import * as d3 from 'd3';
import type { AirbnbListing } from '../types/airbnb.types';

export async function loadAirbnbData(): Promise<AirbnbListing[]> {
  const data = await d3.csv('/data/dataset.csv', (d): AirbnbListing => {
    return {
      id: d.id || '',
      name: d.name || '',
      host_id: d.host_id || '',
      host_name: d.host_name || '',
      neighbourhood: d.neighbourhood || '',
      latitude: parseFloat(d.latitude || '0'),
      longitude: parseFloat(d.longitude || '0'),
      room_type: d.room_type || '',
      price: parseFloat(d.price || '0'),
      minimum_nights: parseInt(d.minimum_nights || '0', 10),
      number_of_reviews: parseInt(d.number_of_reviews || '0', 10),
      last_review: d.last_review || '',
      reviews_per_month: parseFloat(d.reviews_per_month || '0'),
      calculated_host_listings_count: parseInt(d.calculated_host_listings_count || '0', 10),
      availability_365: parseInt(d.availability_365 || '0', 10),
      city: d.city || '',
      year: (parseInt(d.year || '2023', 10) === 2020 ? 2020 : 2023),
      state: d.state || '',
    };
  });

  return data;
}

export function getUniqueStates(data: AirbnbListing[]): string[] {
  return Array.from(new Set(data.map(d => d.state))).filter(s => s && s.length > 0).sort();
}

export function getUniqueCities(data: AirbnbListing[]): string[] {
  return Array.from(new Set(data.map(d => d.city))).sort();
}

export function getUniqueRoomTypes(data: AirbnbListing[]): string[] {
  return Array.from(new Set(data.map(d => d.room_type))).sort();
}

export function getPriceRange(data: AirbnbListing[]): [number, number] {
  const prices = data.map(d => d.price).filter(p => p > 0);
  return [Math.min(...prices), Math.max(...prices)];
}

export function getReviewRange(data: AirbnbListing[]): [number, number] {
  const reviews = data.map(d => d.number_of_reviews);
  return [0, Math.max(...reviews)];
}

