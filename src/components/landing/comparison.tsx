import { Badge } from '@/components/ui/badge';

const comparisons = [
  {
    versus: 'Terminal',
    icon: '>_',
    tagline: 'Your agent works in the terminal. You work in Mission Control.',
    points: [
      { label: 'Visual task management', clawdify: true, other: false },
      { label: 'Real-time activity feed', clawdify: true, other: 'Scrolling logs' },
      { label: 'Access from any device', clawdify: true, other: 'SSH required' },
      { label: 'Artifact preview', clawdify: true, other: false },
      { label: 'Task history & search', clawdify: true, other: 'Shell history' },
      { label: 'Notifications on completion', clawdify: 'Pro', other: false },
    ],
  },
  {
    versus: 'ChatGPT / Claude',
    icon: '💬',
    tagline: 'Chat is for conversations. Mission Control is for getting work done.',
    points: [
      { label: 'Autonomous task execution', clawdify: true, other: false },
      { label: 'File system access', clawdify: true, other: false },
      { label: 'Runs shell commands', clawdify: true, other: false },
      { label: 'Project-based organization', clawdify: true, other: false },
      { label: 'Works on your codebase', clawdify: true, other: 'Copy-paste' },
      { label: 'Runs on your machine', clawdify: true, other: false },
    ],
  },
  {
    versus: 'Cursor / Windsurf',
    icon: '⌨️',
    tagline: 'IDE agents are limited to code. Mission Control agents do anything.',
    points: [
      { label: 'Works beyond code files', clawdify: true, other: false },
      { label: 'Runs any shell command', clawdify: true, other: 'Limited' },
      { label: 'Browser & API access', clawdify: true, other: false },
      { label: 'Manage from any device', clawdify: true, other: false },
      { label: 'Task queue & history', clawdify: true, other: false },
      { label: 'Bring your own model', clawdify: true, other: 'Limited' },
    ],
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
        ✓
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400">
        ✗
      </span>
    );
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export function Comparison() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Compare
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            How Clawdify fits in
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Clawdify isn&apos;t replacing your tools. It&apos;s the layer on top that
            gives you visibility and control over your AI agent.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {comparisons.map((comp) => (
            <div
              key={comp.versus}
              className="rounded-xl border border-border/50 bg-card/50 p-6 transition-all duration-300 hover:border-violet-500/20"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="text-lg">{comp.icon}</span>
                <div>
                  <div className="text-xs text-muted-foreground">vs</div>
                  <h3 className="font-semibold">{comp.versus}</h3>
                </div>
              </div>
              <p className="mb-5 text-sm font-medium text-violet-400">
                {comp.tagline}
              </p>
              <ul className="space-y-3">
                {comp.points.map((point) => (
                  <li
                    key={point.label}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-muted-foreground">{point.label}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge
                        variant="outline"
                        className="border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-400 px-1.5"
                      >
                        <CellValue value={point.clawdify} />
                      </Badge>
                      <CellValue value={point.other} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Love your current tools? Keep using them. Clawdify is the control
          plane on top — not a replacement.
        </p>
      </div>
    </section>
  );
}
