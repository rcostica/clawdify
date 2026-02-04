'use client';

import { useEffect } from 'react';
import { useGatewayConnection } from '@/lib/gateway/hooks';
import { useGatewayStore } from '@/stores/gateway-store';
import { useActivityStore } from '@/stores/activity-store';
import { useTaskStore } from '@/stores/task-store';
import { mapChatEventToActivity, mapAgentEventToActivity } from '@/lib/gateway/activity-mapper';
import { getGatewayClient } from '@/lib/gateway/hooks';
import type { ChatEventPayload, AgentEventPayload } from '@/lib/gateway/types';

/**
 * Initializes the Gateway connection on app load.
 * Loads saved connection from Supabase and auto-connects.
 * Also wires up the activity mapper for real-time event translation.
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
