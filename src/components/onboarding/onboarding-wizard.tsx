'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  Wifi,
  Download,
  Rocket,
  MessageSquare,
  Clock,
  SkipForward,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGatewayStore } from '@/stores/gateway-store';
import { useGatewayConnection } from '@/lib/gateway/hooks';
import { validateGatewayUrl } from '@/lib/gateway/types';
import { createClient } from '@/lib/supabase/client';
import { createProject, fetchProjects } from '@/lib/projects';
import { useProjectStore } from '@/stores/project-store';
import {
  fetchGatewaySessions,
  importSessions,
  type GatewaySession,
  type ImportProgress,
} from '@/lib/gateway/importer';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'clawdify-onboarding-completed';

/** Check if onboarding should be shown */
export function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ONBOARDING_KEY) !== 'true';
}

/** Mark onboarding as completed */
export function completeOnboarding(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }
}

type Step = 'welcome' | 'connect' | 'import' | 'create' | 'done';

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingWizard({ open, onOpenChange }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('welcome');
  const router = useRouter();

  // Connection state
  const [gatewayUrl, setGatewayUrl] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_GATEWAY_URL || '',
  );
  const [gatewayToken, setGatewayToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [insecureAuth, setInsecureAuth] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlInsecure, setUrlInsecure] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionOk, setConnectionOk] = useState(false);

  // Import state
  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importDone, setImportDone] = useState(false);

  // Create project state
  const [projectName, setProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const { connect, testConnection } = useGatewayConnection();
  const isConnected = useGatewayStore((s) => s.status === 'connected');
  const setProjects = useProjectStore((s) => s.setProjects);
  const addProject = useProjectStore((s) => s.addProject);
  const supabase = createClient();

  // Validate URL
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

  // Load sessions when reaching import step
  useEffect(() => {
    if (step === 'import' && isConnected && sessions.length === 0 && !loadingSessions) {
      loadSessions();
    }
  }, [step, isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const result = await fetchGatewaySessions();
      setSessions(result);
      setSelectedKeys(new Set(result.map((s) => s.key)));
    } catch {
      // Sessions load failure is non-fatal for onboarding
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const handleTestAndConnect = async () => {
    setTesting(true);
    setConnectionOk(false);
    try {
      await testConnection({
        url: gatewayUrl,
        token: gatewayToken || undefined,
        insecureAuth,
      });
      setConnectionOk(true);

      // Save to Supabase
      if (gatewayToken) {
        await supabase.rpc('save_gateway_connection', {
          p_name: 'Default',
          p_gateway_url: gatewayUrl,
          p_gateway_token: gatewayToken,
        });
      } else {
        await supabase.rpc('save_gateway_connection', {
          p_name: 'Default',
          p_gateway_url: gatewayUrl,
        });
      }

      // Connect the main client
      connect({
        url: gatewayUrl,
        token: gatewayToken || undefined,
        insecureAuth,
      });

      toast.success('Connected to Gateway!');
    } catch (err) {
      toast.error('Connection failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleImport = useCallback(async () => {
    const selected = sessions.filter((s) => selectedKeys.has(s.key));
    if (selected.length === 0) return;

    setImporting(true);
    try {
      const result = await importSessions(selected, (p) => setImportProgress(p));
      if (result.imported > 0) {
        const projects = await fetchProjects();
        setProjects(projects);
        toast.success(`Imported ${result.imported} conversation${result.imported > 1 ? 's' : ''}`);
      }
      setImportDone(true);
    } catch (err) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setImporting(false);
    }
  }, [sessions, selectedKeys, setProjects]);

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    setCreating(true);
    try {
      const project = await createProject({ name: projectName.trim() });
      addProject(project);
      router.push(`/project/${project.id}`);
      finishOnboarding();
    } catch (err) {
      toast.error('Failed to create project', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  };

  const finishOnboarding = () => {
    completeOnboarding();
    onOpenChange(false);
  };

  const skipToEnd = () => {
    completeOnboarding();
    onOpenChange(false);
  };

  const toggleSelection = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Step indicators
  const steps: Step[] = ['welcome', 'connect', 'import', 'create', 'done'];
  const currentIndex = steps.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) skipToEnd(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-6 pb-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === currentIndex ? 'w-6 bg-primary' : 'w-1.5',
                i < currentIndex ? 'bg-primary/60' : i > currentIndex ? 'bg-muted' : '',
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 pb-6 min-h-[300px]">
          {/* ── Step 1: Welcome ── */}
          {step === 'welcome' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
                🐾
              </div>
              <h2 className="text-2xl font-bold">Welcome to Clawdify!</h2>
              <p className="max-w-sm text-muted-foreground">
                Your workspace for OpenClaw conversations. Let&apos;s get you connected to your AI Gateway.
              </p>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={skipToEnd} className="gap-2">
                  <SkipForward className="h-4 w-4" />
                  Skip Setup
                </Button>
                <Button onClick={() => setStep('connect')} className="gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Gateway Connection ── */}
          {step === 'connect' && (
            <div className="space-y-4 py-4">
              <div className="text-center mb-4">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950 mb-3">
                  <Wifi className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold">Connect your Gateway</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your OpenClaw Gateway URL and token
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-url">Gateway URL</Label>
                  <Input
                    id="ob-url"
                    placeholder="ws://localhost:18789"
                    value={gatewayUrl}
                    onChange={(e) => setGatewayUrl(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Find this by running <code className="rounded bg-muted px-1 py-0.5 text-[10px]">openclaw status</code> on your Gateway host. Default is <code className="rounded bg-muted px-1 py-0.5 text-[10px]">ws://localhost:18789</code>. For remote access, use <code className="rounded bg-muted px-1 py-0.5 text-[10px]">wss://</code> via Tailscale.
                  </p>
                  {urlError && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <XCircle className="h-3 w-3" /> {urlError}
                    </p>
                  )}
                  {urlInsecure && !urlError && (
                    <p className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                      <AlertTriangle className="h-3 w-3" /> Unencrypted connection — consider wss://
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ob-token">Gateway Token</Label>
                  <div className="relative">
                    <Input
                      id="ob-token"
                      type={showToken ? 'text' : 'password'}
                      placeholder="Your gateway token"
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
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Found in your OpenClaw config file at <code className="rounded bg-muted px-1 py-0.5 text-[10px]">~/.openclaw/openclaw.json</code> → <code className="rounded bg-muted px-1 py-0.5 text-[10px]">gateway.auth.token</code>. You can also run <code className="rounded bg-muted px-1 py-0.5 text-[10px]">openclaw status</code> to see it.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <div>
                    <Label htmlFor="ob-insecure" className="text-xs">Allow insecure auth</Label>
                    <p className="text-[10px] text-muted-foreground">For trusted local networks only</p>
                  </div>
                  <Switch id="ob-insecure" checked={insecureAuth} onCheckedChange={setInsecureAuth} />
                </div>

                {connectionOk && (
                  <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      Connected successfully!
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* No gateway? */}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground font-medium">
                  📖 Don&apos;t have an OpenClaw Gateway yet?
                </summary>
                <div className="mt-2 rounded-lg border bg-muted/30 p-3 space-y-3">
                  <div>
                    <p className="font-medium text-foreground mb-1">1. Install OpenClaw</p>
                    <code className="block rounded bg-background px-2 py-1.5 text-[11px]">
                      npm install -g openclaw
                    </code>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">2. Run the setup wizard</p>
                    <code className="block rounded bg-background px-2 py-1.5 text-[11px]">
                      openclaw onboard
                    </code>
                    <p className="mt-1">This will configure your AI provider (Anthropic, OpenAI, etc.) and generate your gateway token.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">3. Start the Gateway</p>
                    <code className="block rounded bg-background px-2 py-1.5 text-[11px]">
                      openclaw gateway start
                    </code>
                    <p className="mt-1">Default URL: <code className="bg-background px-1 rounded">ws://localhost:18789</code></p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">4. For remote access (recommended)</p>
                    <p>Install <a href="https://tailscale.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Tailscale</a> on both machines, then use:</p>
                    <code className="block rounded bg-background px-2 py-1.5 text-[11px]">
                      openclaw gateway --tailscale serve
                    </code>
                    <p className="mt-1">This gives you a secure <code className="bg-background px-1 rounded">wss://</code> URL accessible from anywhere.</p>
                  </div>
                  <p className="pt-1">
                    <a href="https://docs.openclaw.ai" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Full documentation →
                    </a>
                  </p>
                </div>
              </details>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep('welcome')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={skipToEnd}>Skip</Button>
                  {!connectionOk ? (
                    <Button
                      onClick={handleTestAndConnect}
                      disabled={testing || !gatewayUrl || !!urlError}
                    >
                      {testing ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>
                      ) : (
                        'Test & Connect'
                      )}
                    </Button>
                  ) : (
                    <Button onClick={() => setStep('import')} className="gap-2">
                      Next <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Import ── */}
          {step === 'import' && (
            <div className="space-y-4 py-4">
              <div className="text-center mb-2">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-950 mb-3">
                  <Download className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold">Import Conversations</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {sessions.length > 0
                    ? `Found ${sessions.length} existing conversation${sessions.length > 1 ? 's' : ''}`
                    : 'Looking for existing conversations...'}
                </p>
              </div>

              {loadingSessions && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              )}

              {!loadingSessions && sessions.length > 0 && !importDone && (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{selectedKeys.size} of {sessions.length} selected</span>
                    <div className="flex gap-2">
                      <button className="hover:underline" onClick={() => setSelectedKeys(new Set(sessions.map((s) => s.key)))}>All</button>
                      <button className="hover:underline" onClick={() => setSelectedKeys(new Set())}>None</button>
                    </div>
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-1">
                      {sessions.map((session) => (
                        <button
                          key={session.key}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                            selectedKeys.has(session.key)
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-transparent hover:bg-muted/50',
                          )}
                          onClick={() => toggleSelection(session.key)}
                          disabled={importing}
                        >
                          <div className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                            selectedKeys.has(session.key)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30',
                          )}>
                            {selectedKeys.has(session.key) && (
                              <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="truncate text-xs font-medium block">
                              {session.label || session.key.split(':').pop() || session.key}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              {session.messageCount !== undefined && (
                                <span className="flex items-center gap-0.5">
                                  <MessageSquare className="h-2.5 w-2.5" /> {session.messageCount}
                                </span>
                              )}
                              {session.lastActivity && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" /> {formatTimeAgo(session.lastActivity)}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}

              {importing && importProgress && (
                <div className="space-y-2 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing {importProgress.completed + 1} of {importProgress.total}...
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${importProgress.total > 0 ? ((importProgress.completed / importProgress.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {importDone && (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Import complete!
                </div>
              )}

              {!loadingSessions && sessions.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No existing conversations found. That&apos;s okay — let&apos;s create your first project!
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep('connect')} className="gap-2" disabled={importing}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                  {!importDone && sessions.length > 0 && (
                    <Button variant="outline" onClick={() => setStep('create')} disabled={importing}>
                      Skip
                    </Button>
                  )}
                  {!importDone && sessions.length > 0 ? (
                    <Button onClick={handleImport} disabled={importing || selectedKeys.size === 0}>
                      {importing ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
                      ) : (
                        <>Import {selectedKeys.size}</>
                      )}
                    </Button>
                  ) : (
                    <Button onClick={() => setStep(importDone ? 'done' : 'create')} className="gap-2">
                      {importDone ? 'Finish' : 'Next'} <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Create first project ── */}
          {step === 'create' && (
            <div className="space-y-4 py-4">
              <div className="text-center mb-4">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-green-100 dark:bg-green-950 mb-3">
                  <Sparkles className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">Create your first project</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Projects are separate chat spaces with their own context.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-project">Project name</Label>
                <Input
                  id="ob-project"
                  placeholder="My first project"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  maxLength={100}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && projectName.trim()) {
                      e.preventDefault();
                      handleCreateProject();
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep('import')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('done')}>Skip</Button>
                  <Button
                    onClick={handleCreateProject}
                    disabled={creating || !projectName.trim()}
                  >
                    {creating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                    ) : (
                      'Create & Go'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-950 text-3xl">
                <Rocket className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
              <p className="max-w-sm text-muted-foreground">
                Start chatting with your AI agent. Create projects to organize different conversations.
              </p>
              <Button onClick={finishOnboarding} size="lg" className="mt-2 gap-2">
                Let&apos;s Go! <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
