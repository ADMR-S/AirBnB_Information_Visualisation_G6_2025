import * as d3 from 'd3';
import type { AirbnbListing } from '../../../../types/airbnb.types';
import { showTooltip, hideTooltip } from '../../../../utils/tooltip';
import { getApplicableBadgesByConcentration, type BadgeConfig } from './visualBadges';
import { TREEMAP_CONFIG } from './treemapConfig';

export interface TreemapNode {
  name: string;
  level?: string;
  value?: number;
  avgPrice?: number;
  avgAvailability?: number;
  totalListings?: number;
  avgReviews?: number;
  avgReviewsPerMonth?: number;
  parentState?: string;
  listings?: AirbnbListing[];
  children?: TreemapNode[];
}

export function aggregateListings(listings: AirbnbListing[]) {
  return {
    value: listings.length,
    totalListings: listings.length,
    avgPrice: d3.mean(listings, d => d.price) || 0,
    avgAvailability: d3.mean(listings, d => d.availability_365) || 0,
    avgReviews: d3.mean(listings, d => d.number_of_reviews) || 0,
    avgReviewsPerMonth: d3.mean(listings, d => d.reviews_per_month) || 0,
    listings,
  };
}

export function categorizeHostSize(count: number): string {
  if (count === 1) return 'Individual Hosts (1 listing)';
  if (count <= 5) return 'Small Hosts (2-5 listings)';
  if (count <= 20) return 'Medium Hosts (6-20 listings)';
  return 'Large Hosts (21+ listings)';
}

export function categorizeAvailability(avail: number): string {
  if (avail >= 270) return 'Year-round (270+ days)';
  if (avail >= 180) return 'Long-term (180-269 days)';
  if (avail >= 90) return 'Medium-term (90-179 days)';
  return 'Short-term (<90 days)';
}

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
 */
export function renderTreemapSVG(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  root: d3.HierarchyRectangularNode<any>,
  options: {
    colorFn: (d: any) => string;
    tooltipFn: (d: any) => string;
    badges?: BadgeConfig[];
    badgeThresholds?: Map<BadgeConfig, number>;
    minConcentrations?: Map<BadgeConfig, number>; // Minimum % of exceptional listings to show badge (per badge)
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
    8,
    25,
    (d: any) => (d.x1 - d.x0 < TREEMAP_CONFIG.minWidthForLabel ? '' : d.data.name),
    '20px',
    true
  );

  // Add listing count and badge icons
  nodes.each(function(d: any) {
    const width = d.x1 - d.x0;
    
    // Skip text if rectangle too narrow
    if (width < TREEMAP_CONFIG.minWidthForListingCount) return;

    // Render the listing count text
    d3.select(this).append('text')
      .attr('x', 8)
      .attr('y', 55)
      .text(`${d.data.totalListings} listings`)
      .attr('font-size', '18px')
      .attr('fill', 'var(--color-text-white)')
      .style('pointer-events', 'none');

    // Get applicable badges based on listing concentration
    let applicableBadges: BadgeConfig[] = [];
    if (options.badges && options.badgeThresholds && options.minConcentrations) {
      const nodeListings = d.data.listings;
      if (nodeListings && Array.isArray(nodeListings) && nodeListings.length > 0) {
        applicableBadges = getApplicableBadgesByConcentration(
          nodeListings,
          options.badges,
          options.badgeThresholds,
          options.minConcentrations
        );
      }
    }
    
    // Render badge icons on a separate line below
    if (applicableBadges.length > 0) {
      const badgeIcons = applicableBadges.map(b => b.icon).join(' ');
      d3.select(this).append('text')
        .attr('x', 8)
        .attr('y', 88)
        .text(badgeIcons)
        .attr('font-size', '20px')
        .attr('fill', 'var(--color-text-white)')
        .style('pointer-events', 'none');
    }
  });
}
