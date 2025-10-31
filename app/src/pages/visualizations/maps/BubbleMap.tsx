import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { AirbnbListing, Persona } from '../../../types/airbnb.types';
import '../VisualizationPage.css';

interface BubbleMapProps {
  filteredData: AirbnbListing[];
  persona: Persona;
  isLoading: boolean;
}

interface BubbleData {
  label: string;
  latitude: number;
  longitude: number;
  sizeValue: number;
  colorValue: number;
}

/**
 * Creates bubbles on the map based on specified parameters
 * @param svg - D3 selection of the SVG element
 * @param projection - D3 geo projection to convert lat/long to screen coordinates
 * @param filteredData - The filtered dataset
 * @param sizeParameter - Function to extract size value from aggregated data
 * @param colorParameter - Function to extract color value from aggregated data
 * @param groupingKey - Function to create unique key for grouping data points
 * @param maxSizeValue - Maximum size value for consistent scaling across filters
 * @param sizeRange - Min and max radius for bubbles [min, max]
 */
function makeBubbles(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  projection: d3.GeoProjection,
  filteredData: AirbnbListing[],
  sizeParameter: (listings: AirbnbListing[]) => number,
  colorParameter: (listings: AirbnbListing[]) => number,
  groupingKey: (listing: AirbnbListing) => string,
  maxSizeValue: number,
  sizeRange: [number, number] = [2, 20]
) {
  // Group data by the specified key
  const groupedData = new Map<string, AirbnbListing[]>();
  
  filteredData.forEach(d => {
    const key = groupingKey(d);
    const existing = groupedData.get(key);
    if (existing) {
      existing.push(d);
    } else {
      groupedData.set(key, [d]);
    }
  });

  // Create bubble data
  const bubbles: BubbleData[] = Array.from(groupedData.entries()).map(([key, listings]) => {
    const firstListing = listings[0];
    return {
      label: key,
      latitude: firstListing.latitude,
      longitude: firstListing.longitude,
      sizeValue: sizeParameter(listings),
      colorValue: colorParameter(listings)
    };
  });

  // Create scales
  const radiusScale = d3.scaleSqrt()
    .domain([0, maxSizeValue])
    .range(sizeRange);

  const colorScale = d3.scaleSequential()
    .domain([0, d3.max(bubbles, d => d.colorValue) || 1])
    .interpolator(t => d3.interpolateBlues(0.4 + t * 0.6)); // Range from medium to dark blue

  // Draw bubbles
  svg.append("g")
    .attr("class", "bubble")
    .selectAll("circle")
    .data(bubbles)
    .enter().append("circle")
    .attr("cx", d => {
      const projected = projection([d.longitude, d.latitude]);
      return projected ? projected[0] : 0;
    })
    .attr("cy", d => {
      const projected = projection([d.longitude, d.latitude]);
      return projected ? projected[1] : 0;
    })
    .attr("r", d => radiusScale(d.sizeValue))
    .attr("fill", d => colorScale(d.colorValue))
    .attr("fill-opacity", 0.6)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .append("title")
    .text(d => `${d.label}\nSize: ${d.sizeValue}\nColor: ${d.colorValue.toFixed(2)}`);
}

// Population par county, provient du tutoriel bubblemap d3js. Non utilisé actuellement
//@ts-ignore
function renderPopulationBubbles(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, path: d3.GeoPath, width: number, height: number) {
  const formatNumber = d3.format(",.0f");
  const radius = d3.scaleSqrt()
    .domain([0, 1e6])
    .range([0, 15]);

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

  d3.json('/src/pages/visualizations/maps/baseMap/us.json')
    .then((us: any) => {
      if (!us) return;
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
    });
}

export default function BubbleMap({ filteredData, persona, isLoading }: BubbleMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxCountRef = useRef<number>(0);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || filteredData.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 960;
    const height = 600;

    d3.select(svgRef.current).selectAll('*').remove();

    // us.json has pre-projected coordinates, so use null projection for the map
    const path = d3.geoPath().projection(null);
    
    // Use the EXACT same projection as used to create us.json (from Makefile)
    // --projection='width = 960, height = 600, d3.geo.albersUsa().scale(1280).translate([width / 2, height / 2])'
    const projection = d3.geoAlbersUsa().scale(1280).translate([960 / 2, 600 / 2]);

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Calculate max size value for consistent scaling
    const tempGrouped = new Map<string, number>();
    filteredData.forEach(d => {
      const key = `${d.neighbourhood}-${d.latitude.toFixed(4)}-${d.longitude.toFixed(4)}`;
      tempGrouped.set(key, (tempGrouped.get(key) || 0) + 1);
    });
    const currentMax = Math.max(...Array.from(tempGrouped.values()), 1);
    if (currentMax > maxCountRef.current) {
      maxCountRef.current = currentMax;
    }

    // Load base map
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

        // Draw neighborhood bubbles using makeBubbles function
        makeBubbles(
          svg,
          projection,
          filteredData,
          // Size: count of listings in each neighborhood
          (listings) => listings.length,
          // Color: average price in each neighborhood
          (listings) => d3.mean(listings, d => d.price) || 0,
          // Group by: neighborhood + approximate location
          (listing) => `${listing.neighbourhood}-${listing.latitude.toFixed(4)}-${listing.longitude.toFixed(4)}`,
          maxCountRef.current,
          [2, 20]
        );
      })
      .catch(error => {
        console.error('Error loading map:', error);
      });

  }, [filteredData, persona]);

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  // Persona-specific content
  const title = persona === 'host' ? 'Market Coverage Map' : 'Location Explorer';
  const description = persona === 'host' 
    ? `Geographic distribution of your properties (${filteredData.length.toLocaleString()} listings)`
    : `Find your perfect location (${filteredData.length.toLocaleString()} listings available)`;

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
        .bubble circle {
          cursor: pointer;
        }
        .bubble circle:hover {
          stroke: #000;
          stroke-width: 1.5px;
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
      <h2>{title}</h2>
      <p className="viz-description">{description}</p>
      <div ref={containerRef} style={{ width: '100%', minHeight: '600px' }}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
}
