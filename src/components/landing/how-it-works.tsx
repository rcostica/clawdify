import { MousePointerClick, Key, Zap } from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Click Deploy',
    description:
      'Pick Railway or Fly.io. One click deploys an AI agent to your own cloud account. No terminal needed.',
    icon: MousePointerClick,
    detail: 'Or connect your existing OpenClaw Gateway',
  },
  {
    number: '02',
    title: 'Add your API key',
    description:
      'Enter your Anthropic or OpenAI key. Your agent connects to Clawdify automatically. You keep full control of costs.',
    icon: Key,
    detail: 'Keys never leave your infrastructure',
  },
  {
    number: '03',
    title: 'Create a task',
    description:
      'Type what you want built. Watch your agent work in real-time — reading, writing, running commands — until it\'s done.',
    icon: Zap,
    detail: 'First task running in under 5 minutes',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 md:py-32 scroll-mt-20">
      {/* Subtle divider gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            How it works
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            From zero to AI agent in 5 minutes
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            No servers to manage. No Docker to configure. No YAML to debug.
          </p>
        </div>

        <div className="relative mt-16 grid gap-8 md:grid-cols-3">
          {/* Connecting line */}
          <div className="pointer-events-none absolute top-12 left-[16.67%] right-[16.67%] hidden h-px bg-gradient-to-r from-violet-500/30 via-indigo-500/30 to-violet-500/30 md:block" />

          {steps.map((step) => (
            <div key={step.number} className="relative text-center">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-border/50 bg-card/80 shadow-lg shadow-violet-500/5">
                <step.icon className="h-10 w-10 text-violet-400" />
              </div>
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-400">
                Step {step.number}
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
              <p className="mt-3 text-xs font-medium text-violet-400/70">
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
