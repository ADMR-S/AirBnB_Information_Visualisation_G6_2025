import { useFilterStore } from '../../../stores/useFilterStore';
import { useFilteredData } from '../../../hooks/useFilteredData';
import BubbleMap from './BubbleMap';

export default function HostMapView() {
  const { isLoading } = useFilterStore();
  const filteredData = useFilteredData();

  return (
    <BubbleMap 
      filteredData={filteredData} 
      persona="host" 
      isLoading={isLoading} 
    />
  );
}

