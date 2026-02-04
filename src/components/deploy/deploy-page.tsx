'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Terminal,
  Copy,
  CheckCircle2,
  ArrowRight,
  Server,
  Wifi,
  Zap,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ConnectionStatus } from './deploy-status';

const INSTALL_COMMAND = 'npm install -g openclaw';
const START_COMMAND = 'openclaw gateway start';
const DOCKER_COMMAND = `docker run -d \\
  --name openclaw-gateway \\
  -e ANTHROPIC_API_KEY=your_key_here \\
  -e CLAWDIFY_RELAY_URL=wss://relay.clawdify.app \\
  -e CLAWDIFY_USER_TOKEN=your_token_here \\
  -p 18789:18789 \\
  ghcr.io/openclaw/gateway:latest`;

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 text-xs shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {label ?? 'Copy'}
    </Button>
  );
}

function CodeBlock({ command, label }: { command: string; label?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <CopyButton text={command} />
        </div>
      )}
      <div className={cn('flex items-center gap-2', !label && 'justify-between')}>
        <pre className="overflow-x-auto rounded bg-background px-3 py-2 text-sm font-mono leading-relaxed border flex-1">
          {command}
        </pre>
        {!label && <CopyButton text={command} />}
      </div>
    </div>
  );
}

export function DeployPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary/10">
          <Zap className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">
          Get Started in 60 Seconds
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Install OpenClaw, start your Gateway, and connect it to Clawdify.
          That&apos;s it.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-6">
        {/* Step 1 */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </div>
            <div>
              <h3 className="font-semibold">Install OpenClaw</h3>
              <p className="text-sm text-muted-foreground">
                One command to install the CLI globally.
              </p>
            </div>
          </div>
          <div className="ml-11">
            <CodeBlock command={`$ ${INSTALL_COMMAND}`} />
          </div>
        </div>

        {/* Step 2 */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              2
            </div>
            <div>
              <h3 className="font-semibold">Start your Gateway</h3>
              <p className="text-sm text-muted-foreground">
                Launch the Gateway on your machine. It runs locally — your keys never leave your device.
              </p>
            </div>
          </div>
          <div className="ml-11">
            <CodeBlock command={`$ ${START_COMMAND}`} />
          </div>
        </div>

        {/* Step 3 */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              3
            </div>
            <div>
              <h3 className="font-semibold">Connect to Clawdify</h3>
              <p className="text-sm text-muted-foreground">
                Paste your connection token (shown in the dashboard) into your Gateway config, or connect directly from the app.
              </p>
            </div>
          </div>
          <div className="ml-11">
            <Link href="/connect">
              <Button className="gap-2">
                <Wifi className="h-4 w-4" />
                Connect Your Gateway
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Connection status */}
      <ConnectionStatus />

      {/* Already running OpenClaw? */}
      <div className="rounded-xl border p-5 space-y-3 border-blue-500/30 hover:border-blue-500/50 transition-all">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-lg dark:bg-blue-950">
            <Wifi className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold">Already running OpenClaw?</h3>
            <p className="text-sm text-muted-foreground">
              Skip the install — just connect your existing Gateway to Clawdify.
            </p>
          </div>
        </div>
        <Link href="/connect">
          <Button variant="outline" className="gap-2">
            <Wifi className="h-4 w-4" />
            Connect Existing Gateway
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* Self-hosting section */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Want always-on? Run on your server</h2>
            <p className="text-sm text-muted-foreground">
              For advanced users who want their Gateway running 24/7 on their own VPS.
            </p>
          </div>
        </div>
        <CodeBlock command={DOCKER_COMMAND} label="Docker" />
        <p className="text-xs text-muted-foreground">
          Replace <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">your_key_here</code> with your Anthropic API key and{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">your_token_here</code> with your Clawdify connection token.
          The Gateway connects to Clawdify automatically via the relay.
        </p>
      </div>

      {/* How it works */}
      <div className="space-y-4 border-t pt-6">
        <h2 className="text-lg font-semibold text-center">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              step: '1',
              icon: <Download className="h-4 w-4" />,
              title: 'Install & Run',
              description: 'Install the OpenClaw CLI and start your Gateway locally. Your API keys stay on your machine.',
            },
            {
              step: '2',
              icon: <Wifi className="h-4 w-4" />,
              title: 'Connect',
              description: 'Your Gateway connects to Clawdify via a secure relay. No port forwarding needed.',
            },
            {
              step: '3',
              icon: <Terminal className="h-4 w-4" />,
              title: 'Build',
              description: 'Create tasks from the dashboard, watch your agent work in real-time, and review results.',
            },
          ].map((item) => (
            <div key={item.step} className="text-center space-y-2">
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {item.step}
              </div>
              <h3 className="font-medium text-sm">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
