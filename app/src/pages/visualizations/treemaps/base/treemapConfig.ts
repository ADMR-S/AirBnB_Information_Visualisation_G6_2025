import * as d3 from 'd3';

export const TREEMAP_CONFIG = {
  defaultWidth: 600,
  defaultHeight: 500,
  paddingInner: 6,
  paddingOuter: 8,
  minWidthForLabel: 50,
  minWidthForListingCount: 60,
} as const;

export function createTreemapLayout(width: number, height: number) {
  return d3.treemap<any>()
    .size([width, height])
    .paddingInner(TREEMAP_CONFIG.paddingInner)
    .paddingOuter(TREEMAP_CONFIG.paddingOuter);
}

export function prepareHierarchy(data: any) {
  return d3.hierarchy(data)
    .sum((d: any) => (d.value > 0 ? Math.log1p(d.value) : 0))
    .sort((a, b) => (b.value || 0) - (a.value || 0));
}

