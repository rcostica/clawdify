// Plan definitions for Clawdify SaaS tiers

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
    model: 'gemini-flash',
    modelLabel: 'Gemini Flash',
    maxProjects: 3,
    maxProjectsLabel: 'Up to 3 projects',
    description: 'Try Clawdify with Gemini Flash. No API key needed.',
    features: [
      { name: 'Gemini Flash (included)', included: true },
      { name: 'Up to 3 projects', included: true },
      { name: 'Chat & artifacts', included: true },
      { name: 'Dark mode', included: true },
      { name: 'Bring your own API key', included: false },
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
    model: 'byok',
    modelLabel: 'Any model (BYOK)',
    maxProjects: -1,
    maxProjectsLabel: 'Unlimited projects',
    description: 'Bring your own API key. Use Claude, GPT-4, Gemini & more.',
    badge: 'Popular',
    features: [
      { name: 'Any model (your API key)', included: true },
      { name: 'Gemini Flash (included)', included: true },
      { name: 'Unlimited projects', included: true },
      { name: 'Chat & artifacts', included: true },
      { name: 'Voice input', included: true },
      { name: 'File uploads', included: true },
      { name: 'Dark mode', included: true },
      { name: 'Priority support', included: false },
    ],
  },
  byog: {
    id: 'byog',
    name: 'Self-Hosted',
    price: 0,
    priceLabel: 'Free',
    model: 'gateway',
    modelLabel: 'Your Gateway',
    maxProjects: -1,
    maxProjectsLabel: 'Unlimited projects',
    description: 'Connect your own OpenClaw Gateway. Full control, zero cost.',
    features: [
      { name: 'Your Gateway, your rules', included: true },
      { name: 'Any model (your config)', included: true },
      { name: 'Unlimited projects', included: true },
      { name: 'Chat & artifacts', included: true },
      { name: 'Voice input', included: true },
      { name: 'File uploads', included: true },
      { name: 'Complete privacy', included: true },
      { name: 'No subscription needed', included: true },
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
  { id: 'anthropic', name: 'Anthropic', models: ['Claude Sonnet', 'Claude Haiku'], keyPrefix: 'sk-ant-' },
  { id: 'openai', name: 'OpenAI', models: ['GPT-4o', 'GPT-4o mini'], keyPrefix: 'sk-' },
  { id: 'google', name: 'Google', models: ['Gemini Pro', 'Gemini Flash'], keyPrefix: 'AI' },
] as const;

export type ApiProviderId = (typeof API_PROVIDERS)[number]['id'];
