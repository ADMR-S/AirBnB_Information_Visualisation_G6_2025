import { useFilterStore } from '../../../stores/useFilterStore';

export function useTreemapNavigation() {
  const { states, cities, setStates, setCities } = useFilterStore();

  // Derive current level from filter state
  const currentLevel = states.length === 0 ? 0 
                     : cities.length === 0 ? 1 
                     : 2;

  // Click handler to set filters directly
  const handleClick = (item: any) => {
    if (!item.level || !item.name) return;
    
    if (item.level === 'state') {
      setStates([item.name]);
      setCities([]);
    } else if (item.level === 'city') {
      if (states.length === 0 && item.parentState) {
        setStates([item.parentState]);
      }
      setCities([item.name]);
    }
  };

  return { currentLevel, handleClick };
}

