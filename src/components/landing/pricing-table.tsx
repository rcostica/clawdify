import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Try Clawdify with Gemini Flash — no API key needed.',
    cta: 'Get Started Free',
    ctaVariant: 'outline' as const,
    ctaHref: '/signup',
    highlighted: false,
    features: [
      'Gemini Flash model (included)',
      '3 projects',
      'Basic chat interface',
      'Dark mode',
      'Mobile access',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: '$15',
    period: '/mo',
    description: 'Use any model with your own API key. Full workspace features.',
    cta: 'Start Pro Trial',
    ctaVariant: 'default' as const,
    ctaHref: '/signup',
    highlighted: true,
    badge: 'Most Popular',
    features: [
      'Any model (bring your API key)',
      'Claude, GPT-4, Gemini & more',
      'Unlimited projects',
      'Voice input & output',
      'Artifacts & code preview',
      'File uploads',
      'Keyboard shortcuts',
      'Import existing sessions',
    ],
    note: 'API costs billed by your provider',
  },
  {
    name: 'Self-Hosted',
    price: '$0',
    period: '',
    description: 'Connect your own OpenClaw Gateway — full control, zero cost.',
    cta: 'Connect Gateway',
    ctaVariant: 'outline' as const,
    ctaHref: '/signup',
    highlighted: false,
    features: [
      'Your Gateway, your rules',
      'All Pro features included',
      'Complete privacy',
      'No data leaves your server',
      'Unlimited everything',
      'Works with any model',
      'Community support',
      'No subscription needed',
    ],
  },
];

export function PricingTable() {
  return (
    <section id="pricing" className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Pricing
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Start free with Gemini Flash. Bring your own API key for any model. Self-host for complete control.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-xl border p-8 transition-all duration-300 ${
                tier.highlighted
                  ? 'border-violet-500/50 bg-card/80 shadow-xl shadow-violet-500/10 scale-[1.02]'
                  : 'border-border/50 bg-card/50 hover:border-border'
              }`}
            >
              {tier.badge && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-0 px-4 py-1">
                  {tier.badge}
                </Badge>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-muted-foreground">{tier.period}</span>
                  )}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {tier.description}
                </p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm"
                  >
                    <svg
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        tier.highlighted
                          ? 'text-violet-400'
                          : 'text-muted-foreground'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {'note' in tier && tier.note && (
                <p className="mb-4 text-xs text-muted-foreground text-center italic">
                  {tier.note}
                </p>
              )}

              <Link href={tier.ctaHref} className="mt-auto">
                <Button
                  variant={tier.ctaVariant}
                  className={`w-full ${
                    tier.highlighted
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 border-0'
                      : ''
                  }`}
                >
                  {tier.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* BYOK explainer */}
        <div className="mt-10 rounded-xl border border-border/50 bg-card/50 p-6 text-center">
          <p className="text-sm font-medium">
            🔑 Bring Your Own Key{' '}
            <span className="text-muted-foreground">
              — Clawdify connects to models through your API keys. You pay your provider directly (OpenAI, Anthropic, Google) and keep full control of your usage and costs.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
