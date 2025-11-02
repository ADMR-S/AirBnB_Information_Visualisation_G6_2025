import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { BubbleData, NeighborhoodField, CityBoundary } from '../../../types/bubbleMap.types';
import { MAP_CONFIG } from './mapConfig';
import { createColorScale, createRadiusScale } from './mapUtils';
import { showTooltip, hideTooltip, updateTooltipPosition } from '../../../utils/tooltip';

/**
 * Creates bubbles on the map based on specified parameters
 * @param container D3 selection of the container element
 * @param projection D3 GeoProjection for coordinate transformation
 * @param bubbleData Array of bubble data to render
 * @param maxSizeValue Maximum size value for scaling
 * @param sizeRange Tuple of [min, max] bubble radius sizes
 */
export function makeBubbles(
  container: d3.Selection<SVGSVGElement | SVGGElement, unknown, null, undefined>,
  projection: d3.GeoProjection,
  bubbleData: BubbleData[],
  maxSizeValue: number,
  sizeRange: [number, number] = MAP_CONFIG.bubbles.neighborhoodSizeRange
) {
  // Create scales
  const radiusScale = createRadiusScale(maxSizeValue, sizeRange);
  const maxColorValue = d3.max(bubbleData, d => d.colorValue) || 1;
  const colorScale = createColorScale(maxColorValue);

  // Pre-project all coordinates for performance
  const projectedBubbles = bubbleData.map(d => {
    const projected = projection([d.longitude, d.latitude]);
    return {
      ...d,
      x: projected ? projected[0] : 0,
      y: projected ? projected[1] : 0
    };
  });

  // Sort by size (largest first) so large bubbles are drawn behind small ones
  projectedBubbles.sort((a, b) => b.sizeValue - a.sizeValue);

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
    .attr("fill-opacity", MAP_CONFIG.bubbles.fillOpacity)
    .attr("stroke", MAP_CONFIG.bubbles.strokeColor)
    .attr("stroke-width", MAP_CONFIG.bubbles.strokeWidth)
    .on("mouseover", function(event: MouseEvent, d: any) {
      const content = `<strong>${d.label}</strong><br/>Listings: ${d.sizeValue}<br/>Avg Price: $${d.colorValue.toFixed(0)}`;
      showTooltip(event, content);
    })
    .on("mousemove", function(event: MouseEvent) {
      updateTooltipPosition(event);
    })
    .on("mouseout", function() {
      hideTooltip();
    });
}

/**
 * Creates neighborhood fields (quadrilaterals) based on coordinate bounds
 * @param container D3 selection of the container element
 * @param projection D3 GeoProjection for coordinate transformation
 * @param neighborhoodFields Array of neighborhood field data
 */
export function makeNeighborhoodFields(
  container: d3.Selection<SVGSVGElement | SVGGElement, unknown, null, undefined>,
  projection: d3.GeoProjection,
  neighborhoodFields: NeighborhoodField[]
) {
  if (MAP_CONFIG.DEBUG_LOG) {
    console.log(`[makeNeighborhoodFields] Rendering ${neighborhoodFields.length} neighborhoods`);
  }
  
  const maxAvgPrice = d3.max(neighborhoodFields, d => d.avgPrice) || 1;
  const colorScale = createColorScale(maxAvgPrice);

  const fieldsGroup = container.append("g").attr("class", "neighborhood-fields");

  let successCount = 0;
  let failCount = 0;

  neighborhoodFields.forEach((field, index) => {
    // Log first few fields
    if (MAP_CONFIG.DEBUG_LOG && index < 3) {
      const lngs = field.hullPoints.map(p => p[0]);
      const lats = field.hullPoints.map(p => p[1]);
      console.log(`[Field ${index}] ${field.label}:`, {
        hullPoints: field.hullPoints.length,
        bounds: `lng [${Math.min(...lngs).toFixed(4)}, ${Math.max(...lngs).toFixed(4)}], lat [${Math.min(...lats).toFixed(4)}, ${Math.max(...lats).toFixed(4)}]`,
        listings: field.count,
        avgPrice: field.avgPrice.toFixed(2)
      });
    }

    // Project all hull points
    const projectedPoints: [number, number][] = [];
    let allValid = true;
    
    for (const [lng, lat] of field.hullPoints) {
      const projected = projection([lng, lat]);
      if (projected) {
        projectedPoints.push(projected);
      } else {
        allValid = false;
        break;
      }
    }

    // Log first few projections
    if (MAP_CONFIG.DEBUG_LOG && index < 3) {
      console.log(`  Projected ${projectedPoints.length} hull points`);
      if (projectedPoints.length > 0) {
        console.log(`  First point: [${projectedPoints[0][0].toFixed(1)}, ${projectedPoints[0][1].toFixed(1)}]`);
      }
    }

    // Skip if any projection fails
    if (!allValid || projectedPoints.length < 3) {
      failCount++;
      if (MAP_CONFIG.DEBUG_LOG && index < 5) {
        console.warn(`[Projection FAILED] ${field.label}: ${allValid ? 'Not enough points' : 'Some points returned null'}`);
      }
      return;
    }

    successCount++;

    // Create polygon points string from all hull points
    const points = projectedPoints.map(p => `${p[0]},${p[1]}`).join(' ');

    // Draw the hull polygon
    fieldsGroup.append("polygon")
      .attr("points", points)
      .attr("fill", colorScale(field.avgPrice))
      .attr("fill-opacity", MAP_CONFIG.neighborhoodFields.fillOpacity)
      .attr("stroke", colorScale(field.avgPrice))
      .attr("stroke-width", MAP_CONFIG.neighborhoodFields.strokeWidth)
      .attr("stroke-opacity", MAP_CONFIG.neighborhoodFields.strokeOpacity)
      .style("cursor", "pointer")
      .append("title")
      .text(`${field.label}\nListings: ${field.count}\nAvg Price: $${field.avgPrice.toFixed(0)}`);
  });

  if (MAP_CONFIG.DEBUG_LOG) {
    console.log(`[makeNeighborhoodFields] Result: ${successCount} rendered, ${failCount} failed projection`);
  }
}

