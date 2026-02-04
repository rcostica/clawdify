# DEV Pivot Report — BYOG + Install Guide

**Date:** 2026-02-04  
**Commit:** `3fefd65` — `refactor: pivot to BYOG + install guide (remove cloud deploy)`  
**Branch:** main  
**Author:** Razvan Costica

---

## Summary

Completed the product pivot from "deploy your agent to cloud" to "connect your agent, we provide the dashboard" (BYOG — Bring Your Own Gateway).

## Changes Made

### 1. Rewritten Deploy Page → Get Started / Install Guide
**Files:** `src/components/deploy/deploy-page.tsx`, `src/components/deploy/deploy-status.tsx`

- Replaced Railway/Fly.io/Docker deploy buttons with a clean 3-step install + connect guide
- **Section 1:** "Get Started in 60 Seconds" — `npm install -g openclaw` → `openclaw gateway start` → Connect to Clawdify
- **Section 2:** "Already running OpenClaw?" — link to /connect for existing Gateway
- **Section 3:** "Want always-on? Run on your server" — Docker command for self-hosting (documentation, not a deploy button)
- All commands have copy-to-clipboard buttons
- Renamed `DeployStatus` → `ConnectionStatus` with simpler connection steps (no "deploying container")

### 2. Route: /deploy → /get-started (PUBLIC)
**Files changed:**
- Deleted `src/app/(app)/deploy/page.tsx` (was behind auth)
- Created `src/app/(marketing)/get-started/page.tsx` (public, in marketing layout)
- Updated `src/lib/supabase/middleware.ts` — replaced `/deploy` with `/get-started` in publicPaths
- Updated `src/components/sidebar/sidebar.tsx` — link now goes to `/get-started`, icon changed from Rocket to Zap, label "Get Started"
- Updated `src/app/(app)/dashboard/page.tsx` — "Deploy Agent" → "Get Started" with Zap icon

### 3. Onboarding Wizard Rewrite
**File:** `src/components/onboarding/onboarding-wizard.tsx`

- **Removed** the "choose your path" step (Pro vs Free card selection)
- **New flow:** Welcome → Connect Gateway → Create Project → Done
- Everyone connects their own Gateway (BYOG-first for all tiers)
- Added "Don't have OpenClaw yet?" link to `/get-started` install guide
- Added "Skip for now" option on gateway connect step
- Added subtle Pro upsell on create-project step: "Unlock unlimited projects, notifications & analytics for $12/mo"
- Removed all "one-click deploy", "Railway", "Fly.io" language
- Removed `OnboardingPath` type (no longer needed — single path for all users)

### 4. Updated Plans/Pricing
**File:** `src/lib/billing/plans.ts`

- **Free tier:** 2 projects, basic dashboard, community support (removed "One-click deploy" from excluded features)
- **Pro tier ($12/mo):** Unlimited projects, notifications, analytics, priority support, team features (coming soon)
- Removed "BYOG or one-click deploy Gateway" from Pro features
- Changed Pro description from "Deploy-button agents" to "Full Mission Control"
- Updated `byog` plan features for consistency (added "Community support")

### 5. Cleaned Up All Deploy References
- `src/app/(marketing)/pricing/page.tsx` — updated metadata descriptions (removed "one-click deploy" and "deploy buttons")
- `src/app/api/billing/webhook/route.ts` — changed "accidentally deployed" → "accidentally exposed" in comment
- No remaining references to `/deploy` route, "Railway", "Fly.io", or "one-click deploy" outside of landing/ components

### 6. Removed Cloud Deploy Templates
- **Deleted:** `deploy-templates/railway.json`, `deploy-templates/fly.toml`
- **Kept:** `deploy-templates/Dockerfile`, `deploy-templates/entrypoint.sh` (useful for self-hosting documentation)

## Build Verification

- ✅ `npx tsc --noEmit` — passes (zero errors)
- ✅ `npx next build` — succeeds (20 static pages, all routes correct)
- ✅ `/get-started` route renders in marketing layout (public, no auth)
- ✅ `/deploy` route no longer exists
- ✅ Git push to `origin/main` successful

## Route Map (Post-Pivot)

| Route | Type | Description |
|-------|------|-------------|
| `/get-started` | Public (marketing) | Install + connect guide |
| `/connect` | App (auth) | Wire up existing Gateway |
| `/dashboard` | App (auth) | Mission Control home |
| `/pricing` | Public (marketing) | Plans comparison |

## Notes

- Landing page components in `src/components/landing/` were NOT touched (handled by separate agent, commit `ca04b65`)
- The `DeployPage` component name is kept internally but could be renamed to `GetStartedPage` in a future cleanup
- Sidebar ESLint warning about unused `Rocket` import was resolved (replaced with `Zap`)
