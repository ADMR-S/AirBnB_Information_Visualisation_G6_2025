import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useFilterStore } from '../stores/useFilterStore';
import { getUniqueStates, getUniqueCities, getUniqueRoomTypes } from '../utils/dataLoader';
import './FilterBar.css';

const MultiSelect = ({ label, value, options, onChange, showDropdown, setShowDropdown }: any) => {
  const isActive = value.length > 0;
  return (
    <div className="filter-group dropdown-filter">
      <label>{label}</label>
      <button className={`dropdown-button ${isActive ? 'filter-active' : ''}`} onClick={() => setShowDropdown(!showDropdown)}>
        {value.length === 0 ? `All ${label}` : `${value.length} selected`}
      </button>
      {showDropdown && (
        <div className="dropdown-menu">
          {options.map((option: string) => (
            <label key={option} className="dropdown-item">
              <input type="checkbox" checked={value.includes(option)} onChange={() => onChange(option)} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const RangeFilter = ({ label, range, setRange, min = "0", max, step = "1", prefix = "", defaultRange }: any) => {
  const minIsActive = range[0] !== defaultRange[0];
  const maxIsActive = range[1] !== defaultRange[1];
  return (
    <div className="filter-group">
      <label>{label}</label>
      <div className="range-inputs">
        <div className="range-input">
          <label>Min{prefix && ` (${prefix})`}</label>
          <input
            type="number"
            step={step}
            min={min}
            max={range[1]}
            value={range[0]}
            onChange={(e) => setRange([parseFloat(e.target.value) || parseFloat(min), range[1]])}
            className={minIsActive ? 'filter-active' : ''}
          />
        </div>
        <div className="range-input">
          <label>Max{prefix && ` (${prefix})`}</label>
          <input
            type="number"
            step={step}
            min={range[0]}
            max={max}
            value={range[1]}
            onChange={(e) => setRange([range[0], parseFloat(e.target.value) || parseFloat(max)])}
            className={maxIsActive ? 'filter-active' : ''}
          />
        </div>
      </div>
    </div>
  );
};

export default function FilterBar() {
  const location = useLocation();
  const isTraveler = location.pathname.startsWith('/traveler');
  const {
    allData, year, states, cities, roomTypes, priceRange, reviewRange, availabilityRange,
    minNightsRange, reviewsPerMonthRange, hostListingsRange, setYear, setStates, setCities,
    setRoomTypes, setPriceRange, setReviewRange, setAvailabilityRange, setMinNightsRange,
    setReviewsPerMonthRange, setHostListingsRange, resetFilters
  } = useFilterStore();

  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showRoomTypeDropdown, setShowRoomTypeDropdown] = useState(false);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableRoomTypes, setAvailableRoomTypes] = useState<string[]>([]);

  useEffect(() => {
    if (allData.length > 0 && availableStates.length === 0) {
      setAvailableStates(getUniqueStates(allData));
      setAvailableCities(getUniqueCities(allData));
      setAvailableRoomTypes(getUniqueRoomTypes(allData));
    }
  }, [allData.length, availableStates.length, allData]);


  const toggleItem = (items: string[], item: string, setter: (items: string[]) => void) => {
    setter(items.includes(item) ? items.filter(i => i !== item) : [...items, item]);
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar-content">
        <div className="filter-bar-title">Filters</div>

        {!isTraveler && (
          <div className="filter-section">
            <div className="filter-group">
              <label>Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value as any)}>
                <option value="2023">2023</option>
                <option value="2020">2020</option>
              </select>
            </div>
          </div>
        )}

        <div className="filter-section">
          <MultiSelect label="States" value={states} options={availableStates} onChange={(s: string) => toggleItem(states, s, setStates)} showDropdown={showStateDropdown} setShowDropdown={setShowStateDropdown} />
          <MultiSelect label="Cities" value={cities} options={availableCities.slice(0, 20)} onChange={(c: string) => toggleItem(cities, c, setCities)} showDropdown={showCityDropdown} setShowDropdown={setShowCityDropdown} />
          <MultiSelect label="Room Types" value={roomTypes} options={availableRoomTypes} onChange={(rt: string) => toggleItem(roomTypes, rt, setRoomTypes)} showDropdown={showRoomTypeDropdown} setShowDropdown={setShowRoomTypeDropdown} />
        </div>

        <div className="filter-section">
          <RangeFilter label="Price Range" range={priceRange} setRange={setPriceRange} max="50000" prefix="$" defaultRange={[0, 5000]} />
          <RangeFilter label="Reviews" range={reviewRange} setRange={setReviewRange} max="10000" defaultRange={[0, 1000]} />
          <RangeFilter label="Availability" range={availabilityRange} setRange={setAvailabilityRange} max="365" defaultRange={[0, 365]} />
          <RangeFilter label="Minimum Nights" range={minNightsRange} setRange={setMinNightsRange} min="1" max="365" defaultRange={[1, 365]} />
          <RangeFilter label="Reviews/Month" range={reviewsPerMonthRange} setRange={setReviewsPerMonthRange} max="100" step="0.1" defaultRange={[0, 50]} />
          {!isTraveler && (
            <RangeFilter label="Host Listings" range={hostListingsRange} setRange={setHostListingsRange} min="1" max="1000" defaultRange={[1, 500]} />
          )}
        </div>

        <button className="reset-button" onClick={resetFilters}>
          Reset Filters
        </button>
      </div>
    </div>
  );
}
