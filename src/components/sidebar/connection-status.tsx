'use client';

import { useGatewayStore, type ConnectionStatus } from '@/stores/gateway-store';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const statusConfig: Record<
  ConnectionStatus,
  { color: string; label: string; icon: typeof Wifi }
> = {
  connected: { color: 'bg-green-500', label: 'Connected', icon: Wifi },
  connecting: {
    color: 'bg-yellow-500',
    label: 'Connecting...',
    icon: Loader2,
  },
  handshaking: {
    color: 'bg-yellow-500',
    label: 'Handshaking...',
    icon: Loader2,
  },
  disconnected: {
    color: 'bg-gray-400',
    label: 'Disconnected',
    icon: WifiOff,
  },
  error: { color: 'bg-red-500', label: 'Connection Error', icon: WifiOff },
};

export function ConnectionStatus() {
  const status = useGatewayStore((s) => s.status);
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <span
              className={cn('h-2 w-2 rounded-full', config.color)}
            />
            <Icon
              className={cn(
                'h-4 w-4',
                (status === 'connecting' || status === 'handshaking') &&
                  'animate-spin',
              )}
            />
            <span className="truncate">{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Gateway: {config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
