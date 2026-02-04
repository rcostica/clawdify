'use client';

import { useGatewayStore, type ConnectionStatus as StatusType } from '@/stores/gateway-store';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Loader2, Bot } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const statusConfig: Record<
  StatusType,
  { color: string; label: string; icon: typeof Wifi; description: string }
> = {
  connected: {
    color: 'bg-green-500',
    label: 'Connected',
    icon: Wifi,
    description: 'Gateway is connected and ready',
  },
  connecting: {
    color: 'bg-yellow-500',
    label: 'Connecting...',
    icon: Loader2,
    description: 'Establishing connection to Gateway',
  },
  handshaking: {
    color: 'bg-yellow-500',
    label: 'Handshaking...',
    icon: Loader2,
    description: 'Completing authentication handshake',
  },
  disconnected: {
    color: 'bg-gray-400',
    label: 'Disconnected',
    icon: WifiOff,
    description: 'No Gateway connection',
  },
  error: {
    color: 'bg-red-500',
    label: 'Connection Error',
    icon: WifiOff,
    description: 'Failed to connect to Gateway',
  },
};

export function ConnectionStatus() {
  const status = useGatewayStore((s) => s.status);
  const hello = useGatewayStore((s) => s.hello);
  const errorMessage = useGatewayStore((s) => s.errorMessage);
  const config = statusConfig[status];
  const Icon = config.icon;

  const model = hello?.snapshot?.sessionDefaults?.defaultAgentId;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <span
              className={cn('h-2 w-2 rounded-full shrink-0', config.color)}
            />
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                (status === 'connecting' || status === 'handshaking') &&
                  'animate-spin',
              )}
            />
            <div className="min-w-0 flex-1">
              <span className="truncate block text-xs">{config.label}</span>
              {status === 'connected' && model && (
                <span className="truncate block text-[10px] text-muted-foreground/70">
                  {model}
                </span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
          {errorMessage && (
            <p className="text-xs text-red-400 mt-1">{errorMessage}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
