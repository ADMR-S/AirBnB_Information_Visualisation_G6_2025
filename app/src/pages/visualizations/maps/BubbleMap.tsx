import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { AirbnbListing, Persona } from '../../../types/airbnb.types';
import { useAggregatedData } from "../../../hooks/useAggregatedData";
import { createProjection, createNullProjectionPath } from './mapUtils';
import { makeBubbles, makeNeighborhoodFields, makeCityBoundaries, renderBaseMap } from './mapRenderers';
import { renderFisheyeListings, applyFisheyeToBasemap, restoreBasemapPaths, getFisheyeRadius, updateSelectedListing } from './fisheyeUtils';
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
  const originalPathsRef = useRef<Map<SVGPathElement | SVGPolygonElement, string>>(new Map());
  const [fisheyeActive, setFisheyeActive] = useState(false);
  const [fisheyePosition, setFisheyePosition] = useState<[number, number]>([0, 0]);

  // Aggregate data at the component level (must be called at top level, not inside useEffect)
  const { cityBubbles, neighborhoodFields, cityBoundaries, maxCityCount } = useAggregatedData(filteredData);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || filteredData.length === 0) return;

    // Re-attach event listeners to any existing popups
    const existingPopups = document.querySelectorAll('.listing-popup');
    existingPopups.forEach(popup => {
      const closeButton = popup.querySelector('.listing-popup-close');
      if (closeButton) {
        // Remove old listeners by cloning and replacing
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode?.replaceChild(newCloseButton, closeButton);
        // Add fresh listener
        newCloseButton.addEventListener('click', () => {
          popup.remove();
        });
      }
    });

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

    // Log aggregated data
    if (MAP_CONFIG.DEBUG_LOG) {
      console.log(`[BubbleMap] Processing ${filteredData.length} listings`);
      console.log(`[BubbleMap] Aggregated to ${cityBubbles.length} cities, ${neighborhoodFields.length} neighborhoods, ${cityBoundaries.length} city boundaries`);
    }
    
    // Update max for consistent scaling
    if (maxCityCount > maxCityCountRef.current) {
      maxCityCountRef.current = maxCityCount;
    }

    // Function to render based on zoom level
    function renderVisualization(zoomLevel: number) {
      if (MAP_CONFIG.DEBUG_LOG) {
        console.log(`[BubbleMap] renderVisualization called with zoomLevel: ${zoomLevel.toFixed(2)}`);
      }
      
      // Hide tooltips when re-rendering to prevent orphaned tooltips
      d3.selectAll('.viz-tooltip').remove();
      
      // Remove existing visualizations
      g.selectAll('.bubble').remove();
      g.selectAll('.neighborhood-fields').remove();
      g.selectAll('.city-boundaries').remove();

      if (zoomLevel < MAP_CONFIG.zoom.cityThreshold) {
        if (MAP_CONFIG.DEBUG_LOG) {
          console.log(`[BubbleMap] Rendering CITY bubbles (zoom < ${MAP_CONFIG.zoom.cityThreshold})`);
        }
        // Show cities as bubbles
        makeBubbles(g, projection, cityBubbles, maxCityCountRef.current, MAP_CONFIG.bubbles.citySizeRange);
        // Show selected listing at city level too
        updateSelectedListing(g, filteredData, projection, zoomLevel);
      } else {
        if (MAP_CONFIG.DEBUG_LOG) {
          console.log(`[BubbleMap] Rendering NEIGHBORHOOD fields (zoom >= ${MAP_CONFIG.zoom.cityThreshold})`);
        }
        // Show city boundaries first (behind neighborhoods)
        makeCityBoundaries(g, projection, cityBoundaries);
        // Then show neighborhoods as fields
        makeNeighborhoodFields(g, projection, neighborhoodFields);
      }
    }

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent(MAP_CONFIG.zoom.scaleExtent)
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        
        const zoomLevel = event.transform.k;
        const previousZoomLevel = currentZoomRef.current;
        
        // Always update the current zoom level
        currentZoomRef.current = zoomLevel;
        
        // Re-render visualization if we cross the threshold
        if ((previousZoomLevel < MAP_CONFIG.zoom.cityThreshold && zoomLevel >= MAP_CONFIG.zoom.cityThreshold) || 
            (previousZoomLevel >= MAP_CONFIG.zoom.cityThreshold && zoomLevel < MAP_CONFIG.zoom.cityThreshold)) {
          // Hide tooltips when crossing threshold to prevent orphaned tooltips
          d3.selectAll('.viz-tooltip').remove();
          
          renderVisualization(zoomLevel);
          
          // Clean up fisheye elements when zooming out to city level
          if (zoomLevel < MAP_CONFIG.zoom.cityThreshold) {
            // Remove fisheye-specific elements but keep selected listing
            g.selectAll('.fisheye-listing:not(.selected-listing)').remove();
            g.selectAll('.fisheye-lens-circle').remove();
            restoreBasemapPaths(g, originalPathsRef.current);
            setFisheyeActive(false);
            // Update selected listing for city level view
            updateSelectedListing(g, filteredData, projection, zoomLevel);
          } else {
            // Zoomed into neighborhood level - show selected listing if any
            if (!fisheyeActive) {
              updateSelectedListing(g, filteredData, projection, zoomLevel);
            }
          }
        }
        
        // Update fisheye if it's currently active and we're at neighborhood level
        if (fisheyeActive && zoomLevel >= MAP_CONFIG.zoom.cityThreshold && fisheyePosition) {
          const fisheyeRadius = getFisheyeRadius(zoomLevel);
          
          // Apply fisheye distortion to base map
          applyFisheyeToBasemap(g, fisheyePosition, fisheyeRadius, originalPathsRef.current);
          
          // Re-render fisheye listings with updated zoom
          g.selectAll('.fisheye-listings-group').remove();
          renderFisheyeListings(g, filteredData, projection, fisheyePosition, zoomLevel);
        }
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Add fisheye interaction (only at neighborhood zoom level)
    if (MAP_CONFIG.fisheye.enabled) {
      svg.on('mousemove', function(event: MouseEvent) {
        // Don't activate fisheye if mouse is over a popup
        const target = event.target as HTMLElement;
        if (target.closest('.listing-popup')) {
          return;
        }
        
        const zoomLevel = currentZoomRef.current;
        if (zoomLevel >= MAP_CONFIG.zoom.cityThreshold) {
          // Get mouse position relative to the transformed group 'g', not the SVG root
          const [mouseX, mouseY] = d3.pointer(event, g.node());
          setFisheyePosition([mouseX, mouseY]);
          setFisheyeActive(true);
          
          const fisheyeRadius = getFisheyeRadius(zoomLevel);
          
          // Apply fisheye distortion to base map
          applyFisheyeToBasemap(g, [mouseX, mouseY], fisheyeRadius, originalPathsRef.current);
          
          // Render fisheye listings (this will handle the selected listing too)
          renderFisheyeListings(g, filteredData, projection, [mouseX, mouseY], currentZoomRef.current);
        } else {
          setFisheyeActive(false);
          restoreBasemapPaths(g, originalPathsRef.current);
          g.selectAll('.fisheye-listings-group').remove();
        }
      });
      
      svg.on('mouseleave', function() {
        setFisheyeActive(false);
        restoreBasemapPaths(g, originalPathsRef.current);
        // Remove non-selected listings but keep selected listing if any
        g.selectAll('.fisheye-listing:not(.selected-listing)').remove();
        g.selectAll('.fisheye-lens-circle').remove();
        
        // Update selected listing position without fisheye distortion
        const zoomLevel = currentZoomRef.current;
        if (zoomLevel >= MAP_CONFIG.zoom.cityThreshold) {
          updateSelectedListing(g, filteredData, projection, zoomLevel);
        }
      });
    }

    // Load base map and render initial visualization
    renderBaseMap(g, path, () => {
      renderVisualization(1);
    });

    // Cleanup function
    return () => {
      // Remove all event listeners to prevent memory leaks
      svg.on('mousemove', null);
      svg.on('mouseleave', null);
      
      // Note: We don't remove popups or reset state to preserve user's view
      // Popups will have their event listeners re-attached on next mount
    };
  }, [filteredData, persona, cityBubbles, neighborhoodFields, cityBoundaries, maxCityCount]);

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
