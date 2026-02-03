import type { Metadata } from 'next';
import { PricingTable } from '@/components/landing/pricing-table';
import { CtaSection } from '@/components/landing/cta-section';

export const metadata: Metadata = {
  title: 'Pricing — Clawdify',
  description:
    'Simple, transparent pricing for Clawdify. Start free, upgrade when you need more. No hidden fees.',
  openGraph: {
    title: 'Pricing — Clawdify',
    description:
      'Simple, transparent pricing for Clawdify. Start free, upgrade when you need more.',
  },
};

export default function PricingPage() {
  return (
    <div className="pt-16">
      <PricingTable />
      <CtaSection />
    </div>
  );
}
