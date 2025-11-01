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

  // toggle affichage complet vs échantillon
  const [renderAll, setRenderAll] = useState(false);
  
  // Filtre par host_name ou host_id
  const [hostFilter, setHostFilter] = useState('');

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

  // ---- REFS PERSISTANTS (créés une seule fois) ----
  const setupRef = useRef<{
    margin: { top: number; right: number; bottom: number; left: number };
    width: number;
    height: number;
    x: d3.ScalePoint<string>;
    yScales: Record<string, d3.ScaleLinear<number, number>>;
    ctx: CanvasRenderingContext2D | null;
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

    // scales initiales basées sur l'état courant (elles resteront stables ensuite)
    const yScales: Record<string, d3.ScaleLinear<number, number>> = {} as any;
    dimensions.forEach((dim) => {
      // collect finite numeric values only
      const values = filteredData.map(d => Number(d[dim.key] ?? 0)).filter(v => Number.isFinite(v));
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
        yScales[dim.key] = d3.scaleLinear().domain([0, 365]).range([height, 0]);
      } else {
        yScales[dim.key] = d3.scaleLinear().domain(extent).range([height, 0]).nice();
      }
    });
    const x = d3.scalePoint<string>().domain(dimensions.map(d => String(d.key))).range([0, width]);

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
    setupRef.current = { margin, width, height, x, yScales, ctx };

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

    const { margin, x, yScales, ctx } = setup;
    if (!ctx) return;

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


    // sampling stratifié (utilise dataFilteredByHost au lieu de filteredData)
    const data: AirbnbListing[] = dataFilteredByHost;
    const TARGET = Math.min(12000, Math.max(2000, Math.round(data.length * 0.05)));
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

    // source des lignes en fonction des room types actifs + renderAll
    const sourceLines = renderAll
      ? (activeRoomTypes && activeRoomTypes.length > 0 ? data.filter(d => activeRoomTypes.includes(d.room_type)) : data)
      : (activeRoomTypes && activeRoomTypes.length > 0 ? samples.filter(d => activeRoomTypes.includes(d.room_type)) : samples);

    // dessin batched
    const chunkSize = 1500;
    let rafId: number | null = null;

    const drawLine = (d: AirbnbListing) => {
      ctx.beginPath();
      dimensions.forEach((p, i) => {
        const xPos = margin.left + (x(String(p.key)) ?? 0);
        const yPos = margin.top + yScales[p.key](Number(d[p.key] ?? 0));
        if (i === 0) ctx.moveTo(xPos, yPos);
        else ctx.lineTo(xPos, yPos);
      });
      ctx.strokeStyle = colorBy(d.room_type) as string;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    const renderBatched = (lines: AirbnbListing[]) => {
      let i = 0;
      const step = () => {
        const end = Math.min(i + chunkSize, lines.length);
        for (let j = i; j < end; j++) drawLine(lines[j]);
        i = end;
        if (i < lines.length) rafId = requestAnimationFrame(step);
      };
      step();
    };

    renderBatched(sourceLines);

    // cleanup du RAF uniquement (on NE vide PAS le svg)
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [dataFilteredByHost, availRoomTypes, activeRoomTypes, renderAll]); // ⬅️ redraw only

  // --- Stats (inchangées) ---
  const filteredByRoom = (activeRoomTypes && activeRoomTypes.length > 0)
    ? dataFilteredByHost.filter(d => activeRoomTypes.includes(d.room_type))
    : dataFilteredByHost;

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
        {renderAll && (
          <div style={{ fontSize: 12, color: '#a33' }}>
            Affichage complet: {dataFilteredByHost.length.toLocaleString()} lignes — peut être lent
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
        </div>
      </div>
    </div>
  );
}
