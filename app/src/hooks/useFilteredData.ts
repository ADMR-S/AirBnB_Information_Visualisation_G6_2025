import { useMemo } from 'react';
import { useFilterStore } from '../stores/useFilterStore';

/**
 * Get filtered data with all global filters applied
 */
export function useFilteredData() {
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

    // Year filter
    const yearNum = year === '2020' ? 2020 : 2023;
    filtered = filtered.filter(d => d.year === yearNum);

    // State filter
    if (states.length > 0) {
      filtered = filtered.filter(d => states.includes(d.state));
    }

    // City filter
    if (cities.length > 0) {
      filtered = filtered.filter(d => cities.includes(d.city));
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
  ]);

  return filteredData;
}
