import type { BadgeConfig } from './visualBadges';
import type { AirbnbListing } from '../../../../types/airbnb.types';
import type { TreemapNode } from './treemapHelpers';

export interface TreemapViewConfig {
  title: string;
  description: string;
  badges: BadgeConfig[];
  buildHierarchy: (
    filteredData: AirbnbListing[], 
    currentLevel: number,
    aggregateListings: (listings: AirbnbListing[]) => any
  ) => TreemapNode;
  createColorScale: (nodes: any[]) => (value: number) => string;
  getColorValue: (node: any) => number;
  getTooltipContent: (node: any) => string;
  finalLevel: string;
  getLegendColor: () => React.CSSProperties['background'];
  getLegendLabels: () => { high: string; low: string };
  getStats: (filteredData: AirbnbListing[]) => { min: number; avg: number; max: number; unit: string };
}

