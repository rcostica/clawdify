// Plan definitions for Clawdify SaaS tiers — Mission Control positioning

export type PlanId = 'free' | 'pro' | 'byog';

export interface PlanFeature {
  name: string;
  included: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  priceLabel: string;
  model: string;
  modelLabel: string;
  maxProjects: number;
  maxProjectsLabel: string;
  description: string;
  badge?: string;
  features: PlanFeature[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: 'Free forever',
    model: 'byog',
    modelLabel: 'Your Gateway',
    maxProjects: 2,
    maxProjectsLabel: 'Up to 2 projects',
    description: 'Connect your own Gateway and start building. No strings.',
    features: [
      { name: 'Connect your own Gateway (BYOG)', included: true },
      { name: 'Up to 2 projects', included: true },
      { name: 'Basic dashboard', included: true },
      { name: '7-day task history', included: true },
      { name: 'Artifact preview', included: true },
      { name: 'Multi-device access', included: true },
      { name: 'Community support', included: true },
      { name: 'Unlimited projects', included: false },
      { name: 'Push notifications', included: false },
      { name: 'Scheduled tasks', included: false },
      { name: 'Agent analytics', included: false },
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 12,
    priceLabel: '$12/mo',
    model: 'byok',
    modelLabel: 'Any model (BYOK)',
    maxProjects: -1,
    maxProjectsLabel: 'Unlimited projects',
    description:
      'Full Mission Control. Unlimited projects, notifications, analytics, and priority support.',
    badge: 'Most Popular',
    features: [
      { name: 'Everything in Free', included: true },
      { name: 'Unlimited projects', included: true },
      { name: 'Full task history', included: true },
      { name: 'Push notifications', included: true },
      { name: 'Scheduled tasks', included: true },
      { name: 'Agent analytics', included: true },
      { name: 'Priority support', included: true },
      { name: 'Team features (coming soon)', included: true },
    ],
  },
  byog: {
    id: 'byog',
    name: 'Free (BYOG)',
    price: 0,
    priceLabel: 'Free',
    model: 'gateway',
    modelLabel: 'Your Gateway',
    maxProjects: 2,
    maxProjectsLabel: 'Up to 2 projects',
    description:
      'Connect your own OpenClaw Gateway. Same as Free — included at no cost.',
    features: [
      { name: 'Your Gateway, your rules', included: true },
      { name: 'Any model (your config)', included: true },
      { name: 'Up to 2 projects', included: true },
      { name: 'Basic dashboard', included: true },
      { name: '7-day task history', included: true },
      { name: 'Artifact preview', included: true },
      { name: 'Multi-device access', included: true },
      { name: 'Community support', included: true },
    ],
  },
} as const;

/** Get the plan object for a given plan ID, defaulting to free */
export function getPlan(planId: string | null | undefined): Plan {
  if (planId && planId in PLANS) {
    return PLANS[planId as PlanId];
  }
  return PLANS.free;
}

/** Check if a plan has a specific feature */
export function planHasFeature(planId: PlanId, featureName: string): boolean {
  const plan = PLANS[planId];
  return plan.features.some((f) => f.name === featureName && f.included);
}

/** Available API providers for BYOK */
export const API_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['Claude Sonnet', 'Claude Haiku'],
    keyPrefix: 'sk-ant-',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['GPT-4o', 'GPT-4o mini'],
    keyPrefix: 'sk-',
  },
] as const;

export type ApiProviderId = (typeof API_PROVIDERS)[number]['id'];
