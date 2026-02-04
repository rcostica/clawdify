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
          Mission Control for{' '}
          <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            AI Agents
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          You run the agent. We give you the command center. Create tasks, watch
          your agent work in real-time, and review results — all from one
          dashboard.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href="/signup">
            <Button
              size="lg"
              className="h-12 px-8 text-base bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 border-0"
            >
              Get Started Free
            </Button>
          </Link>
          <Link href="#how-it-works">
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base"
            >
              See How It Works
            </Button>
          </Link>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Free tier available · No credit card required · Your API keys stay on
          your machine
        </p>

        {/* Mission Control mockup */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <div className="rounded-xl border border-border/50 bg-card/50 shadow-2xl shadow-violet-500/5 backdrop-blur-sm overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-muted-foreground">
                clawdify.app — Project: landing-page
              </span>
            </div>

            <div className="grid grid-cols-12 min-h-[340px] md:min-h-[420px]">
              {/* Sidebar */}
              <div className="col-span-2 border-r border-border/50 p-3 hidden md:block">
                <div className="space-y-3">
                  {/* Agent status */}
                  <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-2 py-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-[10px] font-medium text-green-400">
                      Agent Online
                    </span>
                  </div>
                  {/* Projects */}
                  <div className="space-y-1.5 pt-2">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Projects
                    </div>
                    <div className="flex items-center gap-2 rounded bg-violet-500/15 px-2 py-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                      <div className="h-2.5 w-16 rounded bg-violet-500/30" />
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                      <div className="h-2.5 w-12 rounded bg-muted/40" />
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                      <div className="h-2.5 w-14 rounded bg-muted/40" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Task list panel */}
              <div className="col-span-4 md:col-span-3 border-r border-border/50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
                  Tasks
                </div>
                {/* Active task */}
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-2.5 mb-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="relative h-2 w-2">
                      <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-50" />
                      <div className="relative h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <span className="text-[10px] font-medium text-green-400">
                      Active
                    </span>
                  </div>
                  <div className="h-3 w-full rounded bg-foreground/10" />
                  <div className="h-2 w-2/3 rounded bg-foreground/5 mt-1" />
                </div>
                {/* Done task */}
                <div className="rounded-lg border border-border/30 bg-muted/20 p-2.5 mb-2 opacity-70">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px]">✅</span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Done
                    </span>
                  </div>
                  <div className="h-3 w-4/5 rounded bg-muted/50" />
                </div>
                {/* Queued task */}
                <div className="rounded-lg border border-border/30 bg-muted/10 p-2.5 mb-3 opacity-50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px]">📋</span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Queued
                    </span>
                  </div>
                  <div className="h-3 w-3/4 rounded bg-muted/40" />
                </div>
                {/* New task button */}
                <div className="rounded-lg border border-dashed border-border/40 px-2.5 py-2 text-center">
                  <span className="text-[10px] text-muted-foreground">
                    + New Task
                  </span>
                </div>
              </div>

              {/* Activity feed + Result */}
              <div className="col-span-8 md:col-span-7 flex flex-col">
                {/* Activity feed */}
                <div className="flex-1 p-3 border-b border-border/50">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
                    Activity
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 shrink-0">
                        14:32
                      </span>
                      <span className="text-[10px]">🔍</span>
                      <div className="h-2.5 w-36 rounded bg-muted/50" />
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 shrink-0">
                        14:33
                      </span>
                      <span className="text-[10px]">📝</span>
                      <div className="h-2.5 w-44 rounded bg-muted/50" />
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 shrink-0">
                        14:34
                      </span>
                      <span className="text-[10px]">⚡</span>
                      <div className="h-2.5 w-32 rounded bg-muted/50" />
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 shrink-0">
                        14:35
                      </span>
                      <span className="text-[10px]">📝</span>
                      <div className="h-2.5 w-40 rounded bg-violet-500/20" />
                    </div>
                    <div className="flex items-start gap-2 opacity-60">
                      <span className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 shrink-0">
                        14:35
                      </span>
                      <span className="text-[10px]">💭</span>
                      <div className="flex gap-1 items-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                        <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:0.2s]" />
                        <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Result panel */}
                <div className="p-3 h-[140px] md:h-[160px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Result
                    </div>
                    <div className="flex gap-1">
                      <div className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] text-violet-400 font-medium">
                        Preview
                      </div>
                      <div className="rounded bg-muted/30 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        Code
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-muted/10 p-2 h-[calc(100%-24px)]">
                    <div className="h-3 w-1/3 rounded bg-muted/40 mb-2" />
                    <div className="h-2 w-full rounded bg-muted/30 mb-1" />
                    <div className="h-2 w-4/5 rounded bg-muted/25 mb-1" />
                    <div className="h-2 w-2/3 rounded bg-muted/20" />
                  </div>
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
