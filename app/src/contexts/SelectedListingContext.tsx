import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { AirbnbListing } from '../types/airbnb.types';

interface SelectedListingContextType {
  selectedListing: AirbnbListing | null;
  setSelectedListing: (listing: AirbnbListing | null) => void;
}

const SelectedListingContext = createContext<SelectedListingContextType | undefined>(undefined);

export function SelectedListingProvider({ children }: { children: ReactNode }) {
  const [selectedListing, setSelectedListing] = useState<AirbnbListing | null>(null);

  return (
    <SelectedListingContext.Provider value={{ selectedListing, setSelectedListing }}>
      {children}
    </SelectedListingContext.Provider>
  );
}

export function useSelectedListing() {
  const context = useContext(SelectedListingContext);
  if (context === undefined) {
    throw new Error('useSelectedListing must be used within a SelectedListingProvider');
  }
  return context;
}
