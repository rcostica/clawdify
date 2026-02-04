import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Clawdify',
  description:
    'Terms and conditions for using Clawdify, your AI workspace for Claude, GPT-4, and Gemini.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Last updated: February 4, 2026
      </p>

      <div className="mt-12 space-y-10 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground">
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p className="mt-3">
            By accessing or using Clawdify (&quot;the Service&quot;), you agree
            to be bound by these Terms of Service (&quot;Terms&quot;). If you do
            not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p className="mt-3">
            Clawdify is a web-based workspace that provides a unified interface
            to interact with AI language models (including Claude, GPT-4, and
            Gemini). The Service includes conversation management, project
            organization, file handling, and optional relay connectivity for
            self-hosted gateways.
          </p>
        </section>

        <section>
          <h2>3. Accounts</h2>
          <p className="mt-3">
            You must create an account to use the Service. You are responsible
            for maintaining the security of your account credentials and for all
            activity that occurs under your account. You must be at least 13
            years old to create an account.
          </p>
        </section>

        <section>
          <h2>4. Subscription Plans and Billing</h2>

          <h3 className="mt-4">Free Tier</h3>
          <p className="mt-2">
            The free tier provides limited access to AI models at no cost. We
            reserve the right to modify free tier limits at any time.
          </p>

          <h3 className="mt-4">Paid Plans</h3>
          <p className="mt-2">
            Paid subscriptions are billed monthly or annually through Stripe.
            Prices are listed on our{' '}
            <a
              href="/pricing"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              pricing page
            </a>
            . We may change prices with 30 days&apos; notice.
          </p>

          <h3 className="mt-4">Cancellation and Refunds</h3>
          <p className="mt-2">
            You may cancel your subscription at any time. Cancellation takes
            effect at the end of the current billing period. We do not offer
            prorated refunds for partial months. If you experience a technical
            issue that prevents use, contact support for consideration.
          </p>
        </section>

        <section>
          <h2>5. Acceptable Use</h2>
          <p className="mt-3">You agree not to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              Use the Service for any unlawful purpose or to violate any laws
            </li>
            <li>
              Attempt to circumvent usage limits, rate limiting, or billing
              mechanisms
            </li>
            <li>
              Share your account credentials or let others access your account
            </li>
            <li>
              Use the Service to generate content that is harmful, abusive,
              harassing, or violates the rights of others
            </li>
            <li>
              Reverse-engineer, decompile, or disassemble any part of the
              Service
            </li>
            <li>
              Interfere with or disrupt the Service, servers, or networks
            </li>
            <li>
              Scrape, crawl, or harvest data from the Service without permission
            </li>
          </ul>
        </section>

        <section>
          <h2>6. AI-Generated Content</h2>
          <p className="mt-3">
            The Service provides access to third-party AI models. AI-generated
            content may be inaccurate, incomplete, or inappropriate. You are
            solely responsible for evaluating and using AI outputs. We do not
            guarantee the accuracy, reliability, or suitability of any
            AI-generated content.
          </p>
        </section>

        <section>
          <h2>7. Your Content</h2>
          <p className="mt-3">
            You retain ownership of all content you create or upload through the
            Service (including conversations, files, and project data). By using
            the Service, you grant us a limited license to process your content
            solely for the purpose of providing the Service. We do not use your
            content to train AI models.
          </p>
        </section>

        <section>
          <h2>8. BYOK and BYOG</h2>
          <p className="mt-3">
            If you provide your own API keys (BYOK) or connect your own Gateway
            (BYOG), you are responsible for compliance with the respective
            provider&apos;s terms of service and any associated costs. We are
            not responsible for charges incurred with third-party providers
            through your own keys.
          </p>
        </section>

        <section>
          <h2>9. Availability and Support</h2>
          <p className="mt-3">
            We strive to keep the Service available but do not guarantee 100%
            uptime. We may perform maintenance, updates, or experience outages.
            We will make reasonable efforts to notify you of planned downtime.
            Support is provided on a best-effort basis.
          </p>
        </section>

        <section>
          <h2>10. Limitation of Liability</h2>
          <p className="mt-3">
            To the maximum extent permitted by law, Clawdify and its operators
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or any loss of profits, data, or
            goodwill, arising from your use of the Service. Our total liability
            shall not exceed the amount you paid us in the 12 months preceding
            the claim.
          </p>
        </section>

        <section>
          <h2>11. Disclaimer of Warranties</h2>
          <p className="mt-3">
            The Service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, either express or
            implied, including but not limited to implied warranties of
            merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>
        </section>

        <section>
          <h2>12. Termination</h2>
          <p className="mt-3">
            We may suspend or terminate your account if you violate these Terms.
            You may delete your account at any time through the Service. Upon
            termination, your right to use the Service ceases immediately, and
            your data will be deleted in accordance with our Privacy Policy.
          </p>
        </section>

        <section>
          <h2>13. Changes to Terms</h2>
          <p className="mt-3">
            We may update these Terms from time to time. We will notify you of
            material changes via email or in-app notice at least 30 days before
            they take effect. Continued use of the Service after changes
            constitutes acceptance.
          </p>
        </section>

        <section>
          <h2>14. Governing Law</h2>
          <p className="mt-3">
            These Terms are governed by and construed in accordance with the
            laws of Romania, without regard to conflict of law principles. Any
            disputes arising from these Terms shall be resolved in the courts of
            Bucharest, Romania.
          </p>
        </section>

        <section>
          <h2>15. Contact</h2>
          <p className="mt-3">
            For questions about these Terms, contact us at{' '}
            <a
              href="mailto:legal@clawdify.app"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              legal@clawdify.app
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
