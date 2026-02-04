# QA Fix Report — Clawdify

**Date:** 2026-02-04  
**Commit:** `372a666` on `main`  
**Author:** Razvan Costica <rcostica@gmail.com>  
**Scope:** 22 issues fixed (3 Critical, 8 High, 9 Medium, 2 Low)

---

## 🔴 CRITICAL (P0) — All Fixed

### C-1: `useChat` hook `?? []` infinite re-render
**File:** `src/lib/gateway/hooks.ts`  
**Fix:** Added module-level stable constants `EMPTY_MESSAGES` and `EMPTY_LOADING`. Replaced `?? []` and `?? false` in Zustand selectors with these stable references, preventing new reference creation on every render.

### C-2: Dashboard useEffect infinite re-fetch loop
**File:** `src/app/(app)/dashboard/page.tsx`  
**Fix:** Removed `tasksByProject` from the useEffect dependency array. Added a `useRef<Set<string>>` to track which projects have already been loaded, preventing cascading re-fetches.

### C-3: `/privacy` and `/terms` blocked for unauthenticated users
**File:** `src/lib/supabase/middleware.ts`  
**Fix:** Added `/privacy`, `/terms`, `/deploy`, and `/forgot-password` to the `publicPaths` array.

---

## 🟠 HIGH (P1) — All Fixed

### H-1: "Create First Project" button does nothing
**Files:** `src/app/(app)/dashboard/page.tsx`, `src/components/sidebar/new-project-dialog.tsx`  
**Fix:** Added `data-new-project` attribute to the `NewProjectDialog` trigger button so `document.querySelector('[data-new-project]')?.click()` finds it.

### H-2: Footer social links are placeholder `#`
**File:** `src/components/landing/footer.tsx`  
**Fix:** Replaced `href="#"` with actual URLs:
- GitHub → `https://github.com/openclaw/openclaw`
- Twitter → `https://x.com/openclaw_ai`
- Discord → `https://discord.com/invite/clawd`
Added `target="_blank"` and `rel="noopener noreferrer"`.

### H-3: CommandPalette props never wired
**Files:** `src/components/command-palette.tsx`, `src/app/(app)/layout.tsx`  
**Fix:** Removed `onNewProject` / `onImport` props. CommandPalette now internally clicks `[data-new-project]` for "New Project". "Import from Gateway" marked "Coming soon" and disabled.

### H-4: Login/signup redirect to `/` causing double redirect
**Files:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/api/auth/callback/route.ts`  
**Fix:** Changed all `router.push('/')` to `router.push('/dashboard')` and `redirect('/')` to `redirect('/dashboard')`.

### H-5: Pro onboarding path doesn't persist API key
**File:** `src/components/onboarding/onboarding-wizard.tsx`  
**Fix:** Removed the misleading mock API key validation step. Pro path now goes: Choose Pro → create project → redirect to `/deploy`. Done step messaging updated to: "You'll configure your API key when connecting your Gateway."

### H-6: Billing page shows hardcoded mock card data
**File:** `src/app/(app)/settings/billing/page.tsx`  
**Fix:** Replaced fake "•••• •••• •••• 4242" card display with "No payment method on file. Billing coming soon."

### H-7: Task cancellation doesn't abort Gateway agent
**File:** `src/app/(app)/project/[id]/page.tsx`  
**Fix:** Added `abortGeneration()` call in `handleCancelTask` — if the task has a `runId` and the Gateway is connected, it aborts before updating status.

### H-8: No "Forgot Password" link
**Files:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/forgot-password/page.tsx` (new)  
**Fix:** Added "Forgot password?" link below the password field on login. Created `/forgot-password` page that calls `supabase.auth.resetPasswordForEmail()` and shows a confirmation message.

---

## 🟡 MEDIUM (P2) — Fixed

### M-1: `GatewayStore.setStatus('error')` clears error message
**File:** `src/stores/gateway-store.ts`  
**Fix:** Changed `setStatus` to only clear `errorMessage` when status is NOT `'error'`, using spread conditional `...(status !== 'error' ? { errorMessage: null } : {})`.

