# Clawdify Security Audit Report

**Date:** February 4, 2026  
**Auditor:** Automated Security Audit  
**Scope:** Full codebase (`src/`, `supabase/migrations/`, `next.config.ts`, `.env*`, dependencies)  
**Stack:** Next.js 15, Supabase, Zustand, TypeScript

---

## Executive Summary

The Clawdify codebase demonstrates **strong security awareness** — tokens are encrypted in the database, RLS is applied to every table, markdown is sanitized with `rehype-sanitize`, HTML previews run in sandboxed iframes, and gateway tokens are never stored in `localStorage`. The security philosophy from the build plan is well-implemented.

However, several issues were found that range from critical (hardcoded encryption key fallback, unverified webhook signatures) to medium (CSP gaps, plugin ordering). The Google Safe Browsing flag is almost certainly a false positive from a new domain performing OAuth.

**Findings Summary:**
- 🔴 **CRITICAL:** 2
- 🟠 **HIGH:** 5
- 🟡 **MEDIUM:** 6
- 🟢 **LOW:** 4
- 🔵 **SAFE BROWSING:** 5 observations

---

## 🔴 CRITICAL — Must Fix Immediately

### C1: Gateway Token Encryption Key Has Hardcoded Fallback

**File:** `supabase/migrations/001_initial.sql`, lines 22–28  
**Risk:** If `app.gateway_token_key` is not configured in the Supabase database settings, ALL gateway tokens are encrypted with the publicly-visible key `'CHANGE_ME_IN_PRODUCTION_32_BYTES!'`. This provides zero encryption since the key is in the git repository.

```sql
create or replace function encrypt_gateway_token(plain_token text)
returns bytea as $$
begin
  return pgp_sym_encrypt(
    plain_token,
    coalesce(
      current_setting('app.gateway_token_key', true),
      'CHANGE_ME_IN_PRODUCTION_32_BYTES!'  -- ← Anyone can see this
    )
  );
end;
$$ language plpgsql security definer;
```

**Impact:** If deployed without setting `app.gateway_token_key`, an attacker with database read access can decrypt every gateway token using this publicly known key. A leaked token = full control of the user's AI agent.

**Fix:** Remove the fallback and RAISE an exception if the key is not configured. Added migration `003_security_hardening.sql`.

---

### C2: Stripe Webhook Signature Verification Is Mocked

**File:** `src/app/api/billing/webhook/route.ts`, entire file  
**Risk:** The webhook endpoint accepts ANY POST request without verifying the Stripe signature. Anyone can send fabricated webhook events to manipulate user subscriptions.

```typescript
// Mock: In production, verify signature
console.log('[billing/webhook] Received webhook:', {
  bodyLength: body.length,
  signature: signature.slice(0, 20) || '(none)',  // ← Never verified!
});
```

**Impact:** An attacker could send fake `checkout.session.completed` events to give themselves paid features, or `customer.subscription.deleted` to downgrade other users.

**Fix:** While Stripe integration is still mocked, the webhook now rejects ALL requests with a 503 status and a clear message that the endpoint is not production-ready. This prevents exploitation if the app is deployed with billing routes accessible.

---

## 🟠 HIGH — Should Fix Soon

### H1: Usage Logs INSERT Policy Allows Any Authenticated User

**File:** `supabase/migrations/002_billing.sql`  
**Risk:** The RLS policy on `usage_logs` for INSERT is `WITH CHECK (true)`, which means ANY authenticated user can insert arbitrary usage records — not just the service role.

```sql
CREATE POLICY "Service can insert usage" ON usage_logs
  FOR INSERT WITH CHECK (true);  -- ← Any authenticated user can insert!
```

**Impact:** Users can forge usage records, potentially causing incorrect billing, skewing analytics, or inserting records with other users' user_id values.

**Fix:** Added migration `003_security_hardening.sql` that drops this policy and replaces it with one restricted to `auth.uid() = user_id` (users can only insert their own usage).

