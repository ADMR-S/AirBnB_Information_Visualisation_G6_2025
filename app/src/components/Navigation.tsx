import { NavLink } from 'react-router-dom';
import './Navigation.css';

interface NavigationProps {
  persona: 'traveler' | 'host';
}

export default function Navigation({ persona }: NavigationProps) {
  const travelerLinks = [
    { path: `/traveler/map`, label: 'Map View' },
    { path: `/traveler/prices`, label: 'Price Explorer' },
    { path: `/traveler/value`, label: 'Value Finder' },
    { path: `/traveler/availability`, label: 'Availability' },
  ];

  const hostLinks = [
    { path: `/host/map`, label: 'Competition Map' },
    { path: `/host/pricing`, label: 'Pricing Benchmark' },
    { path: `/host/market`, label: 'Market Structure' },
    { path: `/host/competition`, label: 'Competitive Analysis'},
  ];

  const links = persona === 'traveler' ? travelerLinks : hostLinks;

  return (
    <nav className={`navigation ${persona}`}>
      <ul>
        {links.map(link => (
          <li key={link.path}>
            <NavLink 
              to={link.path}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span className="label">{link.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

