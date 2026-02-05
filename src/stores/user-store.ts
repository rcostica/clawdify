import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  // Onboarding
  onboardingCompleted: boolean;

  // Actions
  setOnboardingCompleted: (completed: boolean) => void;
  reset: () => void;
}

const initialState = {
  onboardingCompleted: false,
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,

      setOnboardingCompleted: (onboardingCompleted) =>
        set({ onboardingCompleted }),
      reset: () => set(initialState),
    }),
    {
      name: 'clawdify-user',
      partialize: (state) => ({
        onboardingCompleted: state.onboardingCompleted,
      }),
    },
  ),
);
