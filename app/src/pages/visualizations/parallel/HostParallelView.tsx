import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import '../VisualizationPage.css';

export default function HostParallelView() {
  const { isLoading } = useFilterStore();
  const filteredData = useFilteredData();

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