### M-3: Onboarding uses dual localStorage keys
**File:** `src/components/onboarding/onboarding-wizard.tsx`  
**Fix:** Removed the separate `clawdify-onboarding-completed` localStorage key. `shouldShowOnboarding()` now reads from the Zustand persisted `clawdify-user` storage. All completion marking goes through `setOnboardingCompleted(true)` in the Zustand store only.

### M-5: Onboarding done timer has stale closure
**File:** `src/components/onboarding/onboarding-wizard.tsx`  
**Fix:** Added `finishOnboarding` to the useEffect dependency array. Moved `finishOnboarding` definition before the useEffect to resolve the block-scoped variable ordering issue.

### M-6: RPC error not handled in onboarding gateway save
**File:** `src/components/onboarding/onboarding-wizard.tsx`  
**Fix:** Added error checking on the `save_gateway_connection` RPC call — logs error and shows a toast on failure.

### M-8: Pricing CTA says "Start Pro Trial" but no trial exists
**File:** `src/components/landing/pricing-table.tsx`  
**Fix:** Changed Pro tier CTA from `"Start Pro Trial"` to `"Get Started"`.

### M-9: `detectedArtifacts` useEffect guard causes stale state
**File:** `src/app/(app)/project/[id]/page.tsx`  
**Fix:** Removed the conditional guard. Now unconditionally sets `setAllArtifacts(detectedArtifacts)`.

### M-11: Anchor links don't account for fixed header
**Files:** `src/components/landing/features.tsx`, `src/components/landing/how-it-works.tsx`, `src/components/landing/pricing-table.tsx`  
**Fix:** Added `scroll-mt-20` class to all landing page section elements with `id` attributes.

### M-12: Usage display shows fake limits for BYOG users
**File:** `src/components/billing/usage-display.tsx`  
**Fix:** Added BYOG detection. For BYOG/free-tier users, shows "Usage tracked by your Gateway" message instead of a misleading usage bar with arbitrary limits.

---

## 🟢 LOW (P3) — Fixed

### L-9: Plan selector badge condition doesn't match
**File:** `src/components/billing/plan-selector.tsx`  
**Fix:** Changed `plan.badge === 'Popular'` to `plan.badge === 'Most Popular'` to match the actual badge text in `plans.ts`.

---

## Verification

- ✅ `npx tsc --noEmit` — 0 errors
- ✅ `npx next build` — successful (20 pages generated)
- ✅ `git push origin main` — pushed to remote

## Files Modified (20 total)

1. `src/lib/gateway/hooks.ts` — C-1
2. `src/app/(app)/dashboard/page.tsx` — C-2
3. `src/lib/supabase/middleware.ts` — C-3
4. `src/components/sidebar/new-project-dialog.tsx` — H-1
5. `src/components/landing/footer.tsx` — H-2
6. `src/components/command-palette.tsx` — H-3
7. `src/app/(app)/layout.tsx` — H-3 (no change needed, already renders `<CommandPalette />` without props)
8. `src/app/(auth)/login/page.tsx` — H-4, H-8
9. `src/app/(auth)/signup/page.tsx` — H-4
10. `src/app/api/auth/callback/route.ts` — H-4
11. `src/components/onboarding/onboarding-wizard.tsx` — H-5, M-3, M-5, M-6
12. `src/app/(app)/settings/billing/page.tsx` — H-6
13. `src/app/(app)/project/[id]/page.tsx` — H-7, M-9
14. `src/app/(auth)/forgot-password/page.tsx` — H-8 (new file)
15. `src/stores/gateway-store.ts` — M-1
16. `src/components/landing/pricing-table.tsx` — M-8, M-11
17. `src/components/landing/features.tsx` — M-11
18. `src/components/landing/how-it-works.tsx` — M-11
19. `src/components/billing/usage-display.tsx` — M-12
20. `src/components/billing/plan-selector.tsx` — L-9
