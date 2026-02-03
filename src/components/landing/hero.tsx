import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-44 md:pb-32">
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-gradient-to-b from-violet-500/20 via-indigo-500/10 to-transparent blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute left-0 top-1/2 h-[300px] w-[300px] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 text-center">
        <div className="mb-8 inline-flex">
          <Badge
            variant="outline"
            className="gap-2 rounded-full border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-400"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            Now in open beta
          </Badge>
        </div>

        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Your AI workspace,{' '}
          <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            beautifully crafted
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Clawdify gives you a premium AI workspace that works from any device.
          Private, fast, and built for people who ship.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href="/signup">
            <Button
              size="lg"
              className="h-12 px-8 text-base bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 border-0"
            >
              Start Building — It&apos;s Free
            </Button>
          </Link>
          <Link href="#features">
            <Button variant="outline" size="lg" className="h-12 px-8 text-base">
              See How It Works
            </Button>
          </Link>
        </div>

        {/* Product mockup area */}
        <div className="relative mx-auto mt-20 max-w-4xl">
          <div className="rounded-xl border border-border/50 bg-card/50 shadow-2xl shadow-violet-500/5 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-muted-foreground">
                clawdify.app — Project: landing-page
              </span>
            </div>
            <div className="grid grid-cols-12 min-h-[300px] md:min-h-[400px]">
              {/* Fake sidebar */}
              <div className="col-span-3 border-r border-border/50 p-4 hidden sm:block">
                <div className="space-y-3">
                  <div className="h-4 w-20 rounded bg-muted/50" />
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-violet-500/60" />
                      <div className="h-3 w-24 rounded bg-violet-500/20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      <div className="h-3 w-20 rounded bg-muted/50" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      <div className="h-3 w-16 rounded bg-muted/50" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Fake chat area */}
              <div className="col-span-12 sm:col-span-9 p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-violet-500/20" />
                    <div className="space-y-2">
                      <div className="h-3 w-64 rounded bg-muted/60" />
                      <div className="h-3 w-48 rounded bg-muted/40" />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="space-y-2 text-right">
                      <div className="h-3 w-40 rounded bg-violet-500/20 ml-auto" />
                    </div>
                    <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-500/20" />
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-violet-500/20" />
                    <div className="space-y-2">
                      <div className="h-3 w-72 rounded bg-muted/60" />
                      <div className="h-3 w-56 rounded bg-muted/40" />
                      <div className="h-3 w-32 rounded bg-muted/40" />
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <div className="h-10 flex-1 rounded-lg border border-border/50 bg-muted/30" />
                  <div className="h-10 w-10 rounded-lg bg-violet-500/20" />
                </div>
              </div>
            </div>
          </div>
          {/* Subtle glow under mockup */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 h-16 w-3/4 rounded-full bg-violet-500/10 blur-2xl" />
        </div>
      </div>
    </section>
  );
}
