import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { BubbleData, NeighborhoodField } from '../../../types/bubbleMap.types';
import { MAP_CONFIG } from './mapConfig';
import { createColorScale, createRadiusScale } from './mapUtils';

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
    .append("title")
    .text(d => `${d.label}\nListings: ${d.sizeValue}\nAvg Price: $${d.colorValue.toFixed(0)}`);
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
      console.log(`[Field ${index}] ${field.label}:`, {
        coords: `lng [${field.minLng.toFixed(4)}, ${field.maxLng.toFixed(4)}], lat [${field.minLat.toFixed(4)}, ${field.maxLat.toFixed(4)}]`,
        span: `lng: ${(field.maxLng - field.minLng).toFixed(4)}°, lat: ${(field.maxLat - field.minLat).toFixed(4)}°`,
        listings: field.count,
        avgPrice: field.avgPrice.toFixed(2)
      });
    }

    // Project all four corners of the bounding box
    const topLeft = projection([field.minLng, field.maxLat]);
    const topRight = projection([field.maxLng, field.maxLat]);
    const bottomLeft = projection([field.minLng, field.minLat]);
    const bottomRight = projection([field.maxLng, field.minLat]);

    // Log first few projections
    if (MAP_CONFIG.DEBUG_LOG && index < 3) {
      console.log(`  Projected corners:`, {
        topLeft: topLeft ? `[${topLeft[0].toFixed(1)}, ${topLeft[1].toFixed(1)}]` : 'null',
        topRight: topRight ? `[${topRight[0].toFixed(1)}, ${topRight[1].toFixed(1)}]` : 'null',
        bottomLeft: bottomLeft ? `[${bottomLeft[0].toFixed(1)}, ${bottomLeft[1].toFixed(1)}]` : 'null',
        bottomRight: bottomRight ? `[${bottomRight[0].toFixed(1)}, ${bottomRight[1].toFixed(1)}]` : 'null'
      });
    }

    // Skip if any projection fails
    if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
      failCount++;
      if (MAP_CONFIG.DEBUG_LOG && index < 5) {
        console.warn(`[Projection FAILED] ${field.label}: At least one corner is null`);
      }
      return;
    }

    successCount++;

    // Create polygon points string for quadrilateral (top-left, top-right, bottom-right, bottom-left)
    const points = `${topLeft[0]},${topLeft[1]} ${topRight[0]},${topRight[1]} ${bottomRight[0]},${bottomRight[1]} ${bottomLeft[0]},${bottomLeft[1]}`;

    // Draw the quadrilateral polygon
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
