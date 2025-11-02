import * as d3 from 'd3';
import type { AirbnbListing } from '../../../types/airbnb.types';
import { showTooltip, hideTooltip } from '../../../utils/tooltip';
import { getApplicableBadges, type BadgeConfig } from '../../../utils/visualBadges';
import { TREEMAP_CONFIG } from './treemapConfig';

/**
 * Represents a node in the treemap hierarchy
 * Can be a parent (with children) or a leaf node
 */
export interface TreemapNode {
  /** Display name for this node */
  name: string;
  
  /** Hierarchy level: 'state', 'city', 'room_type', 'host_category', etc. */
  level?: string;
  
  /** Numeric value used for sizing */
  value?: number;
  
  /** Average price across listings in this node */
  avgPrice?: number;
  
  /** Average availability (days/year) across listings */
  avgAvailability?: number;
  
  /** Total number of listings in this node */
  totalListings?: number;
  
  /** Average number of reviews across listings */
  avgReviews?: number;
  
  /** Parent state name (used for navigation breadcrumbs) */
  parentState?: string;
  
  /** Child nodes (undefined for leaf nodes) */
  children?: TreemapNode[];
}

/**
 * Aggregates raw listing data into summary statistics
 * Used to compute metrics for each treemap node
 * 
 * @param listings - Array of Airbnb listings to aggregate
 * @returns Object with computed metrics (value, prices, availability, reviews)
 */
export function aggregateListings(listings: AirbnbListing[]) {
  return {
    value: listings.length,
    totalListings: listings.length,
    avgPrice: d3.mean(listings, d => d.price) || 0,
    avgAvailability: d3.mean(listings, d => d.availability_365) || 0,
    avgReviews: d3.mean(listings, d => d.number_of_reviews) || 0,
  };
}

/**
 * Categorizes hosts by their total listing count
 * Used in Host view to show different host size segments
 * 
 * @param count - Number of listings the host has
 * @returns Human-readable category label
 */
export function categorizeHostSize(count: number): string {
  if (count === 1) return 'Individual Hosts (1 listing)';
  if (count <= 5) return 'Small Hosts (2-5 listings)';
  if (count <= 20) return 'Medium Hosts (6-20 listings)';
  return 'Large Hosts (21+ listings)';
}

/**
 * Categorizes listings by their annual availability
 * Used in Traveler view to show availability segments
 * 
 * @param avail - Number of available days per year (0-365)
 * @returns Human-readable availability category
 */
export function categorizeAvailability(avail: number): string {
  if (avail >= 270) return 'Year-round (270+ days)';
  if (avail >= 180) return 'Long-term (180-269 days)';
  if (avail >= 90) return 'Medium-term (90-179 days)';
  return 'Short-term (<90 days)';
}

/**
 * Helper to add text labels to SVG nodes
 * Handles positioning, styling, and conditional rendering based on size
 * 
 * @param nodes - D3 selection of nodes to add text to
 * @param x - X position offset from node origin
 * @param y - Y position offset from node origin
 * @param getText - Function to extract text content from data
 * @param fontSize - CSS font-size value (e.g., '12px')
 * @param bold - Whether to bold the text
 */
const addText = (
  nodes: any,
  x: number,
  y: number,
  getText: (d: any) => string,
  fontSize: string,
  bold = false
) => {
  nodes.append('text')
    .attr('x', x)
    .attr('y', y)
    .text(getText)
    .attr('font-size', fontSize)
    .attr('fill', 'white')
    .attr('font-weight', bold ? 'bold' : 'normal')
    .style('pointer-events', 'none');
};

/**
 * Renders a treemap visualization as SVG
 * 
 * Creates a hierarchical treemap with interactive rectangles representing data nodes.
 * Each rectangle is sized by value (log scale), colored by a metric, and shows
 * labels with optional badge indicators.
 * 
 * Features:
 * - Click to drill down (except on final level)
 * - Hover for tooltips
 * - Automatic label hiding for small rectangles
 * - Inline badge icons for highlighted nodes
 * 
 * @param svg - D3 selection of the SVG element to render into
 * @param root - Computed D3 hierarchy with layout coordinates
 * @param options - Rendering configuration
 * @param options.colorFn - Function to determine fill color for each node
 * @param options.tooltipFn - Function to generate HTML tooltip content
 * @param options.badges - Optional array of badge configs to display on nodes
 * @param options.onDrillDown - Callback when user clicks a node to drill down
 * @param options.finalLevel - Level name where drilling stops (leaf level)
 */
export function renderTreemapSVG(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  root: d3.HierarchyRectangularNode<any>,
  options: {
    colorFn: (d: any) => string;
    tooltipFn: (d: any) => string;
    badges?: BadgeConfig[];
    badgeThresholds?: Map<BadgeConfig, number>;
    onDrillDown: (data: any) => void;
    finalLevel: string;
  }
) {
  // Create a group element for each leaf node
  // Position it at the computed treemap coordinates
  const nodes = svg.selectAll('.leaf-node')
    .data(root.leaves())
    .join('g')
    .attr('class', 'leaf-node')
    .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

  // Render the colored rectangle for each node
  nodes.append('rect')
    .attr('width', (d: any) => d.x1 - d.x0)
    .attr('height', (d: any) => d.y1 - d.y0)
    .attr('fill', (d: any) => options.colorFn(d))
    .attr('stroke', 'white')
    .attr('stroke-width', 2)
    // Show pointer cursor only if node is drillable (not at final level)
    .style('cursor', (d: any) => 
      d.data.level !== options.finalLevel ? 'pointer' : 'default'
    )
    // Hover effects: dim and show tooltip
    .on('mouseover', function(event, d: any) {
      d3.select(this).attr('opacity', 0.8);
      showTooltip(event, options.tooltipFn(d));
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 1);
      hideTooltip();
    })
    // Click to drill down (if not at final level)
    .on('click', function(event, d: any) {
      event.stopPropagation();
      if (d.data.level !== options.finalLevel) {
        options.onDrillDown(d.data);
      }
    });

  // Add node name label (hidden if rectangle too narrow)
  addText(
    nodes,
    4,
    16,
    (d: any) => (d.x1 - d.x0 < TREEMAP_CONFIG.minWidthForLabel ? '' : d.data.name),
    '12px',
    true
  );

  // Add listing count with inline badge icons
  nodes.each(function(d: any) {
    const width = d.x1 - d.x0;
    
    // Skip text if rectangle too narrow
    if (width < TREEMAP_CONFIG.minWidthForListingCount) return;

    // Get applicable badges and their icons
    const applicableBadges = options.badges
      ? getApplicableBadges(d.data, options.badges, options.badgeThresholds)
      : [];
    const badgeIcons = applicableBadges.map(b => b.icon).join(' ');
    
    // Build text: "X listings 🔥 ⭐"
    const text = `${d.data.totalListings} listings${badgeIcons ? ' ' + badgeIcons : ''}`;

    // Render the text element
    d3.select(this).append('text')
      .attr('x', 4)
      .attr('y', 32)
      .text(text)
      .attr('font-size', '10px')
      .attr('fill', 'var(--color-text-white)')
      .style('pointer-events', 'none');
  });
}
