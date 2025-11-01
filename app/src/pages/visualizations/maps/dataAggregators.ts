import type { AirbnbListing } from '../../../types/airbnb.types';
import type { BubbleData, AggregatedCityData, AggregatedNeighborhoodData } from '../../../types/bubbleMap.types';
import { MAP_CONFIG } from './mapConfig';

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
 * Aggregates Airbnb listings by neighborhood as fields with coordinate bounds
 * Filters out neighborhoods with only 1 listing
 * @param data Array of Airbnb listings
 * @returns Array of NeighborhoodField representing neighborhoods with their bounding boxes
 */
export function aggregateNeighborhoodFields(data: AirbnbListing[]) {
  const neighborhoodData = new Map<string, {
    city: string;
    neighbourhood: string;
    listings: AirbnbListing[];
    priceSum: number;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }>();
  
  data.forEach(d => {
    // Create a unique key using both city and neighborhood to avoid conflicts
    const key = `${d.city}, ${d.state}|${d.neighbourhood}`;
    const existing = neighborhoodData.get(key);
    if (existing) {
      existing.listings.push(d);
      existing.priceSum += d.price;
      existing.minLat = Math.min(existing.minLat, d.latitude);
      existing.maxLat = Math.max(existing.maxLat, d.latitude);
      existing.minLng = Math.min(existing.minLng, d.longitude);
      existing.maxLng = Math.max(existing.maxLng, d.longitude);
    } else {
      neighborhoodData.set(key, {
        city: d.city,
        neighbourhood: d.neighbourhood,
        listings: [d],
        priceSum: d.price,
        minLat: d.latitude,
        maxLat: d.latitude,
        minLng: d.longitude,
        maxLng: d.longitude
      });
    }
  });

  // Filter out single-listing neighborhoods and convert to NeighborhoodField
  const fields = Array.from(neighborhoodData.entries())
    .filter(([_, data]) => data.listings.length > 1)
    .map(([_key, data]) => ({
      label: `${data.neighbourhood} (${data.city})`,
      count: data.listings.length,
      avgPrice: data.priceSum / data.listings.length,
      minLat: data.minLat,
      maxLat: data.maxLat,
      minLng: data.minLng,
      maxLng: data.maxLng,
      listings: data.listings
    }));

  if (MAP_CONFIG.DEBUG_LOG) {
    console.log(`[aggregateNeighborhoodFields] Total neighborhoods: ${fields.length}`);
    
    // Log first few neighborhoods with suspicious bounds
    fields.slice(0, 5).forEach(field => {
      const latSpan = field.maxLat - field.minLat;
      const lngSpan = field.maxLng - field.minLng;
      console.log(`[Neighborhood] ${field.label}:`, {
        count: field.count,
        bounds: `lat: ${field.minLat.toFixed(4)} to ${field.maxLat.toFixed(4)} (span: ${latSpan.toFixed(4)})`,
        boundsLng: `lng: ${field.minLng.toFixed(4)} to ${field.maxLng.toFixed(4)} (span: ${lngSpan.toFixed(4)})`,
        avgPrice: field.avgPrice.toFixed(2)
      });
    });

    // Check for suspiciously large neighborhoods
    const largeFields = fields.filter(f => 
      (f.maxLat - f.minLat > 5) || (f.maxLng - f.minLng > 5)
    );
    if (largeFields.length > 0) {
      console.warn(`[WARNING] Found ${largeFields.length} neighborhoods with suspicious bounds (>5 degree span):`);
      largeFields.forEach(field => {
        console.warn(`  - ${field.label}: lat span ${(field.maxLat - field.minLat).toFixed(2)}°, lng span ${(field.maxLng - field.minLng).toFixed(2)}°`);
      });
    }
  }

  return fields;
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
