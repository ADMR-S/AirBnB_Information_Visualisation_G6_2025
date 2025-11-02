import type { AirbnbListing } from '../../../types/airbnb.types';
import type { BubbleData, AggregatedCityData, CityBoundary } from '../../../types/bubbleMap.types';
import * as d3 from 'd3';

/**
 * Aggregates all data in a single pass through the dataset
 * This is much more efficient than calling separate functions
 * @param data Array of Airbnb listings
 * @returns Object containing all aggregated data
 */
export function aggregateAllData(data: AirbnbListing[]) {
  // Initialize data structures for all aggregations
  const cityData = new Map<string, AggregatedCityData>();
  const neighborhoodData = new Map<string, {
    city: string;
    neighbourhood: string;
    count: number;
    coordinates: [number, number][]; // Only store [lng, lat] pairs instead of full listings
    priceSum: number;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }>();
  const cityListings = new Map<string, AirbnbListing[]>();

  // Single pass through all data
  data.forEach(d => {
    // 1. Aggregate city data
    const cityKey = `${d.city}-${d.state}`;
    const existingCity = cityData.get(cityKey);
    if (existingCity) {
      existingCity.count++;
      existingCity.priceSum += d.price;
    } else {
      cityData.set(cityKey, {
        count: 1,
        priceSum: d.price,
        lat: d.latitude,
        lng: d.longitude,
        city: d.city,
        state: d.state
      });
    }

    // 2. Aggregate neighborhood data (skip unincorporated areas)
    if (!d.neighbourhood.toLowerCase().includes('unincorporated')) {
      const neighborhoodKey = `${d.city}, ${d.state}|${d.neighbourhood}`;
      const existingNeighborhood = neighborhoodData.get(neighborhoodKey);
      if (existingNeighborhood) {
        existingNeighborhood.count++;
        existingNeighborhood.coordinates.push([d.longitude, d.latitude]);
        existingNeighborhood.priceSum += d.price;
        existingNeighborhood.minLat = Math.min(existingNeighborhood.minLat, d.latitude);
        existingNeighborhood.maxLat = Math.max(existingNeighborhood.maxLat, d.latitude);
        existingNeighborhood.minLng = Math.min(existingNeighborhood.minLng, d.longitude);
        existingNeighborhood.maxLng = Math.max(existingNeighborhood.maxLng, d.longitude);
      } else {
        neighborhoodData.set(neighborhoodKey, {
          city: d.city,
          neighbourhood: d.neighbourhood,
          count: 1,
          coordinates: [[d.longitude, d.latitude]],
          priceSum: d.price,
          minLat: d.latitude,
          maxLat: d.latitude,
          minLng: d.longitude,
          maxLng: d.longitude
        });
      }
    }

    // 3. Collect listings for city boundaries (including unincorporated)
    const cityBoundaryKey = `${d.city}, ${d.state}`;
    const existingCityListings = cityListings.get(cityBoundaryKey);
    if (existingCityListings) {
      existingCityListings.push(d);
    } else {
      cityListings.set(cityBoundaryKey, [d]);
    }
  });

  // Process city bubbles
  const cityBubbles: BubbleData[] = Array.from(cityData.values()).map(data => ({
    label: `${data.city}, ${data.state}`,
    latitude: data.lat,
    longitude: data.lng,
    sizeValue: data.count,
    colorValue: data.priceSum / data.count
  }));

  // Process neighborhood fields (filter out single-listing neighborhoods)
  const neighborhoodFields = Array.from(neighborhoodData.values())
    .filter(data => data.count > 1)
    .map(data => {
      const hull = d3.polygonHull(data.coordinates);
      let hullPoints: [number, number][];
      
      if (hull && hull.length >= 3) {
        hullPoints = hull as [number, number][];
      } else {
        hullPoints = [
          [data.minLng, data.maxLat],
          [data.maxLng, data.maxLat],
          [data.maxLng, data.minLat],
          [data.minLng, data.minLat]
        ];
      }
      
      return {
        label: `${data.neighbourhood} (${data.city})`,
        city: data.city,
        count: data.count,
        avgPrice: data.priceSum / data.count,
        hullPoints: hullPoints
      };
    });

  // Process city boundaries
  const cityBoundaries: CityBoundary[] = [];
  cityListings.forEach((listings, key) => {
    const [cityState] = key.split('|');
    const [city, state] = cityState.split(', ');
    
    const points: [number, number][] = listings.map(listing => 
      [listing.longitude, listing.latitude]
    );
    
    const hull = d3.polygonHull(points);
    
    if (hull && hull.length >= 3) {
      cityBoundaries.push({
        city,
        state,
        hullPoints: hull as [number, number][],
        totalListings: listings.length
      });
    } else if (points.length > 0) {
      const lngs = points.map(p => p[0]);
      const lats = points.map(p => p[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      
      const buffer = 0.01;
      cityBoundaries.push({
        city,
        state,
        hullPoints: [
          [minLng - buffer, maxLat + buffer],
          [maxLng + buffer, maxLat + buffer],
          [maxLng + buffer, minLat - buffer],
          [minLng - buffer, minLat - buffer]
        ],
        totalListings: listings.length
      });
    }
  });

  // Calculate max city count
  const maxCityCount = cityBubbles.reduce((max, b) => Math.max(max, b.sizeValue), 1);

  return {
    cityBubbles,
    neighborhoodFields,
    cityBoundaries,
    maxCityCount
  };
}


// /**
//  * Aggregates Airbnb listings by city
//  * @param data Array of Airbnb listings
//  * @returns Array of BubbleData representing cities
//  */
// export function aggregateByCity(data: AirbnbListing[]): BubbleData[] {
//   const cityData = new Map<string, AggregatedCityData>();
  
//   data.forEach(d => {
//     const key = `${d.city}-${d.state}`;
//     const existing = cityData.get(key);
//     if (existing) {
//       existing.count++;
//       existing.priceSum += d.price;
//     } else {
//       cityData.set(key, {
//         count: 1,
//         priceSum: d.price,
//         lat: d.latitude,
//         lng: d.longitude,
//         city: d.city,
//         state: d.state
//       });
//     }
//   });

//   return Array.from(cityData.values()).map(data => ({
//     label: `${data.city}, ${data.state}`,
//     latitude: data.lat,
//     longitude: data.lng,
//     sizeValue: data.count,
//     colorValue: data.priceSum / data.count
//   }));
// }

// /**
//  * Aggregates Airbnb listings by neighborhood
//  * @param data Array of Airbnb listings
//  * @returns Array of BubbleData representing neighborhoods
//  */
// export function aggregateByNeighborhood(data: AirbnbListing[]): BubbleData[] {
//   const neighborhoodData = new Map<string, AggregatedNeighborhoodData>();
  
//   data.forEach(d => {
//     const key = `${d.neighbourhood}-${d.latitude.toFixed(4)}-${d.longitude.toFixed(4)}`;
//     const existing = neighborhoodData.get(key);
//     if (existing) {
//       existing.count++;
//       existing.priceSum += d.price;
//     } else {
//       neighborhoodData.set(key, {
//         count: 1,
//         priceSum: d.price,
//         lat: d.latitude,
//         lng: d.longitude,
//         name: d.neighbourhood
//       });
//     }
//   });

//   return Array.from(neighborhoodData.values()).map(data => ({
//     label: data.name,
//     latitude: data.lat,
//     longitude: data.lng,
//     sizeValue: data.count,
//     colorValue: data.priceSum / data.count
//   }));
// }

// /**
//  * Aggregates Airbnb listings by neighborhood as fields with coordinate bounds
//  * Filters out neighborhoods with only 1 listing
//  * @param data Array of Airbnb listings
//  * @returns Array of NeighborhoodField representing neighborhoods with their bounding boxes
//  */
// export function aggregateNeighborhoodFields(data: AirbnbListing[]) {
//   const neighborhoodData = new Map<string, {
//     city: string;
//     neighbourhood: string;
//     listings: AirbnbListing[];
//     priceSum: number;
//     minLat: number;
//     maxLat: number;
//     minLng: number;
//     maxLng: number;
//   }>();
  
//   data.forEach(d => {
//     // Skip unincorporated areas - they're not real neighborhoods
//     if (d.neighbourhood.toLowerCase().includes('unincorporated')) {
//       return;
//     }
    
//     // Create a unique key using both city and neighborhood to avoid conflicts
//     const key = `${d.city}, ${d.state}|${d.neighbourhood}`;
//     const existing = neighborhoodData.get(key);
//     if (existing) {
//       existing.listings.push(d);
//       existing.priceSum += d.price;
//       existing.minLat = Math.min(existing.minLat, d.latitude);
//       existing.maxLat = Math.max(existing.maxLat, d.latitude);
//       existing.minLng = Math.min(existing.minLng, d.longitude);
//       existing.maxLng = Math.max(existing.maxLng, d.longitude);
//     } else {
//       neighborhoodData.set(key, {
//         city: d.city,
//         neighbourhood: d.neighbourhood,
//         listings: [d],
//         priceSum: d.price,
//         minLat: d.latitude,
//         maxLat: d.latitude,
//         minLng: d.longitude,
//         maxLng: d.longitude
//       });
//     }
//   });

//   // Filter out single-listing neighborhoods and convert to NeighborhoodField with convex hull
//   const fields = Array.from(neighborhoodData.entries())
//     .filter(([_, data]) => data.listings.length > 1)
//     .map(([_key, data]) => {
//       // Extract coordinates for convex hull computation
//       const points: [number, number][] = data.listings.map(listing => 
//         [listing.longitude, listing.latitude]
//       );
      
//       // Compute convex hull using d3.polygonHull
//       const hull = d3.polygonHull(points);
      
//       // If hull is null or has less than 3 points, fallback to bounding box
//       let hullPoints: [number, number][];
//       if (hull && hull.length >= 3) {
//         hullPoints = hull as [number, number][];
//       } else {
//         // Fallback: create a simple bounding box
//         hullPoints = [
//           [data.minLng, data.maxLat], // top-left
//           [data.maxLng, data.maxLat], // top-right
//           [data.maxLng, data.minLat], // bottom-right
//           [data.minLng, data.minLat]  // bottom-left
//         ];
//       }
      
//       return {
//         label: `${data.neighbourhood} (${data.city})`,
//         count: data.listings.length,
//         avgPrice: data.priceSum / data.listings.length,
//         hullPoints: hullPoints,
//         listings: data.listings
//       };
//     });

//   if (MAP_CONFIG.DEBUG_LOG) {
//     console.log(`[aggregateNeighborhoodFields] Total neighborhoods: ${fields.length}`);
    
//     // Log first few neighborhoods
//     fields.slice(0, 5).forEach(field => {
//       // Calculate bounds from hull points
//       const lngs = field.hullPoints.map(p => p[0]);
//       const lats = field.hullPoints.map(p => p[1]);
//       const minLng = Math.min(...lngs);
//       const maxLng = Math.max(...lngs);
//       const minLat = Math.min(...lats);
//       const maxLat = Math.max(...lats);
//       const latSpan = maxLat - minLat;
//       const lngSpan = maxLng - minLng;
      
//       console.log(`[Neighborhood] ${field.label}:`, {
//         count: field.count,
//         hullPoints: field.hullPoints.length,
//         bounds: `lat: ${minLat.toFixed(4)} to ${maxLat.toFixed(4)} (span: ${latSpan.toFixed(4)})`,
//         boundsLng: `lng: ${minLng.toFixed(4)} to ${maxLng.toFixed(4)} (span: ${lngSpan.toFixed(4)})`,
//         avgPrice: field.avgPrice.toFixed(2)
//       });
//     });

//     // Check for suspiciously large neighborhoods
//     const largeFields = fields.filter(f => {
//       const lngs = f.hullPoints.map(p => p[0]);
//       const lats = f.hullPoints.map(p => p[1]);
//       const latSpan = Math.max(...lats) - Math.min(...lats);
//       const lngSpan = Math.max(...lngs) - Math.min(...lngs);
//       return latSpan > 5 || lngSpan > 5;
//     });
    
//     if (largeFields.length > 0) {
//       console.warn(`[WARNING] Found ${largeFields.length} neighborhoods with suspicious bounds (>5 degree span):`);
//       largeFields.forEach(field => {
//         const lngs = field.hullPoints.map(p => p[0]);
//         const lats = field.hullPoints.map(p => p[1]);
//         const latSpan = Math.max(...lats) - Math.min(...lats);
//         const lngSpan = Math.max(...lngs) - Math.min(...lngs);
//         console.warn(`  - ${field.label}: lat span ${latSpan.toFixed(2)}°, lng span ${lngSpan.toFixed(2)}°`);
//       });
//     }
//   }

//   return fields;
// }

// /**
//  * Aggregates city boundaries as convex hulls for all listings in each city
//  * Includes all listings (even unincorporated areas)
//  * @param data Array of Airbnb listings
//  * @returns Array of CityBoundary representing city boundaries
//  */
// export function aggregateCityBoundaries(data: AirbnbListing[]): CityBoundary[] {
//   const cityData = new Map<string, AirbnbListing[]>();
  
//   // Group all listings by city (including unincorporated areas)
//   data.forEach(d => {
//     const key = `${d.city}, ${d.state}`;
//     const existing = cityData.get(key);
//     if (existing) {
//       existing.push(d);
//     } else {
//       cityData.set(key, [d]);
//     }
//   });

//   // Create convex hull for each city
//   const boundaries: CityBoundary[] = [];
  
//   cityData.forEach((listings, key) => {
//     const [cityState, _] = key.split('|');
//     const [city, state] = cityState.split(', ');
    
//     // Extract coordinates for convex hull computation
//     const points: [number, number][] = listings.map(listing => 
//       [listing.longitude, listing.latitude]
//     );
    
//     // Compute convex hull
//     const hull = d3.polygonHull(points);
    
//     if (hull && hull.length >= 3) {
//       boundaries.push({
//         city,
//         state,
//         hullPoints: hull as [number, number][],
//         totalListings: listings.length
//       });
//     } else if (points.length > 0) {
//       // Fallback for cities with 1-2 listings: create a small rectangular boundary
//       const lngs = points.map(p => p[0]);
//       const lats = points.map(p => p[1]);
//       const minLng = Math.min(...lngs);
//       const maxLng = Math.max(...lngs);
//       const minLat = Math.min(...lats);
//       const maxLat = Math.max(...lats);
      
//       // Add a small buffer (0.01 degrees, roughly 1km) around the point(s)
//       const buffer = 0.01;
//       const rectanglePoints: [number, number][] = [
//         [minLng - buffer, maxLat + buffer], // top-left
//         [maxLng + buffer, maxLat + buffer], // top-right
//         [maxLng + buffer, minLat - buffer], // bottom-right
//         [minLng - buffer, minLat - buffer]  // bottom-left
//       ];
      
//       boundaries.push({
//         city,
//         state,
//         hullPoints: rectanglePoints,
//         totalListings: listings.length
//       });
//     }
//   });

//   if (MAP_CONFIG.DEBUG_LOG) {
//     console.log(`[aggregateCityBoundaries] Created ${boundaries.length} city boundaries`);
//   }

//   return boundaries;
// }

// /**
//  * Calculates the maximum size value from bubble data
//  * Uses reduce instead of Math.max(...array) to avoid call stack issues with large datasets
//  * @param bubbles Array of BubbleData
//  * @returns Maximum size value
//  */
// export function getMaxSizeValue(bubbles: BubbleData[]): number {
//   return bubbles.reduce((max, b) => Math.max(max, b.sizeValue), 1);
// }
