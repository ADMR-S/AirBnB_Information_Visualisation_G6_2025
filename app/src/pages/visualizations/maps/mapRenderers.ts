import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { BubbleData, NeighborhoodField, CityBoundary } from '../../../types/bubbleMap.types';
import { MAP_CONFIG } from './mapConfig';
import { createRadiusScale } from './mapUtils';
import { showTooltip, hideTooltip, updateTooltipPosition } from '../../../utils/tooltip';

/**
 * Creates bubbles on the map based on specified parameters
 * @param container D3 selection of the container element
 * @param projection D3 GeoProjection for coordinate transformation
 * @param bubbleData Array of bubble data to render
 * @param maxSizeValue Maximum size value for scaling
 * @param sizeRange Tuple of [min, max] bubble radius sizes
 * @param globalMinPrice Optional global minimum price for consistent color scale
 * @param globalMaxPrice Optional global maximum price for consistent color scale
 */
export function makeBubbles(
  container: d3.Selection<SVGSVGElement | SVGGElement, unknown, null, undefined>,
  projection: d3.GeoProjection,
  bubbleData: BubbleData[],
  maxSizeValue: number,
  sizeRange: [number, number] = MAP_CONFIG.bubbles.neighborhoodSizeRange,
  globalMinPrice?: number,
  globalMaxPrice?: number
) {
  // Create scales
  const radiusScale = createRadiusScale(maxSizeValue, sizeRange);
  
  // Use global prices if provided, otherwise calculate from current bubble data
  let minPrice: number;
  let maxPrice: number;
  
  if (globalMinPrice !== undefined && globalMaxPrice !== undefined) {
    minPrice = globalMinPrice;
    maxPrice = globalMaxPrice;
  } else {
    const prices = bubbleData.map(d => d.colorValue);
    minPrice = d3.min(prices) || 0;
    maxPrice = d3.max(prices) || 1;
  }
  
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([maxPrice, minPrice]);

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
    .attr("fill", d => colorScale(d.colorValue) as string)
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
  
  // Group neighborhoods by city to create per-city color scales
  const neighborhoodsByCity = d3.group(neighborhoodFields, d => d.city);
  
  // Create color scale per city (min price -> green, max price -> red)
  const cityColorScales = new Map<string, ReturnType<typeof d3.scaleSequential>>();
  neighborhoodsByCity.forEach((neighborhoods, city) => {
    const prices = neighborhoods.map(n => n.avgPrice);
    const minPrice = d3.min(prices) || 0;
    const maxPrice = d3.max(prices) || 1;
    
    // Use RdYlGn interpolator with reversed domain (high price = red = 0, low price = green = 1)
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([maxPrice, minPrice]);
    
    cityColorScales.set(city, colorScale);
  });

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

    // Get the color scale for this city
    const colorScale = cityColorScales.get(field.city);
    const fillColor: string = colorScale ? colorScale(field.avgPrice) as string : '#cccccc';
    
    // Draw the hull polygon
    fieldsGroup.append("polygon")
      .attr("points", points)
      .attr("fill", fillColor)
      .attr("fill-opacity", MAP_CONFIG.neighborhoodFields.fillOpacity)
      .attr("stroke", fillColor)
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

/**
 * Renders the size legend showing the relationship between circle size and number of listings
 * @param svg D3 selection of the SVG element
 * @param width Width of the SVG
 * @param height Height of the SVG
 * @param maxValue Maximum value for scaling
 * @param sizeRange Tuple of [min, max] bubble radius sizes
 */
export function renderSizeLegend(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  maxValue: number,
  sizeRange: [number, number] = MAP_CONFIG.bubbles.neighborhoodSizeRange
) {
  // Remove existing size legend
  svg.selectAll('.size-legend').remove();
  
  // Create radius scale
  const radiusScale = createRadiusScale(maxValue, sizeRange);
  
  // Define legend values (proportional to max value)
  const legendValues = [
    Math.round(maxValue * 0.25),
    Math.round(maxValue * 0.5),
    maxValue
  ];
  
  // Create legend group - fixed position, not affected by zoom
  const legend = svg.append("g")
    .attr("class", "size-legend")
    .attr("transform", `translate(${width - 120}, ${height - 40})`);
  
  // Add title
  legend.append("text")
    .attr("x", -30)
    .attr("y", -55)
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("fill", "#333")
    .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
    .text("Number of listings");
  
  // Create circles for each value
  const circles = legend.selectAll("g.legend-circle")
    .data(legendValues)
    .enter().append("g")
    .attr("class", "legend-circle");
  
  circles.append("circle")
    .attr("cy", d => -radiusScale(d))
    .attr("r", d => radiusScale(d))
    .attr("fill", "none")
    .attr("stroke", "#333")
    .attr("stroke-width", 1.5);
  
  circles.append("text")
    .attr("y", d => -2 * radiusScale(d))
    .attr("dy", "1.3em")
    .attr("x", d => radiusScale(d) + 18)
    .attr("font-size", "11px")
    .attr("font-weight", "bold")
    .attr("fill", "#333")
    .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
    .text(d => d3.format(",")(d));
}

/**
 * Renders the color legend showing the relationship between color and price
 * @param svg D3 selection of the SVG element
 * @param width Width of the SVG
 * @param height Height of the SVG
 * @param minPrice Minimum price value
 * @param maxPrice Maximum price value
 */
export function renderColorLegend(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  minPrice: number,
  maxPrice: number
) {
  // Remove existing color legend
  svg.selectAll('.color-legend').remove();
  
  // Create color scale (same as used for bubbles: high price = red, low price = green)
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
    .domain([maxPrice, minPrice]);
  
  // Create legend group - fixed position, not affected by zoom
  // Position it above the size legend (which is at height - 80)
  const legend = svg.append("g")
    .attr("class", "color-legend")
    .attr("transform", `translate(${width - 150}, ${height - 200})`);
  
  // Add title
  legend.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("fill", "#333")
    .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
    .text("Average price");
  
  const circleRadius = 8;
  const circleSpacing = 30;
  
  // Data for the two circles
  const priceData = [
    { price: minPrice, label: "Less expensive", y: 25 },
    { price: maxPrice, label: "Most expensive", y: 25 + circleSpacing }
  ];
  
  // Create circles and labels
  priceData.forEach(item => {
    // Draw circle
    legend.append("circle")
      .attr("cx", 10)
      .attr("cy", item.y)
      .attr("r", circleRadius)
      .attr("fill", colorScale(item.price) as string)
      .attr("stroke", "#333")
      .attr("stroke-width", 1.5);
    
    // Add label text with price in parentheses
    legend.append("text")
      .attr("x", 10 + circleRadius + 8)
      .attr("y", item.y)
      .attr("dy", "0.35em")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("fill", "#333")
      .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
      .text(`${item.label} ($${Math.round(item.price)})`);
  });
}

/**
 * Renders the reviews legend showing the relationship between color and number of reviews
 * @param svg D3 selection of the SVG element
 * @param width Width of the SVG
 * @param height Height of the SVG
 * @param minReviews Minimum review count
 * @param maxReviews Maximum review count
 */
export function renderReviewsLegend(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  minReviews: number,
  maxReviews: number
) {
  // Remove existing reviews legend
  svg.selectAll('.reviews-legend').remove();
  
  // Create color scale for reviews (medium blue to dark blue)
  const colorScale = d3.scaleSequential((t: number) => d3.interpolateBlues(0.3 + t * 0.7))
    .domain([minReviews, maxReviews]);
  
  // Create legend group - positioned at the same place as price legend
  const legend = svg.append("g")
    .attr("class", "reviews-legend")
    .attr("transform", `translate(${width - 150}, ${height - 200})`);
  
  // Add title
  legend.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("fill", "#333")
    .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
    .text("Number of reviews");
  
  const circleRadius = 8;
  const circleSpacing = 30;
  
  // Data for the two circles
  const reviewData = [
    { reviews: minReviews, label: "Few reviews", y: 25 },
    { reviews: maxReviews, label: "Many reviews", y: 25 + circleSpacing }
  ];
  
  // Create circles and labels
  reviewData.forEach(item => {
    // Draw circle
    legend.append("circle")
      .attr("cx", 10)
      .attr("cy", item.y)
      .attr("r", circleRadius)
      .attr("fill", colorScale(item.reviews) as string)
      .attr("stroke", "#333")
      .attr("stroke-width", 1.5);
    
    // Add label text with review count in parentheses
    legend.append("text")
      .attr("x", 10 + circleRadius + 8)
      .attr("y", item.y)
      .attr("dy", "0.35em")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("fill", "#333")
      .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
      .text(`${item.label} (${Math.round(item.reviews)})`);
  });
}

