# Clawdify — UX/UI Audit Report

**Reviewer:** Senior UX/UI Design Consultant  
**Date:** 2026-02-03  
**Product Version:** Pre-launch (Open Beta)  
**Stack:** Next.js 15, Tailwind CSS v4, shadcn/ui, Zustand, Supabase  

---

## Executive Summary

Clawdify is a well-architected AI workspace with a clear design language, solid component library, and thoughtful security posture. The violet/indigo brand identity is consistent and premium. The codebase demonstrates competence — responsive layouts, dark mode, loading states, and error handling are present across most surfaces.

However, several critical UX issues need attention before launch: the onboarding wizard has a confusing pricing model mismatch with the landing page, the chat empty state suggestions are non-functional, mobile sidebar accessibility is incomplete, and the emoji picker lacks focus trapping. The product also has significant gaps in form validation feedback and keyboard navigation.

**Overall UX Score: 7.0 / 10**

---

## 1. Information Architecture

**Score: 7 / 10**

### What Works Well
- **Clean page hierarchy:** Marketing (`/`) → Auth (`/login`, `/signup`) → App (`/dashboard`, `/project/[id]`, `/settings`, `/connect`) is logical and industry-standard.
- **Sidebar navigation** is well-structured: brand header → new project action → project list → connection status → settings/footer. This follows established SaaS patterns.
- **Command palette** (`⌘K`) provides power-user discoverability for projects, settings, and theme switching.
- **Settings page** has a focused scope — Gateway connection + account — avoiding settings overload.

### Critical Issues

1. **Duplicate navigation destinations for connection management.** The sidebar exposes both "Connection" (`/connect`) and "Settings" (`/settings`) links, but the Settings page *also* contains the full Gateway connection form. A user's mental model gets fractured: "Where do I go to fix my connection?" The Connect page is diagnostic-only (read-only status checks), but a user doesn't know that until they visit both.
   - **Recommendation:** Merge `/connect` into `/settings` as a collapsible "Diagnostics" section, or add a clear "Edit Connection" CTA on the Connect page that links to Settings. Remove the duplicate sidebar "Connection" link, or rename it to "Diagnostics" / "Connection Health" to differentiate.

2. **No breadcrumb or page title on mobile.** When the sidebar is collapsed on mobile, the user sees the hamburger menu and the page content — but `/settings`, `/connect`, and `/settings/billing` lack clear top-level context about where they are. The billing page has a back arrow (good), but settings and connect pages don't indicate they're sub-pages.
   - **Recommendation:** Add a consistent top bar on mobile that shows "← Settings" / "← Connection" with the hamburger menu.

### Improvements

3. **Landing page navigation anchor links.** The nav links "Features" and "Docs" use `#features` and `#` respectively. The "Docs" link goes nowhere (`href="#"`). Footer has the same issue: Changelog, Docs, About, Blog, Careers, Contact, Privacy, Terms, Security all link to `#`.
   - **Recommendation:** Either create those pages or remove/disable the links. Dead links erode trust on a marketing site. At minimum, link Docs to a placeholder "Coming Soon" page.

4. **No search within settings.** As the product grows, settings will expand. The current single-page approach works now but won't scale.
   - **Recommendation (nice-to-have):** Plan for a settings nav sidebar as features grow.

---

## 2. Onboarding Flow

**Score: 8 / 10**

### What Works Well
- **Three-path wizard** (Free / Pro / Self-Hosted) is clear, well-differentiated, and visually appealing. The card-based selection with badges, emoji icons, and feature tags is excellent.
- **Progress dots** at the top provide clear step-tracking with animated transitions.
- **Contextual back navigation** at every step — the back button returns to the correct previous step based on the chosen path.
- **"Done" step auto-redirect** with a 2-second delay and visual celebration (animated checkmark) feels polished.
- **Skip functionality** — closing the dialog at any point marks onboarding as complete. This respects user autonomy.
- **Security-conscious design:** API keys show encryption reassurance text, tokens use password fields with toggle.

### Critical Issues

