import * as d3 from 'd3';

/**
 * Shared treemap layout configuration
 * Used by both Host and Traveler treemap views
 */
export const TREEMAP_CONFIG = {
  /** Default dimensions if container size cannot be determined */
  defaultWidth: 600,
  defaultHeight: 500,
  
  /** Padding between sibling rectangles */
  paddingInner: 6,
  
  /** Padding around the outer edge of the treemap */
  paddingOuter: 8,
  
  /** Minimum width threshold for showing text labels */
  minWidthForLabel: 50,
  
  /** Minimum width threshold for showing listing count */
  minWidthForListingCount: 60,
} as const;

/**
 * Creates a configured D3 treemap layout
 * 
 * @param width - Width of the treemap
 * @param height - Height of the treemap
 * @returns Configured D3 treemap function
 */
export function createTreemapLayout(width: number, height: number) {
  return d3.treemap<any>()
    .size([width, height])
    .paddingInner(TREEMAP_CONFIG.paddingInner)
    .paddingOuter(TREEMAP_CONFIG.paddingOuter);
}

/**
 * Prepares hierarchy data for treemap rendering
 * Uses logarithmic scaling for better visual distribution
 * 
 * @param data - Hierarchical data structure
 * @returns D3 hierarchy with computed values
 */
export function prepareHierarchy(data: any) {
  return d3.hierarchy(data)
    .sum((d: any) => (d.value > 0 ? Math.log1p(d.value) : 0))
    .sort((a, b) => (b.value || 0) - (a.value || 0));
}

