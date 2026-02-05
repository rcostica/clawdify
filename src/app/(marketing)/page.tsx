import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { DemoPreview } from '@/components/landing/demo-preview';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Comparison } from '@/components/landing/comparison';
import { Testimonials } from '@/components/landing/testimonials';
import { CtaSection } from '@/components/landing/cta-section';
import { Faq } from '@/components/landing/faq';

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <DemoPreview />
      <HowItWorks />
      <Comparison />
      <Testimonials />
      <CtaSection />
      <Faq />
    </>
  );
}
