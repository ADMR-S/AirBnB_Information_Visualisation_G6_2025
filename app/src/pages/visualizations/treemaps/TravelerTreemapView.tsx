import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import { EXAMPLE_BADGES, type BadgeConfig } from '../../../utils/visualBadges';
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

  const badges: BadgeConfig[] = [
    EXAMPLE_BADGES.highAvailability,
    { ...EXAMPLE_BADGES.popular, threshold: 50 },
  ];

  useEffect(() => {
    if (isLoading || filteredData.length === 0) return;
    renderTreemap();
  }, [filteredData, isLoading, states, cities]);

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

    // Color scale for availability (red = low, green = high)
    const colorScale = d3.scaleSequential()
      .domain([0, 365])
      .interpolator(d3.interpolateRgb('#ef4444', '#4ade80'));

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

  return (
    <div className="viz-container">
      <h2>Availability Explorer</h2>
      <p className="viz-description">Geographic distribution of listings available (${filteredData.length.toLocaleString()} listings)</p>

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
              <div className="color-bar" style={{ background: 'linear-gradient(to bottom, #22c55e 0%, #84cc16 25%, #eab308 50%, #f97316 75%, #ef4444 100%)' }}></div>
              <div className="color-labels">
                <span>High</span>
                <span>Low</span>
              </div>
            </div>
          </div>

          <div className="legend-section">
            <div className="legend-title">Indicators</div>
            <div className="badge-legend">
              {badges.map((badge, i) => (
                <div key={i} className="badge-item">
                  <span className="badge-icon">{badge.icon}</span>
                  <span className="badge-label">{badge.label} ({badge.threshold}+)</span>
                </div>
              ))}
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
