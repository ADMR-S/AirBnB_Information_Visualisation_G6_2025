import { useMemo } from "react";
import { aggregateByCity, aggregateNeighborhoodFields, aggregateCityBoundaries, getMaxSizeValue } from "../pages/visualizations/maps/dataAggregators";
import type { AirbnbListing } from "../types/airbnb.types";

export function useAggregatedData(filteredData: AirbnbListing[]) {
  return useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return {
        cityBubbles: [],
        neighborhoodFields: [],
        cityBoundaries: [],
        maxCityCount: 0
      };
    }

    const cityBubbles = aggregateByCity(filteredData);
    const neighborhoodFields = aggregateNeighborhoodFields(filteredData);
    const cityBoundaries = aggregateCityBoundaries(filteredData);
    const maxCityCount = getMaxSizeValue(cityBubbles);

    return { cityBubbles, neighborhoodFields, cityBoundaries, maxCityCount };
  }, [filteredData]);
}