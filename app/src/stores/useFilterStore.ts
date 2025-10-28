import { create } from 'zustand';
import type { AirbnbListing, FilterState } from '../types/airbnb.types';

interface FilterStore extends FilterState {
  allData: AirbnbListing[];
  filteredData: AirbnbListing[];
  isLoading: boolean;
  setAllData: (data: AirbnbListing[]) => void;
  setYear: (year: '2020' | '2023') => void;
  setStates: (states: string[]) => void;
  setCities: (cities: string[]) => void;
  setRoomTypes: (roomTypes: string[]) => void;
  setPriceRange: (range: [number, number]) => void;
  setReviewRange: (range: [number, number]) => void;
  setAvailabilityRange: (range: [number, number]) => void;
  setMinNightsRange: (range: [number, number]) => void;
  setReviewsPerMonthRange: (range: [number, number]) => void;
  setHostListingsRange: (range: [number, number]) => void;
  resetFilters: () => void;
  applyFilters: () => void;
}

const initialFilterState: FilterState = {
  year: '2023',
  states: [],
  cities: [],
  roomTypes: [],
  priceRange: [0, 5000],
  reviewRange: [0, 1000],
  availabilityRange: [0, 365],
  minNightsRange: [1, 365],
  reviewsPerMonthRange: [0, 50],
  hostListingsRange: [1, 500],
};

export const useFilterStore = create<FilterStore>((set, get) => ({
  ...initialFilterState,
  allData: [],
  filteredData: [],
  isLoading: true,

  setAllData: (data) => {
    set({ allData: data, isLoading: false });
    get().applyFilters();
  },

  setYear: (year) => {
    set({ year });
    get().applyFilters();
  },

  setStates: (states) => {
    set({ states });
    get().applyFilters();
  },

  setCities: (cities) => {
    set({ cities });
    get().applyFilters();
  },

  setRoomTypes: (roomTypes) => {
    set({ roomTypes });
    get().applyFilters();
  },

  setPriceRange: (range) => {
    set({ priceRange: range });
    get().applyFilters();
  },

  setReviewRange: (range) => {
    set({ reviewRange: range });
    get().applyFilters();
  },

  setAvailabilityRange: (range) => {
    set({ availabilityRange: range });
    get().applyFilters();
  },

  setMinNightsRange: (range) => {
    set({ minNightsRange: range });
    get().applyFilters();
  },

  setReviewsPerMonthRange: (range) => {
    set({ reviewsPerMonthRange: range });
    get().applyFilters();
  },

  setHostListingsRange: (range) => {
    set({ hostListingsRange: range });
    get().applyFilters();
  },

  resetFilters: () => {
    set(initialFilterState);
    get().applyFilters();
  },

  applyFilters: () => {
    const state = get();
    let filtered = state.allData;

    // Year filter
    const yearNum = state.year === '2020' ? 2020 : 2023;
    filtered = filtered.filter(d => d.year === yearNum);

    // State filter
    if (state.states.length > 0) {
      filtered = filtered.filter(d => state.states.includes(d.state));
    }

    // City filter
    if (state.cities.length > 0) {
      filtered = filtered.filter(d => state.cities.includes(d.city));
    }

    // Room type filter
    if (state.roomTypes.length > 0) {
      filtered = filtered.filter(d => state.roomTypes.includes(d.room_type));
    }

    // Price filter
    filtered = filtered.filter(d => 
      d.price >= state.priceRange[0] && d.price <= state.priceRange[1]
    );

    // Review filter
    filtered = filtered.filter(d => 
      d.number_of_reviews >= state.reviewRange[0] && 
      d.number_of_reviews <= state.reviewRange[1]
    );

    // Availability filter
    filtered = filtered.filter(d => 
      d.availability_365 >= state.availabilityRange[0] && 
      d.availability_365 <= state.availabilityRange[1]
    );

    // Minimum nights filter
    filtered = filtered.filter(d => 
      d.minimum_nights >= state.minNightsRange[0] && 
      d.minimum_nights <= state.minNightsRange[1]
    );

    // Reviews per month filter
    filtered = filtered.filter(d => 
      d.reviews_per_month >= state.reviewsPerMonthRange[0] && 
      d.reviews_per_month <= state.reviewsPerMonthRange[1]
    );

    // Host listings count filter
    filtered = filtered.filter(d => 
      d.calculated_host_listings_count >= state.hostListingsRange[0] && 
      d.calculated_host_listings_count <= state.hostListingsRange[1]
    );

    set({ filteredData: filtered });
  },
}));

