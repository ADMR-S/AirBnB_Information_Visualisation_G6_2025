// @ts-ignore
import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore - d3 types not installed
import * as d3 from 'd3';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import type { AirbnbListing } from '../../../types/airbnb.types';
import '../VisualizationPage.css';

export default function HostViolinView() {
  const { isLoading } = useFilterStore();
  const filteredData = useFilteredData();

  const svgRefOverview = useRef<SVGSVGElement | null>(null);
  const svgRefState = useRef<SVGSVGElement | null>(null);
  const svgRefCity = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const [selectedRoomType, setSelectedRoomType] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  // Reset zoom levels when global filters change
  useEffect(() => {
    setSelectedRoomType(null);
    setSelectedState(null);
  }, [filteredData]);

  // Utility to compute summary stats
  function computeStats(data: { price: number; host_id?: string }[]) {
    if (!data.length) return null;
    const prices = data.map(d => d.price).sort((a, b) => a - b);
    const count = data.length;
    const hosts = new Set(data.map(d => d.host_id)).size;
    const min = d3.min(prices)!;
    const max = d3.max(prices)!;
    const mean = d3.mean(prices)!;
    const median = d3.median(prices)!;
    const std = Math.sqrt(d3.mean(prices.map(p => (p - mean) ** 2))!);
    return { count, hosts, min, max, mean, median, std };
  }

  // === 1️⃣ OVERVIEW: Room Type ===
  useEffect(() => {
  if (!svgRefOverview.current) return;
  const svgEl = svgRefOverview.current;
  const tooltip = d3.select(tooltipRef.current);

  const margin = { top: 40, right: 30, bottom: 60, left: 70 };
  const width = 800 - margin.left - margin.right;
  const height = 420 - margin.top - margin.bottom;

  // Only clear once when global filters change
  d3.select(svgEl).selectAll('*').remove();

  const svg = d3.select(svgEl)
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const data = filteredData
    .filter(d => d.price && d.price > 0 && d.price < 2000)
    .map(d => ({
      room_type: d.room_type,
      state: d.state,
      host_id: d.host_id,
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
    .text('Distribution des prix par type de logement (log₁₀)');

  const kde = kernelDensityEstimator(kernelEpanechnikov(0.15), y.ticks(40));
  const bandwidth = x.bandwidth();

  groups.forEach(group => {
    const subset = data.filter(d => d.room_type === group);
    const values = subset.map(d => d.log_price);
    if (values.length < 2) return;

    const density = kde(values);
    const maxDens = d3.max(density, d => d[1]) || 1;
    const scaleX = d3.scaleLinear().domain([0, maxDens]).range([0, bandwidth / 2]);
    const area = d3.area<[number, number]>()
      .x0(d => -scaleX(d[1]))
      .x1(d => scaleX(d[1]))
      .y(d => y(d[0]))
      .curve(d3.curveCatmullRom);

    const g = svg.append('g').attr('transform', `translate(${x(group)! + bandwidth / 2},0)`);

    g.append('path')
      .datum(density)
      .attr('fill', selectedRoomType === group ? '#69b3a2' : '#88ccee')
      .attr('stroke', '#333')
      .attr('opacity', 0.8)
      .attr('d', area)
      .style('cursor', 'pointer')
      .on('click', () => {
        setSelectedRoomType(group);
        setSelectedState(null);
      })
      .on('mouseover', event => {
        const stats = computeStats(subset);
        if (!stats) return;
        tooltip.style('opacity', 1).html(`
          <strong>${group}</strong><br/>
          Listings: ${stats.count.toLocaleString()}<br/>
          Hosts: ${stats.hosts.toLocaleString()}<br/>
          Min: $${stats.min.toFixed(0)}<br/>
          Median: $${stats.median.toFixed(0)}<br/>
          Max: $${stats.max.toFixed(0)}<br/>
          Mean: $${stats.mean.toFixed(0)}
        `).style('left', event.pageX + 1 + 'px')
          .style('top', event.pageY - 2 + 'px');
      })
      .on('mousemove', (event: MouseEvent) => {
  const container = (svgRefOverview.current?.closest('.viz-container') as HTMLElement) || document.body;
  positionTooltip(event, tooltip, container);
}).on('mouseout', () => tooltip.style('opacity', 0));
    const median = d3.median(values);
    g.append('line')
      .attr('x1', -bandwidth / 4)
      .attr('x2', bandwidth / 4)
      .attr('y1', y(median!))
      .attr('y2', y(median!))
      .attr('stroke', 'black')
      .attr('stroke-width', 2);
  });

}, [selectedRoomType, filteredData])
  // === 2️⃣ DETAIL: State level ===
  useEffect(() => {
    if (!svgRefState.current || !selectedRoomType) return;
    const svgEl = svgRefState.current;
    const tooltip = d3.select(tooltipRef.current);

    const margin = { top: 40, right: 30, bottom: 60, left: 70 };
    const width = 800 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    d3.select(svgEl).html('');
    const svg = d3.select(svgEl)
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const data = filteredData
      .filter(d => d.price > 0 && d.price < 2000 && d.room_type === selectedRoomType)
      .map(d => ({
        state: d.state,
        city: d.city,
        host_id: d.host_id,
        price: d.price,
        log_price: Math.log10(d.price),
      }));

    if (!data.length) return;

    const topStates = d3.rollups(data, v => v.length, d => d.state)
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, 10)
      .map(d => d[0]);

    const filtered = data.filter(d => topStates.includes(d.state));
    const x = d3.scaleBand().domain(topStates).range([0, width]).padding(0.1);
    const y = d3.scaleLinear()
      .domain([Math.log10(10), Math.log10(d3.max(filtered, d => d.price) as number)])
      .nice().range([height, 0]);

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y).tickFormat(d => Math.pow(10, d as number).toFixed(0)));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text(`Top 10 États — ${selectedRoomType}`);

    const kde = kernelDensityEstimator(kernelEpanechnikov(0.15), y.ticks(40));
    const bandwidth = x.bandwidth();

    topStates.forEach(state => {
      const subset = filtered.filter(d => d.state === state);
      const values = subset.map(d => d.log_price);
      if (values.length < 2) return;

      const density = kde(values);
      const maxDens = d3.max(density, d => d[1]) || 1;
      const scaleX = d3.scaleLinear().domain([0, maxDens]).range([0, bandwidth / 2]);
      const area = d3.area<[number, number]>()
        .x0(d => -scaleX(d[1]))
        .x1(d => scaleX(d[1]))
        .y(d => y(d[0]))
        .curve(d3.curveCatmullRom);

      const g = svg.append('g').attr('transform', `translate(${x(state)! + bandwidth / 2},0)`);

      g.append('path')
        .datum(density)
        .attr('fill', selectedState === state ? '#ffb347' : '#69b3a2')
        .attr('stroke', '#333')
        .attr('opacity', 0.8)
        .attr('d', area)
        .style('cursor', 'pointer')
        .on('click', () => setSelectedState(state))
        .on('mouseover', event => {
          const stats = computeStats(subset);
          if (!stats) return;
          tooltip.style('opacity', 1).html(`
            <strong>${state}</strong><br/>
            Listings: ${stats.count.toLocaleString()}<br/>
            Hosts: ${stats.hosts.toLocaleString()}<br/>
            Min: $${stats.min.toFixed(0)}<br/>
            Median: $${stats.median.toFixed(0)}<br/>
            Max: $${stats.max.toFixed(0)}<br/>
            Mean: $${stats.mean.toFixed(0)}
          `).style('left', event.pageX + 1 + 'px')
            .style('top', event.pageY - 2 + 'px');
        })
        .on('mousemove', (event: MouseEvent) => {
  const container = (svgRefOverview.current?.closest('.viz-container') as HTMLElement) || document.body;
  positionTooltip(event, tooltip, container);
}).on('mouseout', () => tooltip.style('opacity', 0));
      const median = d3.median(values);
      g.append('line')
        .attr('x1', -bandwidth / 4)
        .attr('x2', bandwidth / 4)
        .attr('y1', y(median!))
        .attr('y2', y(median!))
        .attr('stroke', 'black')
        .attr('stroke-width', 2);
    });
  }, [selectedRoomType, filteredData, selectedState]);

  // === 3️⃣ CITY LEVEL ===
  useEffect(() => {
    if (!svgRefCity.current || !selectedRoomType || !selectedState) return;
    const svgEl = svgRefCity.current;
    const tooltip = d3.select(tooltipRef.current);

    const margin = { top: 40, right: 30, bottom: 60, left: 70 };
    const width = 800 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    d3.select(svgEl).html('');
    const svg = d3.select(svgEl)
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const data = filteredData
      .filter(d =>
        d.price > 0 &&
        d.price < 2000 &&
        d.room_type === selectedRoomType &&
        d.state === selectedState
      )
      .map(d => ({
        city: d.city,
        host_id: d.host_id,
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
      .text(`Top 10 Villes — ${selectedState} (${selectedRoomType})`);

    const kde = kernelDensityEstimator(kernelEpanechnikov(0.15), y.ticks(40));
    const bandwidth = x.bandwidth();

    topCities.forEach(city => {
      const subset = filtered.filter(d => d.city === city);
      const values = subset.map(d => d.log_price);
      if (values.length < 2) return;

      const density = kde(values);
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
        .attr('fill', '#ffcc66')
        .attr('stroke', '#333')
        .attr('opacity', 0.85)
        .attr('d', area)
        .on('mouseover', event => {
          const stats = computeStats(subset);
          if (!stats) return;
          tooltip.style('opacity', 1).html(`
            <strong>${city}</strong><br/>
            Listings: ${stats.count.toLocaleString()}<br/>
            Hosts: ${stats.hosts.toLocaleString()}<br/>
            Min: $${stats.min.toFixed(0)}<br/>
            Median: $${stats.median.toFixed(0)}<br/>
            Max: $${stats.max.toFixed(0)}<br/>
            Mean: $${stats.mean.toFixed(0)}
          `).style('left', event.pageX + 1 + 'px')
            .style('top', event.pageY - 2 + 'px');
        })
        .on('mousemove', (event: MouseEvent) => {
  const container = (svgRefOverview.current?.closest('.viz-container') as HTMLElement) || document.body;
  positionTooltip(event, tooltip, container);
}).on('mouseout', () => tooltip.style('opacity', 0));
      const median = d3.median(values);
      g.append('line')
        .attr('x1', -bandwidth / 4)
        .attr('x2', bandwidth / 4)
        .attr('y1', y(median!))
        .attr('y2', y(median!))
        .attr('stroke', 'black')
        .attr('stroke-width', 2);
    });
  }, [selectedState, selectedRoomType, filteredData]);

  if (isLoading)
    return <div className="viz-container loading">Loading data...</div>;

  return (
  <div className="viz-container" style={{ position: 'relative' }}>
    <h2>Price Distribution Analysis (Host View)</h2>
    <p className="viz-description">
      Benchmark des prix par type de logement ({filteredData.length.toLocaleString()} annonces)
    </p>

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

    {/* --- Overview chart (room types) --- */}
    <div style={{ display: 'block' }}>
      <h3 style={{ marginTop: 10 }}>Vue d'ensemble</h3>
      <svg ref={svgRefOverview} style={{ width: '100%', maxWidth: 900, height: 420 }} />
    </div>

    {/* --- State chart (second layer) --- */}
    <div
      style={{
        display: selectedRoomType ? 'block' : 'none',
        marginTop: 50,
        transition: 'opacity 0.3s ease',
        opacity: selectedRoomType ? 1 : 0,
      }}
    >
      <h3>
        Zoom sur le type : <span style={{ color: '#3b82f6' }}>{selectedRoomType || ''}</span>
      </h3>
      <svg ref={svgRefState} style={{ width: '100%', maxWidth: 900, height: 420 }} />
    </div>

    {/* --- City chart (third layer) --- */}
    <div
      style={{
        display: selectedState ? 'block' : 'none',
        marginTop: 50,
        transition: 'opacity 0.3s ease',
        opacity: selectedState ? 1 : 0,
      }}
    >
      <h3>
        Zoom sur :{' '}
        <span style={{ color: '#3b82f6' }}>{selectedRoomType || ''}</span> →{' '}
        <span style={{ color: '#22c55e' }}>{selectedState || ''}</span>
      </h3>
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

function positionTooltip(event: MouseEvent, tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>, containerEl: HTMLElement) {
  const rect = containerEl.getBoundingClientRect();
  tooltip
    .style('left', `${event.clientX - rect.left + 10}px`)
    .style('top',  `${event.clientY - rect.top  - 28}px`);
}


function kernelEpanechnikov(k: number) {
  return (v: number) => (Math.abs((v /= k)) <= 1 ? 0.75 * (1 - v * v) / k : 0);
}
