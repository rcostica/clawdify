'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PlanSelector } from '@/components/billing/plan-selector';
import { UsageDisplay } from '@/components/billing/usage-display';
import { useUserStore } from '@/stores/user-store';
import { PLANS } from '@/lib/billing/plans';
import Link from 'next/link';

/** Handle search params in a Suspense boundary */
function BillingSearchParamsHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated!');
    }
    if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout canceled');
    }
  }, [searchParams]);

  return null;
}

export default function BillingPage() {
  const plan = useUserStore((s) => s.plan);
  const currentPlan = PLANS[plan];
  const [managingPortal, setManagingPortal] = useState(false);

  const handleManageSubscription = async () => {
    setManagingPortal(true);
    try {
      // Mock: In production, this would create a Stripe portal session
      toast.info('Stripe billing portal coming soon!', {
        description:
          'This will open the Stripe billing portal where you can manage your subscription, update payment methods, and view invoices.',
      });
    } catch (err) {
      toast.error('Failed to open billing portal', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setManagingPortal(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <CreditCard className="h-5 w-5" />
        <h2 className="font-semibold">Billing</h2>
      </div>

      <Suspense fallback={null}>
        <BillingSearchParamsHandler />
      </Suspense>

      <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
        {/* Current Plan Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Current Plan
              <Badge variant={plan === 'free' ? 'secondary' : 'default'}>
                {currentPlan.name}
              </Badge>
            </CardTitle>
            <CardDescription>{currentPlan.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="mt-1 text-lg font-semibold">
                  {currentPlan.priceLabel}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Model</p>
                <p className="mt-1 text-lg font-semibold">
                  {currentPlan.modelLabel}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Projects</p>
                <p className="mt-1 text-lg font-semibold">
                  {currentPlan.maxProjectsLabel}
                </p>
              </div>
            </div>

            {plan !== 'free' && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={managingPortal}
                  className="gap-2"
                >
                  {managingPortal ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Manage Subscription
                </Button>
                <p className="text-xs text-muted-foreground">
                  Update payment method, view invoices, or cancel
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage */}
        <UsageDisplay />

        <Separator />

        {/* Plan Comparison & Upgrade */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">
              {plan === 'free' ? 'Upgrade your plan' : 'Change plan'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Choose the plan that works best for you
            </p>
          </div>
          <PlanSelector />
        </div>

        {/* Payment Method Placeholder */}
        {plan !== 'free' && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Method</CardTitle>
                <CardDescription>
                  Manage your payment method through the Stripe portal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-lg border border-dashed p-4">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">No payment method on file</p>
                    <p className="text-xs text-muted-foreground">
                      Billing coming soon.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
