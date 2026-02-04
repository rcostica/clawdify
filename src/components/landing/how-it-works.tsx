import { Terminal, Link2, Zap } from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Install OpenClaw',
    description:
      'One command gets you the OpenClaw Gateway — the agent runtime that runs on your machine. Your keys, your hardware, your control.',
    icon: Terminal,
    detail: 'npm install -g openclaw',
    isCode: true,
  },
  {
    number: '02',
    title: 'Connect to Clawdify',
    description:
      'Paste your Clawdify token into the Gateway config. Your agent connects automatically and shows up in your dashboard.',
    icon: Link2,
    detail: 'openclaw gateway start --token YOUR_TOKEN',
    isCode: true,
  },
  {
    number: '03',
    title: 'Create your first task',
    description:
      'Type what you want done. Your agent picks it up, starts working, and you watch every step in real-time from your browser.',
    icon: Zap,
    detail: 'First task running in under 5 minutes',
    isCode: false,
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
            Connected in 5 minutes
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Install the Gateway on your machine. Connect it to Clawdify. Start
            creating tasks. That&apos;s it.
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
              <p
                className={`mt-3 text-xs font-medium ${
                  step.isCode
                    ? 'font-mono rounded-md bg-muted/50 px-3 py-1.5 inline-block text-violet-400'
                    : 'text-violet-400/70'
                }`}
              >
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
