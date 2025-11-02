import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useFilterStore } from '../../../../stores/useFilterStore';
import { useFilteredData } from '../../../../hooks/useFilteredData';
import type { BadgeConfig } from './visualBadges';
import { aggregateListings, renderTreemapSVG } from './treemapHelpers';
import { TREEMAP_CONFIG, createTreemapLayout, prepareHierarchy } from './treemapConfig';
import { useTreemapNavigation } from './useTreemapNavigation';
import type { TreemapViewConfig } from './TreemapViewConfig';
import '../../VisualizationPage.css';
import './TreemapView.css';

interface BaseTreemapViewProps {
  config: TreemapViewConfig;
}

export default function BaseTreemapView({ config }: BaseTreemapViewProps) {
  const { isLoading } = useFilterStore();
  const filteredData = useFilteredData();
  const { currentLevel, handleClick } = useTreemapNavigation();
  const svgRef = useRef<SVGSVGElement>(null);

  const [badgeThresholds, setBadgeThresholds] = useState<Map<string, number>>(
    new Map(config.badges.map(b => [b.label, b.defaultThreshold]))
  );
  const [minConcentrations, setMinConcentrations] = useState<Map<string, number>>(
    new Map(config.badges.map(b => [b.label, 8]))
  );

  useEffect(() => {
    if (isLoading || filteredData.length === 0) return;
    renderTreemap();
  }, [filteredData, isLoading, badgeThresholds, minConcentrations, currentLevel]);

  const createThresholdMap = () => {
    const thresholdMap = new Map<BadgeConfig, number>();
    config.badges.forEach(badge => {
      thresholdMap.set(badge, badgeThresholds.get(badge.label) ?? badge.defaultThreshold);
    });
    return thresholdMap;
  };

  const createConcentrationMap = () => {
    const concentrationMap = new Map<BadgeConfig, number>();
    config.badges.forEach(badge => {
      concentrationMap.set(badge, minConcentrations.get(badge.label) ?? 8);
    });
    return concentrationMap;
  };

  const renderTreemap = () => {
    const svgElement = svgRef.current;
    if (!svgElement || filteredData.length === 0) return;

    const svg = d3.select(svgElement);
    svg.selectAll('*').remove();

    const width = svgElement.clientWidth || TREEMAP_CONFIG.defaultWidth;
    const height = svgElement.clientHeight || TREEMAP_CONFIG.defaultHeight;

    const root = prepareHierarchy(config.buildHierarchy(filteredData, currentLevel, aggregateListings));
    createTreemapLayout(width, height)(root as any);

    const nodes = (root as any).leaves().map((d: any) => d.data);
    const colorScale = config.createColorScale(nodes);

    renderTreemapSVG(svg, root as any, {
      colorFn: (d) => colorScale(config.getColorValue(d.data)),
      tooltipFn: (d) => config.getTooltipContent(d.data),
      badges: config.badges,
      badgeThresholds: createThresholdMap(),
      minConcentrations: createConcentrationMap(),
      onDrillDown: handleClick,
      finalLevel: config.finalLevel,
    });
  };

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  const stats = config.getStats(filteredData);

  return (
    <div className="viz-container">
      <h2>{config.title}</h2>
      <p className="viz-description">{config.description.replace('{count}', filteredData.length.toLocaleString())}</p>

      <div className="treemap-with-legend">
        <div className="treemap-container">
          <svg ref={svgRef} className="treemap-svg"></svg>
        </div>

        <div className="legend">
          <div className="legend-section">
            <div className="legend-title">Color Scale</div>
            <div className="legend-stats">
              <div className="legend-stat"><span>Min:</span><span>{stats.unit}{stats.min.toLocaleString()}</span></div>
              <div className="legend-stat"><span>Avg:</span><span>{stats.unit}{stats.avg.toLocaleString()}</span></div>
              <div className="legend-stat"><span>Max:</span><span>{stats.unit}{stats.max.toLocaleString()}</span></div>
            </div>
            <div className="color-scale">
              <div className="color-bar" style={{ background: config.getLegendColor() }}></div>
              <div className="color-labels">
                <span>{config.getLegendLabels().high}</span>
                <span>{config.getLegendLabels().low}</span>
              </div>
            </div>
          </div>

          <div className="legend-section">
            <div className="legend-title">Indicators</div>
            <div className="badge-legend">
              {config.badges.map((badge, i) => {
                const threshold = badgeThresholds.get(badge.label) ?? badge.defaultThreshold;
                const concentration = minConcentrations.get(badge.label) ?? 8;
                return (
                  <div key={i} className="badge-control-group">
                    <div className="badge-item">
                      <span className="badge-icon">{badge.icon}</span>
                      <span className="badge-label">
                        {badge.label}: {badge.unit}{Math.round(threshold)}+
                      </span>
                    </div>
                    <div className="badge-slider-wrapper">
                      <label className="slider-label">Threshold</label>
                      <input type="range" min={badge.minThreshold ?? badge.defaultThreshold}
                        max={badge.maxThreshold ?? badge.defaultThreshold * 2}
                        step={(badge.maxThreshold ?? badge.defaultThreshold * 2) > 100 ? 10 : 1}
                        value={threshold}
                        onChange={(e) => setBadgeThresholds(new Map(badgeThresholds).set(badge.label, parseInt(e.target.value)))}
                        className="percentile-slider" />
                    </div>
                    {badge.label !== 'High Activity' && (
                      <div className="badge-slider-wrapper">
                        <label className="slider-label">Min Concentration: {concentration}%</label>
                        <input type="range" min="3" max="100" step="1" value={concentration}
                          onChange={(e) => setMinConcentrations(new Map(minConcentrations).set(badge.label, parseInt(e.target.value)))}
                          className="percentile-slider" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="legend-note">Size = Listings (log scale)</div>
        </div>
      </div>
    </div>
  );
}

