'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGatewayStore } from '@/stores/gateway-store';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  handshaking: 'bg-yellow-500',
  disconnected: 'bg-gray-400',
  error: 'bg-red-500',
};

export default function ConnectPage() {
  const status = useGatewayStore((s) => s.status);
  const config = useGatewayStore((s) => s.config);
  const hello = useGatewayStore((s) => s.hello);
  const errorMessage = useGatewayStore((s) => s.errorMessage);

  const isSecureContext =
    typeof window !== 'undefined' && window.isSecureContext;
  const hasWebCrypto =
    typeof crypto !== 'undefined' && !!crypto.subtle;
  const isWss = config?.url?.startsWith('wss://') ?? false;

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Wifi className="h-5 w-5" />
        <h2 className="font-semibold">Connection Status</h2>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${statusColors[status] ?? 'bg-gray-400'}`}
              />
              {status === 'connected' ? 'Connected' : status === 'connecting' || status === 'handshaking' ? 'Connecting...' : status === 'error' ? 'Connection Error' : 'Disconnected'}
            </CardTitle>
            <CardDescription>
              {config?.url
                ? `Gateway: ${config.url}`
                : 'No gateway configured'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === 'error' && errorMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {errorMessage}
              </div>
            )}
            {!config?.url && (
              <Link href="/settings">
                <Button className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configure Gateway
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Connectivity Checks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connectivity Checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CheckItem
              ok={!!config?.url}
              label="Gateway URL configured"
              detail={config?.url ?? 'Not set'}
            />
            <CheckItem
              ok={isSecureContext}
              label="Secure context (HTTPS)"
              detail={
                isSecureContext
                  ? 'Running in secure context'
                  : 'Not in secure context — device identity may not work'
              }
              warn={!isSecureContext}
            />
            <CheckItem
              ok={hasWebCrypto}
              label="WebCrypto available"
              detail={
                hasWebCrypto
                  ? 'Device identity supported'
                  : 'WebCrypto not available — device identity disabled'
              }
              warn={!hasWebCrypto}
            />
            <CheckItem
              ok={isWss || config?.url?.includes('localhost') || config?.url?.includes('127.0.0.1')}
              label="Encrypted connection"
              detail={
                isWss
                  ? 'Using wss:// (encrypted)'
                  : config?.url?.includes('localhost') || config?.url?.includes('127.0.0.1')
                    ? 'Using ws:// on localhost (acceptable)'
                    : 'Using ws:// on remote host — traffic is unencrypted!'
              }
              warn={!isWss && !config?.url?.includes('localhost') && !config?.url?.includes('127.0.0.1')}
            />
            <CheckItem
              ok={status === 'connected'}
              label="Handshake complete"
              detail={
                status === 'connected'
                  ? `Protocol ${hello?.protocol ?? '?'}`
                  : status === 'handshaking'
                    ? 'Handshaking...'
                    : 'Not connected'
              }
              loading={status === 'connecting' || status === 'handshaking'}
            />
          </CardContent>
        </Card>

        {/* Gateway Info (when connected) */}
        {status === 'connected' && hello && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gateway Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow label="Server Version" value={hello.server.version} />
              {hello.server.host && (
                <InfoRow label="Host" value={hello.server.host} />
              )}
              <InfoRow label="Protocol" value={String(hello.protocol)} />
              <InfoRow label="Connection ID" value={hello.server.connId} />
              <InfoRow
                label="Uptime"
                value={formatUptime(hello.snapshot.uptimeMs)}
              />
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Available Methods
                </p>
                <div className="flex flex-wrap gap-1">
                  {hello.features.methods.map((m) => (
                    <Badge key={m} variant="secondary" className="text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Common Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Common Issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <IssueItem
              title="Connection refused"
              detail="Gateway not running or wrong port. Check that OpenClaw is started and the port matches."
            />
            <IssueItem
              title="Device identity required"
              detail="Need HTTPS or enable 'Allow insecure auth' in settings. WebCrypto requires a secure context."
            />
            <IssueItem
              title="Protocol mismatch"
              detail="OpenClaw version too old or too new. Clawdify requires protocol version 3."
            />
            <IssueItem
              title="Token rejected"
              detail="Wrong token or token expired. Re-enter the gateway token in Settings."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CheckItem({
  ok,
  label,
  detail,
  warn,
  loading,
}: {
  ok?: boolean | null;
  label: string;
  detail: string;
  warn?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {loading ? (
        <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-yellow-500" />
      ) : ok ? (
        <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500" />
      ) : warn ? (
        <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-500" />
      ) : (
        <XCircle className="h-4 w-4 mt-0.5 text-gray-400" />
      )}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

function IssueItem({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-xs mt-1">{detail}</p>
    </div>
  );
}

function formatUptime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
