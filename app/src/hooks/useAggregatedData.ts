import { useMemo } from "react";
import { aggregateAllData } from "../pages/visualizations/maps/dataAggregators";
import type { AirbnbListing } from "../types/airbnb.types";

// Create a stable key based on data content, not reference
function getDataKey(data: AirbnbListing[]): string {
  if (!data || data.length === 0) return 'empty';
  // Use length + first and last IDs as a lightweight signature
  return `${data.length}-${data[0]?.id}-${data[data.length - 1]?.id}`;
}

export function useAggregatedData(filteredData: AirbnbListing[]) {
  // Create a stable key that only changes when the actual data changes
  const dataKey = getDataKey(filteredData);
  
  return useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return {
        cityBubbles: [],
        neighborhoodFields: [],
        cityBoundaries: [],
        maxCityCount: 0
      };
    }

    // Single pass through data - much more efficient!
    return aggregateAllData(filteredData);
  }, [dataKey]); // Use dataKey instead of filteredData for stable memoization
}