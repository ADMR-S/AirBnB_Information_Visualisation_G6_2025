//@ts-ignore
import React, { useEffect, useRef, useMemo, useState } from 'react';
//@ts-ignore
import * as d3 from 'd3';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import type { AirbnbListing } from '../../../types/airbnb.types';
import '../VisualizationPage.css';
import './parallel.css';
import { setupCanvas, clearBackingStore, computeTicks } from './parallelCommon';

const DIMENSIONS: { key: keyof AirbnbListing; label: string }[] = [
  { key: 'price', label: 'Price' },
  { key: 'number_of_reviews', label: 'Reviews' },
  { key: 'reviews_per_month', label: 'Reviews/mo' },
  { key: 'availability_365', label: 'Availability' },
  { key: 'minimum_nights', label: 'Min nights' },
  { key: 'calculated_host_listings_count', label: 'Host listings' },
];

export default function TravelerParallelView() {
  const { isLoading, roomTypes: activeRoomTypes, setRoomTypes } = useFilterStore();
  const filteredData = useFilteredData();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderAll, setRenderAll] = useState(false);
  const [useAggregation, setUseAggregation] = useState(true);
  
  const [sortColumn, setSortColumn] = useState<keyof AirbnbListing | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [selectedListing, setSelectedListing] = useState<AirbnbListing | null>(null);

  const handleSort = (column: keyof AirbnbListing) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortColumn(null);
      setSortDirection(null);
    }
  };

  const availRoomTypes = useMemo(
    () => Array.from(new Set(filteredData.map(d => d.room_type))).sort(),
    [filteredData]
  );

  const sortedTableData = useMemo(() => {
    let data = [...filteredData];
    
    if (sortColumn && sortDirection) {
      data.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
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
  }, [filteredData, sortColumn, sortDirection]);

  const setupRef = useRef<{
    margin: { top: number; right: number; bottom: number; left: number };
    width: number;
    height: number;
    x: d3.ScalePoint<string>;
    yScales: Record<string, d3.ScaleLinear<number, number>>;
    ctx: CanvasRenderingContext2D | null;
    svg: d3.Selection<SVGGElement, unknown, null, undefined>;
    axis: d3.Selection<SVGGElement, { key: keyof AirbnbListing; label: string }, SVGGElement, unknown>;
    DIMENSIONS: Array<{ key: keyof AirbnbListing; label: string }>;
    computeYScales: (data: AirbnbListing[]) => Record<string, d3.ScaleLinear<number, number>>;
  } | null>(null);

  // SETUP — once
  useEffect(() => {
    if (!svgRef.current || !canvasRef.current || filteredData.length === 0) return;

    const svgEl = svgRef.current;
    const canvasEl = canvasRef.current;

    const margin = { top: 30, right: 40, bottom: 20, left: 40 };
    const width = Math.max(600, svgEl.clientWidth) - margin.left - margin.right;
    const height = 360 - margin.top - margin.bottom;

    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .html('')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint<string>().domain(DIMENSIONS.map(d => String(d.key))).range([0, width]);

    const computeYScales = (data: AirbnbListing[]) => {
      const scales: Record<string, d3.ScaleLinear<number, number>> = {} as any;
      DIMENSIONS.forEach((dim) => {
        const values = data.map(d => Number(d[dim.key] ?? 0)).filter(v => Number.isFinite(v));
        let extent = d3.extent(values) as [number, number];

        if (extent[0] == null || !Number.isFinite(extent[0])) extent[0] = 0;
        if (extent[1] == null || !Number.isFinite(extent[1])) extent[1] = extent[0] || 0;
        if (extent[0] === extent[1]) {
          if (extent[0] === 0) extent[1] = 1;
          else extent[0] = 0;
        }

        if (dim.key === 'availability_365') {
          scales[dim.key] = d3.scaleLinear().domain([0, 365]).range([height, 0]);
        } else {
          scales[dim.key] = d3.scaleLinear().domain(extent).range([height, 0]).nice();
        }
      });
      return scales;
    };

    const yScales = computeYScales(filteredData);

    const axis = svg
      .selectAll<SVGGElement, { key: keyof AirbnbListing; label: string }>('.dimension')
      .data(DIMENSIONS)
      .enter()
      .append('g')
      .attr('class', 'dimension')
      .attr('transform', (d: { key: keyof AirbnbListing; label: string }) => `translate(${x(String(d.key))},0)`);

    axis.append('g').each(function (this: SVGGElement, d: { key: keyof AirbnbListing; label: string }) {
      const scale = yScales[d.key];
      if (d.key === 'availability_365') {
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

    const totalWidth = width + margin.left + margin.right;
    const totalHeight = height + margin.top + margin.bottom;
    const { ctx } = setupCanvas(canvasEl, totalWidth, totalHeight);
    if (!ctx) return;

    setupRef.current = { 
      margin, 
      width, 
      height, 
      x, 
      yScales, 
      ctx, 
      svg, 
      axis, 
      DIMENSIONS, 
      computeYScales 
    };

    return () => {
      ctx.restore();
      d3.select(svgEl).html('');
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    };
  }, [filteredData, DIMENSIONS]);

  useEffect(() => {
    const setup = setupRef.current;
    if (!setup || !canvasRef.current) return;

    const { margin, x, ctx, axis, DIMENSIONS, computeYScales } = setup;
    if (!ctx) return;

    const colors =
      availRoomTypes.length <= 10
        ? (d3.schemeTableau10 as string[]).slice(0, availRoomTypes.length)
        : availRoomTypes.map((_, i) => d3.interpolateRainbow(i / availRoomTypes.length));
    const colorBy = d3.scaleOrdinal<string, string>().domain(availRoomTypes).range(colors as string[]);

    const canvasEl = canvasRef.current;
    clearBackingStore(ctx, canvasEl);

    const data: AirbnbListing[] = filteredData;
    const TARGET = Math.min(10000, Math.max(2000, Math.round(data.length * 0.05)));
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

    const dataForScales = renderAll ? data : samples;
    const yScales = computeYScales(dataForScales);
    
    axis.each(function (this: SVGGElement, dim: { key: keyof AirbnbListing; label: string }) {
      const scale = yScales[dim.key];
      const axisGroup = d3.select(this).select('g');
      if (!axisGroup.empty()) {
        axisGroup.call(d3.axisLeft(scale).ticks(5) as any);
      }
    });

    const sourceLines = renderAll
      ? (activeRoomTypes && activeRoomTypes.length > 0 ? data.filter(d => activeRoomTypes.includes(d.room_type)) : data)
      : (activeRoomTypes && activeRoomTypes.length > 0 ? samples.filter(d => activeRoomTypes.includes(d.room_type)) : samples);

    const needsAggregation = useAggregation;
    let linesToDraw: Array<{ data: AirbnbListing; count: number }> = [];
    
    if (needsAggregation) {
      const lineMap = new Map<string, { data: AirbnbListing; count: number }>();
      
      sourceLines.forEach(d => {
        const key = DIMENSIONS.map(dim => {
          const value = Number(d[dim.key] ?? 0);
          const scale = yScales[dim.key];
          const yPos = scale(value);
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

    const chunkSize = 1500;
    let rafId: number | null = null;
    const maxCount = needsAggregation ? Math.max(...linesToDraw.map(l => l.count)) : 1;

    const drawLine = (d: AirbnbListing, count: number = 1) => {
      ctx.beginPath();
      DIMENSIONS.forEach((p, i) => {
        const xPos = margin.left + (x(String(p.key)) ?? 0);
        const yPos = margin.top + yScales[p.key](Number(d[p.key] ?? 0));
        if (i === 0) ctx.moveTo(xPos, yPos);
        else ctx.lineTo(xPos, yPos);
      });
      ctx.strokeStyle = colorBy(d.room_type) as string;
      if (needsAggregation) {
        const opacity = 0.2 + (count / maxCount) * 0.7;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = 1.2 + (count / maxCount) * 1.5;
      } else {
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.2;
      }
      ctx.stroke();
    };

    const renderBatched = (lines: Array<{ data: AirbnbListing; count: number }>) => {
      let i = 0;
      const step = () => {
        const end = Math.min(i + chunkSize, lines.length);
        for (let j = i; j < end; j++) drawLine(lines[j].data, lines[j].count);
        i = end;
        if (i < lines.length) rafId = requestAnimationFrame(step);
      };
      step();
    };

    renderBatched(linesToDraw);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [filteredData, availRoomTypes, activeRoomTypes, renderAll, useAggregation]);

  useEffect(() => {
    const setup = setupRef.current;
    const selCanvas = selectionCanvasRef.current;
    if (!setup || !selCanvas) return;

    const { margin, x, yScales } = setup;
    
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    
    const { ctx: selCtx } = setupCanvas(selCanvas, canvasEl.clientWidth, canvasEl.clientHeight);
    if (!selCtx) return;
    
    clearBackingStore(selCtx, selCanvas);
    
    if (selectedListing) {
      selCtx.save();
      selCtx.beginPath();
      DIMENSIONS.forEach((p, i) => {
        const xPos = margin.left + (x(String(p.key)) ?? 0);
        const yPos = margin.top + yScales[p.key](Number(selectedListing[p.key] ?? 0));
        if (i === 0) selCtx.moveTo(xPos, yPos);
        else selCtx.lineTo(xPos, yPos);
      });
      selCtx.strokeStyle = '#FFD700';
      selCtx.globalAlpha = 1;
      selCtx.lineWidth = 4.5;
      selCtx.stroke();
      selCtx.restore();
    }
  }, [selectedListing, DIMENSIONS]);

  const filteredByRoom = (activeRoomTypes && activeRoomTypes.length > 0)
    ? filteredData.filter(d => activeRoomTypes.includes(d.room_type))
    : filteredData;

  const data: AirbnbListing[] = filteredData;
  const TARGET = Math.min(10000, Math.max(2000, Math.round(data.length * 0.05)));
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
  const sourceLines = renderAll
    ? (activeRoomTypes && activeRoomTypes.length > 0 ? data.filter(d => activeRoomTypes.includes(d.room_type)) : data)
    : (activeRoomTypes && activeRoomTypes.length > 0 ? samples.filter(d => activeRoomTypes.includes(d.room_type)) : samples);
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

  const metricStats = DIMENSIONS.map((dim) => {
    const vals = filteredByRoom.map(d => Number(d[dim.key] ?? 0)).filter(v => !Number.isNaN(v));
    return { key: dim.key, label: dim.label, stats: statsFor(vals) };
  });

  const roomCounts = new Map<string, number>();
  filteredByRoom.forEach(d => roomCounts.set(d.room_type, (roomCounts.get(d.room_type) || 0) + 1));
  const sampleEstimate = Math.min(12000, Math.max(2000, Math.round(filteredByRoom.length * 0.05)));

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  return (
    <div className="viz-container">
      <h2>Listing Comparison Tool</h2>
      <p className="viz-description">Compare properties side-by-side ({filteredData.length.toLocaleString()} options)</p>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvasRef} className="parallel-canvas" />
        <canvas ref={selectionCanvasRef} className="parallel-canvas" style={{ pointerEvents: 'none' }} />
        <svg ref={svgRef} className="parallel-svg" aria-label="Parallel coordinates chart" />
      </div>

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
            Affichage complet: {filteredData.length.toLocaleString()} lignes — peut être lent
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

      <div style={{ marginTop: 18, padding: 12, borderRadius: 8, background: 'rgba(250,250,250,0.9)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Données affichées — analyse rapide</h3>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>Total (après filtres): <strong>{filteredData.length.toLocaleString()}</strong></div>
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
              {availRoomTypes.map((rt, i) => {
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

          <div className="data-table-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>
              Data Table (First {sortedTableData.length} of {filteredData.length} rows)
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
                    backgroundColor: selectedListing === row ? '#FFFACD' : 'transparent', 
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
