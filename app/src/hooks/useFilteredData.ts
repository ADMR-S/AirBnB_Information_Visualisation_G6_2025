import { useMemo } from 'react';
import { useFilterStore } from '../stores/useFilterStore';

interface UseFilteredDataOptions {
  yearOverride?: 2020 | 2023;
  applyDrillDown?: { states?: string[]; cities?: string[] };
}

/**
 * Get filtered data with all global filters applied
 * Optionally override year or apply drill-down filters
 */
export function useFilteredData(options: UseFilteredDataOptions = {}) {
  const {
    allData,
    year,
    states,
    cities,
    roomTypes,
    priceRange,
    reviewRange,
    availabilityRange,
    minNightsRange,
    reviewsPerMonthRange,
    hostListingsRange,
  } = useFilterStore();

  const filteredData = useMemo(() => {
    let filtered = allData;

    // Year filter (with optional override)
    const yearNum = options.yearOverride || (year === '2020' ? 2020 : 2023);
    filtered = filtered.filter(d => d.year === yearNum);

    // State filter (global or drill-down override)
    const activeStates = options.applyDrillDown?.states || states;
    if (activeStates.length > 0) {
      filtered = filtered.filter(d => activeStates.includes(d.state));
    }

    // City filter (global or drill-down override)
    const activeCities = options.applyDrillDown?.cities || cities;
    if (activeCities.length > 0) {
      filtered = filtered.filter(d => activeCities.includes(d.city));
    }

    // Room type filter
    if (roomTypes.length > 0) {
      filtered = filtered.filter(d => roomTypes.includes(d.room_type));
    }

    // Range filters
    filtered = filtered.filter(d => 
      d.price >= priceRange[0] && d.price <= priceRange[1] &&
      d.number_of_reviews >= reviewRange[0] && d.number_of_reviews <= reviewRange[1] &&
      d.availability_365 >= availabilityRange[0] && d.availability_365 <= availabilityRange[1] &&
      d.minimum_nights >= minNightsRange[0] && d.minimum_nights <= minNightsRange[1] &&
      d.reviews_per_month >= reviewsPerMonthRange[0] && d.reviews_per_month <= reviewsPerMonthRange[1] &&
      d.calculated_host_listings_count >= hostListingsRange[0] && d.calculated_host_listings_count <= hostListingsRange[1]
    );

    return filtered;
  }, [
    allData,
    year,
    states,
    cities,
    roomTypes,
    priceRange,
    reviewRange,
    availabilityRange,
    minNightsRange,
    reviewsPerMonthRange,
    hostListingsRange,
    options.yearOverride,
    options.applyDrillDown,
  ]);

  return filteredData;
}

/**
 * Get filtered data for a specific year with drill-down applied
 */
export function useYearFilteredData(yearNum: 2020 | 2023, drillPath?: Array<{ level: string; name: string }>) {
  const { states, cities } = useFilterStore();

  // Build drill-down filter from path
  const drillDownFilter = useMemo(() => {
    if (!drillPath || drillPath.length === 0) return undefined;

    const stateItem = drillPath.find(item => item.level === 'state');
    const cityItem = drillPath.find(item => item.level === 'city');

    return {
      states: stateItem ? [stateItem.name] : states.length === 1 ? states : undefined,
      cities: cityItem ? [cityItem.name] : cities.length === 1 ? cities : undefined,
    };
  }, [drillPath, states, cities]);

  return useFilteredData({ 
    yearOverride: yearNum,
    applyDrillDown: drillDownFilter 
  });
}

