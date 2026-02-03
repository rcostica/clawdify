'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Separator } from '@/components/ui/separator';
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
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGatewayStore } from '@/stores/gateway-store';
import { useGatewayConnection } from '@/lib/gateway/hooks';
import { validateGatewayUrl } from '@/lib/gateway/types';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const config = useGatewayStore((s) => s.config);
  const status = useGatewayStore((s) => s.status);
  const hello = useGatewayStore((s) => s.hello);

  const [gatewayUrl, setGatewayUrl] = useState(
    config?.url || process.env.NEXT_PUBLIC_DEFAULT_GATEWAY_URL || '',
  );
  const [gatewayToken, setGatewayToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [insecureAuth, setInsecureAuth] = useState(
    config?.insecureAuth ?? false,
  );
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlInsecure, setUrlInsecure] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  const { connect, disconnect, testConnection } = useGatewayConnection();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
    });
  }, [supabase]);

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

  const handleSaveAndConnect = async () => {
    if (urlError) {
      toast.error('Fix the URL error before saving');
      return;
    }
    setSaving(true);
    try {
      // 🔒 SECURITY: Save token encrypted in Supabase, never in localStorage
      if (gatewayToken) {
        const { error } = await supabase.rpc('save_gateway_connection', {
          p_name: 'Default',
          p_gateway_url: gatewayUrl,
          p_gateway_token: gatewayToken,
        });
        if (error) {
          toast.error('Failed to save connection', {
            description: error.message,
          });
          setSaving(false);
          return;
        }
      } else {
        // Save URL only (no token update)
        const { error } = await supabase.rpc('save_gateway_connection', {
          p_name: 'Default',
          p_gateway_url: gatewayUrl,
        });
        if (error) {
          toast.error('Failed to save connection', {
            description: error.message,
          });
          setSaving(false);
          return;
        }
      }

      // Connect with current credentials
      connect({
        url: gatewayUrl,
        token: gatewayToken || config?.token || undefined,
        insecureAuth,
      });

      toast.success('Connection saved and connecting...');
    } catch (err) {
      toast.error('Failed to save', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast.info('Disconnected from Gateway');
  };

  const handleSignOut = async () => {
    disconnect();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to sign out', { description: error.message });
      return;
    }
    router.push('/login');
    router.refresh();
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
              Configure your OpenClaw Gateway connection. Tokens are
              encrypted and stored securely in Supabase.
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
                    sent in plaintext. Use wss:// (Tailscale Serve) for
                    secure connections.
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
                Your token is encrypted and stored securely — never in
                browser localStorage.
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
            <div className="flex gap-2">
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
                disabled={saving || !gatewayUrl || !!urlError}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Connect'
                )}
              </Button>
              {status === 'connected' && (
                <Button variant="destructive" onClick={handleDisconnect}>
                  Disconnect
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

        {/* Tailscale Guidance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Connecting via Tailscale (Recommended)
            </CardTitle>
            <CardDescription>
              Tailscale provides secure, encrypted connections without
              port forwarding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>Install Tailscale on both machines</li>
              <li>
                On the Gateway host:{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  openclaw gateway --tailscale serve
                </code>
              </li>
              <li>
                Use{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  wss://&lt;magicdns&gt;
                </code>{' '}
                as the Gateway URL
              </li>
              <li>
                Token-based auth or Tailscale identity auth
              </li>
            </ol>
          </CardContent>
        </Card>

        <Separator />

        {/* Account Section */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Manage your account settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userEmail && (
              <div className="space-y-2">
                <Label>Email</Label>
                <p className="text-sm text-muted-foreground">{userEmail}</p>
              </div>
            )}
            <Button
              variant="destructive"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
