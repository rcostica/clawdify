import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function CtaSection() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent p-12 text-center md:p-20">
          {/* Background decoration */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-indigo-500/10 blur-3xl" />

          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to build something amazing?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted-foreground">
            Join developers who are already using Clawdify to ship faster with
            AI. Free to start, no credit card required.
          </p>
          <div className="relative mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/signup">
              <Button
                size="lg"
                className="h-12 px-8 text-base bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 border-0"
              >
                Get Started Free
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
