// Plan definitions for Clawdify SaaS tiers

export type PlanId = 'free' | 'pro' | 'team';

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
    model: 'gemini-flash',
    modelLabel: 'Gemini Flash',
    maxProjects: 3,
    maxProjectsLabel: 'Up to 3 projects',
    description: 'Try Clawdify with Gemini Flash. No credit card needed.',
    features: [
      { name: 'Gemini Flash model', included: true },
      { name: 'Up to 3 projects', included: true },
      { name: 'Chat & artifacts', included: true },
      { name: 'Dark mode', included: true },
      { name: 'Claude & GPT-4', included: false },
      { name: 'Voice input', included: false },
      { name: 'Unlimited projects', included: false },
      { name: 'Priority support', included: false },
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 15,
    priceLabel: '$15/mo',
    model: 'claude-sonnet',
    modelLabel: 'Claude + GPT-4',
    maxProjects: -1,
    maxProjectsLabel: 'Unlimited projects',
    description: 'Claude, GPT-4, unlimited projects, voice & artifacts.',
    badge: 'Popular',
    features: [
      { name: 'Gemini Flash model', included: true },
      { name: 'Claude & GPT-4', included: true },
      { name: 'Unlimited projects', included: true },
      { name: 'Chat & artifacts', included: true },
      { name: 'Voice input', included: true },
      { name: 'File uploads', included: true },
      { name: 'Dark mode', included: true },
      { name: 'Priority support', included: false },
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 25,
    priceLabel: '$25/mo per seat',
    model: 'claude-sonnet',
    modelLabel: 'Claude + GPT-4',
    maxProjects: -1,
    maxProjectsLabel: 'Unlimited projects',
    description: 'Everything in Pro plus team features and priority support.',
    badge: 'Coming Soon',
    features: [
      { name: 'Gemini Flash model', included: true },
      { name: 'Claude & GPT-4', included: true },
      { name: 'Unlimited projects', included: true },
      { name: 'Chat & artifacts', included: true },
      { name: 'Voice input', included: true },
      { name: 'File uploads', included: true },
      { name: 'Dark mode', included: true },
      { name: 'Priority support', included: true },
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

/** Available API providers for Pro tier */
export const API_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', models: ['Claude Sonnet', 'Claude Haiku'], keyPrefix: 'sk-ant-' },
  { id: 'openai', name: 'OpenAI', models: ['GPT-4o', 'GPT-4o mini'], keyPrefix: 'sk-' },
  { id: 'google', name: 'Google', models: ['Gemini Pro', 'Gemini Flash'], keyPrefix: 'AI' },
] as const;

export type ApiProviderId = (typeof API_PROVIDERS)[number]['id'];
