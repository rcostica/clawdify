'use client';

import { useState } from 'react';
import { useGatewayStore } from '@/stores/gateway-store';
import { cn } from '@/lib/utils';
import { Bot, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AgentStatusProps {
  compact?: boolean;
}

export function AgentStatus({ compact = false }: AgentStatusProps) {
  const status = useGatewayStore((s) => s.status);
  const hello = useGatewayStore((s) => s.hello);
  const [expanded, setExpanded] = useState(false);

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'handshaking';

  const serverVersion = hello?.server?.version;
  const serverHost = hello?.server?.host;
  const uptimeMs = hello?.snapshot?.uptimeMs;
  const model = hello?.snapshot?.sessionDefaults?.defaultAgentId;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  isConnected
                    ? 'bg-green-500'
                    : isConnecting
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-gray-400',
                )}
              />
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Agent: {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </p>
            {model && <p className="text-xs text-muted-foreground">Model: {model}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent/50"
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full shrink-0',
            isConnected
              ? 'bg-green-500'
              : isConnecting
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-gray-400',
          )}
        />
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isConnected ? (
            <Wifi className="h-3.5 w-3.5 text-green-500 shrink-0" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">
            {isConnected ? 'Agent Connected' : isConnecting ? 'Connecting...' : 'Agent Disconnected'}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && isConnected && (
        <div className="border-t px-3 py-2 space-y-1">
          {model && (
            <InfoRow label="Model" value={model} />
          )}
          {serverVersion && (
            <InfoRow label="Version" value={serverVersion} />
          )}
          {serverHost && (
            <InfoRow label="Host" value={serverHost} />
          )}
          {uptimeMs !== undefined && (
            <InfoRow label="Uptime" value={formatUptime(uptimeMs)} />
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono truncate ml-2 max-w-[160px]">{value}</span>
    </div>
  );
}

function formatUptime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
