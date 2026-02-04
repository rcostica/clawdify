import { Badge } from '@/components/ui/badge';

const features = [
  {
    label: 'Visual task management',
    clawdify: true,
    terminal: false,
  },
  {
    label: 'Real-time activity feed',
    clawdify: true,
    terminal: 'Scrolling logs',
  },
  {
    label: 'Multi-device access',
    clawdify: true,
    terminal: 'SSH required',
  },
  {
    label: 'Artifact preview (HTML, code)',
    clawdify: true,
    terminal: false,
  },
  {
    label: 'One-click deploy',
    clawdify: true,
    terminal: false,
  },
  {
    label: 'Push notifications',
    clawdify: 'Pro',
    terminal: false,
  },
  {
    label: 'Scheduled tasks',
    clawdify: 'Pro',
    terminal: 'Cron + scripting',
  },
  {
    label: 'Cost',
    clawdify: 'Free / $12/mo',
    terminal: 'Free (your server)',
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
  return <span className="text-sm">{value}</span>;
}

export function Comparison() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Compare
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Why Clawdify vs. the terminal?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            The terminal is powerful. Clawdify gives you what it can&apos;t: visibility,
            organization, and access from anywhere.
          </p>
        </div>

        <div className="mt-16 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  Capability
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg">🐾</span>
                    <span className="font-semibold">Clawdify</span>
                    <Badge className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-0 text-[10px]">
                      Mission Control
                    </Badge>
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg font-mono">&gt;_</span>
                    <span className="font-semibold text-muted-foreground">
                      Terminal
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-border/30 transition-colors hover:bg-muted/30"
                >
                  <td className="py-3.5 pr-4 font-medium">{row.label}</td>
                  <td className="px-4 py-3.5 text-center">
                    <CellValue value={row.clawdify} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <CellValue value={row.terminal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Love the terminal? So do we. Clawdify doesn&apos;t replace it — it gives you a
          control plane on top.
        </p>
      </div>
    </section>
  );
}
