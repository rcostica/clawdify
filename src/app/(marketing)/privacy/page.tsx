import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Clawdify',
  description: 'How Clawdify collects, uses, and protects your personal data.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Last updated: February 4, 2026
      </p>

      <div className="mt-12 space-y-10 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground">
        <section>
          <h2>1. Introduction</h2>
          <p className="mt-3">
            Clawdify (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is
            committed to protecting your privacy. This Privacy Policy explains
            how we collect, use, disclose, and safeguard your information when
            you use our web application and related services (the
            &quot;Service&quot;).
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>

          <h3 className="mt-4">Account Information</h3>
          <p className="mt-2">
            When you create an account, we collect your email address and, if
            you sign in with a third-party provider (Google, GitHub), basic
            profile information such as your name and avatar.
          </p>

          <h3 className="mt-4">Usage Data</h3>
          <p className="mt-2">
            We collect information about how you interact with the Service,
            including pages visited, features used, timestamps, and device
            information (browser type, operating system, screen resolution).
          </p>

          <h3 className="mt-4">Task &amp; Conversation Data</h3>
          <p className="mt-2">
            Your tasks and AI conversations are processed on your own
            OpenClaw Gateway — on your machine or server. Clawdify connects
            to your Gateway via WebSocket relay to display activity and
            results. Conversation content is relayed but not stored on our
            servers beyond what is necessary for real-time transmission.
          </p>

          <h3 className="mt-4">Payment Information</h3>
          <p className="mt-2">
            Payment processing is handled by Stripe. We do not store your full
            credit card number. Stripe may share limited billing details (last
            four digits, expiration date) with us for display in your account.
          </p>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>To provide, maintain, and improve the Service</li>
            <li>To process transactions and manage subscriptions</li>
            <li>To communicate with you about updates, support, and billing</li>
            <li>
              To detect and prevent fraud, abuse, and security incidents
            </li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Sharing</h2>
          <p className="mt-3">
            We do not sell your personal data. We may share information with:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong>AI model providers</strong> (OpenAI, Anthropic, Google) —
              conversation content is sent to the provider you select to
              generate responses
            </li>
            <li>
              <strong>Stripe</strong> — for payment processing
            </li>
            <li>
              <strong>Infrastructure providers</strong> (hosting, CDN) — to
              deliver the Service
            </li>
            <li>
              <strong>Law enforcement</strong> — only when required by valid
              legal process
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Data Retention</h2>
          <p className="mt-3">
            We retain your account information and conversation history for as
            long as your account is active. You can delete your account at any
            time, which will trigger deletion of your data within 30 days.
            Backups may retain data for an additional 90 days.
          </p>
        </section>

        <section>
          <h2>6. Security</h2>
          <p className="mt-3">
            We use industry-standard measures to protect your data, including
            TLS encryption in transit, encrypted storage at rest, and access
            controls. However, no system is 100% secure. We encourage you to use
            strong passwords and enable two-factor authentication when
            available.
          </p>
        </section>

        <section>
          <h2>7. Your Rights</h2>
          <p className="mt-3">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Access, correct, or delete your personal data</li>
            <li>Export your data in a portable format</li>
            <li>Object to or restrict certain processing</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, contact us at{' '}
            <a
              href="mailto:privacy@clawdify.app"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              privacy@clawdify.app
            </a>
            .
          </p>
        </section>

        <section>
          <h2>8. Cookies</h2>
          <p className="mt-3">
            We use essential cookies for authentication and session management.
            We do not use third-party tracking cookies. Analytics, if enabled,
            use privacy-respecting tools that do not track individuals across
            sites.
          </p>
        </section>

        <section>
          <h2>9. Children&apos;s Privacy</h2>
          <p className="mt-3">
            The Service is not intended for users under 13 years of age. We do
            not knowingly collect data from children. If you believe we have
            collected data from a child, please contact us and we will delete it
            promptly.
          </p>
        </section>

        <section>
          <h2>10. Changes to This Policy</h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. We will notify
            you of material changes via email or an in-app notice. Continued use
            of the Service after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2>11. Contact Us</h2>
          <p className="mt-3">
            If you have questions about this Privacy Policy, contact us at{' '}
            <a
              href="mailto:privacy@clawdify.app"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              privacy@clawdify.app
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
