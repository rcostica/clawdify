import { Code2, Users, Rocket, Laptop } from 'lucide-react';

const personas = [
  {
    icon: Code2,
    title: 'Freelance developers',
    description:
      'Managing multiple client projects? Create a project per client, queue up tasks, and let your agent handle the boilerplate while you focus on architecture and client calls.',
    scenario: 'Queue tasks before bed. Review results with morning coffee.',
  },
  {
    icon: Users,
    title: 'Small teams',
    description:
      'Delegate repetitive tasks to your AI agent — test writing, documentation, refactoring. The dashboard gives the whole team visibility into what the agent is doing.',
    scenario: 'One agent, shared dashboard, everyone sees the progress.',
  },
  {
    icon: Rocket,
    title: 'Solo founders',
    description:
      'Building alone doesn\'t mean building slowly. Your agent is your first hire. Assign it tickets from the dashboard like you would a junior dev.',
    scenario: 'Ship your MVP faster with an AI co-pilot you can actually manage.',
  },
  {
    icon: Laptop,
    title: 'AI-curious developers',
    description:
      'Used ChatGPT but want more? An autonomous agent that reads your codebase, runs commands, and builds things — with a dashboard to watch it all happen.',
    scenario: 'From chat to autonomous work, with full visibility.',
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Built For
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Developers who delegate
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Whether you&apos;re building for clients, your startup, or your next
            side project — Clawdify gives you a workspace for your AI
            agent.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {personas.map((persona) => (
            <div
              key={persona.title}
              className="relative rounded-xl border border-border/50 bg-card/50 p-6 transition-all duration-300 hover:border-violet-500/20 hover:bg-card/80"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                  <persona.icon className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold">{persona.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {persona.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 border-l-2 border-violet-500/30 pl-4">
                <p className="text-sm font-medium text-violet-400/80">
                  {persona.scenario}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
