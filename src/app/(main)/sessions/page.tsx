'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, Loader2, Radio, Server, Cpu, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GatewayStatus {
  connected: boolean;
  url: string;
  hasToken: boolean;
  error?: string;
}

export default function SessionsPage() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/gateway/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false, url: '', hasToken: false, error: 'Failed to reach API' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(true), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">Gateway connection & session status</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchStatus(true)}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Gateway Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            Gateway Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {status?.connected ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Disconnected</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
              <Radio className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Endpoint</p>
                <p className="font-mono text-xs">{status?.url || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
              <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Auth Token</p>
                <p className="text-xs">{status?.hasToken ? '✓ Configured' : '✗ Not set'}</p>
              </div>
            </div>
          </div>

          {status?.error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="font-medium">Error</p>
              <p className="text-xs mt-1">{status.error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Session Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-3">
            <p>
              The Gateway manages agent sessions for all your project chats.
              Each project conversation runs as a separate session with its own context.
            </p>
            <div className="bg-muted/50 rounded-md p-4 border border-dashed">
              <p className="font-medium text-foreground mb-1">🚧 Detailed Session Viewer — Coming Soon</p>
              <p className="text-xs">
                Individual session listing with token usage, cost tracking, and conversation history
                will be available in a future update when the Gateway exposes session management APIs.
              </p>
            </div>
            {status?.connected && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs">Gateway is online and accepting requests</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
