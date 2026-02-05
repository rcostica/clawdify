'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway-store';
import { useTaskStore } from '@/stores/task-store';
import { useMemo } from 'react';

interface Agent {
  id: string;
  name: string;
  status: 'working' | 'idle' | 'offline';
  currentTask?: string;
}

export function AgentsCard() {
  const gatewayStatus = useGatewayStore((s) => s.status);
  const tasks = useTaskStore((s) => s.tasks);

  // Find active task for main agent
  const activeTask = useMemo(() => {
    const active = tasks.find((t) => t.status === 'active');
    return active?.title;
  }, [tasks]);

  // Build agents list: main agent from gateway status
  const agents: Agent[] = useMemo(() => {
    const mainStatus = gatewayStatus === 'connected'
      ? (activeTask ? 'working' : 'idle')
      : 'offline';

    return [
      {
        id: 'main',
        name: 'Main Agent',
        status: mainStatus,
        currentTask: activeTask,
      },
      // Future: Add sub-agents from Gateway sessions.list
    ];
  }, [gatewayStatus, activeTask]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Agents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center gap-3 rounded-md px-2 py-1.5"
          >
            <StatusDot status={agent.status} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{agent.name}</p>
              {agent.currentTask ? (
                <p className="text-xs text-muted-foreground truncate">
                  {agent.currentTask}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {agent.status === 'working' ? 'Working...' : 
                   agent.status === 'idle' ? 'Idle' : 'Offline'}
                </p>
              )}
            </div>
          </div>
        ))}
        
        {gatewayStatus !== 'connected' && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Connect to see agents
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: 'working' | 'idle' | 'offline' }) {
  return (
    <div className="relative flex h-5 w-5 items-center justify-center">
      <Circle
        className={cn(
          'h-2.5 w-2.5 fill-current',
          status === 'working' && 'text-green-500',
          status === 'idle' && 'text-yellow-500',
          status === 'offline' && 'text-gray-500'
        )}
      />
      {status === 'working' && (
        <span className="absolute inset-0 animate-ping rounded-full bg-green-500/30" />
      )}
    </div>
  );
}