/**
 * Renders city boundaries as convex hull polygons
 * @param container D3 selection of the container element
 * @param projection D3 geo projection
 * @param cityBoundaries Array of city boundary data
 */
export function makeCityBoundaries(
  container: d3.Selection<SVGSVGElement | SVGGElement, unknown, null, undefined>,
  projection: d3.GeoProjection,
  cityBoundaries: CityBoundary[]
): void {
  if (MAP_CONFIG.DEBUG_LOG) {
    console.log(`[makeCityBoundaries] Rendering ${cityBoundaries.length} city boundaries`);
  }

  const boundariesGroup = container.append("g").attr("class", "city-boundaries");

  let successCount = 0;
  let failCount = 0;

  cityBoundaries.forEach((boundary, index) => {
    // Project all hull points
    const projectedPoints: [number, number][] = [];
    let allValid = true;
    
    for (const [lng, lat] of boundary.hullPoints) {
      const projected = projection([lng, lat]);
      if (projected) {
        projectedPoints.push(projected);
      } else {
        allValid = false;
        break;
      }
    }

    // Skip if any projection fails
    if (!allValid || projectedPoints.length < 3) {
      failCount++;
      if (MAP_CONFIG.DEBUG_LOG && index < 5) {
        console.warn(`[City Boundary FAILED] ${boundary.city}: ${allValid ? 'Not enough points' : 'Some points returned null'}`);
      }
      return;
    }

    successCount++;

    // Create polygon points string from all hull points
    const points = projectedPoints.map(p => `${p[0]},${p[1]}`).join(' ');

    // Draw the city boundary polygon (just outline, no fill)
    boundariesGroup.append("polygon")
      .attr("points", points)
      .attr("fill", "none")
      .attr("stroke", "#333")
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.4)
      .attr("stroke-dasharray", "3,3")
      .style("pointer-events", "none")  // Don't block interaction with neighborhoods
      .append("title")
      .text(`${boundary.city} boundary\n${boundary.totalListings.toLocaleString()} total listings`);
  });

  if (MAP_CONFIG.DEBUG_LOG) {
    console.log(`[makeCityBoundaries] Result: ${successCount} rendered, ${failCount} failed projection`);
  }
}

/**
 * Loads and renders the base US map (land and state borders)
 * @param container D3 selection of the container element
 * @param path D3 GeoPath for rendering
 * @param onComplete Callback function to execute after map is loaded
 */
export async function renderBaseMap(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  path: d3.GeoPath,
  onComplete?: () => void
) {
  try {
    const module = await import('./baseMap/us.json');
    const us: any = module.default;
    
    if (!us) return;

    container.append("path")
      .datum(topojson.feature(us, us.objects.nation))
      .attr("class", "land")
      .attr("d", path);

    container.append("path")
      .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
      .attr("class", "border border--state")
      .attr("d", path);

    if (onComplete) {
      onComplete();
    }
  } catch (error) {
    console.error('Error loading map:', error);
  }
}
