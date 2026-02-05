'use client';

import { useEffect } from 'react';
import { useGatewayConnection } from '@/lib/gateway/hooks';
import { useGatewayStore } from '@/stores/gateway-store';

/**
 * Initializes the Gateway connection on app load.
 * Auto-connects if a saved config exists in localStorage.
 * Must be mounted once at the app layout level.
 */
export function GatewayProvider({ children }: { children: React.ReactNode }) {
  // This hook wires up the singleton GatewayClient to Zustand stores
  const { connect } = useGatewayConnection();
  const config = useGatewayStore((s) => s.config);
  const status = useGatewayStore((s) => s.status);

  // On mount, auto-connect if we have a saved config
  useEffect(() => {
    if (config?.url && status === 'disconnected') {
      // Small delay to ensure store is hydrated
      const timer = setTimeout(() => {
        connect(config);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
