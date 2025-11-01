import type { AirbnbListing } from '../../../types/airbnb.types';
import type { BubbleData, AggregatedCityData, AggregatedNeighborhoodData } from '../../../types/bubbleMap.types';

/**
 * Aggregates Airbnb listings by city
 * @param data Array of Airbnb listings
 * @returns Array of BubbleData representing cities
 */
export function aggregateByCity(data: AirbnbListing[]): BubbleData[] {
  const cityData = new Map<string, AggregatedCityData>();
  
  data.forEach(d => {
    const key = `${d.city}-${d.state}`;
    const existing = cityData.get(key);
    if (existing) {
      existing.count++;
      existing.priceSum += d.price;
    } else {
      cityData.set(key, {
        count: 1,
        priceSum: d.price,
        lat: d.latitude,
        lng: d.longitude,
        city: d.city,
        state: d.state
      });
    }
  });

  return Array.from(cityData.values()).map(data => ({
    label: `${data.city}, ${data.state}`,
    latitude: data.lat,
    longitude: data.lng,
    sizeValue: data.count,
    colorValue: data.priceSum / data.count
  }));
}

/**
 * Aggregates Airbnb listings by neighborhood
 * @param data Array of Airbnb listings
 * @returns Array of BubbleData representing neighborhoods
 */
export function aggregateByNeighborhood(data: AirbnbListing[]): BubbleData[] {
  const neighborhoodData = new Map<string, AggregatedNeighborhoodData>();
  
  data.forEach(d => {
    const key = `${d.neighbourhood}-${d.latitude.toFixed(4)}-${d.longitude.toFixed(4)}`;
    const existing = neighborhoodData.get(key);
    if (existing) {
      existing.count++;
      existing.priceSum += d.price;
    } else {
      neighborhoodData.set(key, {
        count: 1,
        priceSum: d.price,
        lat: d.latitude,
        lng: d.longitude,
        name: d.neighbourhood
      });
    }
  });

  return Array.from(neighborhoodData.values()).map(data => ({
    label: data.name,
    latitude: data.lat,
    longitude: data.lng,
    sizeValue: data.count,
    colorValue: data.priceSum / data.count
  }));
}

/**
 * Calculates the maximum size value from bubble data
 * Uses reduce instead of Math.max(...array) to avoid call stack issues with large datasets
 * @param bubbles Array of BubbleData
 * @returns Maximum size value
 */
export function getMaxSizeValue(bubbles: BubbleData[]): number {
  return bubbles.reduce((max, b) => Math.max(max, b.sizeValue), 1);
}
