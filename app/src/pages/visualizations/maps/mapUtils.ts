import * as d3 from 'd3';
import { MAP_CONFIG } from './mapConfig';

/**
 * Creates the Albers USA projection with standard configuration
 * @returns Configured D3 GeoProjection
 */
export function createProjection(): d3.GeoProjection {
  return d3.geoAlbersUsa()
    .scale(MAP_CONFIG.projection.scale)
    .translate(MAP_CONFIG.projection.translate);
}

/**
 * Creates a color scale for bubble visualization
 * @param maxValue Maximum value for the domain
 * @returns D3 Sequential Scale
 */
export function createColorScale(maxValue: number): d3.ScaleSequential<string> {
  const [min, max] = MAP_CONFIG.colors.interpolateRange;
  return d3.scaleSequential()
    .domain([0, maxValue])
    .interpolator(t => d3.interpolateBlues(min + t * (max - min)));
}

/**
 * Creates a color scale for neighborhoods from green (cheap) to red (expensive)
 * @param minValue Minimum price value (will be green)
 * @param maxValue Maximum price value (will be red)
 * @returns D3 Sequential Scale
 */
export function createNeighborhoodPriceColorScale(minValue: number, maxValue: number) {
  return d3.scaleSequential(d3.interpolateRdYlGn)
    .domain([maxValue, minValue]); // Reversed domain: high values -> red (0.0), low values -> green (1.0)
}

/**
 * Creates a radius scale for bubble sizes
 * @param maxValue Maximum value for the domain
 * @param sizeRange Tuple of [min, max] radius sizes
 * @returns D3 Scale Sqrt
 */
export function createRadiusScale(maxValue: number, sizeRange: [number, number]) {
  return d3.scaleSqrt()
    .domain([0, maxValue])
    .range(sizeRange);
}

/**
 * Creates a null projection path for pre-projected coordinates
 * @returns D3 GeoPath with null projection
 */
export function createNullProjectionPath(): d3.GeoPath {
  return d3.geoPath().projection(null);
}
