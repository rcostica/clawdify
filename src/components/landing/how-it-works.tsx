const steps = [
  {
    number: '01',
    title: 'Sign up',
    description:
      'Create your free account in seconds. No credit card required.',
    icon: '✨',
  },
  {
    number: '02',
    title: 'Connect',
    description:
      'Link your own OpenClaw gateway or spin up our hosted option with one click.',
    icon: '🔗',
  },
  {
    number: '03',
    title: 'Start building',
    description:
      'Create projects, chat with AI, preview artifacts, and ship faster.',
    icon: '🚀',
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-24 md:py-32">
      {/* Subtle divider gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            How it works
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Up and running in minutes
          </h2>
        </div>

        <div className="relative mt-16 grid gap-8 md:grid-cols-3">
          {/* Connecting line */}
          <div className="pointer-events-none absolute top-12 left-[16.67%] right-[16.67%] hidden h-px bg-gradient-to-r from-violet-500/30 via-indigo-500/30 to-violet-500/30 md:block" />

          {steps.map((step) => (
            <div key={step.number} className="relative text-center">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-border/50 bg-card/80 text-4xl shadow-lg shadow-violet-500/5">
                {step.icon}
              </div>
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-400">
                Step {step.number}
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
