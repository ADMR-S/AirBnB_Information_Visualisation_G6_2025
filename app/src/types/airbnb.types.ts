export interface AirbnbListing {
  id: string;
  name: string;
  host_id: string;
  host_name: string;
  neighbourhood: string;
  latitude: number;
  longitude: number;
  room_type: string;
  price: number;
  minimum_nights: number;
  number_of_reviews: number;
  last_review: string;
  reviews_per_month: number;
  calculated_host_listings_count: number;
  availability_365: number;
  city: string;
  year: 2020 | 2023;
  state: string;
}

export type Persona = 'traveler' | 'host';

export interface FilterState {
  year: '2020' | '2023';
  states: string[];
  cities: string[];
  roomTypes: string[];
  priceRange: [number, number];
  reviewRange: [number, number];
  availabilityRange: [number, number];
  minNightsRange: [number, number];
  reviewsPerMonthRange: [number, number];
  hostListingsRange: [number, number];
}

