import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlanId, ApiProviderId } from '@/lib/billing/plans';

export interface UsageStats {
  tokensIn: number;
  tokensOut: number;
  cost: number;
  periodStart: string;
  periodEnd: string;
}

interface UserState {
  // Plan & billing
  plan: PlanId;
  apiProvider: ApiProviderId | null;
  apiKeySet: boolean; // 🔒 SECURITY: never store the actual key in client state
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;

  // Onboarding
  onboardingCompleted: boolean;
  onboardingPath: 'free' | 'pro' | 'gateway' | null;

  // Gateway mode
  gatewayMode: 'hosted' | 'byog'; // hosted = Clawdify-managed, byog = user's own gateway

  // Usage (cached, refreshed from API)
  usage: UsageStats | null;

  // Actions
  setPlan: (plan: PlanId) => void;
  setApiProvider: (provider: ApiProviderId | null) => void;
  setApiKeySet: (set: boolean) => void;
  setStripeCustomerId: (id: string | null) => void;
  setStripeSubscriptionId: (id: string | null) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setOnboardingPath: (path: 'free' | 'pro' | 'gateway' | null) => void;
  setGatewayMode: (mode: 'hosted' | 'byog') => void;
  setUsage: (usage: UsageStats | null) => void;
  reset: () => void;
}

const initialState = {
  plan: 'free' as PlanId,
  apiProvider: null as ApiProviderId | null,
  apiKeySet: false,
  stripeCustomerId: null as string | null,
  stripeSubscriptionId: null as string | null,
  onboardingCompleted: false,
  onboardingPath: null as 'free' | 'pro' | 'gateway' | null,
  gatewayMode: 'byog' as const,
  usage: null as UsageStats | null,
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,

      setPlan: (plan) => set({ plan }),
      setApiProvider: (apiProvider) => set({ apiProvider }),
      setApiKeySet: (apiKeySet) => set({ apiKeySet }),
      setStripeCustomerId: (stripeCustomerId) => set({ stripeCustomerId }),
      setStripeSubscriptionId: (stripeSubscriptionId) =>
        set({ stripeSubscriptionId }),
      setOnboardingCompleted: (onboardingCompleted) =>
        set({ onboardingCompleted }),
      setOnboardingPath: (onboardingPath) => set({ onboardingPath }),
      setGatewayMode: (gatewayMode) => set({ gatewayMode }),
      setUsage: (usage) => set({ usage }),
      reset: () => set(initialState),
    }),
    {
      name: 'clawdify-user',
      partialize: (state) => ({
        // 🔒 SECURITY: Only persist non-sensitive state
        plan: state.plan,
        onboardingCompleted: state.onboardingCompleted,
        onboardingPath: state.onboardingPath,
        gatewayMode: state.gatewayMode,
        apiProvider: state.apiProvider,
        apiKeySet: state.apiKeySet,
      }),
    },
  ),
);
