'use client';

import { useEffect, useState, useRef } from 'react';

const activityLines = [
  { time: '14:32:01', icon: '💭', text: 'Planning approach for landing page...' },
  { time: '14:32:04', icon: '🔍', text: 'Reading file: package.json' },
  { time: '14:32:06', icon: '⚡', text: 'Running: npm install tailwindcss' },
  { time: '14:32:12', icon: '📝', text: 'Creating: src/app/page.tsx' },
  { time: '14:32:18', icon: '📝', text: 'Creating: src/components/hero.tsx' },
  { time: '14:32:24', icon: '📝', text: 'Creating: src/components/features.tsx' },
  { time: '14:32:30', icon: '⚡', text: 'Running: npm run build' },
  { time: '14:32:38', icon: '✅', text: 'Build successful. Landing page ready.' },
];

export function DemoPreview() {
  const [visibleLines, setVisibleLines] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const el = document.getElementById('demo-preview-section');
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          // Clear any existing interval before starting a new one
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setVisibleLines(0);
          let i = 0;
          intervalRef.current = setInterval(() => {
            i++;
            setVisibleLines(i);
            if (i >= activityLines.length) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            }
          }, 600);
        } else {
          // Clean up when element leaves viewport
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return (
    <section id="demo-preview-section" className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            See it in action
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Watch an agent build a landing page
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            You type &quot;Build a landing page for my portfolio.&quot; Your agent does
            the rest.
          </p>
        </div>

        {/* Terminal-style activity preview */}
        <div className="rounded-xl border border-border/50 bg-card/50 shadow-2xl shadow-violet-500/5 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-500/60" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <div className="h-3 w-3 rounded-full bg-green-500/60" />
            <span className="ml-3 text-xs text-muted-foreground font-mono">
              Activity Feed — Task: &quot;Build a landing page&quot;
            </span>
          </div>
          <div className="p-4 md:p-6 font-mono text-sm min-h-[280px]">
            {activityLines.map((line, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 py-1 transition-all duration-300 ${
                  i < visibleLines
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-2'
                }`}
              >
                <span className="text-xs text-muted-foreground/50 mt-0.5 shrink-0 w-16">
                  {line.time}
                </span>
                <span className="shrink-0">{line.icon}</span>
                <span
                  className={
                    i === activityLines.length - 1 && i < visibleLines
                      ? 'text-green-400'
                      : 'text-muted-foreground'
                  }
                >
                  {line.text}
                </span>
              </div>
            ))}
            {visibleLines < activityLines.length && visibleLines > 0 && (
              <div className="flex items-center gap-3 py-1 pl-[76px]">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:0.4s]" />
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
