import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { kernelEpanechnikov, kernelDensityEstimator } from '../utils/kernel';
import { useFilterStore } from '../stores/useFilterStore';
import './ViolinChart.css'; // optional styling

interface ViolinChartProps {
  dataUrl: string;
  groupBy?: 'room_type' | 'neighbourhood';
}

export default function ViolinChart({ dataUrl, groupBy = 'room_type' }: ViolinChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { states, cities } = useFilterStore(); // ✅ uses the same global filters

  useEffect(() => {
    const margin = { top: 40, right: 30, bottom: 60, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // clear old plot before redraw
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // load + render
    d3.csv(dataUrl, d3.autoType).then((raw) => {
      let data = raw as any[];

      // --- filtering ---
      data = data.filter((d) => d.price > 0 && d.price < 2000 && d.room_type);
      if (cities.length === 1) {
        data = data.filter((d) => d.city === cities[0]);
      } else if (states.length === 1) {
        data = data.filter((d) => d.state === states[0]); // adjust if state column exists
      }

      data.forEach((d) => (d.log_price = Math.log10(d.price)));

      const groups = Array.from(new Set(data.map((d) => d[groupBy])));
      const x = d3.scaleBand().domain(groups).range([0, width]).padding(0.1);
      const y = d3
        .scaleLinear()
        .domain([Math.log10(10), Math.log10(d3.max(data, (d) => d.price) as number)])
        .nice()
        .range([height, 0]);

      // axes
      svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
      svg.append('g').call(d3.axisLeft(y).tickFormat((d) => Math.pow(10, d as number).toFixed(0)));

      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text(`Distribution des prix par ${groupBy}`);

      // kernel density estimation
      const kde = kernelDensityEstimator(kernelEpanechnikov(0.15), y.ticks(40));
      const bandwidth = x.bandwidth();

      groups.forEach((group) => {
        const subset = data.filter((d) => d[groupBy] === group);
        const vals = subset.map((d) => d.log_price);
        const density = kde(vals);
        const maxDens = d3.max(density, (d) => d[1]) || 1;
        const scaleX = d3.scaleLinear().domain([0, maxDens]).range([0, bandwidth / 2]);

        const area = d3
          .area<[number, number]>()
          .x0((d) => -scaleX(d[1]))
          .x1((d) => scaleX(d[1]))
          .y((d) => y(d[0]))
          .curve(d3.curveCatmullRom);

        const g = svg.append('g').attr('transform', `translate(${x(group)! + bandwidth / 2},0)`);

        g.append('path')
          .datum(density)
          .attr('fill', '#69b3a2')
          .attr('stroke', '#333')
          .attr('stroke-width', 0.8)
          .attr('opacity', 0.7)
          .attr('d', area);

        const median = d3.median(vals);
        g.append('line')
          .attr('x1', -bandwidth / 4)
          .attr('x2', bandwidth / 4)
          .attr('y1', y(median!))
          .attr('y2', y(median!))
          .attr('stroke', 'black')
          .attr('stroke-width', 2);
      });
    });
  }, [dataUrl, groupBy, states, cities]);

  return <svg ref={svgRef}></svg>;
}
