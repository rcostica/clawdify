const features = [
  {
    icon: '🔒',
    title: 'Your conversations never leave your machine',
    description:
      'Your AI, your data. Conversations stay on your gateway — we never see them.',
  },
  {
    icon: '⚡',
    title: 'Start on laptop, finish on phone',
    description:
      'No VPN, no port forwarding, no complex setup. Just open your browser and go.',
  },
  {
    icon: '📁',
    title: 'Stop losing conversations in endless chat history',
    description:
      'Organize conversations by project. Each workspace has its own context and history.',
  },
  {
    icon: '🎨',
    title: 'See your code running before you copy-paste',
    description:
      'Live preview for HTML, code, and markdown artifacts right in the chat.',
  },
  {
    icon: '🔌',
    title: 'Run everything on your own hardware',
    description:
      'Connect your own OpenClaw gateway or use our hosted option. Your choice.',
  },
  {
    icon: '🌙',
    title: 'Built for all-day use — dark by default, keyboard-first',
    description:
      'Dark-first design with keyboard shortcuts for everything. Work comfortably for hours.',
  },
  {
    icon: '📱',
    title: 'Full-power AI from your pocket',
    description:
      'Full experience on every screen size. Chat with AI from your phone, tablet, or desktop.',
  },
  {
    icon: '🆓',
    title: 'Try everything free. Upgrade when you\u2019re ready.',
    description:
      'Get started with Gemini Flash and 3 projects at no cost. No credit card required.',
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
            What makes Clawdify different
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            A premium workspace designed for developers and creators who want
            privacy, speed, and a beautiful experience.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border border-border/50 bg-card/50 p-6 transition-all duration-300 hover:border-violet-500/30 hover:bg-card/80 hover:shadow-lg hover:shadow-violet-500/5"
            >
              <div className="mb-4 text-3xl">{feature.icon}</div>
              <h3 className="font-semibold">{feature.title}</h3>
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
