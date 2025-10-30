import { useEffect } from 'react';
import { useFilterStore } from '../stores/useFilterStore';
import { loadAirbnbData } from '../utils/dataLoader';

export function useData() {
  const { setAllData, isLoading } = useFilterStore();

  useEffect(() => {
    loadAirbnbData()
      .then(data => {
        setAllData(data);
      })
      .catch(err => {
        console.error('Error loading data:', err);
      });
  }, [setAllData]);

  return { isLoading };
}

