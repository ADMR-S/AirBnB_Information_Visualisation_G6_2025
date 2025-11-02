import { createContext, useContext, useState, type ReactNode } from 'react';

interface HostSelection {
  hostId: string;
  hostName: string;
}

interface HostSelectionContextType {
  selectedHost: HostSelection | null;
  setSelectedHost: (host: HostSelection | null) => void;
}

const HostSelectionContext = createContext<HostSelectionContextType | undefined>(undefined);

export function HostSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedHost, setSelectedHost] = useState<HostSelection | null>(null);

  return (
    <HostSelectionContext.Provider value={{ selectedHost, setSelectedHost }}>
      {children}
    </HostSelectionContext.Provider>
  );
}

export function useHostSelection() {
  const context = useContext(HostSelectionContext);
  if (!context) {
    throw new Error('useHostSelection must be used within HostSelectionProvider');
  }
  return context;
}

