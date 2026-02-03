'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Zap,
  Wifi,
  Download,
  Rocket,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Check,
  SkipForward,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useGatewayStore } from '@/stores/gateway-store';
import { useGatewayConnection } from '@/lib/gateway/hooks';
import { validateGatewayUrl } from '@/lib/gateway/types';
import {
  fetchGatewaySessions,
  importSessions,
  type GatewaySession,
  type ImportProgress,
} from '@/lib/import-sessions';
import { createProject, fetchProjects } from '@/lib/projects';
import { useProjectStore } from '@/stores/project-store';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const ONBOARDING_FLAG = 'clawdify.onboarding_complete';

/** Check if onboarding has been completed */
export function isOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(ONBOARDING_FLAG) === 'true';
}

/** Mark onboarding as complete */
function markOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_FLAG, 'true');
}

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

type Step = 'welcome' | 'connect' | 'import' | 'first-project' | 'done';

export function OnboardingWizard({
  open,
  onComplete,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('welcome');

  const handleComplete = useCallback(() => {
    markOnboardingComplete();
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    markOnboardingComplete();
    onComplete();
    toast.info('You can configure your gateway in Settings anytime.');
  }, [onComplete]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg gap-0 p-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        {/* Progress indicator */}
        <StepIndicator currentStep={step} />

        {/* Steps */}
        <div className="px-6 pb-6">
          {step === 'welcome' && (
            <WelcomeStep
              onNext={() => setStep('connect')}
              onSkip={handleSkip}
            />
          )}
          {step === 'connect' && (
            <ConnectStep
              onNext={() => setStep('import')}
              onBack={() => setStep('welcome')}
              onSkip={handleSkip}
            />
          )}
          {step === 'import' && (
            <ImportStep
              onNext={() => setStep('first-project')}
              onBack={() => setStep('connect')}
              onSkip={() => setStep('first-project')}
            />
          )}
          {step === 'first-project' && (
            <FirstProjectStep
              onNext={() => setStep('done')}
              onSkip={() => setStep('done')}
            />
          )}
          {step === 'done' && <DoneStep onComplete={handleComplete} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Step indicator ──

const STEPS: { key: Step; label: string }[] = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'connect', label: 'Connect' },
  { key: 'import', label: 'Import' },
  { key: 'first-project', label: 'Project' },
  { key: 'done', label: 'Done' },
];

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-1 px-6 pt-6 pb-2">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1 flex-1">
          <div
            className={cn(
              'h-1.5 w-full rounded-full transition-colors duration-300',
              i <= currentIndex ? 'bg-primary' : 'bg-muted',
            )}
          />
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Welcome ──

function WelcomeStep({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-3">
        <div className="text-5xl">🐾</div>
        <h2 className="text-2xl font-bold">Welcome to Clawdify!</h2>
        <p className="text-muted-foreground">
          Your web workspace for OpenClaw. Let&apos;s get you set up in just
          a few steps.
        </p>
      </div>

      <div className="grid gap-3">
        <FeatureCard
          icon={<Wifi className="h-5 w-5 text-blue-500" />}
          title="Connect your Gateway"
          description="Securely link to your OpenClaw Gateway"
        />
        <FeatureCard
          icon={<Download className="h-5 w-5 text-green-500" />}
          title="Import conversations"
          description="Bring in your existing chat sessions"
        />
        <FeatureCard
          icon={<Zap className="h-5 w-5 text-yellow-500" />}
          title="Start chatting"
          description="Create projects and talk to your AI agent"
        />
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          <SkipForward className="mr-2 h-4 w-4" />
          Skip setup
        </Button>
        <Button onClick={onNext} className="gap-2">
          Get started
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ── Step 2: Connect Gateway ──

function ConnectStep({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const config = useGatewayStore((s) => s.config);
  const status = useGatewayStore((s) => s.status);
  const isConnected = status === 'connected';

  const [gatewayUrl, setGatewayUrl] = useState(
    config?.url || process.env.NEXT_PUBLIC_DEFAULT_GATEWAY_URL || '',
  );
  const [gatewayToken, setGatewayToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [insecureAuth, setInsecureAuth] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlInsecure, setUrlInsecure] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const { connect, testConnection } = useGatewayConnection();

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

  const handleTestAndConnect = async () => {
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
        message: `Connected! Server v${hello.server.version}`,
      });

      // Actually connect
      connect({
        url: gatewayUrl,
        token: gatewayToken || undefined,
        insecureAuth,
      });

      // 🔒 SECURITY: Save token encrypted in Supabase
      const supabase = createClient();
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
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Connect your Gateway
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter your OpenClaw Gateway URL and token to connect.
        </p>
      </div>

      {/* Gateway URL */}
      <div className="space-y-2">
        <Label htmlFor="ob-gateway-url">Gateway URL</Label>
        <Input
          id="ob-gateway-url"
          placeholder="ws://localhost:18789"
          value={gatewayUrl}
          onChange={(e) => setGatewayUrl(e.target.value)}
          autoFocus
        />
        {urlError && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <XCircle className="h-3 w-3" />
            {urlError}
          </p>
        )}
        {urlInsecure && !urlError && (
          <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
            <AlertDescription className="text-xs text-yellow-700 dark:text-yellow-300">
              Unencrypted connection. Use wss:// for production.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Token */}
      <div className="space-y-2">
        <Label htmlFor="ob-gateway-token">Gateway Token</Label>
        <div className="relative">
          <Input
            id="ob-gateway-token"
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
          Token is encrypted and stored securely — never in browser storage.
        </p>
      </div>

      {/* Insecure auth */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="ob-insecure" className="text-sm">
            Allow insecure auth
          </Label>
          <p className="text-xs text-muted-foreground">
            Skip device identity. Only for trusted networks.
          </p>
        </div>
        <Switch
          id="ob-insecure"
          checked={insecureAuth}
          onCheckedChange={setInsecureAuth}
        />
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-3 text-sm',
            testResult.ok
              ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300',
          )}
        >
          {testResult.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          {testResult.message}
        </div>
      )}

      {/* Tailscale hint */}
      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">
          💡 Don&apos;t have a Gateway URL?
        </p>
        <p>
          Run{' '}
          <code className="rounded bg-background px-1.5 py-0.5">
            openclaw gateway start
          </code>{' '}
          on your machine, then use{' '}
          <code className="rounded bg-background px-1.5 py-0.5">
            ws://localhost:18789
          </code>
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            variant="ghost"
            onClick={onSkip}
            className="text-muted-foreground"
          >
            Skip
          </Button>
        </div>
        <div className="flex gap-2">
          {!isConnected ? (
            <Button
              onClick={handleTestAndConnect}
              disabled={testing || !gatewayUrl || !!urlError}
              className="gap-2"
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Connect
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={onNext} className="gap-2">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Import ──

function ImportStep({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const isConnected = useGatewayStore((s) => s.status === 'connected');
  const setProjects = useProjectStore((s) => s.setProjects);
  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch sessions
  useEffect(() => {
    if (!isConnected) return;
    let mounted = true;
    setLoading(true);
    setFetchError(null);

    fetchGatewaySessions()
      .then((result) => {
        if (!mounted) return;
        setSessions(result);
        setSelected(new Set(result.map((s) => s.key)));
      })
      .catch((err) => {
        if (!mounted) return;
        setFetchError(err instanceof Error ? err.message : 'Failed to fetch');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isConnected]);

  const toggleSession = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    const toImport = sessions.filter((s) => selected.has(s.key));
    if (toImport.length === 0) {
      onNext();
      return;
    }

    setImporting(true);
    try {
      const result = await importSessions(toImport, setProgress);
      toast.success(
        `Imported ${result.imported} sessions (${result.totalMessages} messages)`,
      );
      // Reload projects
      const projects = await fetchProjects();
      setProjects(projects);
      onNext();
    } catch (err) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setImporting(false);
    }
  }, [sessions, selected, setProjects, onNext]);

  if (!isConnected) {
    return (
      <div className="space-y-4 py-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import conversations
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect to a Gateway first to import existing conversations.
          </p>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onSkip} className="gap-2">
            Skip
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Download className="h-5 w-5" />
          Import conversations
        </h2>
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Finding your existing conversations...'
            : sessions.length > 0
              ? `We found ${sessions.length} conversation${sessions.length !== 1 ? 's' : ''}. Select which to import.`
              : 'No existing conversations found.'}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {fetchError}
        </div>
      )}

      {/* Session list */}
      {!loading && sessions.length > 0 && !importing && (
        <ScrollArea className="max-h-48">
          <div className="space-y-1 pr-3">
            {sessions.map((session) => {
              const name =
                session.label ||
                session.derivedTitle ||
                session.key.split(':').pop() ||
                session.key;
              return (
                <button
                  key={session.key}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                    selected.has(session.key)
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-transparent hover:bg-muted/50',
                  )}
                  onClick={() => toggleSession(session.key)}
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      selected.has(session.key)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30',
                    )}
                  >
                    {selected.has(session.key) && (
                      <Check className="h-2.5 w-2.5" />
                    )}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Progress */}
      {importing && progress && (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Importing {progress.completed + 1} of {progress.total}
            {progress.currentSession ? ` — ${progress.currentSession}` : ''}
          </p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <div className="flex gap-2">
          {!importing && (
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {!importing && (
            <>
              <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
                Skip
              </Button>
              <Button onClick={handleImport} className="gap-2">
                {sessions.length > 0 && selected.size > 0 ? (
                  <>
                    Import {selected.size}
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 4: First Project ──

function FirstProjectStep({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const projects = useProjectStore((s) => s.projects);
  const addProject = useProjectStore((s) => s.addProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const router = useRouter();

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  // If user already has projects (from import), skip to done
  const hasProjects = projects.length > 0;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const project = await createProject({ name: name.trim() });
      addProject(project);
      setActiveProject(project.id);
      router.push(`/project/${project.id}`);
      onNext();
    } catch (err) {
      toast.error('Failed to create project', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          {hasProjects ? 'Ready to go!' : 'Create your first project'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {hasProjects
            ? `You have ${projects.length} project${projects.length !== 1 ? 's' : ''} ready. Create another or get started!`
            : 'Projects are separate chat spaces, each with their own conversation thread.'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ob-project-name">Project name</Label>
        <Input
          id="ob-project-name"
          placeholder="e.g. My coding assistant"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
      </div>

      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
        <p>💡 Project ideas:</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            'Code review helper',
            'Research assistant',
            'Writing partner',
            'DevOps tasks',
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-accent transition-colors"
              onClick={() => setName(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onSkip}
          className="text-muted-foreground"
        >
          {hasProjects ? 'Skip' : 'Skip for now'}
        </Button>
        <Button
          onClick={handleCreate}
          disabled={!name.trim() || creating}
          className="gap-2"
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Create & finish
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Step 5: Done ──

function DoneStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-6 py-4 text-center">
      <div className="space-y-3">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
        <p className="text-muted-foreground">
          Start chatting with your AI agent. You can always adjust settings
          and import more sessions later.
        </p>
      </div>

      <div className="grid gap-2 text-left text-sm">
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <span>Gateway connection configured</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <span>Projects ready to use</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <span>Secure token storage enabled</span>
        </div>
      </div>

      <Button onClick={onComplete} size="lg" className="gap-2 w-full">
        <Zap className="h-4 w-4" />
        Start chatting
      </Button>
    </div>
  );
}
