import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import '../VisualizationPage.css';

export default function TravelerMapView() {
  const { isLoading } = useFilterStore();
  const filteredData = useFilteredData();

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  return (
    <div className="viz-container">
      <h2>Location Explorer</h2>
      <p className="viz-description">
        Find your perfect location ({filteredData.length.toLocaleString()} listings available)
      </p>
      <div className="viz-placeholder">
        <p>Map Visualization</p>
        <p className="placeholder-text">visualization here</p>
      </div>
    </div>
  );
}

