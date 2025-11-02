import * as d3 from 'd3';
import { EXAMPLE_BADGES } from './base/visualBadges';
import { categorizeHostSize } from './base/treemapHelpers';
import BaseTreemapView from './base/BaseTreemapView';
import type { TreemapViewConfig } from './base/TreemapViewConfig';

const HOST_CONFIG: TreemapViewConfig = {
  title: 'Market Structure Analysis',
  description: 'Geographic distribution of your properties ({count} listings)',
  badges: [EXAMPLE_BADGES.popular, EXAMPLE_BADGES.highActivity],
  finalLevel: 'room_type',

  buildHierarchy: (filteredData, currentLevel, aggregate) => {
    if (currentLevel === 0) {
      const grouped = d3.group(filteredData, d => d.state);
      return { name: 'root', children: Array.from(grouped, ([state, listings]) => 
        ({ name: state, level: 'state', ...aggregate(listings) })) };
    }
    if (currentLevel === 1) {
      const grouped = d3.group(filteredData, d => d.city);
      return { name: 'root', children: Array.from(grouped, ([city, listings]) => 
        ({ name: city, level: 'city', parentState: listings[0]?.state, ...aggregate(listings) })) };
    }
    if (currentLevel === 2) {
      const grouped = d3.group(filteredData, d => d.neighbourhood);
      return { name: 'root', children: Array.from(grouped, ([neighbourhood, listings]) => 
        ({ name: neighbourhood, level: 'neighbourhood', ...aggregate(listings) })) };
    }
    if (currentLevel === 3) {
      const grouped = d3.group(filteredData, d => categorizeHostSize(d.calculated_host_listings_count));
      return { name: 'root', children: Array.from(grouped, ([category, listings]) => 
        ({ name: category, level: 'host_category', ...aggregate(listings) })) };
    }
    const grouped = d3.group(filteredData, d => d.room_type);
    return { name: 'root', children: Array.from(grouped, ([roomType, listings]) => 
      ({ name: roomType, level: 'room_type', ...aggregate(listings) })) };
  },

  createColorScale: (nodes) => {
    const prices = nodes.map((n: any) => n.avgPrice).filter((p: number) => p > 0);
    const q10 = d3.quantile(prices.sort(d3.ascending), 0.1) || 0;
    const q90 = d3.quantile(prices.sort(d3.ascending), 0.9) || 500;
    const purpleScale = d3.scaleSequential()
      .domain([q10, q90])
      .interpolator(t => d3.interpolateRgb('#4a148c', '#e1bee7')(t * 0.7 + 0.3))
      .clamp(true);
    return (price: number) => purpleScale(q90 + q10 - price);
  },

  getColorValue: (node) => node.avgPrice,
  
  getTooltipContent: (node) => `
    <strong>${node.name}</strong><br/>
    Listings: ${node.totalListings}<br/>
    Avg Price: $${node.avgPrice.toFixed(2)}<br/>
    Avg Reviews: ${Math.round(node.avgReviews)}
  `,

  getLegendColor: () => 'linear-gradient(to bottom, #e1bee7 0%, #ba68c8 25%, #9c27b0 50%, #7b1fa2 75%, #4a148c 100%)',
  getLegendLabels: () => ({ high: 'High', low: 'Low' }),
  getStats: (data) => ({
    min: Math.round(d3.min(data, d => d.price) || 0),
    avg: Math.round(d3.mean(data, d => d.price) || 0),
    max: Math.round(d3.max(data, d => d.price) || 500),
    unit: '$',
  }),
};

export default function HostTreemapView() {
  return <BaseTreemapView config={HOST_CONFIG} />;
}
