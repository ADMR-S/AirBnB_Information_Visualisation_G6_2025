import { useFilterStore } from '../stores/useFilterStore';

/**
 * Get filtered data with all global filters applied.
 * This hook simply returns the pre-filtered data from the store to avoid double-filtering.
 */
export function useFilteredData() {
  // The store already applies all filters in applyFilters(), no need to filter again!
  return useFilterStore(state => state.filteredData);
}
