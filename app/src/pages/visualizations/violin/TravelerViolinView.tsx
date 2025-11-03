// @ts-ignore
import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore - d3 types not installed
import * as d3 from 'd3';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import type { AirbnbListing } from '../../../types/airbnb.types';
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
    .filter(d => d.price && d.price > 0 && d.price < 2000 && d.availability_365 && d.availability_365 > 0)
    .map(d => ({
      // grouping keys
      room_type: d.room_type,
      city: d.city,

      // values we need for tooltips / representatives
      id: d.id,
      name: d.name,
      host_id: d.host_id,
      host_name: d.host_name,
      availability_365: d.availability_365,
      number_of_reviews: d.number_of_reviews,
      reviews_per_month: d.reviews_per_month,

      // price + derived
      price: d.price,
      log_price: Math.log10(Number(d.price)),
    }));

    if (!data.length) return;

    const groups = Array.from(new Set(data.map(d => d.room_type)));
    const x = d3.scaleBand().domain(groups).range([0, width]).padding(0.1);

    const minPrice = d3.min(data, d => d.price) ?? 1;
    const maxPrice = d3.max(data, d => d.price) ?? 1000;

    const y = d3.scaleLinear()
      .domain([Math.log10(Math.max(1, minPrice)), Math.log10(maxPrice)])
      .nice()
      .range([height, 0]);


    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y).tickFormat(d => Math.pow(10, d as number).toFixed(0)));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text('Price distribution perhousing type');

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
      const g = svg.append('g')
            .attr('class', 'violin')
            .attr('data-group', group)
            .attr('transform', `translate(${x(group)! + bandwidth / 2},0)`);

      g.append('path')
        .datum(density)
        .attr('fill', isAffordable ? '#86efac' : '#fca5a5')
        .attr('data-fill', isAffordable ? '#86efac' : '#fca5a5')        
        .attr('stroke', '#333')
        .attr('opacity', 0.85)
        .attr('d', area)
        .style('cursor', 'pointer')
        .on('click', () => setSelectedRoomType(group))
        .on('mouseover', event => {
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

        // === Representative listings ===
        const validSubset = subset.filter(d => d.availability_365 && d.availability_365 > 0);

        const cheapest = d3.least(validSubset, d => d.price);
        const underBudget = validSubset.filter(d => d.price <= budget);
        const popular = underBudget.length ? d3.greatest(underBudget, d => d.number_of_reviews ?? 0) : null;
        const expensiveUnderBudget = underBudget.length ? d3.greatest(underBudget, d => d.price) : null;

        const reps = [
          { type: 'Cheapest', data: cheapest, color: '#22c55e' },
          { type: 'Most popular', data: popular, color: '#3b82f6' },
          { type: 'Most expensive (under budget)', data: expensiveUnderBudget, color: '#a855f7' },
        ];

        // add representative points
        reps.forEach(rep => {
          if (!rep.data) return;
          const price = rep.data.price;
          const cy = y(Math.log10(price));

          g.append('circle')
            .attr('cx', 0)
            .attr('cy', cy)
            .attr('r', 5)
            .attr('fill', rep.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .on('mouseover', event => {
              tooltip.style('opacity', 1)
                .html(`
                  <strong>${rep.type}</strong><br/>
                  City: ${rep.data.city || '—'}<br/>
                  Host: ${rep.data.host_name || '—'}<br/>
                  Price: $${rep.data.price.toFixed(0)}<br/>
                  Reviews: ${rep.data.number_of_reviews ?? 0}<br/>
                  Availability: ${rep.data.availability_365 ?? 0} days/yr
                `);
            })
            .on('mousemove', (event: MouseEvent) => {
              const container = (svgEl.closest('.viz-container') as HTMLElement) || document.body;
              const rect = container.getBoundingClientRect();
              tooltip
                .style('left', `${event.clientX - rect.left + 10}px`)
                .style('top', `${event.clientY - rect.top - 20}px`);
            })
            .on('mouseout', () => tooltip.style('opacity', 0));
        });



    });
  }, [filteredData, budget]);
  useEffect(() => {
    // Reapply gold color after redraws (e.g., budget changes)
    const svg = d3.select(svgRefOverview.current);
    if (!svg.node()) return;

    svg.selectAll<SVGGElement, unknown>('.violin').each(function () {
      const g = d3.select(this);
      const group = g.attr('data-group');
      const path = g.select<SVGPathElement>('path');

      if (group === selectedRoomType) {
        path.attr('fill', '#ffb347').attr('opacity', 1);
      }
    });
  }, [selectedRoomType, filteredData, budget]); 
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
      .filter(d => d.price > 0 && d.price < 2000 && d.room_type === selectedRoomType && d.availability_365 && d.availability_365 > 0)
      .map(d => ({
        // grouping keys
        city: d.city,

        // values for tooltips / representatives
        id: d.id,
        name: d.name,
        host_id: d.host_id,
        host_name: d.host_name,
        availability_365: d.availability_365,
        number_of_reviews: d.number_of_reviews,
        reviews_per_month: d.reviews_per_month,

        // price + derived
        price: d.price,
        log_price: Math.log10(Number(d.price)),
      }));
    if (!data.length) return;

    const topCities = d3.rollups(data, v => v.length, d => d.city)
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, 10)
      .map(d => d[0]);
    
      const minPrice = d3.min(data, d => d.price) ?? 1;
    const maxPrice = d3.max(data, d => d.price) ?? 1000;

    const filtered = data.filter(d => topCities.includes(d.city));
    const x = d3.scaleBand().domain(topCities).range([0, width]).padding(0.1);
    
    const y = d3.scaleLinear()
      .domain([Math.log10(Math.max(1, minPrice)), Math.log10(maxPrice)])
      .nice()
      .range([height, 0]);  
    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d => String(d).slice(0, 10)));
    svg.append('g').call(d3.axisLeft(y).tickFormat(d => Math.pow(10, d as number).toFixed(0)));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text(`Top 10 Cities — ${selectedRoomType}`);

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
        .attr('d', area)
        .on('mouseover', event => {
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
        // === Representative listings ===
const cheapest = d3.least(subset, d => d.price);
const popular = d3.greatest(subset.filter(d => d.price <= budget), d => d.number_of_reviews);
const expensiveUnderBudget = d3.greatest(subset.filter(d => d.price <= budget), d => d.price);

const reps = [
  { type: 'Cheapest', data: cheapest, color: '#22c55e' },
  { type: 'Most popular', data: popular, color: '#3b82f6' },
  { type: 'Most expensive (under budget)', data: expensiveUnderBudget, color: '#a855f7' },
];

// add representative points
reps.forEach(rep => {
  if (!rep.data) return;
  const price = rep.data.price;
  const cy = y(Math.log10(price));

  g.append('circle')
    .attr('cx', 0)
    .attr('cy', cy)
    .attr('r', 5)
    .attr('fill', rep.color)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .on('mouseover', event => {
      tooltip.style('opacity', 1)
        .html(`
          <strong>${rep.type}</strong><br/>
          City: ${rep.data.city || '—'}<br/>
          Host: ${rep.data.host_name || '—'}<br/>
          Price: $${rep.data.price.toFixed(0)}<br/>
          Reviews: ${rep.data.number_of_reviews ?? 0}<br/>
          Availability: ${rep.data.availability_365 ?? 0} days/yr
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


    });
    
  }, [selectedRoomType, filteredData, budget]);
  // }, [filteredData, budget]);
  useEffect(() => {
  const svg = d3.select(svgRefOverview.current);
  if (!svg.node()) return;

  // set gold on selected, restore others (keeps current opacity)
  svg.selectAll<SVGGElement, unknown>('.violin').each(function () {
    const group = (this as SVGGElement).getAttribute('data-group');
    const path = d3.select(this).select<SVGPathElement>('path');
    if (group === selectedRoomType) {
      path.attr('fill', '#ffb347').attr('opacity', 1);
    } else {
      const fallback = path.attr('data-fill') || path.attr('fill');
      path.attr('fill', fallback).attr('opacity', 0.85);
    }
  });
}, [selectedRoomType]);

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
        <span style={{ fontSize: '13px', color: '#333' }}>Median &lt; Budget (Abordable)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '14px', height: '14px', backgroundColor: '#fca5a5', border: '1px solid #999' }}></div>
        <span style={{ fontSize: '13px', color: '#333' }}>Median &gt; Budget (Cher)</span>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
    <span style={{ fontSize: '13px', color: '#333' }}>Cheapest listing</span>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
    <span style={{ fontSize: '13px', color: '#333' }}>Most popular (under budget)</span>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#a855f7' }}></div>
    <span style={{ fontSize: '13px', color: '#333' }}>Most expensive under budget</span>
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
