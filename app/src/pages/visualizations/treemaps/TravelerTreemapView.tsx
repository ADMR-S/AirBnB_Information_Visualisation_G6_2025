import * as d3 from 'd3';
import { EXAMPLE_BADGES } from './base/visualBadges';
import { categorizeAvailability } from './base/treemapHelpers';
import BaseTreemapView from './base/BaseTreemapView';
import type { TreemapViewConfig } from './base/TreemapViewConfig';

const TRAVELER_CONFIG: TreemapViewConfig = {
  title: 'Availability Explorer',
  description: 'Geographic distribution of listings available ({count} listings)',
  badges: [EXAMPLE_BADGES.popular, EXAMPLE_BADGES.highActivity],
  finalLevel: 'availability_category',

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
      const grouped = d3.group(filteredData, d => d.room_type);
      return { name: 'root', children: Array.from(grouped, ([roomType, listings]) => 
        ({ name: roomType, level: 'room_type', ...aggregate(listings) })) };
    }
    const grouped = d3.group(filteredData, d => categorizeAvailability(d.availability_365));
    return { name: 'root', children: Array.from(grouped, ([category, listings]) => 
      ({ name: category, level: 'availability_category', ...aggregate(listings) })) };
  },

  createColorScale: (nodes) => {
    const availabilities = nodes.map((n: any) => n.avgAvailability);
    const q10 = d3.quantile(availabilities.sort(d3.ascending), 0.1) || 0;
    const q90 = d3.quantile(availabilities.sort(d3.ascending), 0.9) || 365;
    return d3.scaleSequential()
      .domain([q10, q90])
      .interpolator(t => d3.interpolateRgb('#0d47a1', '#90caf9')(t * 0.7 + 0.3))
      .clamp(true);
  },

  getColorValue: (node) => node.avgAvailability,
  
  getTooltipContent: (node) => `
    <strong>${node.name}</strong><br/>
    Listings: ${node.totalListings}<br/>
    Avg Availability: ${Math.round(node.avgAvailability)} days/year<br/>
    Avg Price: $${node.avgPrice.toFixed(2)}
  `,

  getLegendColor: () => 'linear-gradient(to bottom, #90caf9 0%, #64b5f6 25%, #42a5f5 50%, #1e88e5 75%, #0d47a1 100%)',
  getLegendLabels: () => ({ high: 'High', low: 'Low' }),
  getStats: (data) => ({
    min: d3.min(data, d => d.availability_365) || 0,
    avg: Math.round(d3.mean(data, d => d.availability_365) || 0),
    max: d3.max(data, d => d.availability_365) || 365,
    unit: '',
  }),
};

export default function TravelerTreemapView() {
  return <BaseTreemapView config={TRAVELER_CONFIG} />;
}
