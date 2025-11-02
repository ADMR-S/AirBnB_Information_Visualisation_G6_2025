import { useState, useEffect, useRef, useMemo } from 'react';
import { useFilterStore } from '../stores/useFilterStore';
import { useHostSelection } from '../contexts/HostSelectionContext';
import './HostSelectionPopup.css';

interface HostSelectionPopupProps {
  onClose: () => void;
  onConfirm: () => void;
}

type Host = { hostId: string; hostName: string };

export default function HostSelectionPopup({ onClose, onConfirm }: HostSelectionPopupProps) {
  const { allData } = useFilterStore();
  const { selectedHost, setSelectedHost } = useHostSelection();
  const [search, setSearch] = useState('');
  const [hosts, setHosts] = useState<Host[]>([]);
  const [displayCount, setDisplayCount] = useState(10);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Extract unique hosts once
  useEffect(() => {
    if (!allData.length || hosts.length) return;
    
    setTimeout(() => {
      const map = new Map<string, string>();
      allData.forEach(l => {
        if (!map.has(l.host_id)) map.set(l.host_id, l.host_name);
      });
      setHosts(
        Array.from(map, ([hostId, hostName]) => ({ hostId, hostName }))
          .sort((a, b) => a.hostName.localeCompare(b.hostName))
      );
    }, 0);
  }, [allData, hosts.length]);

  // Filter hosts
  const filtered = useMemo(() => {
    if (!search.trim()) return hosts;
    const s = search.toLowerCase();
    return hosts.filter(h => 
      h.hostName.toLowerCase().includes(s) || 
      h.hostId.toLowerCase().includes(s)
    ).slice(0, 500);
  }, [hosts, search]);

  // Reset display count when search changes
  useEffect(() => {
    setDisplayCount(10);
  }, [search]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || search.trim()) return;
    
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && displayCount < filtered.length) {
          setDisplayCount(prev => Math.min(prev + 20, filtered.length));
        }
      },
      { root: listRef.current, rootMargin: '50px' }
    );
    
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [displayCount, filtered.length, search]);

  const visible = search.trim() ? filtered : filtered.slice(0, displayCount);

  return (
    <div className="host-popup-overlay">
      <div className="host-popup" onClick={e => e.stopPropagation()}>
        <div className="host-popup-header">
          <h2>Select a Host</h2>
          <button className="host-popup-close" onClick={onClose}>×</button>
        </div>

        <div className="host-popup-search">
          <input
            type="text"
            placeholder="Search by host name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="host-popup-list" ref={listRef}>
          {!hosts.length ? (
            <div className="host-popup-empty">
              <div className="host-popup-spinner" />
              <span>Loading hosts...</span>
            </div>
          ) : !visible.length ? (
            <div className="host-popup-empty">No hosts found</div>
          ) : (
            <>
              {visible.map(h => (
                <div
                  key={h.hostId}
                  className={`host-popup-item ${selectedHost?.hostId === h.hostId ? 'selected' : ''}`}
                  onClick={() => setSelectedHost(h)}
                >
                  <span className="host-name">{h.hostName}</span>
                  <span className="host-id">ID: {h.hostId}</span>
                </div>
              ))}
              {!search.trim() && displayCount < filtered.length && (
                <div ref={sentinelRef} className="host-popup-sentinel" />
              )}
            </>
          )}
        </div>

        <div className="host-popup-footer">
          <button className="host-popup-btn-cancel" onClick={onClose}>Cancel</button>
          <button 
            className="host-popup-btn-confirm" 
            onClick={onConfirm}
            disabled={!selectedHost}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

