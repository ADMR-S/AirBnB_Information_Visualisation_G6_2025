import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { AirbnbListing, Persona } from '../../../types/airbnb.types';
import '../VisualizationPage.css';
import './BubbleMap.css';

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

interface NeighborhoodField {
  label: string;
  count: number;
  avgPrice: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  listings: AirbnbListing[];
}

/**
 * Creates bubbles on the map based on specified parameters
 */
//@ts-ignore
function makeBubbles(
  container: d3.Selection<SVGSVGElement | SVGGElement, unknown, null, undefined>,
  projection: d3.GeoProjection,
  bubbleData: BubbleData[],
  maxSizeValue: number,
  sizeRange: [number, number] = [2, 20]
) {
  // Create scales
  const radiusScale = d3.scaleSqrt()
    .domain([0, maxSizeValue])
    .range(sizeRange);

  const colorScale = d3.scaleSequential()
    .domain([0, d3.max(bubbleData, d => d.colorValue) || 1])
    .interpolator(t => d3.interpolateBlues(0.4 + t * 0.6));

  // Pre-project all coordinates for performance
  const projectedBubbles = bubbleData.map(d => {
    const projected = projection([d.longitude, d.latitude]);
    return {
      ...d,
      x: projected ? projected[0] : 0,
      y: projected ? projected[1] : 0
    };
  });

  // Draw bubbles
  container.append("g")
    .attr("class", "bubble")
    .selectAll("circle")
    .data(projectedBubbles)
    .enter().append("circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", d => radiusScale(d.sizeValue))
    .attr("fill", d => colorScale(d.colorValue))
    .attr("fill-opacity", 0.6)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .append("title")
    .text(d => `${d.label}\nListings: ${d.sizeValue}\nAvg Price: $${d.colorValue.toFixed(0)}`);
}

/**
 * Creates neighborhood fields (rectangles) based on coordinate bounds
 */
//@ts-ignore
function makeNeighborhoodFields(
  container: d3.Selection<SVGSVGElement | SVGGElement, unknown, null, undefined>,
  projection: d3.GeoProjection,
  neighborhoodFields: NeighborhoodField[]
) {
  const colorScale = d3.scaleSequential()
    .domain([0, d3.max(neighborhoodFields, d => d.avgPrice) || 1])
    .interpolator(t => d3.interpolateBlues(0.4 + t * 0.6));

  const fieldsGroup = container.append("g").attr("class", "neighborhood-fields");

  neighborhoodFields.forEach(field => {
    // Project all four corners of the bounding box
    const topLeft = projection([field.minLng, field.maxLat]);
    const topRight = projection([field.maxLng, field.maxLat]);
    const bottomLeft = projection([field.minLng, field.minLat]);
    const bottomRight = projection([field.maxLng, field.minLat]);

    // Skip if any projection fails
    if (!topLeft || !topRight || !bottomLeft || !bottomRight) return;

    // Calculate the actual bounding box in screen coordinates
    const minX = Math.min(topLeft[0], topRight[0], bottomLeft[0], bottomRight[0]);
    const maxX = Math.max(topLeft[0], topRight[0], bottomLeft[0], bottomRight[0]);
    const minY = Math.min(topLeft[1], topRight[1], bottomLeft[1], bottomRight[1]);
    const maxY = Math.max(topLeft[1], topRight[1], bottomLeft[1], bottomRight[1]);

    const width = maxX - minX;
    const height = maxY - minY;

    // Skip if dimensions are too small or invalid
    if (width <= 0 || height <= 0) return;

    // Draw the rectangle
    fieldsGroup.append("rect")
      .attr("x", minX)
      .attr("y", minY)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", colorScale(field.avgPrice))
      .attr("fill-opacity", 0.4)
      .attr("stroke", colorScale(field.avgPrice))
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.8)
      .style("cursor", "pointer")
      .append("title")
      .text(`${field.label}\nListings: ${field.count}\nAvg Price: $${field.avgPrice.toFixed(0)}`);
  });
}

/*
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
*/

