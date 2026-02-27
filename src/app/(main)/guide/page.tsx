'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Terminal, Server, FolderSearch, Shield, Wifi, 
  MessageSquare, ChevronRight, ExternalLink, BookOpen
} from 'lucide-react';
import { useInstanceName } from '@/components/instance-name';

export default function GuidePage() {
  const { instanceName } = useInstanceName();

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Getting Started with {instanceName}</h1>
        <p className="text-muted-foreground mt-1">
          Step-by-step setup guide for new and existing OpenClaw installations.
        </p>
      </div>

      {/* Prerequisites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Prerequisites
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-0.5 shrink-0">Required</Badge>
            <div>
              <p className="font-medium">OpenClaw</p>
              <p className="text-muted-foreground">
                A running OpenClaw instance on the same machine.{' '}
                <a href="https://docs.openclaw.ai/install" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                  Install guide <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-0.5 shrink-0">Required</Badge>
            <div>
              <p className="font-medium">Node.js 18+</p>
              <p className="text-muted-foreground">
                For building and running Clawdify. Check with <code className="bg-muted px-1 rounded text-xs">node --version</code>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="secondary" className="mt-0.5 shrink-0">Recommended</Badge>
            <div>
              <p className="font-medium">Tailscale</p>
              <p className="text-muted-foreground">
                For secure remote access from your phone or other devices. Clawdify runs on your local network by default — Tailscale extends that securely without exposing ports to the internet.{' '}
                <a href="https://tailscale.com/download" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                  Get Tailscale <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Path A: Fresh Install */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Badge className="bg-green-600">Path A</Badge>
          Fresh OpenClaw — No Existing Projects
        </h2>
        <p className="text-sm text-muted-foreground">
          You just installed OpenClaw and want to use Clawdify as your project workspace from the start.
        </p>

        <div className="space-y-3">
          <StepCard number={1} title="Install & run setup">
            <CodeBlock>{`git clone https://github.com/rcostica/clawdify.git ~/clawdify
cd ~/clawdify
npm install
npm run setup`}</CodeBlock>
            <p className="text-muted-foreground mt-2">
              The setup wizard auto-detects your gateway token, workspace path, and enables the 
              required <code className="bg-muted px-1 rounded text-xs">chatCompletions</code> endpoint.
              You&apos;ll only need to set a PIN and port.
            </p>
          </StepCard>

          <StepCard number={2} title="Restart the gateway">
            <CodeBlock>openclaw gateway restart</CodeBlock>
            <p className="text-muted-foreground mt-2">
              This applies the config change that enables Clawdify to chat with your AI agent.
            </p>
          </StepCard>

          <StepCard number={3} title="Build and start">
            <CodeBlock>{`npm run build
npm start`}</CodeBlock>
            <p className="text-muted-foreground mt-2">
              Open <code className="bg-muted px-1 rounded text-xs">http://localhost:3000</code> (or your Tailscale URL) in your browser.
            </p>
          </StepCard>

          <StepCard number={4} title="Start using it">
            <p className="text-muted-foreground">
              A <strong>General</strong> project is created automatically. Click it in the sidebar to start chatting. 
              Create more projects with the <strong>+</strong> button in the sidebar.
            </p>
          </StepCard>
        </div>
      </div>

      {/* Path B: Existing Instance */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Badge className="bg-blue-600">Path B</Badge>
          Existing OpenClaw — Already Has Projects & Files
        </h2>
        <p className="text-sm text-muted-foreground">
          Your OpenClaw agent has been running via Telegram, Slack, or CLI. There are existing workspace 
          files, project folders, and conversation history.
        </p>

        <div className="space-y-3">
          <StepCard number={1} title="Install & run setup">
            <CodeBlock>{`git clone https://github.com/rcostica/clawdify.git ~/clawdify
cd ~/clawdify
npm install
npm run setup`}</CodeBlock>
            <p className="text-muted-foreground mt-2">
              Same as Path A. The wizard detects your existing workspace and configures everything.
            </p>
          </StepCard>

          <StepCard number={2} title="Restart gateway & start Clawdify">
            <CodeBlock>{`openclaw gateway restart
cd ~/clawdify && npm run build && npm start`}</CodeBlock>
          </StepCard>

          <StepCard number={3} title="Discover existing projects" highlight>
            <p className="text-muted-foreground">
              Go to{' '}
              <Link href="/settings" className="text-primary hover:underline font-medium">
                Settings → Discover Projects
              </Link>{' '}
              and click <strong>Scan Workspace</strong>.
            </p>
            <p className="text-muted-foreground mt-2">
              Clawdify will find all folders in your OpenClaw workspace and show them with checkboxes. 
              Select which ones should become Clawdify projects.
            </p>
            <div className="mt-3 bg-muted/50 border rounded-md p-3 space-y-2 text-xs text-muted-foreground">
              <p><strong>💡 Organizing as sub-projects:</strong> If your agent created folders like 
                <code className="bg-muted px-1 rounded">project1/seo/</code>, <code className="bg-muted px-1 rounded">project1/content/</code>, 
                and <code className="bg-muted px-1 rounded">project1/ads/</code>, you can <strong>drag</strong> the child 
                folders onto the parent to set up the hierarchy before importing.</p>
              <p><strong>📎 External sub-projects:</strong> If sub-projects live in separate workspace folders 
                (not nested inside the parent), the parent&apos;s file browser will show them as linked virtual directories.</p>
            </div>
          </StepCard>

          <StepCard number={4} title="Name your instance (optional)">
            <p className="text-muted-foreground">
              In{' '}
              <Link href="/settings" className="text-primary hover:underline font-medium">
                Settings → Instance
              </Link>
              , give this Clawdify a custom name (e.g. &quot;Home Server&quot;, &quot;Work Agent&quot;). 
              This name appears in the browser tab and when you install the PWA on mobile — 
              useful if you run multiple Clawdify instances.
            </p>
          </StepCard>
        </div>
      </div>

      {/* Remote Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Remote Access with Tailscale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Clawdify binds to <code className="bg-muted px-1 rounded text-xs">localhost:3000</code> by default. 
            To access it from your phone or another computer:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Install <a href="https://tailscale.com/download" target="_blank" rel="noopener" className="text-primary hover:underline">Tailscale</a> on the server and your device</li>
            <li>Both devices join the same Tailscale network</li>
            <li>Access Clawdify at <code className="bg-muted px-1 rounded text-xs">http://your-server:3000</code> from any device on your Tailnet</li>
            <li>For HTTPS, enable <a href="https://tailscale.com/kb/1153/enabling-https" target="_blank" rel="noopener" className="text-primary hover:underline">Tailscale HTTPS</a></li>
          </ol>
          <p className="text-muted-foreground mt-2">
            <strong>Why Tailscale?</strong> It creates a private, encrypted network between your devices. 
            No ports open to the internet, no VPN configuration, no certificates to manage. 
            Your Clawdify instance stays invisible to the public internet.
          </p>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Troubleshooting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <TroubleshootItem
            problem="Chat returns 405 Method Not Allowed"
            solution={
              <>
                The gateway&apos;s <code className="bg-muted px-1 rounded text-xs">chatCompletions</code> endpoint is disabled. 
                Run <code className="bg-muted px-1 rounded text-xs">npm run setup</code> again (it auto-enables it), 
                then <code className="bg-muted px-1 rounded text-xs">openclaw gateway restart</code>.
                Check <Link href="/settings" className="text-primary hover:underline">Settings</Link> for the endpoint status.
              </>
            }
          />
          <TroubleshootItem
            problem="API errors (500) on first load"
            solution="Database tables auto-create on first startup. Try restarting Clawdify. If it persists, delete ~/.clawdify/clawdify.db and restart — it will be recreated."
          />
          <TroubleshootItem
            problem="Gateway shows 'Connected' but chat doesn't work"
            solution={
              <>
                Test the gateway directly: <code className="bg-muted px-1 rounded text-xs">curl -X POST http://localhost:18789/v1/chat/completions -H &quot;Authorization: Bearer YOUR_TOKEN&quot; -H &quot;Content-Type: application/json&quot; -d &apos;{`{"model":"openclaw:main","messages":[{"role":"user","content":"hi"}]}`}&apos;</code>
              </>
            }
          />
          <TroubleshootItem
            problem="Can't access from phone"
            solution="Make sure both devices are on the same network (or Tailscale). Check that the PIN is correct. Clear browser cache if you recently updated."
          />
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Resources
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <a href="https://github.com/rcostica/clawdify" target="_blank" rel="noopener" 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-muted/50">
              <ExternalLink className="h-4 w-4" /> Clawdify GitHub
            </a>
            <a href="https://docs.openclaw.ai" target="_blank" rel="noopener"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-muted/50">
              <ExternalLink className="h-4 w-4" /> OpenClaw Docs
            </a>
            <a href="https://discord.com/invite/clawd" target="_blank" rel="noopener"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-muted/50">
              <ExternalLink className="h-4 w-4" /> OpenClaw Discord
            </a>
            <a href="https://tailscale.com/download" target="_blank" rel="noopener"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-muted/50">
              <ExternalLink className="h-4 w-4" /> Tailscale Download
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepCard({ number, title, children, highlight }: { 
  number: number; title: string; children: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={`flex gap-4 p-4 rounded-lg border ${highlight ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <h3 className="font-medium text-sm">{title}</h3>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

function TroubleshootItem({ problem, solution }: { problem: string; solution: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-destructive">{problem}</p>
      <p className="text-muted-foreground">{solution}</p>
    </div>
  );
}
