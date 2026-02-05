import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

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
            Stop watching terminal output scroll by
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted-foreground">
            Install OpenClaw. Run Clawdify locally. Watch your agent work from a
            real dashboard — not a wall of logs.
          </p>
          <div className="relative mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/get-started">
              <Button
                size="lg"
                className="h-12 px-8 text-base bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 border-0"
              >
                Get Started
              </Button>
            </Link>
            <a
              href="https://github.com/rcostica/clawdify"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base gap-2"
              >
                <Github className="h-4 w-4" />
                View on GitHub
              </Button>
            </a>
          </div>
          <p className="relative mt-6 text-sm text-muted-foreground">
            Open source · MIT License · Self-hosted
          </p>
        </div>
      </div>
    </section>
  );
}
