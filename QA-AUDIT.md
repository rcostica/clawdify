# QA Audit — Clawdify Web App

**Auditor:** Senior QA Engineer (automated audit)  
**Date:** 2026-02-04  
**Scope:** Full codebase review — React anti-patterns, links, user flows, TypeScript, auth, config  
**TypeScript:** ✅ `npx tsc --noEmit` passes cleanly (0 errors)

---

## 🔴 CRITICAL — Will crash or break for users (P0)

### C-1. `useChat` hook creates new array reference every render — infinite re-render risk

**File:** `src/lib/gateway/hooks.ts`, line 112  
**What:** The `useChat` hook uses `?? []` inside a Zustand selector:
```ts
const messages = useChatStore(
  (s) => s.messagesByProject[projectId] ?? [],
);
```
When `messagesByProject[projectId]` is `undefined` (which it is for every new project before messages arrive), `?? []` creates a **new empty array on every render**. Since Zustand uses `Object.is()` for equality checks, a new `[]` !== the previous `[]`, so it triggers a re-render → new `[]` → re-render → **infinite loop**.

**Impact:** Any component using `useChat` for a project with no messages will enter an infinite re-render loop, freezing the browser tab.

**Fix:** Use a module-level stable empty array (same pattern already used in `project/[id]/page.tsx`):
```ts
const EMPTY_MESSAGES: ChatMessage[] = [];
// ...
const messages = useChatStore(
  (s) => s.messagesByProject[projectId] ?? EMPTY_MESSAGES,
);
```

**Note:** The project page (`project/[id]/page.tsx`) correctly defines `EMPTY_TASKS` and `EMPTY_ENTRIES` at module scope — this exact pattern should be replicated in `useChat`.

---

### C-2. Dashboard `useEffect` can cause infinite re-fetch loop

**File:** `src/app/(app)/dashboard/page.tsx`, lines 63–67  
**What:** The effect that loads tasks for all projects has `tasksByProject` as a dependency:
```ts
useEffect(() => {
  for (const project of projects) {
    if (!tasksByProject[project.id]) {
      loadTasks(project.id);
    }
  }
}, [projects, tasksByProject, loadTasks]);
```
Every call to `loadTasks(projectId)` updates `tasksByProject` in the store, which creates a new object reference, which re-triggers the effect. The `!tasksByProject[project.id]` guard only prevents the same project from being fetched twice, but the effect still re-runs on every `tasksByProject` change, potentially causing a cascade:

- 3 projects → `loadTasks(A)` completes → new `tasksByProject` ref → effect re-runs → checks B, C → `loadTasks(B)` completes → re-runs → checks C → etc.

This is O(n²) effect runs for n projects, and worse, each `loadTasks` is async so multiple may be in-flight.

**Fix:** Remove `tasksByProject` from deps and track loaded project IDs in a ref:
```ts
const loadedRef = useRef<Set<string>>(new Set());
useEffect(() => {
  for (const project of projects) {
    if (!loadedRef.current.has(project.id)) {
      loadedRef.current.add(project.id);
      loadTasks(project.id);
    }
  }
}, [projects, loadTasks]);
```

---

### C-3. `/privacy` and `/terms` pages redirect unauthenticated users to login

**File:** `src/lib/supabase/middleware.ts`, line 4  
**What:** The `publicPaths` array only includes:
```ts
const publicPaths = ['/login', '/signup', '/api/auth/callback', '/pricing'];
```
The marketing pages `/privacy` and `/terms` are **not included**. Since these routes are under the `(marketing)` layout group, they should be publicly accessible. But the middleware redirects any unauthenticated visitor to `/login`.

**Impact:** Anyone not logged in who clicks "Privacy" or "Terms" in the footer gets redirected to the login page. This is legally problematic — privacy policies and terms of service must be publicly accessible.

**Fix:** Add the missing paths:
```ts
const publicPaths = ['/login', '/signup', '/api/auth/callback', '/pricing', '/privacy', '/terms'];
```

---

## 🟠 HIGH — Bad UX or broken features (P1)

### H-1. "Create First Project" button on dashboard does nothing

