import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import '../VisualizationPage.css';

export default function HostMapView() {
  const { isLoading } = useFilterStore();
  const filteredData = useFilteredData();

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  return (
    <div className="viz-container">
      <h2>Market Coverage Map</h2>
      <p className="viz-description">
        Geographic distribution of your properties ({filteredData.length.toLocaleString()} listings)
      </p>
      <div className="viz-placeholder">
        <p>Map Visualization</p>
        <p className="placeholder-text">visualization here</p>
      </div>
    </div>
  );
}

