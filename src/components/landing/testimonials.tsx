import { Code2, Clock, Laptop, Briefcase } from 'lucide-react';

const personas = [
  {
    icon: Code2,
    title: 'Freelance developers',
    description:
      'Ship client projects faster. Give your agent the task, review the output, deliver the work. More projects, less grind.',
    highlight: '"I used to spend 3 hours on boilerplate. Now my agent does it while I write the proposal."',
  },
  {
    icon: Clock,
    title: 'Side-project builders',
    description:
      'Got an idea at 11pm? Queue up the tasks. Check your phone in the morning. Your agent worked while you slept.',
    highlight: '"I launched my SaaS MVP in a weekend. The agent handled the boring parts."',
  },
  {
    icon: Briefcase,
    title: 'Startup engineers',
    description:
      'Move fast without breaking things. Your agent writes tests, refactors code, and handles the PRs you never get to.',
    highlight: '"Our 3-person team ships like a 10-person team. The agent is our secret weapon."',
  },
  {
    icon: Laptop,
    title: 'AI-curious developers',
    description:
      "Heard about AI agents but found setup too complex? One click deploys your own agent. See what the fuss is about.",
    highlight: '"I went from zero to watching an agent build a React app in under 5 minutes."',
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
            Developers who ship
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Whether you&apos;re building for clients, side projects, or your startup
            — Clawdify puts an AI agent on your team.
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
              <blockquote className="mt-4 border-l-2 border-violet-500/30 pl-4 text-sm italic text-muted-foreground">
                {persona.highlight}
              </blockquote>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
