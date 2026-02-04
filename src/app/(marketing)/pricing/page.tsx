import type { Metadata } from 'next';
import { PricingTable } from '@/components/landing/pricing-table';
import { Faq } from '@/components/landing/faq';
import { CtaSection } from '@/components/landing/cta-section';

export const metadata: Metadata = {
  title: 'Pricing — Clawdify',
  description:
    'Simple pricing for Clawdify. Free tier with BYOG. Pro at $12/mo for one-click deploy, unlimited projects, and cloud features.',
  openGraph: {
    title: 'Pricing — Clawdify',
    description:
      'Free tier with BYOG. Pro at $12/mo for deploy buttons, unlimited projects, notifications, and analytics.',
  },
};

export default function PricingPage() {
  return (
    <div className="pt-16">
      <PricingTable />
      <Faq />
      <CtaSection />
    </div>
  );
}
