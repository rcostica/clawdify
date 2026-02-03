import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GatewayConnectionConfig,
  HelloOk,
} from '@/lib/gateway/types';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'handshaking'
  | 'connected'
  | 'error';

interface GatewayState {
  status: ConnectionStatus;
  config: GatewayConnectionConfig | null;
  hello: HelloOk | null;
  errorMessage: string | null;

  setStatus: (status: ConnectionStatus) => void;
  setConfig: (config: GatewayConnectionConfig | null) => void;
  setHello: (hello: HelloOk | null) => void;
  setError: (message: string | null) => void;
  /** Load connection config from Supabase (decrypts token server-side) */
  loadFromSupabase: () => Promise<void>;
}

export const useGatewayStore = create<GatewayState>()(
  persist(
    (set) => ({
      status: 'disconnected',
      config: null,
      hello: null,
      errorMessage: null,

      setStatus: (status) =>
        set({
          status,
          errorMessage: status === 'error' ? undefined : null,
        }),
      setConfig: (config) => set({ config }),
      setHello: (hello) => set({ hello }),
      setError: (errorMessage) => set({ errorMessage, status: 'error' }),

      loadFromSupabase: async () => {
        try {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          const { data, error } = await supabase.rpc(
            'get_gateway_connection',
            { p_name: 'Default' },
          );
          if (
            !error &&
            data &&
            Array.isArray(data) &&
            data.length > 0
          ) {
            const conn = data[0] as {
              gateway_url: string;
              gateway_token?: string | null;
            };
            if (conn.gateway_url) {
              set({
                config: {
                  url: conn.gateway_url,
                  token: conn.gateway_token ?? undefined,
                },
              });
            }
          }
        } catch (err) {
          console.warn('[gateway-store] Failed to load from Supabase:', err);
        }
      },
    }),
    {
      name: 'clawdify-gateway',
      partialize: (state) => ({
        // 🔒 SECURITY: Only persist the gateway URL, NEVER the token.
        config: state.config ? { url: state.config.url } : null,
      }),
    },
  ),
);
