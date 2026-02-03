'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGatewayStore } from '@/stores/gateway-store';
import { Activity } from 'lucide-react';

export default function ConnectPage() {
  const status = useGatewayStore((s) => s.status);
  const hello = useGatewayStore((s) => s.hello);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Activity className="h-5 w-5" />
        <h2 className="font-semibold">Connection Health</h2>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              Current gateway connection status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge
                variant={
                  status === 'connected' ? 'default' : 'secondary'
                }
              >
                {status}
              </Badge>
              {hello && (
                <span className="text-sm text-muted-foreground">
                  Server v{hello.server.version} | Protocol v
                  {hello.protocol}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
            <CardDescription>
              Connection diagnostics — Phase 3
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connection diagnostics will be available after the Gateway
              client is implemented (Phase 2).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
