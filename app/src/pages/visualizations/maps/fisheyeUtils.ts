import * as d3 from 'd3';
import type { AirbnbListing } from '../../../types/airbnb.types';
import { MAP_CONFIG } from './mapConfig';

/**
 * Calculates the fisheye radius based on current zoom level
 * @param zoomLevel Current zoom level
 * @returns Adjusted fisheye radius
 */
export function getFisheyeRadius(zoomLevel: number): number {
  const baseRadius = MAP_CONFIG.fisheye.baseRadius;
  const scaleFactor = MAP_CONFIG.fisheye.radiusScaleFactor;
  // Radius decreases as you zoom in
  return baseRadius / (zoomLevel * scaleFactor);
}

/**
 * Calculates the fisheye radius based on current zoom level
 * @param zoomLevel Current zoom level
 * @returns Adjusted fisheye radius
 */
export function getFisheyeStrokeWidth(zoomLevel: number): number {
  const baseStrokeWidth = MAP_CONFIG.fisheye.baseStrokeWidth;
  const scaleFactor = MAP_CONFIG.fisheye.radiusScaleFactor;
  // Radius decreases as you zoom in
  return baseStrokeWidth / (zoomLevel * scaleFactor);
}


/**
 * Applies fisheye distortion to a point
 * @param x X coordinate
 * @param y Y coordinate
 * @param focus Focus point [x, y] of the fisheye
 * @param fisheyeRadius Radius of the fisheye lens
 * @returns Distorted coordinates and scale factor
 */
export function fisheye(
  x: number,
  y: number,
  focus: [number, number],
  fisheyeRadius: number
): { x: number; y: number; scale: number } {
  const fisheyeDistortion = MAP_CONFIG.fisheye.distortion;
  
  const dx = x - focus[0];
  const dy = y - focus[1];
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance >= fisheyeRadius) {
    return { x, y, scale: 1 };
  }
  
  const k = (fisheyeDistortion + 1) * fisheyeRadius * distance /
    (fisheyeDistortion * fisheyeRadius + distance);
  const scale = k / distance;
  
  return {
    x: focus[0] + dx * scale,
    y: focus[1] + dy * scale,
    scale
  };
}

/**
 * Shows a movable popup with listing details
 * @param listing The Airbnb listing data
 * @param position Initial position [x, y]
 * @param onClose Callback when popup is closed (includes clearing selection)
 * @param onSelect Callback when listing is selected
 */
