'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Wifi, WifiOff, Cpu, HardDrive, MemoryStick,
  Clock, RefreshCw, Radio, BrainCircuit, Hash
} from 'lucide-react';

interface HealthData {
  gateway: { connected: boolean; version: string };
  system: { cpu: { load1: string; load5: string; load15: string }; uptime: string };
  resources: {
    disk: { used: string; available: string; total: string; percent: number };
    ram: { total: string; available: string; used: string; percent: number };
  };
  openclaw: { configExists: boolean; sessionCount: number };
  model: { name: string; fallbacks: string[] };
  channels: string[];
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function getResourceColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-green-500';
}

function getResourceTextColor(percent: number): string {
  if (percent >= 90) return 'text-red-500';
  if (percent >= 70) return 'text-amber-500';
  return 'text-green-500';
}

const channelColors: Record<string, string> = {
  telegram: 'bg-blue-500/15 text-blue-500',
  discord: 'bg-indigo-500/15 text-indigo-500',
  whatsapp: 'bg-green-500/15 text-green-600',
  signal: 'bg-sky-500/15 text-sky-600',
  webchat: 'bg-purple-500/15 text-purple-500',
  slack: 'bg-amber-500/15 text-amber-600',
  matrix: 'bg-teal-500/15 text-teal-500',
  irc: 'bg-gray-500/15 text-gray-500',
  'device-pair': 'bg-orange-500/15 text-orange-500',
};

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), 60000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const Skeleton = () => (
    <div className="h-6 w-24 bg-muted rounded animate-pulse" />
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System Health</h1>
          <p className="text-sm text-muted-foreground">Server resources and OpenClaw status</p>
        </div>
        {lastRefresh && (
          <span className="text-xs text-muted-foreground">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-3 px-5">
            <p className="text-sm text-red-500">Failed to load health data: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Top row: Gateway + System + Resources */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Gateway */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {data?.gateway.connected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              Gateway
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton /> : (
              <>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${data?.gateway.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={`text-lg font-semibold ${data?.gateway.connected ? 'text-green-500' : 'text-red-500'}`}>
                    {data?.gateway.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {data?.gateway.version && data.gateway.version !== '?' && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    v{data.gateway.version.replace(/^v/, '')}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* System */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              System
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton /> : (
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">CPU Load (1m / 5m / 15m)</p>
                  <p className="text-lg font-semibold font-mono">
                    {data?.system.cpu.load1} / {data?.system.cpu.load5} / {data?.system.cpu.load15}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Uptime: {data?.system.uptime}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton /> : (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <HardDrive className="h-3 w-3" /> Disk
                    </span>
                    <span className={`text-xs font-medium ${getResourceTextColor(data?.resources.disk.percent || 0)}`}>
                      {data?.resources.disk.used} / {data?.resources.disk.total} ({data?.resources.disk.percent}%)
                    </span>
                  </div>
                  <ProgressBar
                    percent={data?.resources.disk.percent || 0}
                    color={getResourceColor(data?.resources.disk.percent || 0)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MemoryStick className="h-3 w-3" /> RAM
                    </span>
                    <span className={`text-xs font-medium ${getResourceTextColor(data?.resources.ram.percent || 0)}`}>
                      {data?.resources.ram.used} / {data?.resources.ram.total} ({data?.resources.ram.percent}%)
                    </span>
                  </div>
                  <ProgressBar
                    percent={data?.resources.ram.percent || 0}
                    color={getResourceColor(data?.resources.ram.percent || 0)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle row: Model Config + Channels */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Model Config */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BrainCircuit className="h-4 w-4" />
              Model Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton /> : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Primary Model</p>
                  <p className="text-sm font-semibold font-mono">{data?.model.name || '?'}</p>
                </div>
                {data?.model.fallbacks && data.model.fallbacks.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fallbacks</p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.model.fallbacks.map((fb, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-muted"
                        >
                          {fb}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground pt-1 border-t">
                  <Hash className="h-3.5 w-3.5" />
                  <span>{data?.openclaw.sessionCount ?? 0} sessions</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channels */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Connected Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton /> : (
              data?.channels && data.channels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {data.channels.map((ch) => (
                    <span
                      key={ch}
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium capitalize ${channelColors[ch] || 'bg-muted text-muted-foreground'}`}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No channels configured</p>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Refresh */}
      <div className="flex items-center justify-center pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchHealth(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}
