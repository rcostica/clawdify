'use client';

import { useState, useEffect } from 'react';
import {
  OnboardingWizard,
  isOnboardingComplete,
} from './onboarding-wizard';

/**
 * Checks if onboarding should show and renders the wizard.
 * Mount this at the app layout level.
 */
export function OnboardingGate() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Only check on client side
    const complete = isOnboardingComplete();
    setShowOnboarding(!complete);
    setChecked(true);
  }, []);

  if (!checked) return null;

  return (
    <OnboardingWizard
      open={showOnboarding}
      onComplete={() => setShowOnboarding(false)}
    />
  );
}
