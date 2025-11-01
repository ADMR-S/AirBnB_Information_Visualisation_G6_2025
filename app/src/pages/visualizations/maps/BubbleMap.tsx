import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { AirbnbListing, Persona } from '../../../types/airbnb.types';
import { aggregateByCity, aggregateNeighborhoodFields, getMaxSizeValue } from './dataAggregators';
import { createProjection, createNullProjectionPath } from './mapUtils';
import { makeBubbles, makeNeighborhoodFields, renderBaseMap } from './mapRenderers';
import { MAP_CONFIG } from './mapConfig';
import '../VisualizationPage.css';
import './BubbleMap.css';

interface BubbleMapProps {
  filteredData: AirbnbListing[];
  persona: Persona;
  isLoading: boolean;
}

export default function BubbleMap({ filteredData, persona, isLoading }: BubbleMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxCityCountRef = useRef<number>(0);
  const currentZoomRef = useRef<number>(1);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || filteredData.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || MAP_CONFIG.defaultWidth;
    const height = MAP_CONFIG.defaultHeight;

    d3.select(svgRef.current).selectAll('*').remove();

    // us.json has pre-projected coordinates, so use null projection for the map
    const path = createNullProjectionPath();
    
    // Use the same projection as used to create us.json (from Makefile)
    const projection = createProjection();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create zoomable group
    const g = svg.append("g");

    // Aggregate data by CITY and NEIGHBORHOOD
    if (MAP_CONFIG.DEBUG_LOG) {
      console.log(`[BubbleMap] Processing ${filteredData.length} listings`);
    }
    const cityBubbles = aggregateByCity(filteredData);
    const neighborhoodFields = aggregateNeighborhoodFields(filteredData);
    if (MAP_CONFIG.DEBUG_LOG) {
      console.log(`[BubbleMap] Aggregated to ${cityBubbles.length} cities and ${neighborhoodFields.length} neighborhoods`);
    }

    // Update max for consistent scaling
    const cityMax = getMaxSizeValue(cityBubbles);
    
    if (cityMax > maxCityCountRef.current) {
      maxCityCountRef.current = cityMax;
    }

    // Function to render based on zoom level
    function renderVisualization(zoomLevel: number) {
      if (MAP_CONFIG.DEBUG_LOG) {
        console.log(`[BubbleMap] renderVisualization called with zoomLevel: ${zoomLevel.toFixed(2)}`);
      }
      
      // Remove existing visualizations
      g.selectAll('.bubble').remove();
      g.selectAll('.neighborhood-fields').remove();

      if (zoomLevel < MAP_CONFIG.zoom.cityThreshold) {
        if (MAP_CONFIG.DEBUG_LOG) {
          console.log(`[BubbleMap] Rendering CITY bubbles (zoom < ${MAP_CONFIG.zoom.cityThreshold})`);
        }
        // Show cities as bubbles
        makeBubbles(g, projection, cityBubbles, maxCityCountRef.current, MAP_CONFIG.bubbles.citySizeRange);
      } else {
        if (MAP_CONFIG.DEBUG_LOG) {
          console.log(`[BubbleMap] Rendering NEIGHBORHOOD fields (zoom >= ${MAP_CONFIG.zoom.cityThreshold})`);
        }
        // Show neighborhoods as fields
        makeNeighborhoodFields(g, projection, neighborhoodFields);
      }
    }

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent(MAP_CONFIG.zoom.scaleExtent)
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        
        const zoomLevel = event.transform.k;
        
        // Only re-render if we cross the threshold
        if ((currentZoomRef.current < MAP_CONFIG.zoom.cityThreshold && zoomLevel >= MAP_CONFIG.zoom.cityThreshold) || 
            (currentZoomRef.current >= MAP_CONFIG.zoom.cityThreshold && zoomLevel < MAP_CONFIG.zoom.cityThreshold)) {
          currentZoomRef.current = zoomLevel;
          renderVisualization(zoomLevel);
        }
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Load base map and render initial visualization
    renderBaseMap(g, path, () => {
      renderVisualization(1);
    });

  }, [filteredData, persona]);

  function handleZoomIn() {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(MAP_CONFIG.zoom.transitionDuration)
      .call(zoomBehaviorRef.current.scaleBy, MAP_CONFIG.zoom.zoomFactor);
  }

  function handleZoomOut() {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(MAP_CONFIG.zoom.transitionDuration)
      .call(zoomBehaviorRef.current.scaleBy, 1 / MAP_CONFIG.zoom.zoomFactor);
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
