'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { useGatewayStore } from '@/stores/gateway-store';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus, Wifi, WifiOff, Download, Plus, Keyboard } from 'lucide-react';
import Link from 'next/link';

export default function AppHomePage() {
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.loading);
  const isConnected = useGatewayStore((s) => s.status === 'connected');
  const router = useRouter();

  // Navigate to most recent project if one exists
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!loading && !checked) {
      setChecked(true);
      // Don't auto-redirect — let user see the home page
    }
  }, [loading, checked]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
        🐾
      </div>
      <div>
        <h2 className="text-2xl font-bold">Welcome to Clawdify</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          Your workspace for OpenClaw conversations. Select a project from the
          sidebar or get started below.
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {!isConnected && (
          <Link href="/settings">
            <Button variant="outline" className="gap-2">
              <Wifi className="h-4 w-4" />
              Connect Gateway
            </Button>
          </Link>
        )}
        {isConnected && projects.length === 0 && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              // Trigger new project dialog (handled by sidebar)
              document.querySelector<HTMLButtonElement>('[data-new-project]')?.click();
            }}
          >
            <Plus className="h-4 w-4" />
            Create First Project
          </Button>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="mt-4 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center justify-center gap-2">
          <Keyboard className="h-3.5 w-3.5" />
          <span>Keyboard shortcuts:</span>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
            {' '}Search
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘N</kbd>
            {' '}New Project
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">Esc</kbd>
            {' '}Close
          </span>
        </div>
      </div>
    </div>
  );
}
