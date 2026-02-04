'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Rocket,
  ExternalLink,
  Copy,
  CheckCircle2,
  ArrowRight,
  Server,
  Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DeployStatus } from './deploy-status';

const DEPLOY_PROVIDERS = [
  {
    id: 'railway',
    name: 'Railway',
    icon: '🚂',
    description: 'Deploy to Railway with one click. Auto-restarts, logs, and metrics included.',
    freeInfo: '$5/mo credit on free tier',
    templateUrl: null as string | null,
    comingSoon: true,
    color: 'border-purple-500/30 hover:border-purple-500/50',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
  },
  {
    id: 'flyio',
    name: 'Fly.io',
    icon: '🪁',
    description: 'Deploy to Fly.io globally. Low-latency edge deployment with free tier.',
    freeInfo: 'Free tier: 3 shared VMs',
    templateUrl: null as string | null,
    comingSoon: true,
    color: 'border-indigo-500/30 hover:border-indigo-500/50',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/20',
  },
  {
    id: 'docker',
    name: 'Docker',
    icon: '🐳',
    description: 'Run on your own server with Docker. Full control, zero external dependencies.',
    freeInfo: 'Self-hosted — free forever',
    templateUrl: null as string | null,
    comingSoon: false,
    color: 'border-blue-500/30 hover:border-blue-500/50',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
  },
];

const DOCKER_COMMAND = `docker run -d \\
  --name openclaw-gateway \\
  -e ANTHROPIC_API_KEY=your_key_here \\
  -p 18789:18789 \\
  ghcr.io/openclaw/gateway:latest`;

export function DeployPage() {
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);

  const handleCopyDocker = async () => {
    try {
      await navigator.clipboard.writeText(DOCKER_COMMAND);
      setCopiedDocker(true);
      toast.success('Docker command copied!');
      setTimeout(() => setCopiedDocker(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDeploy = (providerId: string, url: string | null) => {
    if (!url) return;
    setDeploying(providerId);
    // Open deploy URL in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
    // Reset after a moment
    setTimeout(() => setDeploying(null), 3000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary/10">
          <Rocket className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">
          Deploy your AI agent
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Get your own OpenClaw Gateway running in 5 minutes.
          No terminal required.
        </p>
      </div>

      {/* Deploy cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {DEPLOY_PROVIDERS.map((provider) => (
          <div
            key={provider.id}
            className={cn(
              'rounded-xl border p-5 space-y-3 transition-all',
              provider.color,
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{provider.icon}</span>
              <h3 className="font-semibold">{provider.name}</h3>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {provider.description}
            </p>

            <Badge
              variant="secondary"
              className={cn('text-[11px]', provider.bgColor)}
            >
              {provider.freeInfo}
            </Badge>

            <div className="pt-1">
              {provider.comingSoon ? (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled
                >
                  Coming Soon
                </Button>
              ) : provider.id === 'docker' ? (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleCopyDocker}
                >
                  {copiedDocker ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Command
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  className="w-full gap-2"
                  onClick={() => handleDeploy(provider.id, provider.templateUrl)}
                  disabled={deploying === provider.id}
                >
                  {deploying === provider.id ? (
                    <>Launching...</>
                  ) : (
                    <>
                      Deploy Now
                      <ExternalLink className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Docker command block */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Docker command</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleCopyDocker}
          >
            {copiedDocker ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            Copy
          </Button>
        </div>
        <pre className="overflow-x-auto rounded bg-background p-3 text-xs font-mono leading-relaxed border">
          {DOCKER_COMMAND}
        </pre>
      </div>

      {/* Deploy status component */}
      <DeployStatus />

      {/* Already have a Gateway */}
      <div className="text-center border-t pt-6 space-y-2">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Server className="h-4 w-4" />
          <span className="text-sm">Already have a Gateway?</span>
        </div>
        <Link href="/connect">
          <Button variant="outline" className="gap-2">
            <Wifi className="h-4 w-4" />
            Connect Existing Gateway
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* How it works */}
      <div className="space-y-4 border-t pt-6">
        <h2 className="text-lg font-semibold text-center">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              step: '1',
              title: 'Click Deploy',
              description: 'Choose a provider and click deploy. It opens with pre-configured settings.',
            },
            {
              step: '2',
              title: 'Add API Key',
              description: 'Enter your Anthropic or OpenAI API key. The gateway handles the rest.',
            },
            {
              step: '3',
              title: 'Start Building',
              description: 'Your agent connects automatically. Create your first task and watch it work.',
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
