import {
  Activity,
  ListTodo,
  FolderKanban,
  Eye,
  Bell,
  BarChart3,
  Network,
  Command,
} from 'lucide-react';

const features = [
  {
    icon: ListTodo,
    title: 'Task management',
    description:
      'Create tasks, queue them up, assign them to your agent. Track progress from queued → active → done. Your agent\'s to-do list, managed visually.',
  },
  {
    icon: Activity,
    title: 'Real-time activity feed',
    description:
      'Watch your agent read files, write code, and run commands — as it happens. Every action, timestamped and logged.',
  },
  {
    icon: Eye,
    title: 'Artifact viewer',
    description:
      'Preview what your agent produced — rendered HTML, syntax-highlighted code, markdown docs, images — right in the dashboard. No context switching.',
  },
  {
    icon: FolderKanban,
    title: 'Project organization',
    description:
      'Group tasks by project. Switch between client work, side projects, and experiments. Each project gets its own task history and activity log.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description:
      'Get alerted when tasks complete or fail. Step away from the screen — your dashboard will ping you when there\'s something to review.',
    badge: 'Pro',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description:
      'Track token usage, task success rates, and time spent per project. Know exactly what your agent costs and where the time goes.',
    badge: 'Pro',
  },
  {
    icon: Network,
    title: 'Multi-gateway support',
    description:
      'Running multiple Gateways? Manage them all from one dashboard. Different machines, different projects — one control plane.',
  },
  {
    icon: Command,
    title: 'Keyboard-first',
    description:
      'Command palette, keyboard shortcuts, and quick actions. Navigate your dashboard without touching the mouse. Built for developers who live in the keyboard.',
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Features
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Your agent works. You stay in control.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            A dashboard built for developers who delegate work to AI agents —
            and want visibility into every step.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border border-border/50 bg-card/50 p-6 transition-all duration-300 hover:border-violet-500/30 hover:bg-card/80 hover:shadow-lg hover:shadow-violet-500/5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                <feature.icon className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="font-semibold">
                {feature.title}
                {'badge' in feature && feature.badge && (
                  <span className="ml-2 inline-flex rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                    {feature.badge}
                  </span>
                )}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
