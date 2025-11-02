import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import { useSelectedListing } from '../../../contexts/SelectedListingContext';
import BubbleMap from './BubbleMap';

export default function HostMapView() {
  const { isLoading } = useFilterStore();
  const filteredData = useFilteredData();
  const { selectedListing } = useSelectedListing();

  return (
    <BubbleMap 
      filteredData={filteredData} 
      persona="host" 
      isLoading={isLoading}
      injectedListing={selectedListing}
    />
  );
}

