import type { Metadata } from 'next';
import { DeployPage } from '@/components/deploy/deploy-page';

export const metadata: Metadata = {
  title: 'Get Started — Clawdify',
  description:
    'Install OpenClaw, start your Gateway, and connect to Clawdify in 60 seconds. No cloud deploy needed — run on your own machine.',
  openGraph: {
    title: 'Get Started — Clawdify',
    description:
      'Install OpenClaw, start your Gateway, and connect to Clawdify in 60 seconds.',
  },
};

export default function GetStartedPage() {
  return <DeployPage />;
}