export default function BubbleMap({ filteredData, persona, isLoading }: BubbleMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxCityCountRef = useRef<number>(0);
  const maxNeighborhoodCountRef = useRef<number>(0);
  const currentZoomRef = useRef<number>(1);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || filteredData.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 960;
    const height = 600;

    d3.select(svgRef.current).selectAll('*').remove();

    // us.json has pre-projected coordinates, so use null projection for the map
    const path = d3.geoPath().projection(null);
    
    // Use the same projection as used to create us.json (from Makefile)
    const projection = d3.geoAlbersUsa().scale(1280).translate([960 / 2, 600 / 2]);

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create zoomable group
    const g = svg.append("g");

    // Aggregate data by CITY (for zoom level 1)
    const cityData = new Map<string, { count: number; priceSum: number; lat: number; lng: number; city: string; state: string }>();
    
    filteredData.forEach(d => {
      const key = `${d.city}-${d.state}`;
      const existing = cityData.get(key);
      if (existing) {
        existing.count++;
        existing.priceSum += d.price;
      } else {
        cityData.set(key, {
          count: 1,
          priceSum: d.price,
          lat: d.latitude,
          lng: d.longitude,
          city: d.city,
          state: d.state
        });
      }
    });

    const cityBubbles: BubbleData[] = Array.from(cityData.values()).map(data => ({
      label: `${data.city}, ${data.state}`,
      latitude: data.lat,
      longitude: data.lng,
      sizeValue: data.count,
      colorValue: data.priceSum / data.count
    }));

    // Aggregate data by NEIGHBORHOOD (for zoom level 2+)
    const neighborhoodData = new Map<string, { count: number; priceSum: number; lat: number; lng: number; name: string }>();
    
    filteredData.forEach(d => {
      const key = `${d.neighbourhood}-${d.latitude.toFixed(4)}-${d.longitude.toFixed(4)}`;
      const existing = neighborhoodData.get(key);
      if (existing) {
        existing.count++;
        existing.priceSum += d.price;
      } else {
        neighborhoodData.set(key, {
          count: 1,
          priceSum: d.price,
          lat: d.latitude,
          lng: d.longitude,
          name: d.neighbourhood
        });
      }
    });

    const neighborhoodBubbles: BubbleData[] = Array.from(neighborhoodData.values()).map(data => ({
      label: data.name,
      latitude: data.lat,
      longitude: data.lng,
      sizeValue: data.count,
      colorValue: data.priceSum / data.count
    }));

    // Update max for consistent scaling
    const cityMax = Math.max(...cityBubbles.map(b => b.sizeValue), 1);
    const neighborhoodMax = Math.max(...neighborhoodBubbles.map(b => b.sizeValue), 1);
    
    if (cityMax > maxCityCountRef.current) {
      maxCityCountRef.current = cityMax;
    }
    if (neighborhoodMax > maxNeighborhoodCountRef.current) {
      maxNeighborhoodCountRef.current = neighborhoodMax;
    }

    // Function to render bubbles based on zoom level
    function renderBubbles(zoomLevel: number) {
      // Remove existing bubbles
      g.selectAll('.bubble').remove();

      if (zoomLevel < 3) {
        // Show cities
        makeBubbles(g, projection, cityBubbles, maxCityCountRef.current, [3, 25]);
      } else {
        // Show neighborhoods
        makeBubbles(g, projection, neighborhoodBubbles, maxNeighborhoodCountRef.current, [2, 20]);
      }
    }

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        
        const zoomLevel = event.transform.k;
        
        // Only re-render if we cross the threshold
        if ((currentZoomRef.current < 3 && zoomLevel >= 3) || 
            (currentZoomRef.current >= 3 && zoomLevel < 3)) {
          currentZoomRef.current = zoomLevel;
          renderBubbles(zoomLevel);
        }
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Load base map - use relative import for production compatibility
    import('./baseMap/us.json')
      .then((module) => {
        const us: any = module.default;
        if (!us) return;

        g.append("path")
          .datum(topojson.feature(us, us.objects.nation))
          .attr("class", "land")
          .attr("d", path);

        g.append("path")
          .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
          .attr("class", "border border--state")
          .attr("d", path);

        // Initial render at zoom level 1 (cities)
        renderBubbles(1);
      })
      .catch(error => {
        console.error('Error loading map:', error);
      });

  }, [filteredData, persona]);

  function handleZoomIn() {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.5);
  }

  function handleZoomOut() {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1 / 1.5);
  }

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  // Persona-specific content
  const title = persona === 'host' ? 'Market Coverage Map' : 'Location Explorer';
  const description = persona === 'host' 
    ? `Geographic distribution of your properties (${filteredData.length.toLocaleString()} listings)`
    : `Find your perfect location (${filteredData.length.toLocaleString()} listings available)`;

  return (
    <div className="viz-container">
      <h2>{title}</h2>
      <p className="viz-description">{description}</p>
      <div ref={containerRef} style={{ width: '100%', minHeight: '600px', position: 'relative' }}>
        <svg ref={svgRef}></svg>
        <div className="zoom-controls">
          <button 
            onClick={handleZoomIn} 
            className="zoom-button zoom-in"
            title="Zoom in"
          >
            +
          </button>
          <button 
            onClick={handleZoomOut} 
            className="zoom-button zoom-out"
            title="Zoom out"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
}
