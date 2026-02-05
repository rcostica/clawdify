'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ConnectionStatus } from './connection-status';
import { AgentStatus } from '@/components/activity/agent-status';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Settings, Wifi, Zap, Github } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useGatewayStore } from '@/stores/gateway-store';

export function Sidebar() {
  const isConnected = useGatewayStore((s) => s.status === 'connected');

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="text-xl">🐾</span>
        <h1 className="text-lg font-bold">Clawdify</h1>
      </div>

      <Separator />

      {/* Agent Status */}
      <div className="px-3 py-2">
        <AgentStatus compact />
      </div>

      <Separator />

      {/* Navigation */}
      <div className="flex-1 space-y-1 px-3 py-3">
        <Link href="/dashboard">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
          >
            <Zap className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <Link href="/connect">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
          >
            <Wifi className="h-4 w-4" />
            Connection
          </Button>
        </Link>
        <Link href="/settings">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>

      <Separator />

      {/* Connection Status */}
      <ConnectionStatus />

      <Separator />

      {/* Footer */}
      <div className="flex flex-col gap-1 px-2 py-2">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <a
          href="https://github.com/rcostica/clawdify"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground"
            size="sm"
          >
            <Github className="h-4 w-4" />
            GitHub
          </Button>
        </a>
      </div>
    </aside>
  );
}
