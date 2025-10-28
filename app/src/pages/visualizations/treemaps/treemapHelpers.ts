import * as d3 from 'd3';
import type { AirbnbListing } from '../../../types/airbnb.types';
import { showTooltip, hideTooltip } from '../../../utils/tooltip';
import { getApplicableBadges, type BadgeConfig } from '../../../utils/visualBadges';

export interface TreemapNode {
  name: string;
  level?: string;
  value?: number;
  avgPrice?: number;
  avgAvailability?: number;
  totalListings?: number;
  avgReviews?: number;
  parentState?: string;
  children?: TreemapNode[];
}

export function aggregateListings(listings: AirbnbListing[]) {
  return {
    value: listings.length,
    totalListings: listings.length,
    avgPrice: d3.mean(listings, d => d.price) || 0,
    avgAvailability: d3.mean(listings, d => d.availability_365) || 0,
    avgReviews: d3.mean(listings, d => d.number_of_reviews) || 0,
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

const addText = (nodes: any, x: number, y: number, getText: (d: any) => string, fontSize: string, bold = false) => {
  nodes.append('text')
    .attr('x', x)
    .attr('y', y)
    .text(getText)
    .attr('font-size', fontSize)
    .attr('fill', 'white')
    .attr('font-weight', bold ? 'bold' : 'normal')
    .style('pointer-events', 'none');
};

const addBadge = (g: any, x: number, badge: BadgeConfig) => {
  g.append('circle')
    .attr('cx', x).attr('cy', 14).attr('r', 11)
    .attr('fill', 'rgba(255, 255, 255, 0.95)')
    .attr('stroke', badge.color).attr('stroke-width', 2)
    .style('pointer-events', 'none');
  
  g.append('text')
    .attr('x', x).attr('y', 14)
    .text(badge.icon)
    .attr('font-size', '15px')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .style('pointer-events', 'none');
};

export function renderTreemapSVG(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  root: d3.HierarchyRectangularNode<any>,
  currentLevel: string,
  options: {
    colorFn: (d: any) => string;
    tooltipFn: (d: any) => string;
    badges?: BadgeConfig[];
    onDrillDown: (data: any) => void;
    finalLevel: string;
  }
) {
  if (['state', 'city', 'room_type', 'host_category'].includes(currentLevel)) {
    svg.selectAll('.parent-group')
      .data(root.children || [])
      .join('rect')
      .attr('class', 'parent-group')
      .attr('x', (d: any) => d.x0).attr('y', (d: any) => d.y0)
      .attr('width', (d: any) => d.x1 - d.x0).attr('height', 25)
      .attr('fill', '#f0f0f0').attr('stroke', '#ccc')
      .style('cursor', 'pointer')
      .on('click', (event, d: any) => {
        event.stopPropagation();
        options.onDrillDown(d.data);
      });

    svg.selectAll('.parent-label')
      .data(root.children || [])
      .join('text')
      .attr('class', 'parent-label')
      .attr('x', (d: any) => d.x0 + 4).attr('y', (d: any) => d.y0 + 17)
      .text((d: any) => d.data.name)
      .attr('font-size', '14px').attr('font-weight', 'bold').attr('fill', '#333')
      .style('pointer-events', 'none');
  }

  const nodes = svg.selectAll('.leaf-node')
    .data(root.leaves())
    .join('g')
    .attr('class', 'leaf-node')
    .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

  nodes.append('rect')
    .attr('width', (d: any) => d.x1 - d.x0)
    .attr('height', (d: any) => d.y1 - d.y0)
    .attr('fill', (d: any) => options.colorFn(d))
    .attr('stroke', 'white').attr('stroke-width', 2)
    .style('cursor', (d: any) => d.data.level !== options.finalLevel ? 'pointer' : 'default')
    .on('mouseover', function(event, d: any) {
      d3.select(this).attr('opacity', 0.8);
      showTooltip(event, options.tooltipFn(d));
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 1);
      hideTooltip();
    })
    .on('click', function(event, d: any) {
      event.stopPropagation();
      if (d.data.level !== options.finalLevel) options.onDrillDown(d.data);
    });

  addText(nodes, 4, 16, (d: any) => (d.x1 - d.x0 < 50 ? '' : d.data.name), '12px', true);
  addText(nodes, 4, 32, (d: any) => (d.x1 - d.x0 < 60 ? '' : `${d.data.totalListings} listings`), '10px');

  if (options.badges) {
    nodes.each(function(d: any) {
      const width = d.x1 - d.x0;
      if (width < 60) return;
      
      const applicableBadges = getApplicableBadges(d.data, options.badges!);
      if (applicableBadges.length === 0) return;
      
      applicableBadges.forEach((badge, i) => 
        addBadge(d3.select(this).append('g'), width - 12 - (i * 24), badge)
      );
    });
  }
}
