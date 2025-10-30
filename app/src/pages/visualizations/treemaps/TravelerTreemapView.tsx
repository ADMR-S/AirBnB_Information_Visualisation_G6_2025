import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import { EXAMPLE_BADGES, type BadgeConfig } from '../../../utils/visualBadges';
import { aggregateListings, categorizeAvailability, renderTreemapSVG, type TreemapNode } from './treemapHelpers';
import '../VisualizationPage.css';
import './TreemapView.css';

export default function TravelerTreemapView() {
  const { isLoading, states, cities, setStates, setCities } = useFilterStore();
  const filteredData = useFilteredData();
  const svgRef = useRef<SVGSVGElement>(null);

  // Derive current level from filter state
  const currentLevel = states.length === 0 ? 0 
                     : cities.length === 0 ? 1 
                     : 2;

  const badges: BadgeConfig[] = [
    EXAMPLE_BADGES.highAvailability,
    { ...EXAMPLE_BADGES.popular, threshold: 50 },
  ];

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
      const grouped = d3.group(filteredData, d => d.city, d => d.room_type);
      return {
        name: 'root',
        children: Array.from(grouped, ([city, roomTypes]) => ({
          name: city,
          level: 'city',
          children: Array.from(roomTypes, ([roomType, listings]) => ({
            name: roomType,
            level: 'room_type',
            ...aggregateListings(listings),
          })),
        })),
      };
    }
    
    if (currentLevel === 2) {
      const grouped = d3.group(filteredData, d => d.room_type, d => categorizeAvailability(d.availability_365));
      return {
        name: 'root',
        children: Array.from(grouped, ([roomType, categories]) => ({
          name: roomType,
          level: 'room_type',
          children: Array.from(categories, ([category, listings]) => ({
            name: category,
            level: 'availability_category',
            ...aggregateListings(listings),
          })),
        })),
      };
    }
    
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

    const width = svgElement.clientWidth || 600;
    const height = svgElement.clientHeight || 500;
    const levelName = ['state', 'city', 'room_type', 'availability_category'][currentLevel];

    const root = d3.hierarchy(buildHierarchy())
      .sum((d: any) => (d.value > 0 ? Math.log1p(d.value) : 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3.treemap<any>()
      .size([width, height])
      .paddingTop(levelName === 'availability_category' ? 20 : 25)
      .paddingInner(2)
      (root as any);

    const colorScale = d3.scaleSequential()
      .domain([0, 365])
      .interpolator(d3.interpolateRgb('#ef4444', '#4ade80'));

    renderTreemapSVG(svg, root as any, levelName, {
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
      <div className="treemap-header">
        <h2>Availability Explorer</h2>
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
