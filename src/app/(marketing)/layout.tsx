import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Clawdify — One AI Workspace for Claude, GPT-4 & Gemini',
  description:
    'One workspace for Claude, GPT-4, and Gemini — private, project-organized, and accessible from any device. Start free.',
  openGraph: {
    title: 'Clawdify — One AI Workspace for Claude, GPT-4 & Gemini',
    description:
      'One workspace for Claude, GPT-4, and Gemini — private, project-organized, and accessible from any device.',
    type: 'website',
    siteName: 'Clawdify',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clawdify — One AI Workspace for Claude, GPT-4 & Gemini',
    description:
      'One workspace for Claude, GPT-4, and Gemini — private, project-organized, and accessible from any device.',
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
