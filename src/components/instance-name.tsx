'use client';

import { useEffect, useState, createContext, useContext } from 'react';

interface InstanceNameContextType {
  instanceName: string;
  setInstanceName: (name: string) => void;
}

const InstanceNameContext = createContext<InstanceNameContextType>({
  instanceName: 'Clawdify',
  setInstanceName: () => {},
});

export function useInstanceName() {
  return useContext(InstanceNameContext);
}

export function InstanceNameProvider({ children }: { children: React.ReactNode }) {
  const [instanceName, setInstanceName] = useState('Clawdify');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings?key=instance_name');
        const data = await res.json();
        if (data.value) {
          setInstanceName(data.value);
          document.title = data.value;
        }
      } catch { /* default */ }
    }
    load();
  }, []);

  // Update document title when name changes
  useEffect(() => {
    document.title = instanceName;
  }, [instanceName]);

  return (
    <InstanceNameContext.Provider value={{ instanceName, setInstanceName }}>
      {children}
    </InstanceNameContext.Provider>
  );
}
