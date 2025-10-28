import { useFilterStore } from '../../../stores/useFilterStore';
import { useYearFilteredData } from '../../../hooks/useFilteredData';
import '../VisualizationPage.css';

export default function HostParallelView() {
  const { isLoading, year } = useFilterStore();
  const filteredData = useYearFilteredData(year === '2020' ? 2020 : 2023, []);

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  return (
    <div className="viz-container">
      <h2>Performance Comparison</h2>
      <p className="viz-description">
        Compare metrics across listings ({filteredData.length.toLocaleString()} properties)
      </p>
      <div className="viz-placeholder">
        <p>Parallel Coordinates</p>
        <p className="placeholder-text">visualization here</p>
      </div>
    </div>
  );
}

