import { Link } from 'react-router-dom';
import type { AirbnbListing, Persona } from '../types/airbnb.types';
import './ListingDetails.css';

interface ListingDetailsProps {
  listing: AirbnbListing;
  persona: Persona;
  onClear?: () => void;
}

export default function ListingDetails({ listing, persona, onClear }: ListingDetailsProps) {
  // Navigation links based on persona
  const navigationLinks = persona === 'traveler' 
    ? [
        { path: '/traveler/map', label: 'Map View' },
        { path: '/traveler/prices', label: 'Price Explorer' },
        { path: '/traveler/value', label: 'Value Finder' },
        { path: '/traveler/availability', label: 'Availability' },
      ]
    : [
        { path: '/host/map', label: 'Competition Map' },
        { path: '/host/pricing', label: 'Pricing Benchmark' },
        { path: '/host/market', label: 'Market Structure' },
        { path: '/host/competition', label: 'Competitive Analysis' },
      ];

  return (
    <div className="listing-details">
      <div className="listing-details-header">
        <h3>Selected Listing</h3>
        {onClear && (
          <button className="listing-details-clear" onClick={onClear} title="Clear selection">
            ×
          </button>
        )}
      </div>
      
      <div className="listing-details-content">
        <div className="listing-details-main">
          <h4 className="listing-name">{listing.name}</h4>
          
          <div className="listing-details-grid">
            <div className="detail-item">
              <span className="detail-label">Host:</span>
              <span className="detail-value">{listing.host_name}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Location:</span>
              <span className="detail-value">{listing.neighbourhood}, {listing.city}, {listing.state}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Room Type:</span>
              <span className="detail-value">{listing.room_type}</span>
            </div>
            
            <div className="detail-item highlight">
              <span className="detail-label">Price:</span>
              <span className="detail-value">${listing.price.toFixed(2)}/night</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Minimum Nights:</span>
              <span className="detail-value">{listing.minimum_nights}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Availability:</span>
              <span className="detail-value">{listing.availability_365} days/year</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Reviews:</span>
              <span className="detail-value">
                {listing.number_of_reviews} ({listing.reviews_per_month?.toFixed(1) || 0}/month)
              </span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Host Listings:</span>
              <span className="detail-value">{listing.calculated_host_listings_count}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Year:</span>
              <span className="detail-value">{listing.year}</span>
            </div>
          </div>
        </div>
        
        <div className="listing-details-actions">
          <p className="action-label">Explore this listing in other views:</p>
          <div className="action-links">
            {navigationLinks.map(link => (
              <Link 
                key={link.path} 
                to={link.path} 
                className="action-link"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
