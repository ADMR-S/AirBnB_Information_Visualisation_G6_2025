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
 * @param onClose Callback when popup is closed
 */
export function showListingPopup(
  listing: AirbnbListing,
  position: [number, number],
  onClose: () => void
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
    onClose();
  });
  
  return popup;
}

/**
 * Renders individual listing bubbles within fisheye lens
 * @param container D3 selection of the container element
 * @param listings Array of listings to render
 * @param projection D3 geo projection
 * @param fisheyeFocus Focus point of the fisheye
 * @param zoomLevel Current zoom level
 */
export function renderFisheyeListings(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  listings: AirbnbListing[],
  projection: d3.GeoProjection,
  fisheyeFocus: [number, number],
  zoomLevel: number
): void {
  // Remove existing fisheye elements
  container.selectAll('.fisheye-listing').remove();
  container.selectAll('.fisheye-lens-circle').remove();
  
  const fisheyeRadius = getFisheyeRadius(zoomLevel);
  // Bubble size decreases as zoom increases
  const baseBubbleRadius = MAP_CONFIG.fisheye.listingBubbleRadius;
  const listingBubbleRadius = baseBubbleRadius / Math.sqrt(zoomLevel);
  
  // Draw fisheye lens circle
  container.append('circle')
    .attr('class', 'fisheye-lens-circle')
    .attr('cx', fisheyeFocus[0])
    .attr('cy', fisheyeFocus[1])
    .attr('r', fisheyeRadius)
    .style('pointer-events', 'none');
  
  // Project listings and filter those within fisheye radius
  const projectedListings = listings
    .map(listing => {
      const projected = projection([listing.longitude, listing.latitude]);
      if (!projected) return null;
      
      const dx = projected[0] - fisheyeFocus[0];
      const dy = projected[1] - fisheyeFocus[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > fisheyeRadius) return null;
      
      return { listing, projected };
    })
    .filter((d): d is { listing: AirbnbListing; projected: [number, number] } => d !== null);
  
  // Create a group for fisheye listings
  const fisheyeGroup = container.append('g').attr('class', 'fisheye-listings-group');
  
  // Render individual listing bubbles
  fisheyeGroup
    .selectAll<SVGCircleElement, typeof projectedListings[0]>('circle.fisheye-listing')
    .data(projectedListings)
    .enter()
    .append('circle')
    .attr('class', 'fisheye-listing')
    .attr('cx', d => {
      const distorted = fisheye(d.projected[0], d.projected[1], fisheyeFocus, fisheyeRadius);
      return distorted.x;
    })
    .attr('cy', d => {
      const distorted = fisheye(d.projected[0], d.projected[1], fisheyeFocus, fisheyeRadius);
      return distorted.y;
    })
    .attr('r', listingBubbleRadius)
    .attr('fill', '#2196F3')
    .attr('fill-opacity', 0.7)
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.15)
    .style('cursor', 'pointer')
    .on('click', function(event: MouseEvent, d) {
      event.stopPropagation();
      const rect = (event.target as SVGCircleElement).getBoundingClientRect();
      showListingPopup(
        d.listing,
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        () => {
          // Popup closed callback
        }
      );
    })
    .on('mouseover', function() {
      d3.select(this)
        .attr('fill', '#FF5722')
        .attr('r', listingBubbleRadius * 1.5);
    })
    .on('mouseout', function() {
      d3.select(this)
        .attr('fill', '#2196F3')
        .attr('r', listingBubbleRadius);
    });
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