**File:** `src/app/(app)/dashboard/page.tsx`, line 128  
**What:** The dashboard has a "Create First Project" button that tries:
```ts
document.querySelector<HTMLButtonElement>('[data-new-project]')?.click();
```
But **no element in the entire codebase** has a `data-new-project` attribute. The `NewProjectDialog` trigger button in the sidebar doesn't set this attribute.

**Impact:** New users who follow the CTA on the dashboard get no response — the button silently fails.

**Fix:** Either add `data-new-project` attribute to the `NewProjectDialog` trigger button, or better, lift the dialog state up and call it programmatically.

---

### H-2. Footer social links are all placeholder `#` hrefs

**File:** `src/components/landing/footer.tsx`, lines 65, 75, 85  
**What:** GitHub, Twitter/X, and Discord social links all use `href="#"`:
```tsx
<a href="#" ...>GitHub</a>
<a href="#" ...>Twitter</a>
<a href="#" ...>Discord</a>
```

**Impact:** Clicking any social link scrolls to the top of the page instead of going to the actual social profiles. Looks broken and unprofessional on a public landing page.

**Fix:** Replace with actual URLs or remove the links entirely:
```tsx
<a href="https://github.com/openclaw" ...>GitHub</a>
```

---

### H-3. `CommandPalette` props are never wired — "New Project" and "Import" commands do nothing

**File:** `src/app/(app)/layout.tsx`, line 15; `src/components/command-palette.tsx`  
**What:** The `CommandPalette` component accepts `onNewProject` and `onImport` props, but it's mounted in the layout without any props:
```tsx
<CommandPalette />
```
When a user opens the command palette (⌘K) and selects "New Project" or "Import from Gateway", it calls `onNewProject?.()` and `onImport?.()` — both undefined, so nothing happens.

**Impact:** Two of the four main commands in the palette silently fail. The ⌘N keyboard shortcut also does nothing for the same reason.

**Fix:** Wire up the props in the layout, either by lifting dialog state or using a Zustand store for dialog visibility.

---

### H-4. Login and signup redirect to `/` instead of `/dashboard`

**File:** `src/app/(auth)/login/page.tsx`, line 78; `src/app/(auth)/signup/page.tsx`, line 92; `src/app/api/auth/callback/route.ts`, line 30  
**What:** After successful authentication, all three auth flows redirect to `/`:
```ts
router.push('/');  // login & signup
return NextResponse.redirect(`${origin}/`);  // OAuth callback
```
The middleware then catches authenticated users at `/` and redirects them to `/dashboard`, causing a double redirect.

**Impact:** Users see a flash/blank screen during the intermediate redirect. Minor latency hit (two server round-trips instead of one).

**Fix:** Redirect directly to `/dashboard`:
```ts
router.push('/dashboard');
// and
return NextResponse.redirect(`${origin}/dashboard`);
```

---

### H-5. Pro onboarding path doesn't actually persist API keys

**File:** `src/components/onboarding/onboarding-wizard.tsx`, lines 164-181  
**What:** The `handleValidateApiKey` function does mock validation (checks key prefix), sets state in the user store, and shows a toast. But **the API key itself is never saved to Supabase** or any backend. It's only held in the `apiKey` component state, which is lost on navigation or refresh.

