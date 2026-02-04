'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useUserStore } from '@/stores/user-store';
import { useGatewayStore } from '@/stores/gateway-store';
import { cn } from '@/lib/utils';

interface UsageBreakdown {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

interface UsageData {
  tokensIn: number;
  tokensOut: number;
  cost: number;
  periodStart: string;
  periodEnd: string;
  breakdown?: UsageBreakdown[];
}

interface UsageDisplayProps {
  className?: string;
}

export function UsageDisplay({ className }: UsageDisplayProps) {
  const plan = useUserStore((s) => s.plan);
  const gatewayMode = useUserStore((s) => s.gatewayMode);
  const setUsage = useUserStore((s) => s.setUsage);
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/usage');
      if (!res.ok) {
        throw new Error('Failed to fetch usage data');
      }
      const usage = (await res.json()) as UsageData;
      setData(usage);
      setUsage({
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        cost: usage.cost,
        periodStart: usage.periodStart,
        periodEnd: usage.periodEnd,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [setUsage]);

  useEffect(() => {
    void fetchUsage();
  }, [fetchUsage]);

  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const isBYOG = plan === 'byog' || plan === 'free' || gatewayMode === 'byog';

  // Usage cap for the visual bar (rough estimate per plan)
  const usageCap = plan === 'free' ? 500_000 : plan === 'pro' ? 5_000_000 : 10_000_000;
  const totalTokens = data ? data.tokensIn + data.tokensOut : 0;
  const usagePercent = Math.min((totalTokens / usageCap) * 100, 100);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-3 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load usage data. {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Usage this period
        </CardTitle>
        <CardDescription>
          {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage bar — hide fake limits for BYOG users */}
        {isBYOG ? (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Usage tracked by your Gateway. Check your Gateway dashboard for detailed metrics.
            </p>
          </div>
        ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {formatTokens(totalTokens)} tokens used
            </span>
            <span className="text-muted-foreground">
              ~{formatTokens(usageCap)} limit
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                usagePercent > 90
                  ? 'bg-red-500'
                  : usagePercent > 70
                    ? 'bg-yellow-500'
                    : 'bg-primary',
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <ArrowDownRight className="h-3 w-3" />
              Input
            </div>
            <p className="mt-1 text-lg font-semibold">
              {formatTokens(data.tokensIn)}
            </p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <ArrowUpRight className="h-3 w-3" />
              Output
            </div>
            <p className="mt-1 text-lg font-semibold">
              {formatTokens(data.tokensOut)}
            </p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              Cost
            </div>
            <p className="mt-1 text-lg font-semibold">
              ${data.cost.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Model breakdown */}
        {data.breakdown && data.breakdown.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">
              By model
            </h4>
            <div className="space-y-1.5">
              {data.breakdown.map((item) => {
                const itemTotal = item.tokensIn + item.tokensOut;
                const itemPercent =
                  totalTokens > 0
                    ? (itemTotal / totalTokens) * 100
                    : 0;
                return (
                  <div key={item.model} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{item.model}</span>
                      <span className="text-muted-foreground">
                        {formatTokens(itemTotal)} · ${item.cost.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all duration-300"
                        style={{ width: `${itemPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
