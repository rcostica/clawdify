'use client';

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
import { Settings } from 'lucide-react';

export default function SettingsPage() {
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
            <CardTitle>Gateway Connection</CardTitle>
            <CardDescription>
              Configure your OpenClaw Gateway connection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gateway-url">Gateway URL</Label>
              <Input
                id="gateway-url"
                placeholder="ws://localhost:18789"
                defaultValue={
                  process.env.NEXT_PUBLIC_DEFAULT_GATEWAY_URL ?? ''
                }
              />
              <p className="text-xs text-muted-foreground">
                Use ws:// for local or wss:// for secure connections
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gateway-token">Gateway Token</Label>
              <Input
                id="gateway-token"
                type="password"
                placeholder="Enter your gateway token"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Your token is encrypted and stored securely in Supabase
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Test Connection</Button>
              <Button>Save &amp; Connect</Button>
            </div>
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
            <p className="text-sm text-muted-foreground">
              Account management coming soon (Phase 3)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
