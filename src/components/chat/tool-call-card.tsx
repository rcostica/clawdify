'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Wrench, Loader2 } from 'lucide-react';

interface ToolCallCardProps {
  name: string;
  input?: unknown;
  output?: unknown;
  status?: 'running' | 'complete' | 'error';
}

export function ToolCallCard({
  name,
  input,
  output,
  status = 'complete',
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1 rounded-lg border bg-muted/30">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {status === 'running' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" />
        ) : (
          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="font-medium">{name}</span>
        <span
          className={cn(
            'ml-auto text-xs',
            status === 'running'
              ? 'text-yellow-600'
              : status === 'error'
                ? 'text-red-500'
                : 'text-green-600',
          )}
        >
          {status}
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {input !== undefined && input !== null && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Input
              </p>
              <pre className="overflow-x-auto rounded bg-background p-2 text-xs">
                {typeof input === 'string'
                  ? input
                  : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {output !== undefined && output !== null && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Output
              </p>
              <pre className="overflow-x-auto rounded bg-background p-2 text-xs max-h-40">
                {typeof output === 'string'
                  ? output
                  : JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
