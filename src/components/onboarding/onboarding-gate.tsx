'use client';

import { useState, useEffect } from 'react';
import { OnboardingWizard, shouldShowOnboarding } from './onboarding-wizard';

/**
 * Checks if the user should see the onboarding wizard.
 * Shows it automatically on first login.
 */
export function OnboardingGate() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Delay check slightly to avoid flash on returning users
    const timer = setTimeout(() => {
      if (shouldShowOnboarding()) {
        setShowOnboarding(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <OnboardingWizard
      open={showOnboarding}
      onOpenChange={setShowOnboarding}
    />
  );
}
