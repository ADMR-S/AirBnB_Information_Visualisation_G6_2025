import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import { EXAMPLE_BADGES, type BadgeConfig } from '../../../utils/visualBadges';
import { calculateNaturalBreaks, createLabels } from '../../../utils/naturalBreaks';
import { sampleColors, createColorBreaks, getColorForValue, COLOR_PALETTES } from '../../../utils/colorScale';
import { aggregateListings, categorizeHostSize, renderTreemapSVG, type TreemapNode } from './treemapHelpers';
import '../VisualizationPage.css';
import './TreemapView.css';

export default function HostTreemapView() {
  const { isLoading, states, cities, setStates, setCities } = useFilterStore();
  const filteredData = useFilteredData();
  const svgRef = useRef<SVGSVGElement>(null);

  // Derive current level from filter state
  const currentLevel = states.length === 0 ? 0 
                     : cities.length === 0 ? 1 
                     : 2;

  const priceBreaks = useMemo(() => {
    const prices = filteredData.map(d => d.price).filter(p => p > 0);
    if (prices.length === 0) return [];
    
    const breaks = calculateNaturalBreaks(prices, 6);
    const labels = createLabels(breaks, '$', '');
    const colors = sampleColors(breaks.length - 1, COLOR_PALETTES.greenToRed.start, COLOR_PALETTES.greenToRed.end);
    return createColorBreaks(breaks, labels, colors);
  }, [filteredData]);

  const badges: BadgeConfig[] = [EXAMPLE_BADGES.highPrice, EXAMPLE_BADGES.popular];

  // Click handler to set filters directly
  const handleClick = (item: any) => {
    if (!item.level || !item.name) return;
    
    if (item.level === 'state') {
      setStates([item.name]);
      setCities([]);
    } else if (item.level === 'city') {
      if (states.length === 0 && item.parentState) {
        setStates([item.parentState]);
      }
      setCities([item.name]);
    }
  };

  // Navigation handler for breadcrumbs
  const handleNavigate = (level: number) => {
    if (level === -1) {
      setStates([]);
      setCities([]);
    } else if (level === 0) {
      setCities([]);
    }
  };

  useEffect(() => {
    if (isLoading || filteredData.length === 0) return;
    renderTreemap();
  }, [filteredData, isLoading, states, cities]);

  const buildHierarchy = (): TreemapNode => {
    if (currentLevel === 0) {
      const grouped = d3.group(filteredData, d => d.state, d => d.city);
      return {
        name: 'root',
        children: Array.from(grouped, ([state, cities]) => ({
          name: state,
          level: 'state',
          children: Array.from(cities, ([city, listings]) => ({
            name: city,
            level: 'city',
            parentState: state,
            ...aggregateListings(listings),
          })),
        })),
      };
    }
    
    if (currentLevel === 1) {
      const grouped = d3.group(filteredData, d => d.city, d => categorizeHostSize(d.calculated_host_listings_count));
      return {
        name: 'root',
        children: Array.from(grouped, ([city, categories]) => ({
          name: city,
          level: 'city',
          children: Array.from(categories, ([category, listings]) => ({
            name: category,
            level: 'host_category',
            ...aggregateListings(listings),
          })),
        })),
      };
    }
    
    if (currentLevel === 2) {
      const grouped = d3.group(filteredData, d => categorizeHostSize(d.calculated_host_listings_count), d => d.room_type);
      return {
        name: 'root',
        children: Array.from(grouped, ([category, roomTypes]) => ({
          name: category,
          level: 'host_category',
          children: Array.from(roomTypes, ([roomType, listings]) => ({
            name: roomType,
            level: 'room_type',
            ...aggregateListings(listings),
          })),
        })),
      };
    }
    
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

    const width = svgElement.clientWidth || 600;
    const height = svgElement.clientHeight || 500;
    const levelName = ['state', 'city', 'host_category', 'room_type'][currentLevel];

    const root = d3.hierarchy(buildHierarchy())
      .sum((d: any) => (d.value > 0 ? Math.log1p(d.value) : 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3.treemap<any>()
      .size([width, height])
      .paddingTop(levelName === 'room_type' ? 20 : 25)
      .paddingInner(2)
      (root as any);

    renderTreemapSVG(svg, root as any, levelName, {
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
      <div className="treemap-header">
        <h2>Market Structure Analysis</h2>
      </div>

      <div className="breadcrumb-nav">
        <button className="breadcrumb-item" onClick={() => handleNavigate(-1)}>
          All States
        </button>
        {states.length === 1 && (
          <span>
            <span className="breadcrumb-separator">›</span>
            <button className="breadcrumb-item" onClick={() => handleNavigate(0)}>
              {states[0]}
            </button>
          </span>
        )}
        {cities.length === 1 && (
          <span>
            <span className="breadcrumb-separator">›</span>
            <button className="breadcrumb-item" onClick={() => handleNavigate(1)}>
              {cities[0]}
            </button>
          </span>
        )}
      </div>

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
            Size = Listings (log scale)<br/>Colors = Natural price breaks
          </div>
        </div>
      </div>
    </div>
  );
}