5. **Pricing mismatch between landing page and onboarding.** The landing page `PricingTable` shows three tiers: Free ($0), Pro ($15/mo), Team ($25/seat/mo). The onboarding wizard shows: Free, Pro ($15/mo), Self-Hosted (BYOG). "Self-Hosted" doesn't appear on the pricing page, and "Team" doesn't appear in onboarding. This will confuse users who read pricing before signing up.
   - **Recommendation:** Align the onboarding paths with the pricing tiers. Either add a "Self-Hosted" tier to the pricing page, or include it as a variant of Pro. The "Team" tier can remain as "Coming Soon" in both places.

6. **Pro setup "Clawdify credits" option is disabled with no timeline.** Showing a disabled "Coming Soon" option during onboarding creates friction and disappointment. A new user who chose Pro may not want to bring their own API key.
   - **Recommendation:** Either remove the credits option from onboarding until it's ready, or provide a waitlist signup. Don't show broken paths during first-run experience.

### Improvements

7. **Onboarding state is stored in localStorage only** (`clawdify-onboarding-completed`). If a user clears their browser data or switches devices, they'll see onboarding again. This is jarring for returning users.
   - **Recommendation:** Persist onboarding completion in Supabase user metadata, and use localStorage only as a fast cache.

8. **No skip button visible on the "Welcome" step.** The user can only proceed forward or close the dialog (X button). Adding a "Skip setup" text link would be more discoverable than relying on the dialog close button.

9. **Gateway connection step in onboarding doesn't offer guidance on *getting* a Gateway.** A new user choosing "Self-Hosted" might not have a Gateway running yet. The step jumps straight to "Enter your URL and token."
   - **Recommendation:** Add a brief intro with links: "Don't have a Gateway yet? [Install OpenClaw →]" before the connection form.

---

## 3. Layout & Visual Hierarchy

**Score: 8 / 10**

### What Works Well
- **Hero section** is visually striking with layered gradient blobs, animated badge, gradient text, and a beautifully crafted product mockup. The visual hierarchy is clear: badge → headline → subtext → CTAs → mockup.
- **Consistent card-based layouts** throughout: Features grid, pricing cards, settings cards, billing cards. The shadcn/ui Card component provides uniform structure.
- **Chat interface** has a clean layout with proper visual hierarchy: header (project info + status) → messages → input. The `max-w-3xl` message container prevents overly wide text.
- **Dark mode** is well-implemented with consistent use of Tailwind's `dark:` variants and CSS custom properties. The `bg-card/50`, `bg-muted/30` opacity patterns create depth.
- **Whitespace** is generally well-used: `py-24 md:py-32` for landing sections, `space-y-6` for settings cards, `gap-6` for grids.

### Critical Issues

10. **Pricing card scale transform breaks layout flow.** The Pro card uses `scale-[1.02]` which overlaps adjacent cards slightly. On mobile (single column), this is fine, but on desktop the overlap can cause visual clipping issues.
    - **Recommendation:** Use `ring` or `shadow` emphasis instead of `scale` for the highlighted card, or add padding to the grid to accommodate the scale.

### Improvements

11. **Feature cards on landing page could benefit from visual anchoring.** The 8-card grid (4 columns on desktop) with emoji icons works but lacks visual weight. All cards look the same — nothing draws the eye to the most important features.
    - **Recommendation:** Make the top 2-3 features visually distinct (larger cards, illustrations, or a featured row) before the remaining 5-6 in a tighter grid.

12. **Settings page Gateway info block** (when connected) uses very small text (`text-xs`) with dense technical details. This is appropriate for developers but could overwhelm non-technical users.
    - **Recommendation:** Show a simplified "Connected ✓" summary by default, with an expandable "Technical Details" section.

13. **Billing page's mock payment method** (`•••• •••• •••• 4242`) could confuse beta users into thinking they've been charged.
    - **Recommendation:** Add a clear "Demo data" badge or remove the payment method section entirely until Stripe is live.

---

## 4. Component Consistency

**Score: 8 / 10**

