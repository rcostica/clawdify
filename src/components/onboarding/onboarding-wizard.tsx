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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Star,
  Key,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGatewayStore } from '@/stores/gateway-store';
import { useGatewayConnection } from '@/lib/gateway/hooks';
import { validateGatewayUrl } from '@/lib/gateway/types';
import { createClient } from '@/lib/supabase/client';
import { createProject, fetchProjects } from '@/lib/projects';
import { useProjectStore } from '@/stores/project-store';
import { useUserStore } from '@/stores/user-store';
import { API_PROVIDERS, type ApiProviderId } from '@/lib/billing/plans';
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

type Step = 'welcome' | 'choose-path' | 'pro-setup' | 'gateway-connect' | 'create-project' | 'done';
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

  // Pro setup state
  const [proOption, setProOption] = useState<'api-key' | 'credits' | null>(null);
  const [apiProvider, setApiProvider] = useState<ApiProviderId>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);

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
  const setApiProviderStore = useUserStore((s) => s.setApiProvider);
  const setApiKeySet = useUserStore((s) => s.setApiKeySet);
  const setGatewayMode = useUserStore((s) => s.setGatewayMode);
  const supabase = createClient();

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
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Navigation helpers ────────────────────────────────────────────────────

  const goTo = (nextStep: Step, dir: 'forward' | 'backward' = 'forward') => {
    setDirection(dir);
    setStep(nextStep);
  };

  const handleChooseFree = () => {
    setPath('free');
    setUserPlan('free');
    setGatewayMode('hosted');
    goTo('create-project');
  };

  const handleChoosePro = () => {
    setPath('pro');
    setGatewayMode('hosted');
    goTo('pro-setup');
  };

  const handleChooseGateway = () => {
    setPath('gateway');
    setGatewayMode('byog');
    goTo('gateway-connect');
  };

  // ─── Pro setup handlers ────────────────────────────────────────────────────

  const handleValidateApiKey = async () => {
    if (!apiKey.trim()) return;
    setValidatingKey(true);
    setKeyValid(null);
    try {
      // Mock validation: check if key starts with expected prefix
      const provider = API_PROVIDERS.find((p) => p.id === apiProvider);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // simulate network delay

      if (provider && apiKey.startsWith(provider.keyPrefix)) {
        setKeyValid(true);
        setApiProviderStore(apiProvider);
        setApiKeySet(true);
        setUserPlan('pro');
        toast.success('API key validated!');
      } else {
        setKeyValid(false);
        toast.error('Invalid API key', {
          description: `Expected key starting with "${provider?.keyPrefix ?? ''}"`,
        });
      }
    } catch {
      setKeyValid(false);
      toast.error('Validation failed');
    } finally {
      setValidatingKey(false);
    }
  };

  const handleProContinue = () => {
    goTo('create-project');
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
      router.push(`/project/${project.id}`);
      goTo('done');
    } catch (err) {
      toast.error('Failed to create project', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  };

  // ─── Finish ────────────────────────────────────────────────────────────────

  const finishOnboarding = useCallback(() => {
    completeOnboarding();
    setOnboardingCompleted(true);
    if (path) setOnboardingPath(path);
    onOpenChange(false);
  }, [onOpenChange, path, setOnboardingCompleted, setOnboardingPath]);

  const skipToEnd = () => {
    completeOnboarding();
    setOnboardingCompleted(true);
    onOpenChange(false);
  };

  // ─── Step progress ─────────────────────────────────────────────────────────

  const getStepIndex = (): number => {
    switch (step) {
      case 'welcome': return 0;
      case 'choose-path': return 1;
      case 'pro-setup':
      case 'gateway-connect': return 2;
      case 'create-project': return 3;
      case 'done': return 4;
      default: return 0;
    }
  };
  const totalSteps = 5;
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
            {step === 'pro-setup' && 'Pro Setup'}
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
                {/* Free Card */}
                <button
                  onClick={handleChooseFree}
                  className="group flex items-start gap-4 rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-lg dark:bg-green-950">
                    🆓
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">Free</h4>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Connect your own Gateway. 2 projects, free forever.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">BYOG</Badge>
                      <Badge variant="secondary" className="text-[10px]">2 projects</Badge>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>

                {/* Pro Card */}
                <button
                  onClick={handleChoosePro}
                  className="group relative flex items-start gap-4 rounded-xl border border-primary/30 p-4 text-left transition-all hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Badge variant="default" className="absolute -top-2 right-3 text-[10px]">
                    Popular
                  </Badge>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-lg dark:bg-yellow-950">
                    ⭐
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">Pro</h4>
                      <span className="text-sm font-medium text-primary">$12/mo</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      One-click deploy, unlimited projects, notifications &amp; analytics
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">Deploy</Badge>
                      <Badge variant="secondary" className="text-[10px]">Unlimited</Badge>
                      <Badge variant="secondary" className="text-[10px]">BYOK</Badge>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>

                {/* Deploy Card */}
                <button
                  onClick={() => {
                    completeOnboarding();
                    setOnboardingCompleted(true);
                    onOpenChange(false);
                    router.push('/deploy');
                  }}
                  className="group flex items-start gap-4 rounded-xl border border-green-500/30 p-4 text-left transition-all hover:border-green-500/50 hover:bg-green-50/50 dark:hover:bg-green-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-lg dark:bg-green-950">
                    🚀
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">Deploy Agent</h4>
                      <Badge variant="secondary" className="text-[10px]">New</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      One-click deploy to Railway or Fly.io
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">Railway</Badge>
                      <Badge variant="secondary" className="text-[10px]">Fly.io</Badge>
                      <Badge variant="secondary" className="text-[10px]">Docker</Badge>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>

                {/* Self-Hosted Card */}
                <button
                  onClick={handleChooseGateway}
                  className="group flex items-start gap-4 rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-lg dark:bg-blue-950">
                    🔧
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">Self-Hosted</h4>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Connect your own OpenClaw Gateway
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">BYOG</Badge>
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

          {/* ── Step 3a: Pro Setup ── */}
          {step === 'pro-setup' && (
            <div className={cn('space-y-4 py-4', contentClass)}>
              <div className="text-center mb-4">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-950 mb-3">
                  <Star className="h-5 w-5 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold">Pro Setup</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose how to power your AI models
                </p>
              </div>

              {/* Sub-option selection */}
              {!proOption && (
                <div className="grid gap-3">
                  <button
                    onClick={() => setProOption('api-key')}
                    className="group flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Key className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold">Use your own API key</h4>
                      <p className="text-xs text-muted-foreground">
                        Connect Anthropic, OpenAI, or Google API key
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>

                  <button
                    disabled
                    className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-left opacity-60 cursor-not-allowed"
                  >
                    <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="flex-1">
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        Use Clawdify credits
                        <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Pay per token — no API keys needed
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {/* API Key form */}
              {proOption === 'api-key' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ob-provider">AI Provider</Label>
                    <Select
                      value={apiProvider}
                      onValueChange={(v) => {
                        setApiProvider(v as ApiProviderId);
                        setApiKey('');
                        setKeyValid(null);
                      }}
                    >
                      <SelectTrigger className="w-full" id="ob-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {API_PROVIDERS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — {p.models.join(', ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ob-api-key">API Key</Label>
                    <div className="relative">
                      <Input
                        id="ob-api-key"
                        type={showApiKey ? 'text' : 'password'}
                        placeholder={`Enter your ${API_PROVIDERS.find((p) => p.id === apiProvider)?.name ?? ''} API key`}
                        value={apiKey}
                        onChange={(e) => { setApiKey(e.target.value); setKeyValid(null); }}
                        autoComplete="off"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      🔒 Your key is encrypted and stored securely. Never stored in the browser.
                    </p>
                  </div>

                  {keyValid === true && (
                    <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700 dark:text-green-300">
                        API key validated successfully!
                      </AlertDescription>
                    </Alert>
                  )}
                  {keyValid === false && (
                    <Alert className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700 dark:text-red-300">
                        Invalid API key. Please check and try again.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleValidateApiKey}
                    disabled={validatingKey || !apiKey.trim()}
                    className="w-full"
                  >
                    {validatingKey ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...</>
                    ) : (
                      'Validate Key'
                    )}
                  </Button>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (proOption) {
                      setProOption(null);
                      setKeyValid(null);
                    } else {
                      goTo('choose-path', 'backward');
                    }
                  }}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                {keyValid === true && (
                  <Button onClick={handleProContinue} className="gap-2">
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3b: Gateway Connection ── */}
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
                      path === 'free' ? 'choose-path' :
                      path === 'pro' ? 'pro-setup' :
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
                {path === 'free' && 'Your workspace is ready. Create your first task!'}
                {path === 'pro' && 'Pro activated! Deploy an agent or connect your Gateway.'}
                {path === 'gateway' && 'Gateway connected. Create your first task!'}
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
