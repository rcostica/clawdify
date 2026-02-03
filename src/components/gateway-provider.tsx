'use client';

import { useEffect } from 'react';
import { useGatewayConnection } from '@/lib/gateway/hooks';
import { useGatewayStore } from '@/stores/gateway-store';

/**
 * Initializes the Gateway connection on app load.
 * Loads saved connection from Supabase and auto-connects.
 * Must be mounted once at the app layout level.
 */
export function GatewayProvider({ children }: { children: React.ReactNode }) {
  // This hook wires up the singleton GatewayClient to Zustand stores
  useGatewayConnection();

  const loadFromSupabase = useGatewayStore((s) => s.loadFromSupabase);
  const config = useGatewayStore((s) => s.config);

  // On mount, try to load saved connection from Supabase
  useEffect(() => {
    if (!config?.token) {
      loadFromSupabase();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
