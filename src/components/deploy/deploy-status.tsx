'use client';

import { useGatewayStore } from '@/stores/gateway-store';
import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, Circle } from 'lucide-react';

export function ConnectionStatus() {
  const status = useGatewayStore((s) => s.status);
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'handshaking';

  // Only show if actively connecting or connected
  if (status === 'disconnected' || status === 'error') return null;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-3',
        isConnected ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-yellow-500/30',
      )}
    >
      <div className="flex items-center gap-2">
        {isConnected ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : isConnecting ? (
          <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="font-medium">
          {isConnected
            ? 'Gateway Connected!'
            : isConnecting
              ? 'Connecting to Gateway...'
              : 'Waiting for connection'}
        </span>
      </div>

      {isConnected && (
        <p className="text-sm text-muted-foreground">
          Your Gateway is connected and ready. Head to a project to create your first task.
        </p>
      )}

      {isConnecting && (
        <div className="space-y-2">
          <ConnectionStep label="Reaching Gateway" done />
          <ConnectionStep label="Authenticating" active />
        </div>
      )}
    </div>
  );
}

function ConnectionStep({
  label,
  done,
  active,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : active ? (
        <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={cn(done ? 'text-muted-foreground' : active ? 'font-medium' : 'text-muted-foreground')}>
        {label}
      </span>
    </div>
  );
}
