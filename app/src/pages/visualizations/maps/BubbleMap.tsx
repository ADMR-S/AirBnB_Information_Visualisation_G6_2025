import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { AirbnbListing, Persona } from '../../../types/airbnb.types';
import { useAggregatedData } from "../../../hooks/useAggregatedData";
import { useSelectedListing } from '../../../contexts/SelectedListingContext';
import { useHostSelection } from '../../../contexts/HostSelectionContext';
import { useFilterStore } from '../../../stores/useFilterStore';
import { createProjection, createNullProjectionPath } from './mapUtils';
import { makeBubbles, makeNeighborhoodFields, makeCityBoundaries, renderBaseMap, renderSizeLegend, renderColorLegend } from './mapRenderers';
import { renderFisheyeListings, applyFisheyeToBasemap, restoreBasemapPaths, getFisheyeRadius, updateSelectedListing, renderHostProperties } from './fisheyeUtils';
import { MAP_CONFIG } from './mapConfig';
import ListingDetails from '../../../components/ListingDetails';
import '../VisualizationPage.css';
import './BubbleMap.css';

interface BubbleMapProps {
  filteredData: AirbnbListing[];
  persona: Persona;
  isLoading: boolean;
  injectedListing?: AirbnbListing | null;
}

export default function BubbleMap({ filteredData, persona, isLoading, injectedListing }: BubbleMapProps) {
  // Get allData for host properties (so they're always visible regardless of filters)
  const { allData } = useFilterStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentZoomRef = useRef<number>(1);
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const originalPathsRef = useRef<Map<SVGPathElement | SVGPolygonElement, string>>(new Map());
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const initializedRef = useRef<boolean>(false);
  const [fisheyeActive, setFisheyeActive] = useState(false);
  const [fisheyePosition, setFisheyePosition] = useState<[number, number]>([0, 0]);
  
  // Use context for selected listing management
  const { selectedListing, setSelectedListing } = useSelectedListing();
  const selectedListingRef = useRef<AirbnbListing | null>(null);
  const setSelectedListingRef = useRef<(listing: AirbnbListing | null) => void>(setSelectedListing);
  
  // Get host selection context (for host persona only)
  const { selectedHost } = useHostSelection();
  
  // Filter host's listings from allData (not filteredData) so they're always visible
  const hostListings = useMemo(() => {
    if (persona !== 'host' || !selectedHost || !allData.length) {
      return [];
    }
    
    // Use allData instead of filteredData so host properties are always visible
    const listings = allData.filter(listing => String(listing.host_id) === String(selectedHost.hostId));
    return listings;
  }, [persona, selectedHost, allData]);
  
  // Keep refs in sync with context
  useEffect(() => {
    selectedListingRef.current = selectedListing;
    setSelectedListingRef.current = setSelectedListing;
  }, [selectedListing, setSelectedListing]);

  // Aggregate data at the component level (must be called at top level, not inside useEffect)
  const { cityBubbles, neighborhoodFields, cityBoundaries, maxCityCount } = useAggregatedData(filteredData);

  // Handle injected listing (from context or props)
  useEffect(() => {
    if (injectedListing) {
      setSelectedListing(injectedListing);
    }
  }, [injectedListing, setSelectedListing]);

  // Update selected listing visualization when selection changes (but not when data changes - that's handled by data effect)
  useEffect(() => {
    if (!gRef.current || !projectionRef.current || filteredData.length === 0) return;
    
    const zoomLevel = currentZoomRef.current;
    
    // Show selected listing at both city and neighborhood levels
    // But skip if fisheye is active - renderFisheyeListings handles it
    if (selectedListing && !fisheyeActive) {
      updateSelectedListing(gRef.current, filteredData, projectionRef.current, zoomLevel, selectedListing);
    } else if (!selectedListing) {
      // No selection - remove the selected listing pin and center circle
      gRef.current.selectAll('.selected-listing').remove();
      gRef.current.selectAll('.selected-listing-center').remove();
    }
  }, [selectedListing, fisheyeActive, filteredData]); // Depend on fisheyeActive too

  // Cleanup effect - close popup when leaving the map view
  useEffect(() => {
    return () => {
      // Remove any listing popup when component unmounts
      const popup = document.querySelector('.listing-popup');
      if (popup) {
        popup.remove();
      }
    };
  }, []);

  // Initialization effect - runs once
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || initializedRef.current) return;

    initializedRef.current = true;

    const container = containerRef.current;
    const width = container.clientWidth || MAP_CONFIG.defaultWidth;
    const height = MAP_CONFIG.defaultHeight;

    // us.json has pre-projected coordinates, so use null projection for the map
    const path = createNullProjectionPath();
    
    // Use the same projection as used to create us.json (from Makefile)
    const projection = createProjection();
    projectionRef.current = projection;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Clear any existing content to avoid superposition
    svg.selectAll('*').remove();

    // Create zoomable group
    const g = svg.append("g");
    gRef.current = g;

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
        makeBubbles(g, projection, cityBubbles, maxCityCount, MAP_CONFIG.bubbles.citySizeRange);
        // Show selected listing AFTER city bubbles so it appears on top
        updateSelectedListing(g, filteredData, projection, zoomLevel, selectedListingRef.current);
        // Show host properties as green triangles (for host persona)
        if (hostListings.length > 0) {
          renderHostProperties(g, hostListings, projection, zoomLevel);
        }
      } else {
        if (MAP_CONFIG.DEBUG_LOG) {
          console.log(`[BubbleMap] Rendering NEIGHBORHOOD fields (zoom >= ${MAP_CONFIG.zoom.cityThreshold})`);
        }
        // Show city boundaries first (behind neighborhoods)
        makeCityBoundaries(g, projection, cityBoundaries);
        // Then show neighborhoods as fields
        makeNeighborhoodFields(g, projection, neighborhoodFields);
        // Show host properties as green triangles (for host persona)
        if (hostListings.length > 0) {
          renderHostProperties(g, hostListings, projection, zoomLevel);
        }
      }
    }

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent(MAP_CONFIG.zoom.scaleExtent)
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        
        const zoomLevel = event.transform.k;
        const previousZoomLevel = currentZoomRef.current;
        
        // Always update the current zoom level and transform
        currentZoomRef.current = zoomLevel;
        currentTransformRef.current = event.transform;
        
        // Re-render visualization if we cross the threshold
        if ((previousZoomLevel < MAP_CONFIG.zoom.cityThreshold && zoomLevel >= MAP_CONFIG.zoom.cityThreshold) || 
            (previousZoomLevel >= MAP_CONFIG.zoom.cityThreshold && zoomLevel < MAP_CONFIG.zoom.cityThreshold)) {
          // Hide tooltips when crossing threshold to prevent orphaned tooltips
          d3.selectAll('.viz-tooltip').remove();
          
          renderVisualization(zoomLevel);
          
          // Update legends when crossing zoom threshold
          const prices = filteredData.map(d => d.price);
          const minPrice = d3.min(prices) || 0;
          const maxPrice = d3.max(prices) || 1;
          
          if (zoomLevel < MAP_CONFIG.zoom.cityThreshold) {
            // City level: show city bubble size legend
            renderSizeLegend(svg, width, height, maxCityCount, MAP_CONFIG.bubbles.citySizeRange);
          } else {
            // Neighborhood level: show neighborhood size legend
            const maxNeighborhoodCount = d3.max(neighborhoodFields, d => d.count) || 1;
            renderSizeLegend(svg, width, height, maxNeighborhoodCount, MAP_CONFIG.bubbles.neighborhoodSizeRange);
          }
          renderColorLegend(svg, width, height, minPrice, maxPrice);
          
          // Clean up fisheye elements when zooming out to city level
          if (zoomLevel < MAP_CONFIG.zoom.cityThreshold) {
            // Remove fisheye-specific elements but keep selected listing
            g.selectAll('.fisheye-listing:not(.selected-listing)').remove();
            g.selectAll('.fisheye-lens-circle').remove();
            restoreBasemapPaths(g, originalPathsRef.current);
            setFisheyeActive(false);
            // Update selected listing for city level (will be drawn on top of city bubbles)
            updateSelectedListing(g, filteredData, projection, zoomLevel, selectedListingRef.current);
          } else {
            // Zoomed into neighborhood level - show selected listing if any
            if (!fisheyeActive) {
              updateSelectedListing(g, filteredData, projection, zoomLevel, selectedListingRef.current);
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
          renderFisheyeListings(g, filteredData, projection, fisheyePosition, zoomLevel, setSelectedListingRef.current, selectedListingRef.current, hostListings);
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
          
          // Render fisheye listings (this will handle the selected listing and host properties too)
          renderFisheyeListings(g, filteredData, projection, [mouseX, mouseY], currentZoomRef.current, setSelectedListingRef.current, selectedListingRef.current, hostListings);
        } else {
          setFisheyeActive(false);
          restoreBasemapPaths(g, originalPathsRef.current);
          // Don't remove the entire group - just remove non-selected listings
          g.selectAll('.fisheye-listing:not(.selected-listing)').remove();
          g.selectAll('.fisheye-lens-circle').remove();
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
          updateSelectedListing(g, filteredData, projection, zoomLevel, selectedListingRef.current);
          // Re-render host properties after fisheye deactivation
          if (hostListings.length > 0) {
            renderHostProperties(g, hostListings, projection, zoomLevel);
          }
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
      if (svg) {
        svg.on('mousemove', null);
        svg.on('mouseleave', null);
      }
      // Clear SVG content
      svg.selectAll('*').remove();
      // Reset refs
      gRef.current = null;
      projectionRef.current = null;
      zoomBehaviorRef.current = null;
      originalPathsRef.current.clear();
      // Reset initialization flag so it reinitializes on remount
      initializedRef.current = false;
    };
  }, [isLoading]); // Run when component mounts/unmounts or loading changes

  // Data update effect - runs when filtered data changes
  useEffect(() => {
    if (!gRef.current || !projectionRef.current || filteredData.length === 0) return;

    const g = gRef.current;
    const projection = projectionRef.current;

    // Re-attach event listeners to any existing popups
    const existingPopups = document.querySelectorAll('.listing-popup');
    existingPopups.forEach(popup => {
      const closeButton = popup.querySelector('.listing-popup-close');
      if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode?.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', () => {
          popup.remove();
          // Don't clear selection - keep the listing selected below the map
          // g.selectAll('.selected-listing').remove(); // Keep the selected listing visible
        });
      }
    });

    // Log aggregated data
    if (MAP_CONFIG.DEBUG_LOG) {
      console.log(`[BubbleMap] Data update - Processing ${filteredData.length} listings`);
      console.log(`[BubbleMap] Aggregated to ${cityBubbles.length} cities, ${neighborhoodFields.length} neighborhoods, ${cityBoundaries.length} city boundaries`);
    }

    // Function to render based on zoom level
    function renderVisualization(zoomLevel: number) {
      if (MAP_CONFIG.DEBUG_LOG) {
        console.log(`[BubbleMap] renderVisualization called with zoomLevel: ${zoomLevel.toFixed(2)}`);
      }
      
      // Remove existing visualizations
      g.selectAll('.bubble').remove();
      g.selectAll('.neighborhood-fields').remove();
      g.selectAll('.city-boundaries').remove();

      if (zoomLevel < MAP_CONFIG.zoom.cityThreshold) {
        if (MAP_CONFIG.DEBUG_LOG) {
          console.log(`[BubbleMap] Rendering CITY bubbles (zoom < ${MAP_CONFIG.zoom.cityThreshold})`);
        }
        makeBubbles(g, projection, cityBubbles, maxCityCount, MAP_CONFIG.bubbles.citySizeRange);
        // Show selected listing AFTER city bubbles so it appears on top
        updateSelectedListing(g, filteredData, projection, zoomLevel, selectedListingRef.current);
        // Show host properties as green triangles (for host persona)
        if (hostListings.length > 0) {
          renderHostProperties(g, hostListings, projection, zoomLevel);
        }
      } else {
        if (MAP_CONFIG.DEBUG_LOG) {
          console.log(`[BubbleMap] Rendering NEIGHBORHOOD fields (zoom >= ${MAP_CONFIG.zoom.cityThreshold})`);
        }
        makeCityBoundaries(g, projection, cityBoundaries);
        makeNeighborhoodFields(g, projection, neighborhoodFields);
        // Show host properties as green triangles (for host persona)
        if (hostListings.length > 0) {
          renderHostProperties(g, hostListings, projection, zoomLevel);
        }
      }
    }

    // Re-render with current zoom level (preserving zoom state)
    const currentZoom = currentZoomRef.current;
    renderVisualization(currentZoom);

    // Restore the transform to maintain zoom and position
    if (svgRef.current && zoomBehaviorRef.current) {
      const svg = d3.select(svgRef.current);
      svg.call(zoomBehaviorRef.current.transform, currentTransformRef.current);
    }
  }, [filteredData, cityBubbles, neighborhoodFields, cityBoundaries, maxCityCount, hostListings]);

  // Legend rendering effect - updates when data changes
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || filteredData.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || MAP_CONFIG.defaultWidth;
    const height = MAP_CONFIG.defaultHeight;
    const svg = d3.select(svgRef.current);

    // Calculate min and max prices from filtered data
    const prices = filteredData.map(d => d.price);
    const minPrice = d3.min(prices) || 0;
    const maxPrice = d3.max(prices) || 1;

    // Render legends based on current zoom level
    const currentZoom = currentZoomRef.current;
    
    if (currentZoom < MAP_CONFIG.zoom.cityThreshold) {
      // City level: show city bubble size legend
      renderSizeLegend(svg, width, height, maxCityCount, MAP_CONFIG.bubbles.citySizeRange);
    } else {
      // Neighborhood level: show neighborhood size legend
      const maxNeighborhoodCount = d3.max(neighborhoodFields, d => d.count) || 1;
      renderSizeLegend(svg, width, height, maxNeighborhoodCount, MAP_CONFIG.bubbles.neighborhoodSizeRange);
    }
    
    // Always show color legend
    renderColorLegend(svg, width, height, minPrice, maxPrice);
  }, [filteredData, neighborhoodFields, maxCityCount]);

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
      
      {selectedListing && (
        <ListingDetails 
          listing={selectedListing} 
          persona={persona}
          onClear={() => {
            setSelectedListing(null);
            // Remove any popup
            const popup = document.querySelector('.listing-popup');
            if (popup) {
              popup.remove();
            }
            // Remove selected listing visualization and center circle
            if (gRef.current) {
              gRef.current.selectAll('.selected-listing').remove();
              gRef.current.selectAll('.selected-listing-center').remove();
            }
          }}
        />
      )}
    </div>
  );
}
