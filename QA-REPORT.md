# QA Report — Clawdify v2

**Date:** 2026-02-03  
**Auditor:** QA Subagent  
**Scope:** Full codebase audit + live site testing  

---

## Summary

| Category | Count |
|----------|-------|
| Critical (v1 architecture remnants) | 3 |
| Copy Issues | 1 |
| Code Quality Issues | 4 |
| Dead Code | 1 |
| Placeholder Links | 3 |
| Total | 12 |

The app is generally well-built. The main issues are **v1 Tailscale references** that contradict v2's relay-based architecture.

---

## Critical Issues (v1 Architecture Remnants)

### 1. Settings page: Entire Tailscale guidance card
- **File:** `src/app/(app)/settings/page.tsx`, lines 361-389
- **Issue:** Contains a full card titled "Connecting via Tailscale (Recommended)" with step-by-step Tailscale setup instructions. This is a v1 remnant — v2 uses a relay model, not direct Tailscale connections.
- **Fix:** Replace with a "Connection Help" card that describes the v2 relay model and self-hosted Gateway option without recommending Tailscale.

### 2. Settings page: Tailscale Serve in warning text
- **File:** `src/app/(app)/settings/page.tsx`, line 213
- **Issue:** Warning text says "Use wss:// (Tailscale Serve) for secure connections" — references v1's Tailscale approach.
- **Fix:** Change to "Use wss:// for secure connections."

### 3. README.md: Tailscale connection section
- **File:** `README.md`, lines 104-109
- **Issue:** "Connecting via Tailscale (Recommended)" section with Tailscale setup instructions. v1 remnant.
- **Fix:** Replace with v2 relay-oriented connection docs.

---

## Copy Issues

### 4. Landing page features: Tailscale mention
- **File:** `src/components/landing/features.tsx`, line 12
- **Issue:** "No VPN, no Tailscale, no port forwarding." — While this is actually correct messaging for v2 (you DON'T need Tailscale with the relay), mentioning Tailscale by name is awkward since most users won't know what it is.
- **Fix:** Change to "No VPN, no port forwarding, no complex setup."

---

## Code Quality Issues

### 5. Duplicate import module (dead code)
- **File:** `src/lib/gateway/importer.ts` (entire file)
- **Issue:** This file exports `fetchGatewaySessions` and `importSessions` — the exact same functions also exist in `src/lib/import-sessions.ts` with a different implementation. The app uses `src/lib/import-sessions.ts` (imported by `import-sessions-dialog.tsx`). `importer.ts` is dead code.
- **Fix:** Delete `src/lib/gateway/importer.ts`.

### 6. TODO comments in billing webhook
- **File:** `src/app/api/billing/webhook/route.ts`, lines 40, 48, 53
- **Issue:** Three TODO comments for Stripe integration. These are legitimate future work but should be tracked.
- **Fix:** Leave as-is (legitimate TODOs for when Stripe is integrated).

### 7. Placeholder footer links
- **File:** `src/components/landing/footer.tsx`
- **Issue:** Privacy and Terms links point to `#`. GitHub, Twitter, and Discord icons link to `#`.
- **Fix:** Leave as-is until real pages/URLs exist. Note for future.

### 8. BUILD-PLAN.md: ClawSpace references
- **File:** `BUILD-PLAN.md` (throughout)
- **Issue:** Title and many references still say "ClawSpace" — the old name before rebranding to "Clawdify".
- **Fix:** This is a historical build document. Update the title and first few references to avoid confusion, but keep as a reference doc.

---

## Live Site Testing

### Pages Tested
| Page | Status | Notes |
|------|--------|-------|
| `/` (landing) | ✅ 200 OK | All sections render correctly |
| `/login` | ✅ 200 OK | OAuth buttons (Google/GitHub) present |
| `/signup` | ✅ 200 OK | OAuth buttons present, password validation works |
| `/pricing` | ✅ 200 OK | All 3 tiers render correctly |
| `/dashboard` | ✅ Redirects to `/login` when unauthenticated | Correct behavior |
| `/settings` | ✅ Redirects to `/login` when unauthenticated | Correct behavior |
| `/connect` | ✅ Redirects to `/login` when unauthenticated | Correct behavior |

### Auth Flow
- Login page shows Google + GitHub OAuth buttons ✅
- Email/password form with validation ✅
- Signup page with password confirmation ✅
- Auth callback route handles code exchange ✅

### Landing Page Content
- All sections render: Hero, Features, Comparison, How It Works, Pricing, Testimonials, CTA, FAQ ✅
- Mobile nav hamburger menu ✅
- Dark mode support ✅
- "Clawdify" branding consistent throughout ✅
- No "ClawSpace" references on live site ✅

### Security
- CSP headers configured ✅
- X-Frame-Options: DENY ✅
- Referrer-Policy set ✅
- HSTS enabled ✅
- Token never in URL query params ✅
- Quick-connect handler strips tokens from URL ✅
- Markdown sanitization with rehype-sanitize ✅
- Sandboxed iframe for HTML previews ✅

---

## Files Audited (Complete List)

All 93 source files in `src/` were individually reviewed. The following contained no issues:
- All UI components (`src/components/ui/`) — shadcn defaults, clean
- All artifact components — proper security (sandboxed iframe, sanitize)
- All store files — proper Zustand patterns, security-conscious persistence
- Gateway client, types, device-identity, device-token — clean v2 implementation
- Auth pages, middleware, callback — clean
- Billing pages and API routes — clean (mocked Stripe, legitimate TODOs)
- Chat components — clean, proper security
- All lib files — clean

---

## Fixes Applied

1. ✅ Removed Tailscale guidance card from settings page
2. ✅ Updated insecure connection warning text (removed Tailscale Serve reference)
3. ✅ Updated README.md to remove Tailscale-specific connection section
4. ✅ Updated landing features copy (removed Tailscale name)
5. ✅ Deleted dead code: `src/lib/gateway/importer.ts`
6. ✅ Updated BUILD-PLAN.md title line
