'use client';

import { useEffect, useState, createContext, useContext } from 'react';

interface InstanceContextType {
  instanceName: string;
  setInstanceName: (name: string) => void;
  instanceIconVersion: number;
  bumpInstanceIcon: () => void;
}

const InstanceNameContext = createContext<InstanceContextType>({
  instanceName: 'Clawdify',
  setInstanceName: () => {},
  instanceIconVersion: 0,
  bumpInstanceIcon: () => {},
});

export function useInstanceName() {
  return useContext(InstanceNameContext);
}

export function InstanceNameProvider({ children }: { children: React.ReactNode }) {
  const [instanceName, setInstanceName] = useState('Clawdify');
  const [instanceIconVersion, setInstanceIconVersion] = useState(0);

  const bumpInstanceIcon = () => setInstanceIconVersion(v => v + 1);

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
    <InstanceNameContext.Provider value={{ instanceName, setInstanceName, instanceIconVersion, bumpInstanceIcon }}>
      {children}
    </InstanceNameContext.Provider>
  );
}
