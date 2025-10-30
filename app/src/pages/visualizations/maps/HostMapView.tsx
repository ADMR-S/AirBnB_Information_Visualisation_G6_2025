import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import '../VisualizationPage.css';

export default function HostMapView() {
  const { isLoading } = useFilterStore();
  const filteredData = useFilteredData();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 960;
    const height = 600;

    const formatNumber = d3.format(",.0f");

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Note: D3 v7 doesn't have d3.geo.path(), it's now d3.geoPath()
    // Since projection is null in original, we'll use geoAlbersUsa which is standard for US maps
    const path = d3.geoPath().projection(null);

    const radius = d3.scaleSqrt()
      .domain([0, 1e6])
      .range([0, 15]);

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - 50}, ${height - 20})`)
      .selectAll("g")
      .data([1e6, 5e6, 1e7])
      .enter().append("g");

    legend.append("circle")
      .attr("cy", (d) => -radius(d))
      .attr("r", radius);

    legend.append("text")
      .attr("y", (d) => -2 * radius(d))
      .attr("dy", "1.3em")
      .text(d3.format(".1s"));

    // Load us.json
    d3.json('/src/pages/visualizations/maps/baseMap/us.json')
      .then((us: any) => {
        if (!us) return;

        svg.append("path")
          .datum(topojson.feature(us, us.objects.nation))
          .attr("class", "land")
          .attr("d", path);

        svg.append("path")
          .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
          .attr("class", "border border--state")
          .attr("d", path);

        const counties = topojson.feature(us, us.objects.counties) as any;
        
        svg.append("g")
          .attr("class", "bubble")
          .selectAll("circle")
          .data(counties.features
            .sort((a: any, b: any) => b.properties.population - a.properties.population))
          .enter().append("circle")
          .attr("transform", (d: any) => {
            const centroid = path.centroid(d);
            return `translate(${centroid})`;
          })
          .attr("r", (d: any) => radius(d.properties.population))
          .append("title")
          .text((d: any) => {
            return d.properties.name + "\nPopulation " + formatNumber(d.properties.population);
          });
      })
      .catch(error => {
        console.error('Error loading map:', error);
      });

  }, []);

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  return (
    <div className="viz-container">
      <style>{`
        .land {
          fill: #ddd;
        }
        .border {
          fill: none;
          stroke: #fff;
          stroke-linejoin: round;
          stroke-linecap: round;
        }
        .bubble {
          fill: brown;
          fill-opacity: .5;
          stroke: #fff;
          stroke-width: .5px;
        }
        .bubble circle:hover {
          stroke: #000;
        }
        .legend circle {
          fill: none;
          stroke: #ccc;
        }
        .legend text {
          fill: #777;
          font: 10px sans-serif;
          text-anchor: middle;
        }
      `}</style>
      <h2>Market Coverage Map</h2>
      <p className="viz-description">
        Geographic distribution of your properties ({filteredData.length.toLocaleString()} listings)
      </p>
      <div ref={containerRef} style={{ width: '100%', minHeight: '600px' }}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
}