**Impact:** Users who go through the Pro onboarding flow and enter their API key will think it's saved. But after closing the wizard, the key is gone. They'd need to configure it again somewhere (but there's no API key field in the Settings page either).

**Fix:** Save the API key to Supabase via an RPC call (like `save_api_key`), or at minimum, make it clear in the UI that key management happens on the Gateway, not in Clawdify.

---

### H-6. Billing page shows hardcoded mock payment card data

**File:** `src/app/(app)/settings/billing/page.tsx`, lines approximately 115-125  
**What:** For non-free plan users, the billing page shows:
```
•••• •••• •••• 4242
Expires 12/2027 · Mock payment method
```
This is hardcoded mock data that will confuse real users.

**Impact:** Paying users see fake credit card info, which damages trust and looks broken.

**Fix:** Either hide the payment method section until Stripe is integrated, or show a "No payment method on file" message with a CTA to set one up.

---

### H-7. Task cancellation doesn't abort the Gateway agent

**File:** `src/app/(app)/project/[id]/page.tsx`, `handleCancelTask` callback (line ~222)  
**What:** When cancelling a task, the code updates Supabase status and adds an activity entry, but never calls `abortGeneration()` (available from `useChat`) to actually stop the agent from working through the Gateway.

**Impact:** The task shows as "cancelled" in the UI, but the agent continues working on it in the background, wasting API tokens and potentially producing confusing results.

**Fix:** Add `abortGeneration()` call before updating status:
```ts
const handleCancelTask = useCallback(async (taskId: string) => {
  try {
    // Actually abort the agent
    const task = tasks.find(t => t.id === taskId);
    if (task?.runId && isConnected) {
      try { await abortGeneration(); } catch {}
    }
    await cancelTask(taskId);
    // ... rest of handler
  }
}, [/* ... */]);
```

---

### H-8. No "Forgot Password" link on login page

**File:** `src/app/(auth)/login/page.tsx`  
**What:** The login form has email/password fields but no "Forgot Password" / password reset link.

**Impact:** Users who forget their password have no way to recover their account through the UI.

**Fix:** Add a "Forgot Password" link below the password field, and implement a password reset flow using `supabase.auth.resetPasswordForEmail()`.

---

## 🟡 MEDIUM — Cosmetic or minor issues (P2)

### M-1. `GatewayStore.setStatus('error')` silently clears error message

**File:** `src/stores/gateway-store.ts`, line 39  
**What:**
```ts
setStatus: (status) => set({
  status,
  errorMessage: status === 'error' ? undefined : null,
}),
```
When `setStatus('error')` is called, it sets `errorMessage` to `undefined` instead of leaving it unchanged. This means if you call `setError('msg')` first and then `setStatus('error')`, the error message gets wiped.

**Fix:**
```ts
setStatus: (status) => set({
  status,
  ...(status !== 'error' ? { errorMessage: null } : {}),
}),
```

---

### M-2. Entire `src/components/chat/` directory is dead code

**Files:** `src/components/chat/` (9 files: `message-input.tsx`, `message-list.tsx`, `message-bubble.tsx`, `streaming-text.tsx`, `thinking-indicator.tsx`, `voice-recorder.tsx`, `link-preview.tsx`, `message-search.tsx`, `tool-call-card.tsx`, `file-upload.tsx`)  
**What:** After the pivot from chat-based to task-based UI, the entire `chat/` directory is unused. No page or layout imports from it. The files only import from each other.

**Impact:** Dead code increases bundle size and maintenance burden. No runtime impact.

**Fix:** Remove the directory or mark it clearly as unused (e.g., move to `_archive/`).

---

### M-3. Onboarding completion check uses only `localStorage`, not synced state

**File:** `src/components/onboarding/onboarding-wizard.tsx`, lines 54-57  
**What:** `shouldShowOnboarding()` only checks `localStorage.getItem(ONBOARDING_KEY)`. The user store also has `onboardingCompleted` persisted via Zustand persist, but these two are not synced.

**Impact:** Users who clear browser data or use a new device will see the onboarding wizard again, even if they completed it before. The Zustand persist storage (`clawdify-user`) might also be out of sync with the `clawdify-onboarding-completed` localStorage key.

**Fix:** Check both localStorage and the Zustand user store, or remove the duplicate key and use only one source of truth.

---

### M-4. `createClient()` called at render-time in Settings page

**File:** `src/app/(app)/settings/page.tsx`, line 55  
**What:**
```ts
const supabase = createClient();
```
This creates a new Supabase client instance on every render. While `createBrowserClient` is likely memoized internally by `@supabase/ssr`, it's still a code smell and against React best practices.

**Fix:** Move into a `useMemo` or call it inside the effect/handler where it's needed.

---

### M-5. Onboarding wizard auto-redirect has missing dependency

**File:** `src/components/onboarding/onboarding-wizard.tsx`, line 132  
**What:**
```ts
useEffect(() => {
  if (step === 'done') {
    doneTimerRef.current = setTimeout(() => {
      finishOnboarding();
    }, 2000);
  }
  // ...
}, [step]); // eslint-disable-line react-hooks/exhaustive-deps
```
`finishOnboarding` is in the closure but not in the deps. The eslint-disable hides this. If `finishOnboarding` changes (e.g., due to `path` or `setOnboardingPath` changing), the stale reference will be used.

**Fix:** Add `finishOnboarding` to deps or use a ref for it.

---

### M-6. RPC error not handled in onboarding gateway save

**File:** `src/components/onboarding/onboarding-wizard.tsx`, ~line 197  
**What:** When saving gateway credentials during onboarding:
```ts
await supabase.rpc('save_gateway_connection', { ... });
```
The return value is not checked for errors. If the RPC fails, the user thinks they saved but they didn't.

**Fix:** Check `{ error }` and show a toast on failure.

---

### M-7. `insecureAuth` setting not persisted when loading from Supabase

**File:** `src/stores/gateway-store.ts`, `loadFromSupabase` method  
**What:** When loading the saved connection from Supabase, only `url` and `token` are restored. The `insecureAuth` flag is lost.

**Impact:** Users who enabled "Allow insecure auth" during connection setup will find the setting reset after page reload.

**Fix:** Store and load `insecureAuth` from Supabase alongside the other connection fields.

---

### M-8. Pricing table CTA says "Start Pro Trial" but no trial exists

**File:** `src/components/landing/pricing-table.tsx`  
**What:** The Pro tier's CTA button text is `"Start Pro Trial"`, but the app has no trial functionality — clicking it goes directly to `/signup`.

**Impact:** Sets incorrect expectations. Users may expect a free trial period that doesn't exist.

**Fix:** Change to `"Get Started"` or `"Sign Up for Pro"`.

---

### M-9. `detectedArtifacts` useEffect guard can cause stale state

**File:** `src/app/(app)/project/[id]/page.tsx`, lines 108-112  
**What:**
```ts
useEffect(() => {
  if (detectedArtifacts.length > 0 || allArtifacts.length > 0) {
    setAllArtifacts(detectedArtifacts);
  }
}, [detectedArtifacts]);
```
When artifacts are present and then the message with artifacts is deleted, `detectedArtifacts` becomes `[]` but the guard prevents updating `allArtifacts` to `[]` because `allArtifacts.length > 0` is checked but `allArtifacts` is not in the dependency array.

**Fix:** Simply set the artifacts unconditionally:
```ts
useEffect(() => {
  setAllArtifacts(detectedArtifacts);
}, [detectedArtifacts]);
```

---

### M-10. No loading skeleton for dashboard

**File:** `src/app/(app)/dashboard/page.tsx`  
**What:** The dashboard doesn't show any loading state while projects and tasks are being fetched. Users see the empty state flash before content loads.

**Fix:** Show a skeleton UI when `loading` is true from the project store.

---

### M-11. Anchor links on landing page don't account for fixed header

**File:** `src/components/landing/nav.tsx`, various landing components  
**What:** The nav header is `fixed top-0` with `h-16`. Anchor links like `#features` and `#how-it-works` will scroll the section title under the fixed header.

**Fix:** Add `scroll-mt-20` class to the section elements or add `scroll-padding-top: 5rem` to the html element.

---

### M-12. Usage display hardcoded token limits are misleading for BYOG users

**File:** `src/components/billing/usage-display.tsx`, lines ~85-86  
**What:**
```ts
const usageCap = plan === 'free' ? 500_000 : plan === 'pro' ? 5_000_000 : 10_000_000;
```
For BYOG users, Clawdify doesn't actually track usage (tokens go through the user's own Gateway). Showing a fake usage bar with arbitrary limits is misleading.

