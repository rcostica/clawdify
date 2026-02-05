'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Settings,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGatewayStore } from '@/stores/gateway-store';
import { useGatewayConnection } from '@/lib/gateway/hooks';
import { validateGatewayUrl } from '@/lib/gateway/types';

export default function SettingsPage() {
  const config = useGatewayStore((s) => s.config);
  const status = useGatewayStore((s) => s.status);
  const hello = useGatewayStore((s) => s.hello);
  const clearConfig = useGatewayStore((s) => s.clearConfig);

  const [gatewayUrl, setGatewayUrl] = useState(
    config?.url || process.env.NEXT_PUBLIC_DEFAULT_GATEWAY_URL || '',
  );
  const [gatewayToken, setGatewayToken] = useState(config?.token || '');
  const [showToken, setShowToken] = useState(false);
  const [insecureAuth, setInsecureAuth] = useState(
    config?.insecureAuth ?? false,
  );
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlInsecure, setUrlInsecure] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const { connect, disconnect, testConnection } = useGatewayConnection();

  // Sync form with store when config changes
  useEffect(() => {
    if (config) {
      setGatewayUrl(config.url || '');
      setGatewayToken(config.token || '');
      setInsecureAuth(config.insecureAuth ?? false);
    }
  }, [config]);

  // Validate URL on change
  useEffect(() => {
    if (!gatewayUrl) {
      setUrlError(null);
      setUrlInsecure(false);
      return;
    }
    const result = validateGatewayUrl(gatewayUrl);
    setUrlError(result.valid ? null : (result.error ?? null));
    setUrlInsecure(result.isInsecure ?? false);
  }, [gatewayUrl]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const hello = await testConnection({
        url: gatewayUrl,
        token: gatewayToken || undefined,
        insecureAuth,
      });
      setTestResult({
        ok: true,
        message: `Connected! Server v${hello.server.version}, protocol ${hello.protocol}`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndConnect = () => {
    if (urlError) {
      toast.error('Fix the URL error before saving');
      return;
    }

    // Save to localStorage via Zustand and connect
    connect({
      url: gatewayUrl,
      token: gatewayToken || undefined,
      insecureAuth,
    });

    toast.success('Connection saved!');
  };

  const handleDisconnect = () => {
    disconnect();
    toast.info('Disconnected from Gateway');
  };

  const handleClearConfig = () => {
    disconnect();
    clearConfig();
    setGatewayUrl('');
    setGatewayToken('');
    setInsecureAuth(false);
    setTestResult(null);
    toast.info('Connection cleared');
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Settings className="h-5 w-5" />
        <h2 className="font-semibold">Settings</h2>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
        {/* Connection Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Gateway Connection
            </CardTitle>
            <CardDescription>
              Configure your OpenClaw Gateway connection. Your credentials
              are stored locally in your browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Gateway URL */}
            <div className="space-y-2">
              <Label htmlFor="gateway-url">Gateway URL</Label>
              <Input
                id="gateway-url"
                placeholder="ws://localhost:18789"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
              />
              {urlError && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <XCircle className="h-3 w-3" />
                  {urlError}
                </p>
              )}
              {urlInsecure && !urlError && (
                <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs text-yellow-700 dark:text-yellow-300">
                    ⚠️ Unencrypted connection — your gateway token will be
                    sent in plaintext. Use wss:// for secure connections,
                    or ws:// over Tailscale/VPN.
                  </AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Use ws:// for local or wss:// for secure connections
              </p>
            </div>

            {/* Gateway Token */}
            <div className="space-y-2">
              <Label htmlFor="gateway-token">Gateway Token</Label>
              <div className="relative">
                <Input
                  id="gateway-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your gateway token"
                  value={gatewayToken}
                  onChange={(e) => setGatewayToken(e.target.value)}
                  autoComplete="off"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Find your token:{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                  openclaw status
                </code>
              </p>
            </div>

            {/* Insecure Auth Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="insecure-auth" className="text-sm">
                  Allow insecure auth
                </Label>
                <p className="text-xs text-muted-foreground">
                  Disables device identity verification. Only use on
                  trusted networks.
                </p>
              </div>
              <Switch
                id="insecure-auth"
                checked={insecureAuth}
                onCheckedChange={setInsecureAuth}
              />
            </div>

            {/* Test Result */}
            {testResult && (
              <Alert
                className={
                  testResult.ok
                    ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
                    : 'border-red-500/50 bg-red-50 dark:bg-red-950/20'
                }
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription
                  className={
                    testResult.ok
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }
                >
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing || !gatewayUrl || !!urlError}
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Button
                onClick={handleSaveAndConnect}
                disabled={!gatewayUrl || !!urlError}
              >
                Save & Connect
              </Button>
              {status === 'connected' && (
                <Button variant="outline" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              )}
              {config && (
                <Button
                  variant="ghost"
                  onClick={handleClearConfig}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* Connection Status */}
            {status === 'connected' && hello && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <p>
                  <span className="font-medium">Server:</span>{' '}
                  v{hello.server.version}
                  {hello.server.host ? ` (${hello.server.host})` : ''}
                </p>
                <p>
                  <span className="font-medium">Protocol:</span>{' '}
                  {hello.protocol}
                </p>
                <p>
                  <span className="font-medium">Connection ID:</span>{' '}
                  {hello.server.connId}
                </p>
                <p>
                  <span className="font-medium">Methods:</span>{' '}
                  {hello.features.methods.length} available
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Help */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Connection Options
            </CardTitle>
            <CardDescription>
              Choose how to connect to your AI workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="space-y-3">
              <div>
                <p className="font-medium text-foreground">Local Gateway</p>
                <p className="text-xs mt-1">
                  Run OpenClaw on your machine. Use{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                    ws://localhost:18789
                  </code>{' '}
                  — your keys never leave your device.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Tailscale/VPN</p>
                <p className="text-xs mt-1">
                  Access your home server from anywhere via Tailscale. Use{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                    ws://100.x.x.x:18789
                  </code>{' '}
                  — encrypted at the network layer.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Remote Gateway (wss://)</p>
                <p className="text-xs mt-1">
                  Running OpenClaw on a VPS with a domain? Use{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                    wss://yourdomain.com
                  </code>{' '}
                  for TLS-encrypted connections.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
