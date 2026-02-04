import {
  Activity,
  ListTodo,
  Rocket,
  Link2,
  MonitorSmartphone,
  Eye,
  Bell,
  Shield,
} from 'lucide-react';

const features = [
  {
    icon: Activity,
    title: 'Real-time activity feed',
    description:
      'Watch your agent read files, write code, and run commands — as it happens. Like watching a senior dev pair-program with you.',
  },
  {
    icon: ListTodo,
    title: 'Task-based workflow',
    description:
      'Create tasks, queue them up, and let your agent work through them. Track progress from active to done.',
  },
  {
    icon: Rocket,
    title: 'One-click deploy',
    description:
      'Deploy your own AI agent to Railway or Fly.io with a single click. Runs on your account. Takes 5 minutes.',
  },
  {
    icon: Link2,
    title: 'Bring your own Gateway',
    description:
      'Already running an OpenClaw Gateway? Connect it in seconds. Enter your WebSocket URL and token — done.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Works on every device',
    description:
      'Start a task on your laptop. Check progress on your phone. Full experience on every screen size.',
  },
  {
    icon: Eye,
    title: 'Artifact preview',
    description:
      'See what your agent produced — rendered HTML, syntax-highlighted code, and markdown — right in the dashboard.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description:
      'Get notified when tasks finish. No need to stare at the screen. Come back when the work is done.',
    badge: 'Pro',
  },
  {
    icon: Shield,
    title: 'Your keys. Your infrastructure.',
    description:
      'Clawdify never touches your API keys. They stay on your Gateway — on YOUR server, YOUR account.',
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Features
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to manage AI agents
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            A task-centric dashboard for developers who want to see what their
            AI agent is doing — and stay in control.
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
