import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'handshaking'
  | 'connected'
  | 'error';

export interface GatewayConnectionConfig {
  url: string;
  token?: string;
  password?: string;
  insecureAuth?: boolean;
}

export interface HelloOk {
  type: 'hello-ok';
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  snapshot: unknown;
  auth?: {
    deviceToken: string;
    role: string;
    scopes: string[];
  };
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
}

interface GatewayState {
  status: ConnectionStatus;
  config: GatewayConnectionConfig | null;
  hello: HelloOk | null;
  errorMessage: string | null;

  setStatus: (status: ConnectionStatus) => void;
  setConfig: (config: GatewayConnectionConfig | null) => void;
  setHello: (hello: HelloOk | null) => void;
  setError: (message: string | null) => void;
}

export const useGatewayStore = create<GatewayState>()(
  persist(
    (set) => ({
      status: 'disconnected',
      config: null,
      hello: null,
      errorMessage: null,

      setStatus: (status) =>
        set({ status, errorMessage: status === 'error' ? undefined : null }),
      setConfig: (config) => set({ config }),
      setHello: (hello) => set({ hello }),
      setError: (errorMessage) => set({ errorMessage }),
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
