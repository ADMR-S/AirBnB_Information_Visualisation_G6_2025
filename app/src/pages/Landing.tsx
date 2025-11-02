import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelectedListing } from '../contexts/SelectedListingContext';
import HostSelectionPopup from '../components/HostSelectionPopup';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const [showHostPopup, setShowHostPopup] = useState(false);
  const { setSelectedListing } = useSelectedListing();
  
  // Reset selected listing when landing on homepage
  useEffect(() => {
    setSelectedListing(null);
  }, [setSelectedListing]);

  const handleHostSelection = () => {
    setShowHostPopup(false);
    navigate('/host/map');
  };

  return (
    <div className="landing">
      <div className="landing-container">
        <h1>Airbnb Market Insights</h1>
        <div className="persona-selection">
          <div 
            className="persona-card traveler hover-lift"
            onClick={() => navigate('/traveler/map')}
          >
            <h2>I'm a Traveler</h2>
            <button>Explore as Traveler</button>
          </div>

          <div 
            className="persona-card host hover-lift"
            onClick={() => setShowHostPopup(true)}
          >
            <h2>I'm a Host</h2>
            <button>Explore as Host</button>
          </div>
        </div>
      </div>

      {showHostPopup && (
        <HostSelectionPopup
          onClose={() => setShowHostPopup(false)}
          onConfirm={handleHostSelection}
        />
      )}
    </div>
  );
}

