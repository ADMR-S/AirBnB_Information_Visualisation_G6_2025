export interface BubbleData {
  label: string;
  latitude: number;
  longitude: number;
  sizeValue: number;
  colorValue: number;
}

export interface NeighborhoodField {
  label: string;
  count: number;
  avgPrice: number;
  hullPoints: [number, number][];
}

export interface CityBoundary {
  city: string;
  state: string;
  hullPoints: [number, number][];
  totalListings: number;
}

export interface AggregatedCityData {
  count: number;
  priceSum: number;
  lat: number;
  lng: number;
  city: string;
  state: string;
}

export interface AggregatedNeighborhoodData {
  count: number;
  priceSum: number;
  lat: number;
  lng: number;
  name: string;
}
