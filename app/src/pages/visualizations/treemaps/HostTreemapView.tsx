import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import { EXAMPLE_BADGES, type BadgeConfig } from '../../../utils/visualBadges';
import { calculateNaturalBreaks, createLabels } from '../../../utils/naturalBreaks';
import { sampleColors, createColorBreaks, getColorForValue, COLOR_PALETTES } from '../../../utils/colorScale';
import { aggregateListings, categorizeHostSize, renderTreemapSVG, type TreemapNode } from './treemapHelpers';
import { TREEMAP_CONFIG, createTreemapLayout, prepareHierarchy } from './treemapConfig';
import { useTreemapNavigation } from './useTreemapNavigation';
import '../VisualizationPage.css';
import './TreemapView.css';

export default function HostTreemapView() {
  const { isLoading, states, cities } = useFilterStore();
  const filteredData = useFilteredData();
  const { currentLevel, handleClick } = useTreemapNavigation();
  const svgRef = useRef<SVGSVGElement>(null);

  const priceBreaks = useMemo(() => {
    const prices = filteredData.map(d => d.price).filter(p => p > 0);
    if (prices.length === 0) return [];
    
    const breaks = calculateNaturalBreaks(prices, 6);
    const labels = createLabels(breaks, '$', '');
    const colors = sampleColors(breaks.length - 1, COLOR_PALETTES.greenToRed.start, COLOR_PALETTES.greenToRed.end);
    return createColorBreaks(breaks, labels, colors);
  }, [filteredData]);

  const badges: BadgeConfig[] = [EXAMPLE_BADGES.highPrice, EXAMPLE_BADGES.popular];

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
    
    // Level 2: Show host size categories (within selected city)
    if (currentLevel === 2) {
      const grouped = d3.group(filteredData, d => categorizeHostSize(d.calculated_host_listings_count));
      return {
        name: 'root',
        children: Array.from(grouped, ([category, listings]) => ({
          name: category,
          level: 'host_category',
          ...aggregateListings(listings),
        })),
      };
    }
    
    // Level 3: Show room types (final level)
    const grouped = d3.group(filteredData, d => d.room_type);
    return {
      name: 'root',
      children: Array.from(grouped, ([roomType, listings]) => ({
        name: roomType,
        level: 'room_type',
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
    const width = svgElement.clientWidth //|| TREEMAP_CONFIG.defaultWidth;
    const height = svgElement.clientHeight //|| TREEMAP_CONFIG.defaultHeight;

    // Prepare data hierarchy
    const root = prepareHierarchy(buildHierarchy());

    // Apply treemap layout
    createTreemapLayout(width, height)(root as any);

    // Render the treemap
    renderTreemapSVG(svg, root as any, {
      colorFn: (d) => getColorForValue(d.data.avgPrice, priceBreaks, '#999'),
      tooltipFn: (d) => `
        <strong>${d.data.name}</strong><br/>
        Listings: ${d.data.totalListings}<br/>
        Avg Price: $${d.data.avgPrice.toFixed(2)}<br/>
        Avg Reviews: ${Math.round(d.data.avgReviews)}
      `,
      badges,
      onDrillDown: handleClick,
      finalLevel: 'room_type',
    });
  };

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  const stats = {
    min: Math.round(d3.min(filteredData, d => d.price) || 0),
    avg: Math.round(d3.mean(filteredData, d => d.price) || 0),
    max: Math.round(d3.max(filteredData, d => d.price) || 500),
  };

  return (
    <div className="viz-container">
        <h2>Market Structure Analysis</h2>
        <p className="viz-description">Geographic distribution of your properties (${filteredData.length.toLocaleString()} listings)</p>

      <div className="treemap-with-legend">
        <div className="treemap-container">
          <svg ref={svgRef} className="treemap-svg"></svg>
        </div>

        <div className="legend">
          <div className="legend-section">
            <div className="legend-title">Price Ranges</div>
            <div className="legend-stats">
              <div className="legend-stat"><span>Min:</span><span>${stats.min.toLocaleString()}</span></div>
              <div className="legend-stat"><span>Avg:</span><span>${stats.avg.toLocaleString()}</span></div>
              <div className="legend-stat"><span>Max:</span><span>${stats.max.toLocaleString()}</span></div>
            </div>
            <div className="price-breaks-legend">
              {priceBreaks.map((b, i) => (
                <div key={i} className="price-break-item">
                  <div className="price-break-color" style={{ backgroundColor: b.color }}></div>
                  <span className="price-break-label">{b.label}</span>
                </div>
              ))}
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