---

### H2: Referrer-Policy Too Permissive for Quick-Connect URLs

**File:** `next.config.ts`  
**Risk:** The build plan explicitly requires `Referrer-Policy: no-referrer` to prevent token leakage via quick-connect URLs (`?token=...`). The current setting `strict-origin-when-cross-origin` leaks the full URL path (including query parameters containing the token) when navigating to a same-origin page before the token is stripped.

**Impact:** During the brief window between page load and URL stripping in `QuickConnectHandler`, the token could leak via the Referer header to same-origin resources (images, scripts, etc.) or be captured by browser extensions.

**Fix:** Changed to `no-referrer` as specified in the build plan.

---

### H3: CSP connect-src Allows All WebSocket Origins

**File:** `next.config.ts`  
**Risk:** `connect-src 'self' ${SUPABASE_URL} wss: ws:` allows the page to open WebSocket connections to ANY server. Combined with an XSS vector, this could be used to exfiltrate data.

```
connect-src 'self' ${SUPABASE_URL} wss: ws:
```

**Impact:** If an attacker finds an XSS vector (bypassing rehype-sanitize), they could establish a WebSocket connection to their own server and exfiltrate tokens, messages, and user data.

**Fix:** This is intentional — users connect to their own Gateway at arbitrary URLs. However, we should document this risk. Cannot restrict without breaking BYOG functionality.  
**Mitigation:** The existing rehype-sanitize + CSP script restrictions make XSS exploitation difficult. Accepted risk with documentation.

---

### H4: rehype-sanitize Runs Before rehype-highlight (Wrong Order)

**Files:**
- `src/components/chat/message-bubble.tsx` (line ~107)
- `src/components/chat/streaming-text.tsx` (line ~19)
- `src/components/artifacts/markdown-preview.tsx` (line ~16)

**Risk:** The sanitizer plugin runs first, then rehype-highlight adds unsanitized HTML (span elements with class names). While rehype-highlight only adds `<span class="hljs-...">` which is allowed by the schema, the principle of defense-in-depth says sanitize should be the LAST transformation.

```typescript
rehypePlugins={[
  [rehypeSanitize, sanitizeSchema],  // ← Runs first
  rehypeHighlight,                   // ← Adds HTML after sanitization
]}
```

**Impact:** Currently low because rehype-highlight's output is safe. But if a different plugin were added between them, or if rehype-highlight had a vulnerability, the unsanitized output could contain XSS payloads.

**Fix:** Reordered plugins: `[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]` — sanitize always runs last.

---

### H5: Auth Callback Ignores Exchange Errors

**File:** `src/app/api/auth/callback/route.ts`  
**Risk:** The callback silently ignores the result of `exchangeCodeForSession`. If the exchange fails (invalid code, expired code, replay attack), the user is redirected to the home page without any error handling.

```typescript
if (code) {
  const supabase = await createServerSupabase();
  await supabase.auth.exchangeCodeForSession(code);
  // ← Result ignored! No error check!
}
return NextResponse.redirect(`${origin}/`);
```

**Impact:** Failed auth exchanges are silently swallowed. Users may think they're authenticated when they're not. Also, there's no protection against PKCE code replay if the exchange fails but the redirect succeeds.

**Fix:** Added error handling: on exchange failure, redirect to `/login?error=auth_callback_failed`.

---

## 🟡 MEDIUM — Recommended Improvements

### M1: CSP Uses 'unsafe-inline' for Scripts

**File:** `next.config.ts`  
**Risk:** `script-src 'self' 'unsafe-inline'` allows inline scripts to execute, which weakens XSS protection. Next.js requires inline scripts for hydration, but nonce-based CSP would be more secure.

**Impact:** If an attacker can inject HTML content that bypasses rehype-sanitize, inline scripts would execute.

