import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Clawdify — Mission Control for AI Agents',
  description:
    'Mission Control for your AI agents. Create tasks, watch your agent work in real-time, and review results — all from one dashboard. Free tier available.',
  openGraph: {
    title: 'Clawdify — Mission Control for AI Agents',
    description:
      'Mission Control for your AI agents. Create tasks, watch your agent work in real-time, and review results — all from one dashboard.',
    type: 'website',
    siteName: 'Clawdify',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clawdify — Mission Control for AI Agents',
    description:
      'Mission Control for your AI agents. Create tasks, watch your agent work in real-time, and review results — all from one dashboard.',
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
