'use client';

import { useGatewayStore } from '@/stores/gateway-store';
import { CurrentHeroCard } from '@/components/dashboard/current-hero-card';
import { TasksCard } from '@/components/dashboard/tasks-card';
import { AgentsCard } from '@/components/dashboard/agents-card';
import { FilesCard } from '@/components/dashboard/files-card';
import { MediaCard } from '@/components/dashboard/media-card';
import { CronsCard } from '@/components/dashboard/crons-card';
import { Button } from '@/components/ui/button';
import { Zap, Wifi, Keyboard } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const isConnected = useGatewayStore((s) => s.status === 'connected');

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
            🐾
          </div>
          <div>
            <h2 className="text-2xl font-bold">Agent Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Manage your AI agent
            </p>
          </div>
        </div>

        {/* Quick Actions (when not connected) */}
        {!isConnected && (
          <div className="flex flex-wrap gap-2">
            <Link href="/get-started">
              <Button variant="default" className="gap-2">
                <Zap className="h-4 w-4" />
                Get Started
              </Button>
            </Link>
            <Link href="/connect">
              <Button variant="outline" className="gap-2">
                <Wifi className="h-4 w-4" />
                Connect Gateway
              </Button>
            </Link>
          </div>
        )}

        {/* Hero Card — Current Activity */}
        <CurrentHeroCard />

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TasksCard />
          <AgentsCard />
          <FilesCard />
          <div className="grid grid-cols-2 gap-4">
            <MediaCard />
            <CronsCard />
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Keyboard className="h-3.5 w-3.5" />
            <span>Keyboard shortcuts:</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
              {' '}Command Palette
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