**Fix:** Show a different message for BYOG users: "Usage tracking not available for self-hosted Gateways."

---

## 🟢 LOW — Nice to fix but not urgent (P3)

### L-1. `useKeyboardShortcuts` hook exists but is unused

**File:** `src/hooks/use-keyboard-shortcuts.ts`  
**What:** This hook is defined but never imported anywhere. The command palette implements its own keyboard handling.

**Fix:** Remove the file, or refactor the command palette to use it.

---

### L-2. `Bot` icon imported but unused in connection status

**File:** `src/components/sidebar/connection-status.tsx`, line 5  
**What:** `Bot` is imported from `lucide-react` but never used in the component.

**Fix:** Remove the unused import.

---

### L-3. Mobile sidebar hamburger may overlap page content

**File:** `src/app/(app)/layout.tsx`  
**What:** The hamburger button is `fixed left-2 top-2 z-40 md:hidden`, but page content doesn't have corresponding top padding on mobile. This means the button overlaps the first few pixels of content on pages like Dashboard and Settings.

**Fix:** Add `pt-12 md:pt-0` to the main content area on mobile.

---

### L-4. Docker image path should be verified

**File:** `src/components/deploy/deploy-page.tsx`  
**What:** The Docker command references `ghcr.io/openclaw/gateway:latest`. This should be verified as the correct and publicly available image path.

