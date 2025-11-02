import { useFilterStore } from '../stores/useFilterStore';
import './FilterBreadcrumbs.css';

export default function FilterBreadcrumbs() {
  const { states, cities, neighbourhoods, setStates, setCities, setNeighbourhoods } = useFilterStore();

  const handleNavigate = (level: number) => {
    if (level === -1) {
      setStates([]);
      setCities([]);
      setNeighbourhoods([]);
    } else if (level === 0) {
      setCities([]);
      setNeighbourhoods([]);
    } else if (level === 1) {
      setNeighbourhoods([]);
    }
  };

  return (
    <div className="breadcrumb-nav">
      <button className="breadcrumb-item" onClick={() => handleNavigate(-1)}>
        All States
      </button>
      {states.length === 1 && (
        <span>
          <span className="breadcrumb-separator">{'>'}</span>
          <button className="breadcrumb-item" onClick={() => handleNavigate(0)}>
            {states[0]}
          </button>
        </span>
      )}
      {cities.length === 1 && (
        <span>
          <span className="breadcrumb-separator">{'>'}</span>
          <button className="breadcrumb-item" onClick={() => handleNavigate(1)}>
            {cities[0]}
          </button>
        </span>
      )}
      {neighbourhoods.length === 1 && (
        <span>
          <span className="breadcrumb-separator">{'>'}</span>
          <button className="breadcrumb-item" onClick={() => handleNavigate(2)}>
            {neighbourhoods[0]}
          </button>
        </span>
      )}
    </div>
  );
}