export function showListingPopup(
  listing: AirbnbListing,
  position: [number, number],
  onClose: () => void,
  onSelect?: (listing: AirbnbListing | null) => void
): HTMLDivElement {
  // Remove any existing popup
  const existingPopup = document.querySelector('.listing-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  const popup = document.createElement('div');
  popup.className = 'listing-popup';
  popup.style.left = `${position[0]}px`;
  popup.style.top = `${position[1]}px`;
  
  // Store the listing ID as a data attribute for easy access
  popup.setAttribute('data-listing-id', listing.id);
  
  popup.innerHTML = `
    <div class="listing-popup-header">
      <span class="listing-popup-drag-handle">☰</span>
      <button class="listing-popup-close">×</button>
    </div>
    <div class="listing-popup-content">
      <h3>${listing.name}</h3>
      <p><strong>Host:</strong> ${listing.host_name}</p>
      <p><strong>Room Type:</strong> ${listing.room_type}</p>
      <p><strong>Price:</strong> $${listing.price.toFixed(2)}/night</p>
      <p><strong>Minimum Nights:</strong> ${listing.minimum_nights}</p>
      <p><strong>Availability:</strong> ${listing.availability_365} days/year</p>
      <p><strong>Reviews:</strong> ${listing.number_of_reviews} (${listing.reviews_per_month?.toFixed(1) || 0}/month)</p>
      <p><strong>Location:</strong> ${listing.neighbourhood}, ${listing.city}</p>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  // Call onSelect immediately to update context
  if (onSelect) {
    onSelect(listing);
  }
  
  // Make popup draggable
  let isDragging = false;
  let currentX: number;
  let currentY: number;
  let initialX: number;
  let initialY: number;
  
  const dragHandle = popup.querySelector('.listing-popup-drag-handle') as HTMLElement;
  
  dragHandle.addEventListener('mousedown', (e: MouseEvent) => {
    isDragging = true;
    initialX = e.clientX - popup.offsetLeft;
    initialY = e.clientY - popup.offsetTop;
    popup.style.cursor = 'grabbing';
  });
  
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      popup.style.left = `${currentX}px`;
      popup.style.top = `${currentY}px`;
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    popup.style.cursor = 'auto';
  });
  
  // Close button
  const closeButton = popup.querySelector('.listing-popup-close') as HTMLElement;
  closeButton.addEventListener('click', () => {
    popup.remove();
    // Don't clear selection - the listing remains selected
    // User can clear it using the clear button in ListingDetails below the map
    onClose();
  });
  
  return popup;
}

/**
 * Gets the currently selected listing ID from the popup if it exists
 * @returns The selected listing ID or null
 */
export function getSelectedListingId(): string | null {
  const popup = document.querySelector('.listing-popup');
  return popup ? popup.getAttribute('data-listing-id') : null;
}

/**
 * Renders or updates the selected listing bubble without fisheye effect
 * @param container D3 selection of the container element
 * @param listings Array of all listings
 * @param projection D3 geo projection
 * @param zoomLevel Current zoom level
 * @param injectedSelectedListing Optional selected listing from context
 */
export function updateSelectedListing(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  listings: AirbnbListing[],
  projection: d3.GeoProjection,
  zoomLevel: number,
  injectedSelectedListing?: AirbnbListing | null
): void {
  // Try to get selected listing from popup first, then from injected parameter
  const selectedListingId = getSelectedListingId();
  let selectedListing: AirbnbListing | null = null;
  
  if (selectedListingId) {
    // Find the selected listing from popup
    selectedListing = listings.find(l => l.id === selectedListingId) || null;
  } else if (injectedSelectedListing) {
    // Use injected selected listing
    selectedListing = injectedSelectedListing;
  }
  
  if (!selectedListing) {
    // No selection, remove any selected listing bubble
    container.selectAll('.selected-listing').remove();
    return;
  }
  
  // Project the listing
  const projected = projection([selectedListing.longitude, selectedListing.latitude]);
  if (!projected) {
    container.selectAll('.selected-listing').remove();
    return;
  }
  
  // Calculate bubble radius based on zoom level
  const baseBubbleRadius = MAP_CONFIG.fisheye.listingBubbleRadius;
  let listingBubbleRadius = baseBubbleRadius / Math.sqrt(zoomLevel);
  
  // Make the bubble bigger at city level (when zoom is lower)
  if (zoomLevel < MAP_CONFIG.zoom.cityThreshold) {
    // At city level, make it 3x larger to stand out among city bubbles
    listingBubbleRadius = listingBubbleRadius * 3;
  }
  
  // Get or create fisheye group
  let fisheyeGroup = container.select<SVGGElement>('g.fisheye-listings-group');
  if (fisheyeGroup.empty()) {
    fisheyeGroup = container.append('g').attr('class', 'fisheye-listings-group');
  }
  
  // Raise the group to ensure it's on top of other elements (like city bubbles)
  fisheyeGroup.raise();
  
  // Update or create selected listing bubble (no fisheye distortion)
  let selectedBubble = fisheyeGroup.select<SVGCircleElement>('.selected-listing');
  
  if (selectedBubble.empty()) {
    selectedBubble = fisheyeGroup.append('circle')
      .attr('class', 'fisheye-listing selected-listing')
      .attr('fill', '#FF5722')
      .attr('fill-opacity', 0.9)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.02)
      .style('cursor', 'pointer')
      .style('pointer-events', 'none');
  }
  
  selectedBubble
    .attr('cx', projected[0])
    .attr('cy', projected[1])
    .attr('r', listingBubbleRadius);
}

/**
 * Renders individual listing bubbles within fisheye lens
 * @param container D3 selection of the container element
 * @param listings Array of listings to render
 * @param projection D3 geo projection
 * @param fisheyeFocus Focus point of the fisheye
 * @param zoomLevel Current zoom level
 * @param onSelect Callback when a listing is selected or cleared
 */
export function renderFisheyeListings(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  listings: AirbnbListing[],
  projection: d3.GeoProjection,
  fisheyeFocus: [number, number],
  zoomLevel: number,
  onSelect?: (listing: AirbnbListing | null) => void
): void {
  // Get currently selected listing ID
  const selectedListingId = getSelectedListingId();
  
  // Remove existing non-selected fisheye listings
  container.selectAll('.fisheye-listing:not(.selected-listing)').remove();
  container.selectAll('.fisheye-lens-circle').remove();
  
  const fisheyeRadius = getFisheyeRadius(zoomLevel);
  const fisheyeStrokeWidth = getFisheyeStrokeWidth(zoomLevel);
  // Bubble size decreases as zoom increases
  const baseBubbleRadius = MAP_CONFIG.fisheye.listingBubbleRadius;
  const listingBubbleRadius = baseBubbleRadius / Math.sqrt(zoomLevel);
  
  // Draw fisheye lens circle
  container.append('circle')
    .attr('class', 'fisheye-lens-circle')
    .attr('cx', fisheyeFocus[0])
    .attr('cy', fisheyeFocus[1])
    .attr('r', fisheyeRadius)
    .attr('stroke-width', fisheyeStrokeWidth)
    .style('pointer-events', 'none');
  
  // Project listings and filter those within fisheye radius
  type ProjectedListing = { listing: AirbnbListing; projected: [number, number] };
  const projectedListings: ProjectedListing[] = listings
    .map(listing => {
      const projected = projection([listing.longitude, listing.latitude]);
      if (!projected) return null;
      
      const dx = projected[0] - fisheyeFocus[0];
      const dy = projected[1] - fisheyeFocus[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > fisheyeRadius) return null;
      
      return { listing, projected };
    })
    .filter((d): d is ProjectedListing => d !== null);
  
  // Separate selected and non-selected listings
  const nonSelectedListings = projectedListings.filter(d => d.listing.id !== selectedListingId);
  const selectedListingData = selectedListingId 
    ? projectedListings.find(d => d.listing.id === selectedListingId)
    : null;
  
  // Create or get fisheye listings group
  let fisheyeGroup = container.select<SVGGElement>('g.fisheye-listings-group');
  if (fisheyeGroup.empty()) {
    fisheyeGroup = container.append('g').attr('class', 'fisheye-listings-group');
  }
  
  // Render non-selected listing bubbles
  fisheyeGroup
    .selectAll<SVGCircleElement, ProjectedListing>('circle.fisheye-listing:not(.selected-listing)')
    .data(nonSelectedListings)
    .enter()
    .append('circle')
    .attr('class', 'fisheye-listing')
    .attr('cx', (d: ProjectedListing) => {
      const distorted = fisheye(d.projected[0], d.projected[1], fisheyeFocus, fisheyeRadius);
      return distorted.x;
    })
    .attr('cy', (d: ProjectedListing) => {
      const distorted = fisheye(d.projected[0], d.projected[1], fisheyeFocus, fisheyeRadius);
      return distorted.y;
    })
    .attr('r', listingBubbleRadius)
    .attr('fill', '#2196F3')
    .attr('fill-opacity', 0.7)
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.02)
    .style('cursor', 'pointer')
    .on('click', function(event: MouseEvent, d: ProjectedListing) {
      event.stopPropagation();
      
      // Reset hover state on the clicked bubble
      d3.select(this)
        .attr('fill', '#2196F3')
        .attr('r', listingBubbleRadius);
      
      const rect = (event.target as SVGCircleElement).getBoundingClientRect();
      showListingPopup(
        d.listing,
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        () => {
          // Popup closed - keep the selected listing bubble visible
          // User can clear selection using the clear button in ListingDetails component
        },
        onSelect
      );
      
      // Remove old selected listing and create new one
      fisheyeGroup.selectAll<SVGCircleElement, unknown>('.selected-listing').remove();
      
      // Hide the clicked bubble by making it invisible
      d3.select(this).style('opacity', 0);
      
      // Create selected listing bubble with fisheye distortion
      const distorted = fisheye(d.projected[0], d.projected[1], fisheyeFocus, fisheyeRadius);
      fisheyeGroup.append('circle')
        .attr('class', 'fisheye-listing selected-listing')
        .attr('cx', distorted.x)
        .attr('cy', distorted.y)
        .attr('r', listingBubbleRadius)
        .attr('fill', '#FF5722')
        .attr('fill-opacity', 0.9)
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.02)
        .style('pointer-events', 'none'); // Prevent interaction with selected bubble
    })
    .on('mouseover', function(this: SVGCircleElement) {
      d3.select(this)
        .attr('fill', '#FF5722')
        .attr('r', listingBubbleRadius * 1.5);
    })
    .on('mouseout', function(this: SVGCircleElement) {
      d3.select(this)
        .attr('fill', '#2196F3')
        .attr('r', listingBubbleRadius);
    });
  
  // Render or update selected listing if it exists
  // First check if it's in the fisheye radius
  if (selectedListingData) {
    // Selected listing is inside fisheye - render with distortion
    const distorted = fisheye(
      selectedListingData.projected[0], 
      selectedListingData.projected[1], 
      fisheyeFocus, 
      fisheyeRadius
    );
    
    // Remove any existing selected listing
    fisheyeGroup.selectAll<SVGCircleElement, unknown>('.selected-listing').remove();
    
    // Create selected listing bubble with fisheye distortion
    fisheyeGroup.append('circle')
      .attr('class', 'fisheye-listing selected-listing')
      .attr('cx', distorted.x)
      .attr('cy', distorted.y)
      .attr('r', listingBubbleRadius)
      .attr('fill', '#FF5722')
      .attr('fill-opacity', 0.9)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.02)
      .style('pointer-events', 'none');
  } else if (selectedListingId) {
    // Selected listing exists but is outside fisheye - keep it at original position
    const selectedListing = listings.find(l => l.id === selectedListingId);
    if (selectedListing) {
      const projected = projection([selectedListing.longitude, selectedListing.latitude]);
      if (projected) {
        // Check if there's already a selected bubble, if not create one
        let selectedBubble = fisheyeGroup.select<SVGCircleElement>('.selected-listing');
        
        if (selectedBubble.empty()) {
          selectedBubble = fisheyeGroup.append('circle')
            .attr('class', 'fisheye-listing selected-listing')
            .attr('fill', '#FF5722')
            .attr('fill-opacity', 0.9)
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.02)
            .style('pointer-events', 'none');
        }
        
        // Update position without fisheye distortion
        selectedBubble
          .attr('cx', projected[0])
          .attr('cy', projected[1])
          .attr('r', listingBubbleRadius);
      }
    }
  }
}

/**
 * Applies fisheye distortion to SVG path and polygon elements
 * @param container D3 selection of the container element
 * @param fisheyeFocus Focus point of the fisheye
 * @param fisheyeRadius Radius of the fisheye lens
 * @param originalPaths Map storing original path strings
 */
export function applyFisheyeToBasemap(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  fisheyeFocus: [number, number],
  fisheyeRadius: number,
  originalPaths: Map<SVGPathElement | SVGPolygonElement, string>
): void {
  // Select all base map paths (land and state borders)
  const paths = container.selectAll<SVGPathElement, unknown>('path.land, path.border--state');
  
  paths.each(function() {
    const pathElement = this;
    
    // Store original path if not already stored
    if (!originalPaths.has(pathElement)) {
      const originalD = pathElement.getAttribute('d');
      if (originalD) {
        originalPaths.set(pathElement, originalD);
      }
    }
    
    // Get original path
    const originalD = originalPaths.get(pathElement);
    if (!originalD) return;
    
    // Parse and distort path
    const distortedPath = distortPathString(originalD, fisheyeFocus, fisheyeRadius);
    d3.select(pathElement).attr('d', distortedPath);
  });
  
  // Select all neighborhood field polygons and city boundary polygons
  const polygons = container.selectAll<SVGPolygonElement, unknown>('.neighborhood-fields polygon, .city-boundaries polygon');
  
  polygons.each(function() {
    const polygonElement = this;
    
    // Store original points if not already stored
    if (!originalPaths.has(polygonElement)) {
      const originalPoints = polygonElement.getAttribute('points');
      if (originalPoints) {
        originalPaths.set(polygonElement, originalPoints);
      }
    }
    
    // Get original points
    const originalPoints = originalPaths.get(polygonElement);
    if (!originalPoints) return;
    
    // Parse and distort polygon points
    const distortedPoints = distortPolygonPoints(originalPoints, fisheyeFocus, fisheyeRadius);
    d3.select(polygonElement).attr('points', distortedPoints);
  });
}

/**
 * Restores original paths and polygons without fisheye distortion
 * @param container D3 selection of the container element
 * @param originalPaths Map storing original path/polygon strings
 */
export function restoreBasemapPaths(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  originalPaths: Map<SVGPathElement | SVGPolygonElement, string>
): void {
  const paths = container.selectAll<SVGPathElement, unknown>('path.land, path.border--state');
  
  paths.each(function() {
    const pathElement = this;
    const originalD = originalPaths.get(pathElement);
    if (originalD) {
      d3.select(pathElement).attr('d', originalD);
    }
  });
  
  const polygons = container.selectAll<SVGPolygonElement, unknown>('.neighborhood-fields polygon, .city-boundaries polygon');
  
  polygons.each(function() {
    const polygonElement = this;
    const originalPoints = originalPaths.get(polygonElement);
    if (originalPoints) {
      d3.select(polygonElement).attr('points', originalPoints);
    }
  });
}

/**
 * Distorts an SVG path string using fisheye transformation
 * @param pathString Original SVG path string
 * @param focus Focus point of the fisheye
 * @param fisheyeRadius Radius of the fisheye lens
 * @returns Distorted path string
 */
function distortPathString(
  pathString: string,
  focus: [number, number],
  fisheyeRadius: number
): string {
  // Parse path commands
  const commands = pathString.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (!commands) return pathString;
  
  let distortedCommands: string[] = [];
  
  for (const command of commands) {
    const type = command[0];
    const coords = command.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
    
    if (type === 'M' || type === 'L') {
      // Move or Line commands: distort x,y pairs
      const distortedCoords: number[] = [];
      for (let i = 0; i < coords.length; i += 2) {
        const distorted = fisheye(coords[i], coords[i + 1], focus, fisheyeRadius);
        distortedCoords.push(distorted.x, distorted.y);
      }
      distortedCommands.push(`${type}${distortedCoords.join(',')}`);
    } else if (type === 'C') {
      // Cubic Bezier: distort all 3 control points
      const distortedCoords: number[] = [];
      for (let i = 0; i < coords.length; i += 2) {
        const distorted = fisheye(coords[i], coords[i + 1], focus, fisheyeRadius);
        distortedCoords.push(distorted.x, distorted.y);
      }
      distortedCommands.push(`${type}${distortedCoords.join(',')}`);
    } else if (type === 'Z' || type === 'z') {
      // Close path: no coordinates
      distortedCommands.push(type);
    } else {
      // For other commands, keep original (or implement as needed)
      distortedCommands.push(command);
    }
  }
  
  return distortedCommands.join('');
}

/**
 * Distorts SVG polygon points using fisheye transformation
 * @param pointsString Original polygon points string (e.g., "x1,y1 x2,y2 x3,y3")
 * @param focus Focus point of the fisheye
 * @param fisheyeRadius Radius of the fisheye lens
 * @returns Distorted points string
 */
function distortPolygonPoints(
  pointsString: string,
  focus: [number, number],
  fisheyeRadius: number
): string {
  // Parse points: "x1,y1 x2,y2 x3,y3" format
  const pointPairs = pointsString.trim().split(/\s+/);
  const distortedPoints: string[] = [];
  
  for (const pair of pointPairs) {
    const coords = pair.split(',').map(parseFloat);
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      const distorted = fisheye(coords[0], coords[1], focus, fisheyeRadius);
      distortedPoints.push(`${distorted.x},${distorted.y}`);
    }
  }
  
  return distortedPoints.join(' ');
}