### What Works Well
- **shadcn/ui foundation** ensures buttons, cards, inputs, dialogs, badges, tooltips, and dropdowns are visually consistent throughout.
- **Icon usage** is consistent — Lucide icons everywhere, appropriate sizes (`h-4 w-4` for inline, `h-5 w-5` for headers).
- **Loading states** use `Loader2` with `animate-spin` consistently across all async actions (login, signup, project creation, gateway testing, import, billing).
- **Color system** is coherent: violet/indigo brand, green for success, yellow for warnings, red for errors/destructive actions.
- **Button variants** are used appropriately: `default` for primary actions, `outline` for secondary, `ghost` for tertiary, `destructive` for dangerous actions.

### Improvements

14. **Inconsistent emoji picker implementations.** `NewProjectDialog` and `OnboardingWizard` both have emoji pickers with different emoji sets and slightly different styling. The wizard uses `cn()` for selection state; the dialog uses template literals.
    - **Recommendation:** Extract a shared `<EmojiPicker>` component with a configurable emoji set. Use the same selection styling pattern.

15. **Color picker in NewProjectDialog uses raw `style` attribute** for `backgroundColor`. This works but doesn't integrate with the theme system. The selected color dot uses `ring-2 ring-offset-2 ring-primary scale-110` — good, but `ring-offset` won't adapt to the sidebar's different background color.
    - **Recommendation:** Add `ring-offset-background` or `ring-offset-sidebar` to ensure the ring offset matches the actual background.

16. **Inconsistent "secure" messaging.** The settings page says "Tokens are encrypted and stored securely in Supabase." The onboarding wizard says "Your key is encrypted and stored securely. Never stored in the browser." The messaging is correct but phrased differently, which may cause users to question whether the same security applies everywhere.
    - **Recommendation:** Use a single, standardized security message component or string constant.

---

## 5. Mobile Responsiveness

**Score: 7 / 10**

### What Works Well
- **Mobile sidebar** is implemented via shadcn's `Sheet` component with slide-from-left animation. The `md:hidden` hamburger trigger and `hidden md:flex` desktop sidebar pattern is correct.
- **Landing page** uses responsive breakpoints: `text-4xl sm:text-5xl md:text-6xl lg:text-7xl` for the hero, `sm:grid-cols-2 lg:grid-cols-4` for features, `md:grid-cols-3` for pricing.
- **Auth pages** use `max-w-md` cards centered with `min-h-screen` — these work well on any screen size.
- **Chat message input** has a full-width textarea that adapts to mobile.
- **Billing stats grid** uses `grid-cols-1 sm:grid-cols-3` — proper mobile stacking.

### Critical Issues

17. **Mobile sidebar hamburger button has no accessible label.** The `<Button variant="ghost" size="icon">` with just a `<Menu>` icon lacks `aria-label` or `<span className="sr-only">`.
    - **Component:** `src/app/(app)/layout.tsx`, line ~35
    - **Recommendation:** Add `aria-label="Open navigation menu"` to the hamburger button.

18. **SheetContent for mobile sidebar has no accessible title.** shadcn's Sheet requires a `SheetTitle` (or `aria-label` on `SheetContent`) for screen readers. Without it, the dialog announces as unlabeled.
    - **Component:** `src/app/(app)/layout.tsx`
    - **Recommendation:** Add a visually-hidden `<SheetTitle>` inside `SheetContent`, or add `aria-label="Navigation"` to the Sheet.

19. **Emoji picker in chat input is positioned `absolute bottom-full left-0`** which may overflow the viewport on mobile, especially in landscape orientation.
    - **Component:** `src/components/chat/message-input.tsx`, `EmojiPicker`
    - **Recommendation:** Use a Popover or Dialog on mobile instead of absolute positioning. Check bounds before rendering.

### Improvements

