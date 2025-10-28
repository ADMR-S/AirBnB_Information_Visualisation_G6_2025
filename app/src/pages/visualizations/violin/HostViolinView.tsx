import { useFilterStore } from '../../../stores/useFilterStore';
import { useYearFilteredData } from '../../../hooks/useFilteredData';
import '../VisualizationPage.css';

export default function HostViolinView() {
  const { isLoading, year } = useFilterStore();
  const filteredData = useYearFilteredData(year === '2020' ? 2020 : 2023, []);

  if (isLoading) return <div className="viz-container loading">Loading data...</div>;

  return (
    <div className="viz-container">
      <h2>Price Distribution Analysis</h2>
      <p className="viz-description">
        Understand pricing patterns across categories ({filteredData.length.toLocaleString()} listings)
      </p>
      <div className="viz-placeholder">
        <p>Violin Plot</p>
        <p className="placeholder-text">visualization here</p>
      </div>
    </div>
  );
}

