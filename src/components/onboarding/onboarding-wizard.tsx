'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
  Rocket,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGatewayStore } from '@/stores/gateway-store';
import { useGatewayConnection } from '@/lib/gateway/hooks';
import { validateGatewayUrl } from '@/lib/gateway/types';
import { createClient } from '@/lib/supabase/client';
import { createProject, fetchProjects } from '@/lib/projects';
import { useProjectStore } from '@/stores/project-store';
import { useUserStore } from '@/stores/user-store';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Check if onboarding should be shown — uses Zustand persisted state */
export function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  // Read directly from the Zustand persisted storage (single source of truth)
  try {
    const stored = localStorage.getItem('clawdify-user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.state?.onboardingCompleted) return false;
    }
  } catch { /* ignore parse errors */ }
  return true;
}

type Step = 'welcome' | 'choose-path' | 'gateway-connect' | 'create-project' | 'done';
type OnboardingPath = 'free' | 'pro' | 'gateway';

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Emoji options for project creation
const EMOJI_OPTIONS = ['📁', '🚀', '💡', '🎨', '🔬', '📊', '🤖', '✨', '🐾', '🌟', '🔧', '📝'];

export function OnboardingWizard({ open, onOpenChange }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const router = useRouter();

  // Gateway connection state
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

  // Create project state
  const [projectName, setProjectName] = useState('My Workspace');
  const [projectEmoji, setProjectEmoji] = useState('🐾');
  const [creating, setCreating] = useState(false);

  // Done state
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { connect, testConnection } = useGatewayConnection();
  const isConnected = useGatewayStore((s) => s.status === 'connected');
  const setProjects = useProjectStore((s) => s.setProjects);
  const addProject = useProjectStore((s) => s.addProject);
  const setUserPlan = useUserStore((s) => s.setPlan);
  const setOnboardingCompleted = useUserStore((s) => s.setOnboardingCompleted);
  const setOnboardingPath = useUserStore((s) => s.setOnboardingPath);
  const setGatewayMode = useUserStore((s) => s.setGatewayMode);
  const supabase = createClient();

  // ─── Finish (defined early so useEffect can reference it) ──────────────

  const finishOnboarding = useCallback(() => {
    setOnboardingCompleted(true);
    if (path) setOnboardingPath(path);
    onOpenChange(false);
  }, [onOpenChange, path, setOnboardingCompleted, setOnboardingPath]);

  const skipToEnd = () => {
    setOnboardingCompleted(true);
    onOpenChange(false);
  };

  // Validate gateway URL
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

  // Auto-redirect on done
  useEffect(() => {
    if (step === 'done') {
      doneTimerRef.current = setTimeout(() => {
        finishOnboarding();
      }, 2000);
    }
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, [step, finishOnboarding]);

  // ─── Navigation helpers ────────────────────────────────────────────────────

  const goTo = (nextStep: Step, dir: 'forward' | 'backward' = 'forward') => {
    setDirection(dir);
    setStep(nextStep);
  };

  const handleChoosePro = () => {
    setPath('pro');
    setUserPlan('pro');
    setGatewayMode('hosted');
    goTo('create-project');
  };

  const handleChooseGateway = () => {
    setPath('free');
    setUserPlan('free');
    setGatewayMode('byog');
    goTo('gateway-connect');
  };

  // ─── Gateway connection handlers ───────────────────────────────────────────

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
      const rpcPayload = gatewayToken
        ? { p_name: 'Default', p_gateway_url: gatewayUrl, p_gateway_token: gatewayToken }
        : { p_name: 'Default', p_gateway_url: gatewayUrl };
      const { error: rpcError } = await supabase.rpc('save_gateway_connection', rpcPayload);
      if (rpcError) {
        console.error('[onboarding] Failed to save gateway connection:', rpcError);
        toast.error('Failed to save connection', {
          description: rpcError.message,
        });
      }

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

  // ─── Create project handler ────────────────────────────────────────────────

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    setCreating(true);
    try {
      const project = await createProject({
        name: projectName.trim(),
        icon: projectEmoji,
      });
      addProject(project);
      const projects = await fetchProjects();
      setProjects(projects);
      if (path === 'pro') {
        router.push('/deploy');
      } else {
        router.push(`/project/${project.id}`);
      }
      goTo('done');
    } catch (err) {
      toast.error('Failed to create project', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  };

  // ─── Step progress ─────────────────────────────────────────────────────────

  const getStepIndex = (): number => {
    switch (step) {
      case 'welcome': return 0;
      case 'choose-path': return 1;
      case 'gateway-connect': return 2;
      case 'create-project': return path === 'pro' ? 2 : 3;
      case 'done': return path === 'pro' ? 3 : 4;
      default: return 0;
    }
  };
  const totalSteps = path === 'pro' ? 4 : 5;
  const currentIndex = getStepIndex();

  // Transition class based on direction
  const contentClass = cn(
    'transition-all duration-300 ease-out',
    direction === 'forward'
      ? 'animate-in fade-in slide-in-from-right-4'
      : 'animate-in fade-in slide-in-from-left-4',
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) skipToEnd(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>
            {step === 'welcome' && 'Welcome to Clawdify'}
            {step === 'choose-path' && 'Choose your plan'}
            {step === 'gateway-connect' && 'Connect your Gateway'}
            {step === 'create-project' && 'Create your first project'}
            {step === 'done' && 'Setup complete'}
          </DialogTitle>
        </VisuallyHidden>
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-6 pb-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === currentIndex ? 'w-6 bg-primary' : 'w-1.5',
                i < currentIndex ? 'bg-primary/60' : i > currentIndex ? 'bg-muted' : '',
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 pb-6 min-h-[340px]">

          {/* ── Step 1: Welcome ── */}
          {step === 'welcome' && (
            <div className={cn('flex flex-col items-center justify-center gap-4 py-8 text-center', contentClass)}>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
                🐾
              </div>
              <h2 className="text-2xl font-bold">Welcome to Clawdify 🐾</h2>
              <p className="max-w-sm text-muted-foreground">
                Your private AI workspace
              </p>
              <Button onClick={() => goTo('choose-path')} size="lg" className="mt-4 gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ── Step 2: Choose Your Path ── */}
          {step === 'choose-path' && (
            <div className={cn('space-y-4 py-4', contentClass)}>
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">Choose your path</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  How would you like to use Clawdify?
                </p>
              </div>

              <div className="grid gap-3">
                {/* Pro Card — Primary CTA */}
                <button
                  onClick={handleChoosePro}
                  className="group relative flex items-start gap-4 rounded-xl border border-primary/30 p-4 text-left transition-all hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Badge variant="default" className="absolute -top-2 right-3 text-[10px]">
                    Recommended
                  </Badge>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-lg dark:bg-yellow-950">
                    🚀
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">Pro</h4>
                      <span className="text-sm font-medium text-primary">$12/mo</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      One-click deploy to Railway or Fly.io, unlimited projects, notifications &amp; analytics
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">One-click deploy</Badge>
                      <Badge variant="secondary" className="text-[10px]">Unlimited</Badge>
                      <Badge variant="secondary" className="text-[10px]">BYOK</Badge>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>

                {/* Free / BYOG Card */}
                <button
                  onClick={handleChooseGateway}
                  className="group flex items-start gap-4 rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-lg dark:bg-blue-950">
                    🔧
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">Free</h4>
                      <span className="text-sm text-muted-foreground">Bring your own Gateway</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Already running OpenClaw? Connect your Gateway and start managing tasks.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">BYOG</Badge>
                      <Badge variant="secondary" className="text-[10px]">2 projects</Badge>
                      <Badge variant="secondary" className="text-[10px]">Any model</Badge>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              </div>

              <div className="flex justify-start pt-2">
                <Button variant="ghost" onClick={() => goTo('welcome', 'backward')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Gateway Connection (Free/BYOG path) ── */}
          {step === 'gateway-connect' && (
            <div className={cn('space-y-4 py-4', contentClass)}>
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
                    Find this by running <code className="rounded bg-muted px-1 py-0.5 text-[10px]">openclaw status</code> on your Gateway host.
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

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => goTo('choose-path', 'backward')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
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
                    <Button onClick={() => goTo('create-project')} className="gap-2">
                      Next <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Create First Project ── */}
          {step === 'create-project' && (
            <div className={cn('space-y-4 py-4', contentClass)}>
              <div className="text-center mb-4">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-green-100 dark:bg-green-950 mb-3">
                  <Sparkles className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">Create your first project</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Projects are separate workspaces with their own context.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-project">Project name</Label>
                  <Input
                    id="ob-project"
                    placeholder="My Workspace"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    maxLength={100}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && projectName.trim()) {
                        e.preventDefault();
                        void handleCreateProject();
                      }
                    }}
                    autoFocus
                  />
                </div>

                {/* Emoji picker */}
                <div className="space-y-1.5">
                  <Label>Icon</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setProjectEmoji(emoji)}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all',
                          projectEmoji === emoji
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                            : 'border-transparent hover:bg-muted',
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    const backStep: Step =
                      path === 'pro' ? 'choose-path' :
                      'gateway-connect';
                    goTo(backStep, 'backward');
                  }}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => void handleCreateProject()}
                  disabled={creating || !projectName.trim()}
                  size="lg"
                  className="gap-2"
                >
                  {creating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                  ) : (
                    <>Let&apos;s Go! <Rocket className="h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === 'done' && (
            <div className={cn('flex flex-col items-center justify-center gap-4 py-8 text-center', contentClass)}>
              {/* Animated checkmark */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950 animate-in zoom-in-50 duration-500">
                <CheckCircle2 className="h-8 w-8 text-green-600 animate-in zoom-in-0 duration-700 delay-200" />
              </div>
              <h2 className="text-2xl font-bold animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
                You&apos;re all set!
              </h2>
              <p className="max-w-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 delay-500">
                {path === 'free' && 'Gateway connected. Create your first task!'}
                {path === 'pro' && 'Pro activated! You\'ll configure your API key when connecting your Gateway.'}
                {!path && 'Your workspace is ready. Let\u0027s build something.'}
              </p>
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground animate-in fade-in duration-500 delay-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Redirecting to your workspace...
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
