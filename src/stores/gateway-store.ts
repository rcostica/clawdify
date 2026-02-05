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
  clearConfig: () => void;
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
          ...(status !== 'error' ? { errorMessage: null } : {}),
        }),
      setConfig: (config) => set({ config }),
      setHello: (hello) => set({ hello }),
      setError: (errorMessage) => set({ errorMessage, status: 'error' }),
      clearConfig: () => set({ config: null, status: 'disconnected', hello: null }),
    }),
    {
      name: 'clawdify-gateway',
      // Self-hosted: safe to persist both URL and token locally
      partialize: (state) => ({
        config: state.config,
      }),
    },
  ),
);
