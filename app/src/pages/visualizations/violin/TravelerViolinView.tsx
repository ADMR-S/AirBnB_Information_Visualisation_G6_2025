// @ts-ignore
import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore - d3 types not installed
import * as d3 from 'd3';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import '../VisualizationPage.css';

export default function TravelerViolinView() {
  const { isLoading } = useFilterStore();
  const filteredData = useFilteredData();

  const svgRefOverview = useRef<SVGSVGElement | null>(null);
  const svgRefCity = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const [selectedRoomType, setSelectedRoomType] = useState<string | null>(null);
  const [budget, setBudget] = useState<number>(150); // default user budget

  // Reset zoom when global filters change
  useEffect(() => {
    setSelectedRoomType(null);
  }, [filteredData]);

  // Utility to compute summary stats
  function computeStats(data: { price: number }[]) {
    if (!data.length) return null;
    const prices = data.map(d => d.price).sort((a, b) => a - b);
    const count = data.length;
    const min = d3.min(prices)!;
    const max = d3.max(prices)!;
    const mean = d3.mean(prices)!;
    const median = d3.median(prices)!;
    const underBudget = (prices.filter(p => p <= budget).length / count) * 100;
    return { count, min, max, mean, median, underBudget };
  }

  // === 1️⃣ OVERVIEW: Price per Room Type ===
  useEffect(() => {
    if (!svgRefOverview.current) return;
    const svgEl = svgRefOverview.current;
    const tooltip = d3.select(tooltipRef.current);

    const margin = { top: 40, right: 30, bottom: 60, left: 70 };
    const width = 800 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    d3.select(svgEl).selectAll('*').remove();
    const svg = d3.select(svgEl)
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const data = filteredData
      .filter(d => d.price && d.price > 0 && d.price < 2000)
      .map(d => ({
        room_type: d.room_type,
        city: d.city,
        price: d.price,
        log_price: Math.log10(d.price),
      }));

    if (!data.length) return;

    const groups = Array.from(new Set(data.map(d => d.room_type)));
    const x = d3.scaleBand().domain(groups).range([0, width]).padding(0.1);
    const y = d3.scaleLinear()
      .domain([Math.log10(10), Math.log10(d3.max(data, d => d.price) as number)])
      .nice().range([height, 0]);

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y).tickFormat(d => Math.pow(10, d as number).toFixed(0)));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text('Distribution des prix par type de logement');

    // Budget line
    svg.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', y(Math.log10(budget)))
      .attr('y2', y(Math.log10(budget)))
      .attr('stroke', '#0EA5E9')
      .attr('stroke-dasharray', '4 2')
      .attr('stroke-width', 1.5);

    svg.append('text')
      .attr('x', width - 10)
      .attr('y', y(Math.log10(budget)) - 6)
      .attr('text-anchor', 'end')
      .style('fill', '#0EA5E9')
      .style('font-size', '12px')
      .text(`Budget: $${budget}`);

    const kde = kernelDensityEstimator(kernelEpanechnikov(0.15), y.ticks(40));
    const bandwidth = x.bandwidth();

    groups.forEach(group => {
      const subset = data.filter(d => d.room_type === group);
      const values = subset.map(d => d.log_price);
      if (values.length < 2) return;

      const density = kde(values);
      const stats = computeStats(subset);
      if (!stats) return;

      const maxDens = d3.max(density, d => d[1]) || 1;
      const scaleX = d3.scaleLinear().domain([0, maxDens]).range([0, bandwidth / 2]);
      const area = d3.area<[number, number]>()
        .x0(d => -scaleX(d[1]))
        .x1(d => scaleX(d[1]))
        .y(d => y(d[0]))
        .curve(d3.curveCatmullRom);

      const isAffordable = stats.median <= budget;
      const g = svg.append('g').attr('transform', `translate(${x(group)! + bandwidth / 2},0)`);

      g.append('path')
        .datum(density)
        .attr('fill', isAffordable ? '#86efac' : '#fca5a5')
        .attr('stroke', '#333')
        .attr('opacity', 0.85)
        .attr('d', area as any)
        .style('cursor', 'pointer')
        .on('click', () => setSelectedRoomType(group))
        .on('mouseover', _ => {
          tooltip.style('opacity', 1)
            .html(`
              <strong>${group}</strong><br/>
              Listings: ${stats.count}<br/>
              Min: $${stats.min.toFixed(0)}<br/>
              Median: $${stats.median.toFixed(0)}<br/>
              Mean: $${stats.mean.toFixed(0)}<br/>
              Max: $${stats.max.toFixed(0)}<br/>
              Under budget ($${budget}): ${stats.underBudget.toFixed(1)}%
            `);
        })
        .on('mousemove', (event: MouseEvent) => {
          const container = (svgRefOverview.current?.closest('.viz-container') as HTMLElement) || document.body;
          const rect = container.getBoundingClientRect();
          tooltip
            .style('left', `${event.clientX - rect.left + 10}px`)
            .style('top', `${event.clientY - rect.top - 20}px`);
        })
        .on('mouseout', () => tooltip.style('opacity', 0));

      const median = d3.median(values);
      g.append('line')
        .attr('x1', -bandwidth / 4)
        .attr('x2', bandwidth / 4)
        .attr('y1', y(median!))
        .attr('y2', y(median!))
        .attr('stroke', 'black')
        .attr('stroke-width', 2);
    });
  }, [filteredData, budget]);

  // === 2️⃣ ZOOM: Price per City (for selected room type) ===
  useEffect(() => {
    if (!svgRefCity.current || !selectedRoomType) return;
    const svgEl = svgRefCity.current;
    const tooltip = d3.select(tooltipRef.current);

    const margin = { top: 40, right: 30, bottom: 60, left: 70 };
    const width = 800 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    d3.select(svgEl).selectAll('*').remove();
    const svg = d3.select(svgEl)
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const data = filteredData
      .filter(d => d.price > 0 && d.price < 2000 && d.room_type === selectedRoomType)
      .map(d => ({
        city: d.city,
        price: d.price,
        log_price: Math.log10(d.price),
      }));

    if (!data.length) return;

    const topCities = d3.rollups(data, v => v.length, d => d.city)
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, 10)
      .map(d => d[0]);

    const filtered = data.filter(d => topCities.includes(d.city));
    const x = d3.scaleBand().domain(topCities).range([0, width]).padding(0.1);
    const y = d3.scaleLinear()
      .domain([Math.log10(10), Math.log10(d3.max(filtered, d => d.price) as number)])
      .nice().range([height, 0]);

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d => String(d).slice(0, 10)));
    svg.append('g').call(d3.axisLeft(y).tickFormat(d => Math.pow(10, d as number).toFixed(0)));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text(`Top 10 villes — ${selectedRoomType}`);

    // Budget line
    svg.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', y(Math.log10(budget)))
      .attr('y2', y(Math.log10(budget)))
      .attr('stroke', '#0EA5E9')
      .attr('stroke-dasharray', '4 2')
      .attr('stroke-width', 1.5);

    svg.append('text')
      .attr('x', width - 10)
      .attr('y', y(Math.log10(budget)) - 6)
      .attr('text-anchor', 'end')
      .style('fill', '#0EA5E9')
      .style('font-size', '12px')
      .text(`Budget: $${budget}`);

    const kde = kernelDensityEstimator(kernelEpanechnikov(0.15), y.ticks(40));
    const bandwidth = x.bandwidth();

    topCities.forEach(city => {
      const subset = filtered.filter(d => d.city === city);
      const values = subset.map(d => d.log_price);
      if (values.length < 2) return;

      const density = kde(values);
      const stats = computeStats(subset);
      if (!stats) return;

      const isAffordable = stats.median <= budget;
      const maxDens = d3.max(density, d => d[1]) || 1;
      const scaleX = d3.scaleLinear().domain([0, maxDens]).range([0, bandwidth / 2]);
      const area = d3.area<[number, number]>()
        .x0(d => -scaleX(d[1]))
        .x1(d => scaleX(d[1]))
        .y(d => y(d[0]))
        .curve(d3.curveCatmullRom);

      const g = svg.append('g').attr('transform', `translate(${x(city)! + bandwidth / 2},0)`);

      g.append('path')
        .datum(density)
        .attr('fill', isAffordable ? '#86efac' : '#fca5a5')
        .attr('stroke', '#333')
        .attr('opacity', 0.85)
        .attr('d', area as any)
        .on('mouseover', _ => {
          tooltip.style('opacity', 1)
            .html(`
              <strong>${city}</strong><br/>
              Listings: ${stats.count}<br/>
              Min: $${stats.min.toFixed(0)}<br/>
              Median: $${stats.median.toFixed(0)}<br/>
              Mean: $${stats.mean.toFixed(0)}<br/>
              Max: $${stats.max.toFixed(0)}<br/>
              Under budget ($${budget}): ${stats.underBudget.toFixed(1)}%
            `);
        })
        .on('mousemove', (event: MouseEvent) => {
          const container = (svgRefCity.current?.closest('.viz-container') as HTMLElement) || document.body;
          const rect = container.getBoundingClientRect();
          tooltip
            .style('left', `${event.clientX - rect.left + 10}px`)
            .style('top', `${event.clientY - rect.top - 20}px`);
        })
        .on('mouseout', () => tooltip.style('opacity', 0));
    });
  }, [selectedRoomType, filteredData, budget]);

  if (isLoading)
    return <div className="viz-container loading">Loading data...</div>;

  return (
    <div className="viz-container" style={{ position: 'relative' }}>
      <h2>Traveler View — Budget Explorer</h2>
      <p className="viz-description">
        Compare prices per type &amp; city to find affordable listings.
      </p>

      {/* Budget control */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontWeight: 'bold' }}>Budget: ${budget}</label>
        <input
          type="range"
          min={20}
          max={500}
          step={10}
          value={budget}
          onChange={e => setBudget(+e.target.value)}
          style={{ width: '300px', marginLeft: '10px' }}
        />
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px', marginTop: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '14px', height: '14px', backgroundColor: '#86efac', border: '1px solid #999' }}></div>
        <span style={{ fontSize: '13px', color: '#333' }}>Médiane &lt; Budget (Abordable)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '14px', height: '14px', backgroundColor: '#fca5a5', border: '1px solid #999' }}></div>
        <span style={{ fontSize: '13px', color: '#333' }}>Médiane &gt; Budget (Cher)</span>
      </div>
    </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '8px 12px',
          borderRadius: 6,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          border: '1px solid rgba(0,0,0,0.15)',
          fontSize: 13,
          lineHeight: 1.4,
          opacity: 0,
          color: '#333',
          zIndex: 10,
        }}
      ></div>

      {/* Overview */}
      <div style={{ display: 'block' }}>
        <svg ref={svgRefOverview} style={{ width: '100%', maxWidth: 900, height: 420 }} />
      </div>

      {/* City detail */}
      <div
        style={{
          display: selectedRoomType ? 'block' : 'none',
          marginTop: 50,
          transition: 'opacity 0.3s ease',
          opacity: selectedRoomType ? 1 : 0,
        }}
      >
        
        <svg ref={svgRefCity} style={{ width: '100%', maxWidth: 900, height: 420 }} />
      </div>
    </div>
  );
}

// === KDE HELPERS ===
function kernelDensityEstimator(kernel: (v: number) => number, X: number[]) {
  return function (V: number[]) {
    return X.map(x => [x, d3.mean(V, v => kernel(x - v)) as number]);
  };
}
function kernelEpanechnikov(k: number) {
  return (v: number) => (Math.abs((v /= k)) <= 1 ? 0.75 * (1 - v * v) / k : 0);
}
