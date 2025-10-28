import { useNavigate } from 'react-router-dom';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <div className="landing-container">
        <h1>Airbnb Market Insights</h1>
        <div className="persona-selection">
          <div 
            className="persona-card traveler"
            onClick={() => navigate('/traveler/map')}
          >
            <h2>I'm a Traveler</h2>
            <button>Explore as Traveler</button>
          </div>

          <div 
            className="persona-card host"
            onClick={() => navigate('/host/map')}
          >
            <h2>I'm a Host</h2>
            <button>Explore as Host</button>
          </div>
        </div>
      </div>
    </div>
  );
}

