import { Outlet, useNavigate } from 'react-router-dom';
import FilterBar from './FilterBar';
import Navigation from './Navigation';
import FilterBreadcrumbs from './FilterBreadcrumbs';
import './Layout.css';
import { useHostSelection } from '../contexts/HostSelectionContext';

interface LayoutProps {
  persona: 'traveler' | 'host';
}

export default function Layout({ persona }: LayoutProps) {
  const navigate = useNavigate();
  const host = useHostSelection();

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="layout">
      <header className={`header ${persona}`}>
        <div className="header-content">
          <h1 onClick={handleGoHome} style={{ cursor: 'pointer' }}>
            AirBnB Market Insights
          </h1>
          {persona === 'traveler' && (
          <span className="persona-badge">
            {'Traveler'} Page
          </span>
          )}
          {persona === 'host' && (
            <span className="persona-badge">
              Host {`${host?.selectedHost?.hostName}`} {`Id: ${host?.selectedHost?.hostId}`}
            </span>
          )}
            
        </div>
      </header>

      <div className="main-content">
        <Navigation persona={persona} />
        <main className="content">
          <FilterBreadcrumbs />
          <Outlet />
        </main>
      </div>
      
      <FilterBar />
    </div>
  );
}

