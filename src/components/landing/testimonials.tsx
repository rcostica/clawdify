const testimonials = [
  {
    quote:
      "Clawdify replaced 3 different tools for me. The workspace concept with private gateway is exactly what I needed.",
    author: 'Alex Chen',
    role: 'Senior Developer',
    company: 'Startup',
    avatar: 'AC',
  },
  {
    quote:
      "Finally an AI workspace that doesn't require a VPN to access my home server. Works perfectly from my phone too.",
    author: 'Sarah Kim',
    role: 'Indie Hacker',
    company: 'Solo',
    avatar: 'SK',
  },
  {
    quote:
      "The artifacts panel is a game changer. Live code preview while chatting with Claude? Yes please.",
    author: 'Marcus Rivera',
    role: 'Full-Stack Dev',
    company: 'Agency',
    avatar: 'MR',
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Testimonials
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Loved by developers
          </h2>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="relative rounded-xl border border-border/50 bg-card/50 p-6 transition-all duration-300 hover:border-violet-500/20 hover:bg-card/80"
            >
              {/* Quote icon */}
              <svg
                className="mb-4 h-8 w-8 text-violet-500/20"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11H10v10H0z" />
              </svg>

              <p className="text-sm leading-relaxed text-muted-foreground">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-bold text-white">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {testimonial.author}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {testimonial.role} @ {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
