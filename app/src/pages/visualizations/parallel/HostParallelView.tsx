//@ts-ignore
import React, { useEffect, useRef, useMemo, useState } from 'react';
// @ts-ignore - d3 types are not installed in project (dev-dependency) — treat as any
import * as d3 from 'd3';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import type { AirbnbListing } from '../../../types/airbnb.types';
import '../VisualizationPage.css';
import './parallel.css';
import { setupCanvas, clearBackingStore, computeTicks } from './parallelCommon';

export default function HostParallelView() {
  const { isLoading, roomTypes: activeRoomTypes, setRoomTypes } = useFilterStore();
  const filteredData = useFilteredData();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement | null>(null); // Separate canvas for selection

  // toggle affichage complet vs échantillon
  const [renderAll, setRenderAll] = useState(false);
  
  // toggle agrégation
  const [useAggregation, setUseAggregation] = useState(false);
  
  // Filtre par host_name ou host_id
  const [hostFilter, setHostFilter] = useState('');
  
  // Tri du tableau
  const [sortColumn, setSortColumn] = useState<keyof AirbnbListing | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  
  // Ligne sélectionnée depuis le tableau
  const [selectedListing, setSelectedListing] = useState<AirbnbListing | null>(null);

  // Handle column sort - cycle through null -> asc -> desc -> null
  const handleSort = (column: keyof AirbnbListing) => {
    if (sortColumn !== column) {
      // New column - start with ascending
      setSortColumn(column);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      // Same column, was ascending - switch to descending
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      // Same column, was descending - reset to neutral
      setSortColumn(null);
      setSortDirection(null);
    }
  };

  // dimensions utilisées (fixes ici)
  const dimensions: { key: keyof AirbnbListing; label: string }[] = [
    { key: 'price', label: 'Price' },
    { key: 'number_of_reviews', label: 'Reviews' },
    { key: 'reviews_per_month', label: 'Reviews/mo' },
    { key: 'availability_365', label: 'Availability' },
    { key: 'minimum_nights', label: 'Min nights' },
    { key: 'calculated_host_listings_count', label: 'Host listings' },
  ];

  // dispos room types (utile pour la légende + couleurs du redraw)
  const availRoomTypes = useMemo(
    () => Array.from(new Set(filteredData.map(d => d.room_type))).sort(),
    [filteredData]
  );

  // Données filtrées par host_name ou host_id (si un filtre est actif)
  const dataFilteredByHost = useMemo(() => {
    if (!hostFilter.trim()) return filteredData;
    const searchTerm = hostFilter.toLowerCase().trim();
    return filteredData.filter(d => 
      d.host_name?.toLowerCase().includes(searchTerm) ||
      d.host_id?.toLowerCase().includes(searchTerm)
    );
  }, [filteredData, hostFilter]);

  // Memoize samples to prevent resampling on selection change
  const sampledData = useMemo(() => {
    const data: AirbnbListing[] = dataFilteredByHost;
    const TARGET = Math.min(10000, Math.max(2000, Math.round(data.length * 0.05))); // Limited to 10,000
    const groups = d3.group(data, (d: AirbnbListing) => d.room_type) as Map<string, AirbnbListing[]>;
    const samples: AirbnbListing[] = [];
    const total = data.length;
    availRoomTypes.forEach((rt) => {
      const group = groups.get(rt) || [];
      const proportion = group.length / Math.max(1, total);
      const k = Math.max(5, Math.round(proportion * TARGET));
      const shuffled = d3.shuffle(group.slice()) as AirbnbListing[];
      for (let i = 0; i < Math.min(k, shuffled.length); i++) samples.push(shuffled[i]);
    });
    return samples;
  }, [dataFilteredByHost, availRoomTypes]); // Only resample when data or room types change, NOT on selection

  // Sort and limit data for table display (top 100 rows)
  const sortedTableData = useMemo(() => {
    let data = [...dataFilteredByHost];
    
    if (sortColumn && sortDirection) {
      data.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        // Compare values
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    
    return data.slice(0, 100);
  }, [dataFilteredByHost, sortColumn, sortDirection]);

  // ---- REFS PERSISTANTS (créés une seule fois) ----
  const setupRef = useRef<{
    margin: { top: number; right: number; bottom: number; left: number };
    width: number;
    height: number;
    x: d3.ScalePoint<string>;
    yScales: Record<string, d3.ScaleLinear<number, number>>;
    ctx: CanvasRenderingContext2D | null;
    svg: d3.Selection<SVGGElement, unknown, null, undefined>;
    axis: d3.Selection<SVGGElement, { key: keyof AirbnbListing; label: string }, SVGGElement, unknown>;
    dimensions: Array<{ key: keyof AirbnbListing; label: string }>;
    computeYScales: (data: AirbnbListing[]) => Record<string, d3.ScaleLinear<number, number>>;
  } | null>(null);

  // ---------- 1) SETUP — axes + scales + canvas (UNE FOIS) ----------
  useEffect(() => {
    if (!svgRef.current || !canvasRef.current) return;

    const svgEl = svgRef.current;
    const canvasEl = canvasRef.current;

    // mesures + marges
    const margin = { top: 30, right: 40, bottom: 20, left: 40 };
    const width = Math.max(600, svgEl.clientWidth) - margin.left - margin.right;
    const height = 360 - margin.top - margin.bottom;

    // conteneur svg
    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .html('') // clear une seule fois au mount
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // x scale (stable)
    const x = d3.scalePoint<string>().domain(dimensions.map(d => String(d.key))).range([0, width]);

    // fonction pour calculer les échelles Y basées sur les données actuelles
    const computeYScales = (data: AirbnbListing[]) => {
      const scales: Record<string, d3.ScaleLinear<number, number>> = {} as any;
      dimensions.forEach((dim) => {
        // collect finite numeric values only
        const values = data.map(d => Number(d[dim.key] ?? 0)).filter(v => Number.isFinite(v));
        let extent = d3.extent(values) as [number, number];

        // sanitize extent
        if (extent[0] == null || !Number.isFinite(extent[0])) extent[0] = 0;
        if (extent[1] == null || !Number.isFinite(extent[1])) extent[1] = extent[0] || 0;
        if (extent[0] === extent[1]) {
          // ensure a non-zero span
          if (extent[0] === 0) extent[1] = 1;
          else extent[0] = 0;
        }

        // For availability_365 we want a fixed domain [0, 365] (business constraint)
        if (dim.key === 'availability_365') {
          scales[dim.key] = d3.scaleLinear().domain([0, 365]).range([height, 0]);
        } else {
          scales[dim.key] = d3.scaleLinear().domain(extent).range([height, 0]).nice();
        }
      });
      return scales;
    };

    // scales initiales basées sur les données filtrées
    const yScales = computeYScales(filteredData);

    // axes (ne seront PAS recréés)
    const axis = svg
      .selectAll<SVGGElement, { key: keyof AirbnbListing; label: string }>('.dimension')
      .data(dimensions)
      .enter()
      .append('g')
      .attr('class', 'dimension')
      .attr('transform', (d: { key: keyof AirbnbListing; label: string }) => `translate(${x(String(d.key))},0)`);

    axis.append('g').each(function (this: SVGGElement, d: { key: keyof AirbnbListing; label: string }) {
      const scale = yScales[d.key];
      if (d.key === 'availability_365') {
        // ensure ticks don't exceed 365: compute ticks in [0,365]
        const ticks = computeTicks(0, 365, 5);
        d3.select(this).call(d3.axisLeft(scale).tickValues(ticks) as any);
      } else {
        d3.select(this).call(d3.axisLeft(scale).ticks(5) as any);
      }
    });

    axis
      .append('text')
      .attr('y', -9)
      .attr('text-anchor', 'middle')
      .text((d: { key: keyof AirbnbListing; label: string }) => d.label)
      .style('font-size', '12px');

  // canvas (taille + contexte) — centralized helper
  const totalWidth = width + margin.left + margin.right;
  const totalHeight = height + margin.top + margin.bottom;
  const { ctx } = setupCanvas(canvasEl, totalWidth, totalHeight);
  if (!ctx) return;

    // stocker le setup pour les redraws
    setupRef.current = { 
      margin, 
      width, 
      height, 
      x, 
      yScales, 
      ctx, 
      svg, 
      axis, 
      dimensions, 
      computeYScales 
    };

    // cleanup à l'unmount uniquement
    return () => {
      ctx.restore();
      d3.select(svgEl).html('');
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ⬅️ une seule fois

  // ---------- 2) DRAW — clear canvas + (re)dessin des lignes ----------
  useEffect(() => {
    const setup = setupRef.current;
    if (!setup || !canvasRef.current) return;

    const { margin, x, ctx, axis, dimensions, computeYScales } = setup;
    if (!ctx) return;

    // Recalculer les échelles Y basées sur les données filtrées actuelles
    const dataForScales = renderAll ? dataFilteredByHost : sampledData;
    const yScales = computeYScales(dataForScales);
    
    // Mettre à jour les axes avec les nouvelles échelles
    axis.each(function (this: SVGGElement, dim: { key: keyof AirbnbListing; label: string }) {
      const scale = yScales[dim.key];
      const axisGroup = d3.select(this).select('g');
      if (!axisGroup.empty()) {
        axisGroup.call(d3.axisLeft(scale).ticks(5) as any);
      }
    });

    // couleurs par room type (peut changer avec les filtres)
    const colors =
      availRoomTypes.length <= 10
        ? (d3.schemeTableau10 as string[]).slice(0, availRoomTypes.length)
        : availRoomTypes.map((_, i) => d3.interpolateRainbow(i / availRoomTypes.length));
    const colorBy = d3.scaleOrdinal<string, string>().domain(availRoomTypes).range(colors as string[]);

    // clear canvas (PAS de reset svg/axes)
    const canvasEl = canvasRef.current;

  // clear full backing store regardless of current transform
  clearBackingStore(ctx, canvasEl);

    // 2) on remet un état "propre" de peinture (au cas où)
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // source des lignes en fonction des room types actifs + renderAll
    const data: AirbnbListing[] = dataFilteredByHost;
    const sourceLines = renderAll
      ? (activeRoomTypes && activeRoomTypes.length > 0 ? data.filter(d => activeRoomTypes.includes(d.room_type)) : data)
      : (activeRoomTypes && activeRoomTypes.length > 0 ? sampledData.filter(d => activeRoomTypes.includes(d.room_type)) : sampledData);

    // Use aggregation based on user toggle
    const needsAggregation = useAggregation;
    
    // Aggregation: group lines by discretized coordinates and count frequency
    let linesToDraw: Array<{ data: AirbnbListing; count: number }> = [];
    
    if (needsAggregation) {
      // Create a map to aggregate similar lines
      const lineMap = new Map<string, { data: AirbnbListing; count: number }>();
      
      sourceLines.forEach(d => {
        // Create a key based on binned values for each dimension (20 bins per dimension)
        const key = dimensions.map(dim => {
          const value = Number(d[dim.key] ?? 0);
          const scale = yScales[dim.key];
          const yPos = scale(value);
          // Bin into 20 segments along the y-axis
          const bin = Math.floor((yPos / setup.height) * 20);
          return `${dim.key}:${bin}`;
        }).join('|');
        
        if (lineMap.has(key)) {
          lineMap.get(key)!.count++;
        } else {
          lineMap.set(key, { data: d, count: 1 });
        }
      });
      
      linesToDraw = Array.from(lineMap.values());
    } else {
      linesToDraw = sourceLines.map(d => ({ data: d, count: 1 }));
    }

    // dessin batched
    const chunkSize = 1500;
    let rafId: number | null = null;

    // Calculate max count for opacity scaling when aggregating
    const maxCount = needsAggregation ? Math.max(...linesToDraw.map(l => l.count)) : 1;

    const drawLine = (d: AirbnbListing, count: number = 1, isSelected = false) => {
      ctx.beginPath();
      dimensions.forEach((p, i) => {
        const xPos = margin.left + (x(String(p.key)) ?? 0);
        const yPos = margin.top + yScales[p.key](Number(d[p.key] ?? 0));
        if (i === 0) ctx.moveTo(xPos, yPos);
        else ctx.lineTo(xPos, yPos);
      });
      
      if (isSelected) {
        ctx.strokeStyle = '#FFD700'; // Gold/yellow color
        ctx.globalAlpha = 1;
        ctx.lineWidth = 4.5; // Thicker line for selection
      } else {
        ctx.strokeStyle = colorBy(d.room_type) as string;
        // Opacity based on count when aggregating
        if (needsAggregation) {
          // Scale opacity from 0.2 to 0.9 based on count
          const opacity = 0.2 + (count / maxCount) * 0.7;
          ctx.globalAlpha = opacity;
          // Also vary line width slightly based on frequency
          ctx.lineWidth = 1.2 + (count / maxCount) * 1.5;
        } else {
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 1.2;
        }
      }
      ctx.stroke();
    };

    const renderBatched = (lines: Array<{ data: AirbnbListing; count: number }>) => {
      let i = 0;
      const step = () => {
        const end = Math.min(i + chunkSize, lines.length);
        for (let j = i; j < end; j++) {
          drawLine(lines[j].data, lines[j].count, false); // Draw all lines normally, selection will be drawn separately
        }
        i = end;
        if (i < lines.length) {
          rafId = requestAnimationFrame(step);
        }
      };
      step();
    };

    renderBatched(linesToDraw);

    // cleanup du RAF uniquement (on NE vide PAS le svg)
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [dataFilteredByHost, availRoomTypes, activeRoomTypes, renderAll, sampledData, useAggregation]); // Added useAggregation

  // ---------- 3) DRAW SELECTED LINE on top (without full redraw) ----------
  useEffect(() => {
    const setup = setupRef.current;
    const selCanvas = selectionCanvasRef.current;
    if (!setup || !selCanvas) return;

    const { margin, x, yScales } = setup;
    
    // Setup selection canvas with same dimensions as main canvas
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    
    const { ctx: selCtx } = setupCanvas(selCanvas, canvasEl.clientWidth, canvasEl.clientHeight);
    if (!selCtx) return;
    
    // Clear the selection canvas
    clearBackingStore(selCtx, selCanvas);
    
    // Draw the selected line on the selection canvas only
    if (selectedListing) {
      selCtx.save();
      selCtx.beginPath();
      dimensions.forEach((p, i) => {
        const xPos = margin.left + (x(String(p.key)) ?? 0);
        const yPos = margin.top + yScales[p.key](Number(selectedListing[p.key] ?? 0));
        if (i === 0) selCtx.moveTo(xPos, yPos);
        else selCtx.lineTo(xPos, yPos);
      });
      selCtx.strokeStyle = '#FFD700'; // Gold/yellow color
      selCtx.globalAlpha = 1;
      selCtx.lineWidth = 4.5; // Thicker line for selection
      selCtx.stroke();
      selCtx.restore();
    }
  }, [selectedListing, dimensions]); // Only when selection changes

  // --- Stats (inchangées) ---
  const filteredByRoom = (activeRoomTypes && activeRoomTypes.length > 0)
    ? dataFilteredByHost.filter(d => activeRoomTypes.includes(d.room_type))
    : dataFilteredByHost;

  // Check if aggregation would be used
  const data: AirbnbListing[] = dataFilteredByHost;
  const sourceLines = renderAll
    ? (activeRoomTypes && activeRoomTypes.length > 0 ? data.filter(d => activeRoomTypes.includes(d.room_type)) : data)
    : (activeRoomTypes && activeRoomTypes.length > 0 ? sampledData.filter(d => activeRoomTypes.includes(d.room_type)) : sampledData);
  const isAggregated = useAggregation;

  const statsFor = (arr: number[]) => {
    if (!arr || arr.length === 0) return { count: 0, mean: NaN, median: NaN, std: NaN, min: NaN, max: NaN };
    const count = arr.length;
    const mean = arr.reduce((s, v) => s + v, 0) / count;
    const sorted = arr.slice().sort((a, b) => a - b);
    const median = (sorted[Math.floor((count - 1) / 2)] + sorted[Math.ceil((count - 1) / 2)]) / 2;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / count;
    const std = Math.sqrt(variance);
    return { count, mean, median, std, min, max };
  };

  const metricStats = dimensions.map((dim) => {
    const vals = filteredByRoom.map(d => Number(d[dim.key] ?? 0)).filter(v => !Number.isNaN(v));
    return { key: dim.key, label: dim.label, stats: statsFor(vals) };
  });

  const roomCounts = new Map<string, number>();
  filteredByRoom.forEach(d => roomCounts.set(d.room_type, (roomCounts.get(d.room_type) || 0) + 1));
  //@ts-ignore
  const roomCountsArr = Array.from(roomCounts.entries()).sort((a, b) => b[1] - a[1]);
    //@ts-ignore
  const totalShown = filteredByRoom.length;
  const sampleEstimate = Math.min(12000, Math.max(2000, Math.round(filteredByRoom.length * 0.05)));

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  return (
    <div className="viz-container">
      <h2>Performance Comparison</h2>
      <p className="viz-description">
        Compare metrics across listings ({filteredData.length.toLocaleString()} properties)
        {hostFilter && ` — Filtered by host: "${hostFilter}" (${dataFilteredByHost.length} results)`}
      </p>

      {/* Filtre par host_name ou host_id */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label htmlFor="host-search" style={{ fontSize: 14, fontWeight: 500 }}>
          Filter by Host Name or ID:
        </label>
        <input
          id="host-search"
          type="text"
          value={hostFilter}
          onChange={(e) => setHostFilter(e.target.value)}
          placeholder="Enter host name or ID..."
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid rgba(0,0,0,0.12)',
            fontSize: 14,
            minWidth: 250,
            outline: 'none',
          }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(0,0,0,0.12)'}
        />
        {hostFilter && (
          <button
            onClick={() => setHostFilter('')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid rgba(0,0,0,0.08)',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
            title="Clear filter"
          >
            Clear
          </button>
        )}
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvasRef} className="parallel-canvas" />
        <canvas ref={selectionCanvasRef} className="parallel-canvas" style={{ pointerEvents: 'none' }} />
        <svg ref={svgRef} className="parallel-svg" aria-label="Parallel coordinates chart" />
      </div>

      {/* Légende / contrôles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button
          onClick={() => setRenderAll(r => !r)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)', background: renderAll ? '#f0f0f0' : '#fff', cursor: 'pointer' }}
          title="Afficher toutes les lignes (peut être lent)"
        >
          {renderAll ? 'Afficher échantillon' : 'Afficher tout'}
        </button>
        <button
          onClick={() => setUseAggregation(a => !a)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)', background: useAggregation ? '#e0f2fe' : '#fff', cursor: 'pointer' }}
          title="Activer l'agrégation pour réduire le nombre de lignes affichées"
        >
          {useAggregation ? '📊 Agrégation ON' : 'Agrégation OFF'}
        </button>
        {renderAll && (
          <div style={{ fontSize: 12, color: '#a33' }}>
            Affichage complet: {dataFilteredByHost.length.toLocaleString()} lignes — peut être lent
          </div>
        )}
        {isAggregated && (
          <div style={{ 
            fontSize: 12, 
            color: '#3b82f6',
            backgroundColor: '#eff6ff',
            padding: '4px 8px',
            borderRadius: 4,
            fontWeight: 500
          }}>
            Opacité = densité ({sourceLines.length.toLocaleString()} lignes à afficher)
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }} aria-hidden={false}>
        {availRoomTypes.map((rt, i) => (
          <button
            key={rt}
            onClick={() => {
              const active = new Set(activeRoomTypes || []);
              if (active.has(rt)) active.delete(rt); else active.add(rt);
              setRoomTypes(Array.from(active));
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}
            aria-pressed={(activeRoomTypes || []).includes(rt)}
          >
            <div style={{ width: 14, height: 14, background: (d3.schemeTableau10 as string[])[i % 10], borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,0.05) inset' }} />
            <div style={{ fontSize: 12 }}>{rt}</div>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ marginTop: 18, padding: 12, borderRadius: 8, background: 'rgba(250,250,250,0.9)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Données affichées — analyse rapide</h3>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>Total (après filtres): <strong>{dataFilteredByHost.length.toLocaleString()}</strong></div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>Échantillon estimé dessiné: <strong>{sampleEstimate.toLocaleString()}</strong></div>

            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  <th style={{ padding: '6px 4px' }}>Métrique</th>
                  <th style={{ padding: '6px 4px' }}>Moy</th>
                  <th style={{ padding: '6px 4px' }}>Med</th>
                  <th style={{ padding: '6px 4px' }}>Écart</th>
                  <th style={{ padding: '6px 4px' }}>Min</th>
                  <th style={{ padding: '6px 4px' }}>Max</th>
                </tr>
              </thead>
              <tbody>
                {metricStats.map(m => (
                  <tr key={String(m.key)}>
                    <td style={{ padding: '6px 4px' }}>{m.label}</td>
                    <td style={{ padding: '6px 4px' }}>{Number.isNaN(m.stats.mean) ? '—' : m.stats.mean.toFixed(1)}</td>
                    <td style={{ padding: '6px 4px' }}>{Number.isNaN(m.stats.median) ? '—' : m.stats.median.toFixed(1)}</td>
                    <td style={{ padding: '6px 4px' }}>{Number.isNaN(m.stats.std) ? '—' : m.stats.std.toFixed(1)}</td>
                    <td style={{ padding: '6px 4px' }}>{Number.isNaN(m.stats.min) ? '—' : m.stats.min.toLocaleString()}</td>
                    <td style={{ padding: '6px 4px' }}>{Number.isNaN(m.stats.max) ? '—' : m.stats.max.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>Répartition par room type</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from(new Map(filteredByRoom.map(d => [d.room_type, 0]))).map(([rt]) => rt) /* placeholder order */ &&
                availRoomTypes.map((rt, i) => {
                  const c = filteredByRoom.filter(d => d.room_type === rt).length;
                  const totalShown = filteredByRoom.length;
                  return (
                    <div key={rt} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 12, height: 12, background: (d3.schemeTableau10 as string[])[i % 10], borderRadius: 2 }} />
                      <div style={{ flex: 1, fontSize: 13 }}>{rt}</div>
                      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>
                        {c.toLocaleString()} ({((c / Math.max(1, totalShown)) * 100).toFixed(1)}%)
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Data Table */}
          <div className="data-table-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>
                Data Table (First {sortedTableData.length} of {dataFilteredByHost.length} rows)
                {selectedListing && <span style={{ color: '#FFD700', marginLeft: '0.5rem', fontWeight: 'bold' }}>● 1 selected</span>}
              </h3>
              {selectedListing && (
                <button
                  onClick={() => setSelectedListing(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Clear Selection
                </button>
              )}
            </div>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
              💡 Click on any row to highlight it in the parallel coordinates chart above
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  {(Object.keys(sortedTableData[0] || {}) as Array<keyof AirbnbListing>).map((column) => (
                    <th
                      key={column}
                      onClick={() => handleSort(column)}
                      style={{
                        backgroundColor: sortColumn === column ? '#f0f0f0' : 'transparent',
                        fontWeight: sortColumn === column ? 'bold' : 'normal',
                      }}
                    >
                      {column}
                      {sortColumn === column && (
                        <span style={{ marginLeft: '0.5rem' }}>
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTableData.map((row, idx) => (
                  <tr 
                    key={idx}
                    onClick={() => setSelectedListing(row)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedListing === row ? '#FFFACD' : 'transparent', // Light yellow background
                    }}
                  >
                    {(Object.keys(row) as Array<keyof AirbnbListing>).map((column) => (
                      <td
                        key={column}
                        title={String(row[column])}
                      >
                        {row[column] != null ? String(row[column]) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
