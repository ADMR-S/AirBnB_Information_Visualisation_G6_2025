import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import { useSelectedListing } from '../../../contexts/SelectedListingContext';
import BubbleMap from './BubbleMap';

export default function TravelerMapView() {
  const { isLoading } = useFilterStore();
  const filteredData = useFilteredData();
  const { selectedListing } = useSelectedListing();

  return (
    <BubbleMap 
      filteredData={filteredData} 
      persona="traveler" 
      isLoading={isLoading}
      injectedListing={selectedListing}
    />
  );
}

