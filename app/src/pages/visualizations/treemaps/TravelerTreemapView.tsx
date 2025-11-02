import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import { EXAMPLE_BADGES, type BadgeConfig, calculateBadgeThresholds } from '../../../utils/visualBadges';
import { aggregateListings, categorizeAvailability, renderTreemapSVG, type TreemapNode } from './treemapHelpers';
import { TREEMAP_CONFIG, createTreemapLayout, prepareHierarchy } from './treemapConfig';
import { useTreemapNavigation } from './useTreemapNavigation';
import '../VisualizationPage.css';
import './TreemapView.css';

export default function TravelerTreemapView() {
  const { isLoading, states, cities } = useFilterStore();
  const filteredData = useFilteredData();
  const { currentLevel, handleClick } = useTreemapNavigation();
  const svgRef = useRef<SVGSVGElement>(null);

  // Don't use highAvailability badge since color already encodes availability
  const baseBadges: BadgeConfig[] = [
    EXAMPLE_BADGES.popular,
  ];

  // State for badge percentiles
  const [badgePercentiles, setBadgePercentiles] = useState<Map<string, number>>(
    new Map(baseBadges.map(b => [b.label, b.percentile ?? 75]))
  );

  // Create badges with current percentiles
  const badges: BadgeConfig[] = baseBadges.map(badge => ({
    ...badge,
    percentile: badgePercentiles.get(badge.label) ?? badge.percentile ?? 75,
  }));

  useEffect(() => {
    if (isLoading || filteredData.length === 0) return;
    renderTreemap();
  }, [filteredData, isLoading, states, cities, badgePercentiles]);

  // Build simplified hierarchy - one level at a time (no nested parent/child groups)
  const buildHierarchy = (): TreemapNode => {
    // Level 0: Show states
    if (currentLevel === 0) {
      const grouped = d3.group(filteredData, d => d.state);
      return {
        name: 'root',
        children: Array.from(grouped, ([state, listings]) => ({
          name: state,
          level: 'state',
          ...aggregateListings(listings),
        })),
      };
    }
    
    // Level 1: Show cities (within selected state)
    if (currentLevel === 1) {
      const grouped = d3.group(filteredData, d => d.city);
      return {
        name: 'root',
        children: Array.from(grouped, ([city, listings]) => {
          const parentState = listings[0]?.state;
          return {
            name: city,
            level: 'city',
            parentState,
            ...aggregateListings(listings),
          };
        }),
      };
    }
    
    // Level 2: Show room types (within selected city)
    if (currentLevel === 2) {
      const grouped = d3.group(filteredData, d => d.room_type);
      return {
        name: 'root',
        children: Array.from(grouped, ([roomType, listings]) => ({
          name: roomType,
          level: 'room_type',
          ...aggregateListings(listings),
        })),
      };
    }
    
    // Level 3: Show availability categories (final level)
    const grouped = d3.group(filteredData, d => categorizeAvailability(d.availability_365));
    return {
      name: 'root',
      children: Array.from(grouped, ([category, listings]) => ({
        name: category,
        level: 'availability_category',
        ...aggregateListings(listings),
      })),
    };
  };

  const renderTreemap = () => {
    const svgElement = svgRef.current;
    if (!svgElement || filteredData.length === 0) return;

    const svg = d3.select(svgElement);
    svg.selectAll('*').remove();

    // Get dimensions
    const width = svgElement.clientWidth || TREEMAP_CONFIG.defaultWidth;
    const height = svgElement.clientHeight || TREEMAP_CONFIG.defaultHeight;

    // Prepare data hierarchy
    const root = prepareHierarchy(buildHierarchy());

    // Apply treemap layout
    createTreemapLayout(width, height)(root as any);

    // Calculate badge thresholds based on current nodes
    const nodes = (root as any).leaves().map((d: any) => d.data);
    const badgeThresholds = calculateBadgeThresholds(nodes, badges);

    // Get availability values for color domain (use quantiles to avoid washout)
    const availabilities = nodes.map((n: any) => n.avgAvailability);
    const q10 = d3.quantile(availabilities.sort(d3.ascending), 0.1) || 0;
    const q90 = d3.quantile(availabilities.sort(d3.ascending), 0.9) || 365;

    // Perceptually uniform color scale (RdYlGn reversed: red=low, green=high)
    const colorScale = d3.scaleSequential()
      .domain([q10, q90])
      .interpolator(d3.interpolateRdYlGn)
      .clamp(true);

    // Render the treemap
    renderTreemapSVG(svg, root as any, {
      colorFn: (d) => colorScale(d.data.avgAvailability),
      tooltipFn: (d) => `
        <strong>${d.data.name}</strong><br/>
        Listings: ${d.data.totalListings}<br/>
        Avg Availability: ${Math.round(d.data.avgAvailability)} days/year<br/>
        Avg Price: $${d.data.avgPrice.toFixed(2)}
      `,
      badges,
      badgeThresholds,
      onDrillDown: handleClick,
      finalLevel: 'availability_category',
    });
  };

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  const availabilities = filteredData.map(d => d.availability_365);
  const stats = {
    min: d3.min(availabilities) || 0,
    avg: Math.round(d3.mean(availabilities) || 0),
    max: d3.max(availabilities) || 365,
  };

  // Calculate badge thresholds for legend display
  const hierarchy = prepareHierarchy(buildHierarchy());
  const nodes = hierarchy.leaves().map((d: any) => d.data);
  const badgeThresholds = calculateBadgeThresholds(nodes, badges);

  return (
    <div className="viz-container">
      <h2>Availability Explorer</h2>
      <p className="viz-description">Geographic distribution of listings available ({filteredData.length.toLocaleString()} listings)</p>

      <div className="treemap-with-legend">
        <div className="treemap-container">
          <svg ref={svgRef} className="treemap-svg"></svg>
        </div>

        <div className="legend">
          <div className="legend-section">
            <div className="legend-title">Color Scale</div>
            <div className="legend-stats">
              <div className="legend-stat"><span>Min:</span><span>{stats.min}d</span></div>
              <div className="legend-stat"><span>Avg:</span><span>{stats.avg}d</span></div>
              <div className="legend-stat"><span>Max:</span><span>{stats.max}d</span></div>
            </div>
            <div className="color-scale">
              <div className="color-bar" style={{ background: 'linear-gradient(to bottom, #1a9641 0%, #a6d96a 33%, #ffffbf 50%, #fdae61 66%, #d7191c 100%)' }}></div>
              <div className="color-labels">
                <span>High</span>
                <span>Low</span>
              </div>
            </div>
          </div>

          <div className="legend-section">
            <div className="legend-title">Indicators</div>
            <div className="badge-legend">
              {badges.map((badge, i) => {
                const threshold = badgeThresholds.get(badge) ?? badge.defaultThreshold;
                const percentile = badgePercentiles.get(badge.label) ?? 75;
                const topPercent = 100 - percentile;
                const unit = badge.label === 'Available' ? 'd' : '';
                return (
                  <div key={i} className="badge-item-wrapper">
                    <div className="badge-item">
                      <span className="badge-icon">{badge.icon}</span>
                      <span className="badge-label">{badge.label} (top {topPercent}%: {Math.round(threshold)}{unit}+)</span>
                    </div>
                    <div className="badge-slider">
                      <input
                        type="range"
                        min="50"
                        max="95"
                        step="5"
                        value={percentile}
                        onChange={(e) => {
                          const newPercentiles = new Map(badgePercentiles);
                          newPercentiles.set(badge.label, parseInt(e.target.value));
                          setBadgePercentiles(newPercentiles);
                        }}
                        className="percentile-slider"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="legend-note">
            Size = Listings (log scale)
          </div>
        </div>
      </div>
    </div>
  );
}
