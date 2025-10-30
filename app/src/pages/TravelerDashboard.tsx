import { useEffect } from 'react';
import Layout from '../components/Layout';
import { useFilterStore } from '../stores/useFilterStore';

export default function TravelerDashboard() {
  const { setYear } = useFilterStore();

  useEffect(() => {
    setYear('2023');
  }, [setYear]);

  return <Layout persona="traveler" />;
}