'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { PLANS, type PlanId } from '@/lib/billing/plans';
import { useUserStore } from '@/stores/user-store';
import { cn } from '@/lib/utils';

interface PlanSelectorProps {
  className?: string;
}

export function PlanSelector({ className }: PlanSelectorProps) {
  const currentPlan = useUserStore((s) => s.plan);
  const setPlan = useUserStore((s) => s.setPlan);
  const [loading, setLoading] = useState<PlanId | null>(null);

  const handleSelectPlan = async (planId: PlanId) => {
    if (planId === currentPlan) return;

    // Free downgrade
    if (planId === 'free') {
      setPlan('free');
      toast.success('Switched to Free plan');
      return;
    }

    // Team plan — coming soon
    if (planId === 'team') {
      toast.info('Team plan is coming soon!');
      return;
    }

    // Pro upgrade — go through Stripe checkout (mocked)
    setLoading(planId);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Failed to create checkout session');
      }

      // Mock: In production, redirect to Stripe checkout
      // window.location.href = data.url;

      // For now: simulate successful upgrade
      setPlan(planId);
      toast.success(`Upgraded to ${PLANS[planId].name} plan!`, {
        description: 'This is a mock upgrade. Stripe integration coming soon.',
      });
    } catch (err) {
      toast.error('Upgrade failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(null);
    }
  };

  const planOrder: PlanId[] = ['free', 'pro', 'team'];

  return (
    <div className={cn('grid gap-4 md:grid-cols-3', className)}>
      {planOrder.map((planId) => {
        const plan = PLANS[planId];
        const isCurrent = planId === currentPlan;
        const isUpgrade =
          planOrder.indexOf(planId) > planOrder.indexOf(currentPlan);
        const isDowngrade =
          planOrder.indexOf(planId) < planOrder.indexOf(currentPlan);

        return (
          <Card
            key={planId}
            className={cn(
              'relative flex flex-col transition-all',
              isCurrent && 'border-primary ring-1 ring-primary/20',
              plan.badge === 'Popular' &&
                !isCurrent &&
                'border-primary/50',
            )}
          >
            {plan.badge && (
              <Badge
                variant={plan.badge === 'Popular' ? 'default' : 'secondary'}
                className="absolute -top-2.5 right-4"
              >
                {plan.badge}
              </Badge>
            )}

            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {plan.name}
                {isCurrent && (
                  <Badge variant="outline" className="text-[10px]">
                    Current
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="pt-2">
                {plan.price === 0 ? (
                  <span className="text-3xl font-bold">Free</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold">
                      ${plan.price}
                    </span>
                    <span className="text-muted-foreground">/mo</span>
                  </>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature.name} className="flex items-center gap-2">
                    {feature.included ? (
                      <Check className="h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <span
                      className={cn(
                        !feature.included && 'text-muted-foreground/60',
                      )}
                    >
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                variant={isCurrent ? 'outline' : isUpgrade ? 'default' : 'outline'}
                disabled={isCurrent || loading !== null}
                onClick={() => handleSelectPlan(planId)}
              >
                {loading === planId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : isCurrent ? (
                  'Current Plan'
                ) : isUpgrade ? (
                  `Upgrade to ${plan.name}`
                ) : isDowngrade ? (
                  `Downgrade to ${plan.name}`
                ) : (
                  `Select ${plan.name}`
                )}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