**Recommendation:** Use Next.js `nonce` feature for CSP when it stabilizes. Current setup is standard for Next.js apps but not ideal.

---

### M2: SVG Files Allowed in Uploads

**File:** `src/components/chat/file-upload.tsx`, line 25  
**Risk:** `image/svg+xml` is in `ALLOWED_TYPES`. SVG files can contain JavaScript that executes when viewed in a browser. If Supabase Storage serves SVGs with `Content-Type: image/svg+xml` and no `Content-Disposition: attachment`, the JavaScript inside will execute in the Supabase domain context.

**Impact:** Limited because SVGs would execute in the Supabase Storage domain, not the Clawdify domain. But could still be used for phishing.

**Recommendation:** Remove SVG from allowed types, or convert SVGs to rasterized PNGs before serving.

---

### M3: No Rate Limiting on API Routes

**Files:** `src/app/api/billing/checkout/route.ts`, `src/app/api/billing/usage/route.ts`, `src/app/api/auth/callback/route.ts`  
**Risk:** No rate limiting. An attacker could brute-force endpoints or cause excessive load.

**Impact:** Denial of service, excessive Supabase usage, potential cost inflation.

**Recommendation:** Add rate limiting middleware (e.g., `next-rate-limiter` or Vercel's built-in edge rate limiting).

---

### M4: Error Boundary Exposes Error Messages to Users

**File:** `src/components/error-boundary.tsx`, line ~42  
**Risk:** Shows `error.message` to users, which could contain internal implementation details, file paths, or database errors.

**Recommendation:** Show a generic error message in production. Log the full error server-side.

---

### M5: Missing HSTS preload Directive

**File:** `next.config.ts`  
**Risk:** HSTS is set with `max-age=31536000; includeSubDomains` but without `preload`. Adding `preload` and submitting to the HSTS preload list would prevent SSL-stripping attacks on first visit.

**Recommendation:** Add `preload` to the HSTS header value and submit to hstspreload.org.

---

### M6: Webhook Logs Potentially Sensitive Data

**File:** `src/app/api/billing/webhook/route.ts`  
**Risk:** `console.log('[billing/webhook] Received webhook:', ...)` logs event data which could contain PII (email, customer ID, payment info) in production.

**Recommendation:** Remove verbose logging or mask sensitive fields.

---

## 🟢 LOW — Nice to Have

### L1: Console Logging in Production

Multiple files log warnings and errors to console. While not a direct vulnerability, these logs could reveal implementation details in browser dev tools.

**Recommendation:** Use a structured logger with log levels. Disable verbose logging in production builds.

---

### L2: ErrorBoundary Logs Full Error Objects

**File:** `src/components/error-boundary.tsx`  
`componentDidCatch` logs full error and errorInfo objects which could contain sensitive data in stack traces.

---

### L3: Missing Subresource Integrity (SRI)

No SRI hashes on external resources. This is standard for Next.js apps that self-host assets but could be improved.

---

### L4: `npm audit` Findings

```
1 moderate severity vulnerability

next  15.0.0-canary.0 - 15.6.0-canary.60
  Next.js has Unbounded Memory Consumption via PPR Resume Endpoint
  https://github.com/advisories/GHSA-5f7q-jpqc-wp7h
```

**Recommendation:** Update Next.js when a patched version is available (fix requires major version bump to 16.x).

---

## 🔵 SAFE BROWSING — Google Safe Browsing Flag Analysis

### Verdict: Almost Certainly a False Positive

The codebase contains **no malicious patterns**. The Google Safe Browsing flag is triggered by a combination of factors common to new SaaS products:

### SB1: New Domain Performing OAuth (Primary Trigger)
A brand-new domain (`clawdify.app`) that immediately performs Google OAuth sign-in is a classic phishing pattern that Google's automated systems flag. The domain has no reputation history.

### SB2: Login Form on New Domain
Standard login forms with email/password fields on newly registered domains match credential-harvesting patterns.

### SB3: WebSocket Connections
The site opens WebSocket connections to user-configured URLs, which could appear suspicious to automated scanners.

### SB4: No Issues Found in Code
- ✅ No hidden redirects
- ✅ No obfuscated JavaScript
- ✅ No deceptive downloads or install prompts
- ✅ No credential harvesting to third parties
- ✅ Forms submit to proper auth endpoints (Supabase)
- ✅ Proper meta tags (title, description, OpenGraph, Twitter)
- ✅ No suspicious URL patterns
- ✅ SSL/HSTS properly configured

### SB5: Recommended Actions
1. **Submit for review** via [Google Search Console](https://search.google.com/search-console) → Security Issues → Request Review
2. **Add a Privacy Policy page** at `/privacy` — helps establish legitimacy
3. **Add Terms of Service** at `/terms`
4. **Verify domain in Google Search Console** to prove ownership
5. **Register for Google Safe Browsing API** to proactively monitor
6. **Consider Google Cloud Web Risk API** for ongoing monitoring
7. **Wait** — new domains often get auto-cleared after 1-2 weeks of legitimate traffic

---

## ✅ Things Done Right (Notable Positives)

| Area | Implementation | Assessment |
|------|---------------|------------|
| Token storage | Encrypted in Supabase via `pgp_sym_encrypt`, never in localStorage | ✅ Excellent |
| RLS | Every table has RLS with `auth.uid()` checks | ✅ Excellent |
| Markdown sanitization | `rehype-sanitize` with strict custom schema | ✅ Good (order fixed) |
| HTML previews | Sandboxed iframe without `allow-same-origin` | ✅ Excellent |
| Gateway URL validation | Validates protocol, hostname, warns on insecure | ✅ Good |
| Token URL stripping | Quick-connect strips `?token=` immediately | ✅ Good |
| Device token isolation | Only device tokens (Gateway-issued, rotatable) in localStorage | ✅ Excellent |
| Zustand persistence | Only URL persisted, never tokens | ✅ Excellent |
| `.gitignore` | `.env.local` properly excluded, never in git history | ✅ Verified |
| Security headers | HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy | ✅ Good |
| WebSocket security | Defensive JSON parsing, frame validation, fail-closed on unknowns | ✅ Excellent |
| Input validation | Project names, colors, icons validated server-side | ✅ Good |
| `SUPABASE_SERVICE_ROLE_KEY` | Never exposed to browser (no `NEXT_PUBLIC_` prefix) | ✅ Correct |

---

## npm audit Results

```
1 moderate severity vulnerability

next  15.0.0-canary.0 - 15.6.0-canary.60
  Severity: moderate
  Next.js has Unbounded Memory Consumption via PPR Resume Endpoint
  https://github.com/advisories/GHSA-5f7q-jpqc-wp7h
  fix available via `npm audit fix --force` (breaking change: next@16.x)
```

---

## Fixes Applied

| ID | Severity | Fix | File(s) Modified |
|----|----------|-----|-----------------|
| C1 | CRITICAL | Removed hardcoded encryption key fallback; functions now RAISE on missing key | `supabase/migrations/003_security_hardening.sql` |
| C2 | CRITICAL | Webhook endpoint now rejects all requests with 503 until properly implemented | `src/app/api/billing/webhook/route.ts` |
| H1 | HIGH | Replaced permissive INSERT policy with `auth.uid() = user_id` check | `supabase/migrations/003_security_hardening.sql` |
| H2 | HIGH | Changed Referrer-Policy to `no-referrer` | `next.config.ts` |
| H4 | HIGH | Reordered rehype plugins: sanitize now runs LAST | `message-bubble.tsx`, `streaming-text.tsx`, `markdown-preview.tsx` |
| H5 | HIGH | Auth callback now handles exchange errors and redirects to login | `src/app/api/auth/callback/route.ts` |
