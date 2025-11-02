import * as d3 from 'd3';
import type { AirbnbListing } from '../../../../types/airbnb.types';
import { showTooltip, hideTooltip } from '../../../../utils/tooltip';
import { getApplicableBadgesByConcentration, type BadgeConfig } from './visualBadges';

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
  // Create a container group for zoom/pan
  const container = svg.selectAll('.treemap-container')
    .data([null])
    .join('g')
    .attr('class', 'treemap-container');

  // Function to update content visibility and scale based on zoom level
  const updateContentVisibility = (scale: number) => {
    container.selectAll('.leaf-node').each(function(d: any) {
      const node = d3.select(this);
      const width = (d.x1 - d.x0) * scale;
      const height = (d.y1 - d.y0) * scale;
      
      // Show text only if rectangle is large enough after zoom
      const showTitle = width > 110 && height > 40;
      const showCount = width > 110 && height > 70;
      
      // Scale all text inversely with zoom to maintain consistent visual size
      node.select('.node-title')
        .style('display', showTitle ? 'block' : 'none')
        .attr('font-size', `${1.25 / scale}rem`);
      
      node.select('.node-count')
        .style('display', showCount ? 'block' : 'none')
        .attr('font-size', `${1.0 / scale}rem`);
      
      node.select('.node-badge')
        .attr('font-size', `${1.0 / scale}rem`);
    });
  };

  // Setup zoom behavior
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 8]) // Allow zoom from 50% to 800%
    .on('zoom', (event) => {
      container.attr('transform', event.transform);
      updateContentVisibility(event.transform.k);
    });

  // Apply zoom to SVG and reset zoom on double-click
  svg.call(zoom as any)
    .on('dblclick.zoom', null) // Disable default double-click zoom
    .on('dblclick', () => {
      // Reset zoom on double-click
      svg.transition().duration(750).call(zoom.transform as any, d3.zoomIdentity);
    });

  // Create a group element for each leaf node
  // Position it at the computed treemap coordinates
  const nodes = container.selectAll('.leaf-node')
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
        // Reset zoom before drilling down
        svg.transition().duration(500).call(zoom.transform as any, d3.zoomIdentity);
        options.onDrillDown(d.data);
      }
    });

  // Add text labels (hidden by default, shown on zoom) - positioned relatively
  nodes.append('text')
    .attr('class', 'node-title')
    .attr('x', (d: any) => (d.x1 - d.x0) * 0.05) // 5% from left edge
    .attr('y', (d: any) => (d.y1 - d.y0) * 0.2) // 20% from top
    .text((d: any) => d.data.name)
    .attr('font-size', '1.25rem')
    .attr('fill', 'white')
    .attr('font-weight', 'bold')
    .style('pointer-events', 'none')
    .style('display', 'none'); // Hidden by default

  nodes.append('text')
    .attr('class', 'node-count')
    .attr('x', (d: any) => (d.x1 - d.x0) * 0.05) // 5% from left edge
    .attr('y', (d: any) => (d.y1 - d.y0) * 0.4) // 40% from top
    .text((d: any) => `${d.data.totalListings} listings`)
    .attr('font-size', '1rem')
    .attr('fill', 'white')
    .style('pointer-events', 'none')
    .style('display', 'none'); // Hidden by default

  // Add badges (always visible, centered in rectangles)
  nodes.each(function(d: any) {
    const width = d.x1 - d.x0;
    const height = d.y1 - d.y0;

    // Get applicable badges based on listing concentration
    if (!options.badges || !options.badgeThresholds || !options.minConcentrations) return;
    
    const nodeListings = d.data.listings;
    if (!nodeListings || !Array.isArray(nodeListings) || nodeListings.length === 0) return;
    
    const applicableBadges = getApplicableBadgesByConcentration(
      nodeListings,
      options.badges,
      options.badgeThresholds,
      options.minConcentrations
    );
    
    if (applicableBadges.length > 0) {
      const badgeIcons = applicableBadges.map(b => b.icon).join(' ');
      
      d3.select(this).append('text')
        .attr('class', 'node-badge')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .text(badgeIcons)
        .attr('font-size', '1rem')
        .attr('fill', 'white')
        .style('pointer-events', 'none');
    }
  });

  // Initialize content visibility at default zoom level
  updateContentVisibility(1);
}
