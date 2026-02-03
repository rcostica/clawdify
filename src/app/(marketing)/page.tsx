import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Comparison } from '@/components/landing/comparison';
import { HowItWorks } from '@/components/landing/how-it-works';
import { PricingTable } from '@/components/landing/pricing-table';
import { Testimonials } from '@/components/landing/testimonials';
import { CtaSection } from '@/components/landing/cta-section';
import { Faq } from '@/components/landing/faq';

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <Comparison />
      <HowItWorks />
      <PricingTable />
      <Testimonials />
      <CtaSection />
      <Faq />
    </>
  );
}
