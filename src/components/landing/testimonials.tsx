import { Badge } from '@/components/ui/badge';

const trustBadges = [
  {
    icon: '🔓',
    title: 'Open Source',
    description:
      'The OpenClaw relay is fully open source. Inspect the code, run it yourself, contribute back.',
    badge: 'GitHub',
  },
  {
    icon: '🔐',
    title: 'E2E Encryption Planned',
    description:
      'End-to-end encryption is on the roadmap. Your conversations will be encrypted at rest and in transit.',
    badge: 'Roadmap',
  },
  {
    icon: '🤖',
    title: 'Multi-Model',
    description:
      'Access Claude, GPT-4, and Gemini from one workspace. Switch models per conversation.',
    badge: 'Live',
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Trusted in Open Beta
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Built on transparency
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Clawdify is built in the open. No black boxes, no data lock-in.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {trustBadges.map((item) => (
            <div
              key={item.title}
              className="relative rounded-xl border border-border/50 bg-card/50 p-6 text-center transition-all duration-300 hover:border-violet-500/20 hover:bg-card/80"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-3xl">
                {item.icon}
              </div>
              <Badge
                variant="secondary"
                className="mb-3 text-[10px] uppercase tracking-wider"
              >
                {item.badge}
              </Badge>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
