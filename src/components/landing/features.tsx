const features = [
  {
    icon: '🔒',
    title: 'End-to-end privacy',
    description:
      'Your AI, your data. Conversations stay on your gateway — we never see them.',
  },
  {
    icon: '⚡',
    title: 'Works from any device',
    description:
      'No VPN, no Tailscale, no port forwarding. Just open your browser and go.',
  },
  {
    icon: '📁',
    title: 'Project-based workspaces',
    description:
      'Organize conversations by project. Each workspace has its own context and history.',
  },
  {
    icon: '🎨',
    title: 'Artifacts & code preview',
    description:
      'Live preview for HTML, code, and markdown artifacts right in the chat.',
  },
  {
    icon: '🔌',
    title: 'Bring your own Gateway',
    description:
      'Connect your own OpenClaw gateway or use our hosted option. Your choice.',
  },
  {
    icon: '🌙',
    title: 'Dark mode & shortcuts',
    description:
      'Built for developers. Dark-first design with keyboard shortcuts for everything.',
  },
  {
    icon: '📱',
    title: 'Mobile responsive',
    description:
      'Full experience on every screen size. Chat with AI from your phone, tablet, or desktop.',
  },
  {
    icon: '🆓',
    title: 'Free tier included',
    description:
      'Get started with Gemini Flash and 3 projects at no cost. Upgrade when you need more.',
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
            Everything you need to ship with AI
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
