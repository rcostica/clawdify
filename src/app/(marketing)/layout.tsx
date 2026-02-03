import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Clawdify — Your AI Workspace, Beautifully Crafted',
  description:
    'A premium AI workspace that works from any device. Private, fast, and built for developers who ship. Start free.',
  openGraph: {
    title: 'Clawdify — Your AI Workspace, Beautifully Crafted',
    description:
      'A premium AI workspace that works from any device. Private, fast, and built for developers who ship.',
    type: 'website',
    siteName: 'Clawdify',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clawdify — Your AI Workspace, Beautifully Crafted',
    description:
      'A premium AI workspace that works from any device. Private, fast, and built for developers who ship.',
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col">
      <LandingNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
