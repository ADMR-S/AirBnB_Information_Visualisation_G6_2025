import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useData } from './hooks/useData';
import { HostSelectionProvider } from './contexts/HostSelectionContext';
import Landing from './pages/Landing';
import TravelerDashboard from './pages/TravelerDashboard';
import HostDashboard from './pages/HostDashboard';
import TravelerMapView from './pages/visualizations/maps/TravelerMapView';
import TravelerViolinView from './pages/visualizations/violin/TravelerViolinView';
import TravelerParallelView from './pages/visualizations/parallel/TravelerParallelView';
import TravelerTreemapView from './pages/visualizations/treemaps/TravelerTreemapView';
import HostMapView from './pages/visualizations/maps/HostMapView';
import HostViolinView from './pages/visualizations/violin/HostViolinView';
import HostParallelView from './pages/visualizations/parallel/HostParallelView';
import HostTreemapView from './pages/visualizations/treemaps/HostTreemapView';

function App() {
  useData();

  return (
    <HostSelectionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />

          <Route path="/traveler" element={<TravelerDashboard />}>
            <Route index element={<Navigate to="map" replace />} />
            <Route path="map" element={<TravelerMapView />} />
            <Route path="prices" element={<TravelerViolinView />} />
            <Route path="value" element={<TravelerParallelView />} />
            <Route path="availability" element={<TravelerTreemapView />} />
          </Route>

          <Route path="/host" element={<HostDashboard />}>
            <Route index element={<Navigate to="map" replace />} />
            <Route path="map" element={<HostMapView />} />
            <Route path="pricing" element={<HostViolinView />} />
            <Route path="market" element={<HostTreemapView />} />
            <Route path="competition" element={<HostParallelView />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </HostSelectionProvider>
  );
}

export default App;
