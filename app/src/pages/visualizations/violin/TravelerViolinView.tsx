import { useFilterStore } from '../../../stores/useFilterStore';
import { useYearFilteredData } from '../../../hooks/useFilteredData';
import '../VisualizationPage.css';

export default function TravelerViolinView() {
  const { isLoading } = useFilterStore();
  const filteredData = useYearFilteredData(2023, []);

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  return (
    <div className="viz-container">
      <h2>Price Explorer</h2>
      <p className="viz-description">
        Find listings in your budget ({filteredData.length.toLocaleString()} available)
      </p>
      <div className="viz-placeholder">
        <p>Violin Plot</p>
        <p className="placeholder-text">visualization here</p>
      </div>
    </div>
  );
}