20. **Touch targets in chat message actions.** The copy and reply buttons on message hover are `h-6 w-6` (24px). Apple's HIG recommends minimum 44×44pt touch targets.
    - **Component:** `src/components/chat/message-bubble.tsx`
    - **Recommendation:** Increase to `h-8 w-8` or wrap in a touch-friendly area. On mobile, consider showing actions on tap (not hover, which doesn't exist on touch).

21. **Artifact panel has no mobile experience.** The `ResizablePanelGroup` with horizontal split works on desktop but would be unusable on mobile. The artifact panel takes 40% of horizontal space.
    - **Component:** `src/app/(app)/project/[id]/page.tsx`
    - **Recommendation:** On mobile (`< md`), show the artifact panel as a full-screen overlay or bottom sheet instead of a side panel.

22. **Landing page mockup hides fake sidebar on mobile** (`hidden sm:block`) — good. But the remaining chat mockup area takes full width with no padding adjustment, looking slightly awkward at very small widths.

---

## 6. Accessibility

**Score: 6 / 10**

### What Works Well
- **Form labels** are present on all input fields across login, signup, settings, and onboarding. Labels are properly associated via `htmlFor`/`id` pairs.
- **Theme toggle** includes `<span className="sr-only">Toggle theme</span>` — good screen reader support.
- **Social links in footer** have `aria-label` attributes.
- **Focus-visible styles** from shadcn/ui are inherited by all interactive components.
- **Error messages** use semantic color (red) plus icon indicators — not relying solely on color.

### Critical Issues

23. **Onboarding wizard dialog has no accessible title.** The `<DialogContent>` has no `<DialogTitle>` at any step. This means screen readers announce it as an unnamed dialog. This is a WCAG 2.1 Level A violation (4.1.2 Name, Role, Value).
    - **Component:** `src/components/onboarding/onboarding-wizard.tsx`
    - **Recommendation:** Add a visually-hidden `<DialogTitle>` that updates per step: "Welcome", "Choose your plan", "Pro Setup", "Connect Gateway", "Create project", "Setup complete".

24. **Chat textarea has no explicit label.** The `<textarea>` relies on `placeholder` text for context, but placeholder is not a label. Screen readers may not announce the purpose of the field.
    - **Component:** `src/components/chat/message-input.tsx`
    - **Recommendation:** Add `<Label htmlFor="chat-input" className="sr-only">Message</Label>` and `id="chat-input"` on the textarea.

25. **Emoji picker has no focus trapping or keyboard navigation.** The inline emoji picker (`EmojiPicker` in message-input.tsx) renders as a grid of buttons with no focus trap. Tabbing out of it moves focus elsewhere; there's no way to navigate the grid with arrow keys. Same issue for the emoji/icon pickers in `NewProjectDialog` and `OnboardingWizard`.
    - **Recommendation:** Use Radix UI's `Popover` with focus trapping, or implement arrow-key navigation through the emoji grid with `role="grid"`, `role="gridcell"`, and roving tabindex.

26. **Color picker in NewProjectDialog lacks accessible names.** The color swatch buttons have no `aria-label` — a screen reader would announce them as unlabeled buttons.
    - **Component:** `src/components/sidebar/new-project-dialog.tsx`
    - **Recommendation:** Add `aria-label={c}` or descriptive color names like `aria-label="Indigo"`.

### Improvements

27. **Message bubble hover actions are invisible to keyboard users.** The timestamp and copy/reply buttons only appear on mouse hover (`!hovered && 'opacity-0'`). A keyboard user tabbing through the message list would see these buttons flash in and out as focus moves, but they'd be invisible otherwise.
    - **Recommendation:** Show actions on `:focus-within` as well as `:hover`. Use `group-focus-within:opacity-100` alongside `group-hover:opacity-100`.

28. **No skip-to-content link** on any page. Users navigating via keyboard must tab through the entire nav/sidebar before reaching main content.
    - **Recommendation:** Add a `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>` at the top of both marketing and app layouts.

29. **Suggestion chips in empty chat state are not functional.** The "Help me with a coding task", "Write a script to...", "Explain how to..." buttons in `MessageList` have no `onClick` handler — they render as styled `<button>` elements that do nothing when activated.
    - **Component:** `src/components/chat/message-list.tsx`
    - **Recommendation:** Wire these to populate and optionally auto-send the message input, or remove them. Non-functional interactive elements are a WCAG violation.

---

## 7. Error States & Loading

**Score: 8 / 10**

### What Works Well
- **ErrorBoundary** provides a friendly recovery UI with "Try Again" button, error message display, and clean iconography.
- **Loading states** are comprehensive: skeleton loaders for project list, spinner for session fetching, progressive loading for chat messages, animated spinner during gateway testing.
- **Toast notifications** via Sonner are used consistently for success, error, and info states across all async operations. They include descriptive messages and error details.
- **Empty states** are designed: no projects (sidebar), no messages (chat), no sessions (import dialog).
- **Connection status** is shown in multiple places: sidebar (dot + label), chat header (badge), dashboard (button), reconnecting banner.
- **Usage display** has loading skeleton, error state, and null-data handling.

### Critical Issues

30. **"Project not found" state is too minimal.** When navigating to `/project/[invalid-id]`, the user sees just `<p>Project not found</p>` centered on screen. No back button, no guidance, no branding.
    - **Component:** `src/app/(app)/project/[id]/page.tsx`
    - **Recommendation:** Show a proper empty state with icon, message, and "← Back to Dashboard" or "Create a new project" CTA.

### Improvements

31. **Gateway connection errors could be more actionable.** When the test connection fails, the error message is a raw string (e.g., "WebSocket connection failed"). Non-technical users won't know how to fix this.
    - **Recommendation:** Map common error patterns to user-friendly messages with specific remediation steps. For example: "Connection refused → Make sure your Gateway is running" or "Timeout → Check your network and firewall settings."

32. **No retry mechanism for failed message persistence.** When `persistMessage` or `persistArtifacts` fails, it logs to console but the user is unaware. Messages could be lost.
    - **Recommendation:** Show a subtle inline warning on messages that failed to save, with a retry option.

33. **Import dialog doesn't handle partial failures.** The `importSessions` call either succeeds or shows a generic error. If 8 of 10 sessions import successfully and 2 fail, the user gets no feedback on which ones failed.
    - **Recommendation:** Track and display per-session import status (success/fail) in the progress view.

---

## 8. Micro-interactions & Polish

**Score: 7 / 10**

### What Works Well
- **Onboarding transitions** use `animate-in fade-in slide-in-from-right-4` (forward) and `slide-in-from-left-4` (backward) with 300ms duration — this feels natural and directional.
- **Progress dots** in onboarding animate width and color changes with `transition-all duration-300`.
- **Thinking indicator** uses staggered bounce animations for the three dots — a classic, well-executed pattern.
- **Streaming text cursor** (blinking `w-0.5` bar) provides clear "AI is typing" feedback.
- **Feature cards** on landing have subtle hover effects: border color change, background opacity, and shadow.
- **Theme toggle** uses smooth rotate/scale transitions for the sun/moon icons.
- **Copy button** in message bubble shows Check icon for 2 seconds after copying — satisfying micro-feedback.

### Improvements

34. **Hero "Now in open beta" badge** has a ping animation on the dot, which is nice, but the badge itself doesn't link anywhere. Users might expect to click it for release notes or changelog.
    - **Recommendation:** Link the badge to a changelog or blog post.

35. **Message suggestions in empty state don't have hover feedback.** They have `hover:bg-accent` but no transition, so the color change is instant.
    - **Component:** `src/components/chat/message-list.tsx`
    - **Recommendation:** Add `transition-colors` to the suggestion buttons.

36. **Pricing card hover has no transition on non-highlighted cards.** The CSS includes `transition-all duration-300` but the `hover:border-border` change on non-highlighted cards is barely noticeable.
    - **Recommendation:** Add a subtle `hover:shadow-md` or `hover:-translate-y-0.5` to make the hover feel interactive.

37. **No haptic-style feedback on mobile for important actions.** The send button, project creation, and gateway connect actions could benefit from a subtle scale animation on tap.
    - **Recommendation:** Add `active:scale-95 transition-transform` to primary action buttons.

38. **Voice recorder lacks visual waveform.** Recording shows a pulsing red dot and timer, but no audio level visualization. Users can't tell if the microphone is actually picking up sound.
    - **Recommendation (nice-to-have):** Add a simple audio level meter or waveform visualization using `AnalyserNode` from the Web Audio API.

---

## Detailed Component-Level Findings

### Landing Page Components

| Component | Issue | Severity | Recommendation |
|-----------|-------|----------|----------------|
| `LandingNav` | No mobile menu — nav links hidden on small screens with no hamburger | Improvement | Add a mobile nav menu or at least keep CTA buttons visible |
| `LandingNav` | "Docs" link is dead (`href="#"`) | Critical | Remove or link to actual page |
| `Footer` | 8 of 11 links are dead (`href="#"`) | Critical | Create pages or remove links |
| `Hero` | "See How It Works" button scrolls to `#features` not `#how-it-works` | Bug | Change to `#how-it-works` or add id to the correct section |
| `HowItWorks` | Section has no `id` attribute for anchor linking | Bug | Add `id="how-it-works"` to the section element |
| `Testimonials` | Avatar circles use initials but no actual images — feels placeholder-y | Improvement | Add real photos or illustrated avatars |
| `PricingTable` | "Contact Sales" for Team tier links to `/signup` not a contact form | Bug | Link to a contact/sales page or email |

### Chat Components

| Component | Issue | Severity | Recommendation |
|-----------|-------|----------|----------------|
| `MessageList` | Suggestion chips are non-functional buttons | Critical | Add onClick to populate input |
| `MessageInput` | textarea has no accessible label | Critical | Add sr-only label |
| `MessageInput` | EmojiPicker positioned absolutely — can overflow viewport | Improvement | Use Popover with boundary detection |
| `MessageBubble` | Actions only visible on hover — inaccessible via keyboard | Improvement | Add focus-within visibility |
| `MessageBubble` | User message avatar is always 👤 with no personalization | Nice-to-have | Use user's initials or avatar |
| `MessageSearch` | `onJumpTo` is optional and not passed from `ProjectPage` | Bug | Wire `onJumpTo` to scroll to the matching message |
| `StreamingText` | No error handling — if markdown parsing fails, whole component crashes | Improvement | Wrap in ErrorBoundary |
| `ToolCallCard` | Rendered but never used in current chat flow | Nice-to-have | Wire to actual tool call messages |
| `VoiceRecorder` | Standalone component exists but message-input uses inline duplicate | Improvement | Consolidate into one implementation |

### Sidebar Components

| Component | Issue | Severity | Recommendation |
|-----------|-------|----------|----------------|
| `Sidebar` | No keyboard shortcut indicator for `⌘N` next to "New Project" | Nice-to-have | Add `kbd` element showing shortcut |
| `ProjectList` | No drag-and-drop reordering | Nice-to-have | Add sortable projects |
| `ProjectList` | No right-click context menu for rename/delete/archive | Improvement | Add context menu with project actions |
| `ConnectionStatus` | Uses separate `Tooltip` wrapping — inconsistent with rest of app | Minor | Matches pattern, but could use inline tooltip |
| `NewProjectDialog` | No character count indicator on name field despite `maxLength={100}` | Improvement | Show remaining characters |

### Onboarding & Billing

| Component | Issue | Severity | Recommendation |
|-----------|-------|----------|----------------|
| `OnboardingWizard` | No `DialogTitle` — accessibility violation | Critical | Add per-step visually-hidden title |
| `OnboardingWizard` | eslint-disable on deps — potential stale closure in auto-redirect | Bug risk | Add `finishOnboarding` to useEffect deps |
| `PlanSelector` | Team plan click shows toast "coming soon" — could be a disabled card instead | Improvement | Disable the card visually and show "Coming Soon" overlay |
| `UsageDisplay` | Hardcoded usage caps (500K/5M/10M) don't come from plan config | Improvement | Move to plan definitions |

### Artifact Components

| Component | Issue | Severity | Recommendation |
|-----------|-------|----------|----------------|
| `ArtifactPanel` | Fullscreen mode (`expanded`) takes over entire viewport with no escape instruction | Improvement | Show "Press Esc to exit" hint, or handle Escape key |
| `ArtifactPanel` | Tab bar horizontal scroll has no scroll indicators | Minor | Add fade gradient at edges |
| `HtmlPreview` | No loading state — complex HTML may take time to render | Improvement | Add loading spinner while iframe loads |
| `CodePreview` | No syntax highlighting — relies on plain monospace text | Improvement | Integrate Shiki or highlight.js in the preview pane |
| `ImagePreview` | No zoom/pan capability | Nice-to-have | Add click-to-zoom with a lightbox |

---

## Security UX Notes (Positive)

The security posture of the UI is notably strong. Highlighting what's done well:

- ✅ Gateway tokens are never stored in localStorage — persisted encrypted in Supabase via RPC
- ✅ QuickConnectHandler strips tokens from URL immediately to prevent leakage via browser history
- ✅ HTML artifact preview uses sandboxed iframe without `allow-same-origin`
- ✅ CSP meta tag injected into HTML previews blocks network requests
- ✅ Markdown rendering uses `rehype-sanitize` with a custom schema
- ✅ External links use `rel="noopener noreferrer"` throughout
- ✅ Image rendering in chat validates URL scheme (blocks `javascript:` and `data:` URIs)
- ✅ File uploads validate type and size before transmission
- ✅ User store `partialize` excludes sensitive state from localStorage persistence

**One security UX concern:** The "Allow insecure auth" toggle in both Settings and Onboarding could benefit from a more prominent warning. Currently it's a small Switch with a subtitle. Consider making it require a confirmation dialog, or coloring the toggle red/orange when enabled.

---

## Priority Action Items

### 🔴 Critical (Must Fix Before Launch)

1. **Add `DialogTitle` to OnboardingWizard** — WCAG violation (§6, #23)
2. **Fix non-functional suggestion chips in empty chat** — broken interactive element (§6, #29)
3. **Add accessible label to chat textarea** — WCAG violation (§6, #24)
4. **Add `aria-label` to mobile hamburger button** — WCAG violation (§5, #17)
5. **Fix dead links in nav and footer** — marketing trust issue (§1, #3)
6. **Align pricing tiers between landing page and onboarding** — confusing user journey (§2, #5)
7. **Add accessible title to mobile Sheet sidebar** — WCAG violation (§5, #18)
8. **Fix "See How It Works" anchor** — links to `#features` instead of how-it-works section (table)
9. **Fix "Contact Sales" link** — goes to `/signup` instead of contact form (table)

### 🟡 Improvements (Should Fix Soon)

10. Merge or differentiate `/connect` and `/settings` (§1, #1)
11. Remove "Clawdify credits" from onboarding until ready (§2, #6)
12. Persist onboarding state in Supabase (§2, #7)
13. Add focus-within visibility for message bubble actions (§6, #27)
14. Add emoji picker focus trapping (§6, #25)
15. Add `aria-label` to color picker swatches (§6, #26)
16. Improve "Project not found" empty state (§7, #30)
17. Make mobile artifact panel a full-screen overlay (§5, #21)
18. Wire `onJumpTo` in message search (table)
19. Increase mobile touch targets for message actions (§5, #20)
20. Add skip-to-content link (§6, #28)
21. Consolidate duplicate voice recorder implementations (table)
22. Wire suggestion chips to populate message input (table)
23. Add LandingNav mobile menu (table)
24. Add keyboard Escape handler to expanded artifact panel (table)
25. Add `transition-colors` to empty state suggestion buttons (§8, #35)

### 🟢 Nice-to-Haves (Future Polish)

26. Add gateway error message mapping to user-friendly instructions (§7, #31)
27. Message persistence retry mechanism (§7, #32)
28. Per-session import status tracking (§7, #33)
29. Audio waveform in voice recorder (§8, #38)
30. Click-to-zoom on artifact images (table)
31. Drag-and-drop project reordering (table)
32. Right-click context menu for projects (table)
33. User avatar personalization in chat (table)
34. Landing page feature card visual hierarchy (§3, #11)
35. Pricing card hover enhancement (§8, #36)
36. `active:scale-95` on primary buttons for mobile tap feedback (§8, #37)
37. Link the "open beta" badge to changelog (§8, #34)
38. Add syntax highlighting to CodePreview artifact panel (table)

---

## Specific Code Change Suggestions

### 1. Fix OnboardingWizard Accessibility

```tsx
// src/components/onboarding/onboarding-wizard.tsx
// Inside DialogContent, add a visually-hidden title that updates per step:

import { DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

// Inside DialogContent, before the progress dots:
<VisuallyHidden>
  <DialogTitle>
    {step === 'welcome' && 'Welcome to Clawdify'}
    {step === 'choose-path' && 'Choose your plan'}
    {step === 'pro-setup' && 'Pro Setup'}
    {step === 'gateway-connect' && 'Connect your Gateway'}
    {step === 'create-project' && 'Create your first project'}
    {step === 'done' && 'Setup complete'}
  </DialogTitle>
</VisuallyHidden>
```

### 2. Fix Chat Textarea Label

```tsx
// src/components/chat/message-input.tsx
// Add a sr-only label before the textarea:

<label htmlFor="chat-message-input" className="sr-only">
  Message
</label>
<textarea
  id="chat-message-input"
  ref={textareaRef}
  // ... rest of props
/>
```

### 3. Fix Mobile Hamburger Accessibility

```tsx
// src/app/(app)/layout.tsx
<Button
  variant="ghost"
  size="icon"
  className="fixed left-2 top-2 z-40 md:hidden"
  aria-label="Open navigation menu"
>
  <Menu className="h-5 w-5" />
</Button>
```

### 4. Wire Suggestion Chips

```tsx
// src/components/chat/message-list.tsx
// The suggestion buttons need an onClick handler. Pass an onSuggestionClick prop:

interface MessageListProps {
  // ... existing props
  onSuggestionClick?: (text: string) => void;
}

// In the empty state:
{[
  'Help me with a coding task',
  'Write a script to...',
  'Explain how to...',
].map((suggestion) => (
  <button
    key={suggestion}
    onClick={() => onSuggestionClick?.(suggestion)}
    className="rounded-full border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-accent"
  >
    {suggestion}
  </button>
))}
```

### 5. Show Message Actions on Focus-Within

```tsx
// src/components/chat/message-bubble.tsx
// Change the timestamp/actions container:

<div
  className={cn(
    'mt-1 flex items-center gap-1 text-xs text-muted-foreground',
    isUser ? 'justify-end' : 'justify-start',
    // Show on hover OR keyboard focus within the message
    'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
    'transition-opacity',
  )}
>
```

### 6. Improve "Project Not Found" State

```tsx
// src/app/(app)/project/[id]/page.tsx
if (!project) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <FolderOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-semibold">Project not found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This project may have been deleted or the link is incorrect.
        </p>
      </div>
      <Link href="/dashboard">
        <Button variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
```

---

## Category Scores Summary

| Category | Score | Notes |
|----------|-------|-------|
| 1. Information Architecture | 7/10 | Good hierarchy, but duplicate connection pages and dead links |
| 2. Onboarding Flow | 8/10 | Excellent multi-path wizard; pricing mismatch is main issue |
| 3. Layout & Visual Hierarchy | 8/10 | Strong visual identity; minor layout issues |
| 4. Component Consistency | 8/10 | shadcn/ui provides great baseline; some duplicated components |
| 5. Mobile Responsiveness | 7/10 | Good responsive layouts; accessibility gaps on mobile |
| 6. Accessibility | 6/10 | Labels present but missing dialog titles, focus management, keyboard nav |
| 7. Error States & Loading | 8/10 | Comprehensive loading/error handling; some edge cases |
| 8. Micro-interactions & Polish | 7/10 | Good animations and feedback; room for mobile tactile polish |

## **Overall UX Score: 7.0 / 10**

Clawdify is a solid product with a premium feel that's close to launch-ready. The critical accessibility fixes (#23, #24, #17, #18, #29) are the highest priority — they're relatively small code changes with outsized impact on usability. The pricing alignment (#5) and dead link cleanup (#3) are essential for marketing credibility. After those fixes, the product would score an 8+/10.

The team should be proud of the onboarding wizard, the security-conscious architecture, and the overall visual polish. With the improvements outlined above, Clawdify will deliver a truly premium AI workspace experience.
