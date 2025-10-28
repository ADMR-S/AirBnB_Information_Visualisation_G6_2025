import { useState, useEffect } from 'react';
import { useFilterStore } from '../../../stores/useFilterStore';

export type DrillLevel = 'state' | 'city' | 'room_type' | 'host_category' | 'availability_category' | string;

export interface DrilldownItem {
  level: DrillLevel;
  name: string;
}

export function useDrilldown() {
  const { states, cities, setStates, setCities } = useFilterStore();
  const [drillPath, setDrillPath] = useState<DrilldownItem[]>([]);

  useEffect(() => {
    const newPath: DrilldownItem[] = [];
    if (states.length === 1) {
      newPath.push({ level: 'state', name: states[0] });
      if (cities.length === 1) {
        newPath.push({ level: 'city', name: cities[0] });
      }
    }
    setDrillPath(newPath);
  }, [states, cities]);

  const drillDown = (item: DrilldownItem) => {
    if (!item.level || !item.name) return;
    
    if (item.level === 'state') {
      setStates([item.name]);
      setCities([]);
    } else if (item.level === 'city') {
      if (drillPath.length === 0 && (item as any).parentState) {
        setStates([(item as any).parentState]);
      }
      setCities([item.name]);
    }
  };

  const navigateUp = (index: number) => {
    if (index === -1) {
      setStates([]);
      setCities([]);
    } else if (index === 0) {
      setCities([]);
    }
  };

  return { drillPath, drillDown, navigateUp };
}
