import { useFilterStore } from '../../../../stores/useFilterStore';

export function useTreemapNavigation() {
  const { states, cities, neighbourhoods, setStates, setCities, setNeighbourhoods } = useFilterStore();

  // Derive current level from filter state
  const currentLevel = states.length === 0 ? 0 
                     : cities.length === 0 ? 1 
                     : neighbourhoods.length === 0 ? 2
                     : 3;

  // Click handler to set filters directly
  const handleClick = (item: any) => {
    if (!item.level || !item.name) return;
    
    if (item.level === 'state') {
      setStates([item.name]);
      setCities([]);
      setNeighbourhoods([]);
    } else if (item.level === 'city') {
      if (states.length === 0 && item.parentState) {
        setStates([item.parentState]);
      }
      setCities([item.name]);
      setNeighbourhoods([]);
    } else if (item.level === 'neighbourhood') {
      setNeighbourhoods([item.name]);
    }
  };

  return { currentLevel, handleClick };
}

