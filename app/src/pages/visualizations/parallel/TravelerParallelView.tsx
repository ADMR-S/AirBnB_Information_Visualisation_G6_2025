import { useFilterStore } from '../../../stores/useFilterStore';
import { useYearFilteredData } from '../../../hooks/useFilteredData';
import '../VisualizationPage.css';

export default function TravelerParallelView() {
  const { isLoading } = useFilterStore();
  const filteredData = useYearFilteredData(2023, []);

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  return (
    <div className="viz-container">
      <h2>Listing Comparison Tool</h2>
      <p className="viz-description">
        Compare properties side-by-side ({filteredData.length.toLocaleString()} options)
      </p>
      <div className="viz-placeholder">
        <p>Parallel Coordinates</p>
        <p className="placeholder-text">visualization here</p>
      </div>
    </div>
  );
}