**Fix:** Verify the Docker image exists and is pullable. Update if the path has changed.

---

### L-5. Stripe integration placeholders may confuse developers

**File:** `src/lib/billing/stripe.ts`  
**What:** The entire Stripe client is mocked. Functions like `createCheckoutSession` log to console and return fake data. `verifyWebhookSignature` always returns `true`.

**Impact:** No user impact (this is clearly marked as mocked), but `console.log` in production code is a security concern — it logs user IDs and email addresses.

**Fix:** Remove or gate the `console.log` calls behind a `NODE_ENV !== 'production'` check.

---

### L-6. `.env.local.example` is missing Stripe env vars

**File:** `.env.local.example`  
**What:** The example env file doesn't include `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`, which are referenced in the codebase.

**Fix:** Add them as commented-out optional vars:
```
# Stripe (optional — not yet implemented)
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

---

### L-7. `persistMessage` function in `messages.ts` is never called

**File:** `src/lib/messages.ts`, line 4  
**What:** The `persistMessage` function is exported but never imported or called anywhere in the codebase. Messages are only persisted during import (`import-sessions.ts`).

**Fix:** Either integrate it into the chat flow (call it when messages are finalized) or remove it.

---

### L-8. Testimonials section uses made-up quotes

**File:** `src/components/landing/testimonials.tsx`  
**What:** The "testimonials" are clearly fabricated quotes attributed to generic personas ("Freelance developers", "Side-project builders"). This is fine for beta but could damage credibility.

**Fix:** Replace with real testimonials from beta users, or relabel the section as "Use Cases" instead of implying real quotes.

---

### L-9. `plan-selector.tsx` badge condition doesn't match plan data

**File:** `src/components/billing/plan-selector.tsx`, line ~73  
**What:** Checks `plan.badge === 'Popular'` but the actual badge in plans.ts is `'Most Popular'`.

**Impact:** The badge highlight styling never triggers for the Pro plan card in the selector.

**Fix:** Change condition to `plan.badge === 'Most Popular'` or update the plan data.

---

### L-10. CSP `script-src 'unsafe-inline'` weakens security

**File:** `next.config.ts`  
**What:** The Content-Security-Policy includes `script-src 'self' 'unsafe-inline'`. This defeats most of the XSS protection that CSP provides.

**Impact:** Next.js requires it for inline scripts in development, but in production, nonce-based CSP would be more secure.

**Fix:** Use nonce-based CSP in production (Next.js 13+ supports this with `experimental.appDocumentPreloading`).

---

## Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| 🔴 CRITICAL (P0) | 3 | Re-render loop in useChat, dashboard fetch loop, public pages blocked |
| 🟠 HIGH (P1) | 8 | Dead "Create Project" button, placeholder links, broken commands, no forgot password |
| 🟡 MEDIUM (P2) | 12 | Dead code, stale state, mock data shown, missing error handling |
| 🟢 LOW (P3) | 10 | Unused code, minor security, cosmetic issues |
| **Total** | **33** | |

### Priority Recommendation
1. **Fix C-1 immediately** — the `useChat` `?? []` will crash production for any user who opens a project page
2. **Fix C-3 next** — legal pages must be publicly accessible
3. **Fix C-2 and H-1** — dashboard experience is broken for new users
4. **Then H-3 through H-8** — these are all "user tries a feature and nothing happens" bugs
