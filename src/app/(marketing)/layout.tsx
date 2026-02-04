import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Clawdify — Mission Control for AI Agents',
  description:
    'Deploy your own AI agent in 5 minutes. Create tasks, watch it work in real-time, and see results — all from your browser. Free tier available.',
  openGraph: {
    title: 'Clawdify — Mission Control for AI Agents',
    description:
      'Deploy your own AI agent in 5 minutes. Create tasks, watch it work in real-time, and see results — all from your browser.',
    type: 'website',
    siteName: 'Clawdify',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clawdify — Mission Control for AI Agents',
    description:
      'Deploy your own AI agent in 5 minutes. Create tasks, watch it work in real-time, and see results — all from your browser.',
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
