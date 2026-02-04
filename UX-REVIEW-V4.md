# UX Review — Clawdify V4 (Mission Control + One-Click Deploy)

> **Reviewer:** UX/UI Specialist (subagent)  
> **Date:** February 4, 2026  
> **Scope:** Full product review — Dashboard (Mission Control) + Landing Page  
> **Reference docs:** BUILD-PLAN-V4.md, DEV-BUILD-REPORT.md, MARKETING-BUILD-REPORT.md, STRATEGIST-REVIEW.md, STRATEGIST-BYOG-ANALYSIS.md

---

## OVERALL SCORE: 6.8 / 10

| Category | Score | Status |
|----------|-------|--------|
| Mission Control Dashboard | 7.0 / 10 | Good foundation, needs polish |
| Deploy Page | 7.0 / 10 | Functional, missing cost clarity |
| Landing Page | 8.0 / 10 | Strong, excellent positioning |
| Consistency | 5.0 / 10 | **Critical issues** — onboarding is broken |

The V4 pivot from chat-centric to Mission Control is well-executed architecturally. The landing page nails the positioning. But the onboarding wizard was NOT updated for V4 and still shows V3 pricing, V3 language, and references removed features. This single issue would torpedo the first-run experience for every new user.

---

## 1. MISSION CONTROL DASHBOARD — 7.0 / 10

### What Works ✅

**Layout matches spec.** The three-column ResizablePanelGroup (task list + activity feed + artifacts) faithfully implements the BUILD-PLAN-V4 spec. The panels are resizable with drag handles, which is a nice power-user touch not in the original spec.

**Task creation flow is intuitive.** The `TaskCreate` component opens inline with a focused text input, supports Enter to submit and Escape to cancel, has an optional expandable description field, and disables when the gateway is disconnected. Clean, minimal, no modal friction.

**Activity feed conveys real-time agent actions clearly.** The `ActivityFeed` component auto-scrolls, shows timestamped entries with type-specific icons (Eye for file reads, Pencil for writes, Terminal for commands, Brain for thinking), has an expandable detail view for each entry, and shows a streaming indicator. The `activity-mapper.ts` properly recognizes all major tool types.

**Agent status indicator is visible and informative.** Both compact (sidebar dot) and expanded (dashboard card) modes. Shows model, version, host, and uptime. Color-coded: green (connected), yellow (connecting), red/gray (disconnected).

**Mobile responsiveness works.** Three tabs [Tasks] [Activity] [Results]. Selecting a task auto-switches to the Activity tab — smart UX. Tabs use the proper `variant="line"` styling.

**Empty states are thoughtful.** Task list shows "No tasks yet" with a clear CTA. Activity feed differentiates between "no task selected" and "task selected but no activity yet."

**Error handling is reasonable.** Toast notifications for failed task creation, failed gateway sends, and disconnection warnings. Task status updates to 'failed' with error messages.

### What Needs Work ⚠️

**No task cancel/retry UI.** The `useTaskStore` has a `cancelTask` method but it's never exposed in the UI. There's no cancel button on active tasks and no retry button on failed tasks. This is a significant gap — if an agent runs away on an expensive operation, the user has no way to stop it from the dashboard.

**No keyboard shortcuts.** The spec mentions `⌘T` for quick task creation. The dashboard page shows `⌘K` (Search) and `⌘N` (New Project) hints but doesn't implement `⌘T`. For a developer-focused product, keyboard shortcuts are expected, not bonus features.

**Activity entries lack alternating backgrounds.** The spec says "Alternating row backgrounds for readability." The current implementation uses `divide-y divide-border/50` (divider lines). While the dividers work, they don't provide the visual scanning advantage of alternating backgrounds in a dense log-style feed.

**Artifact panel has a double-border issue.** `ArtifactPanel` applies `border-l bg-background` but it's nested inside a `ResizablePanel` that already has a `ResizableHandle` separator. This creates a visual inconsistency — the left border is redundant when the resize handle is present.

**No "Waiting for results" placeholder.** The spec says "If no artifacts yet, show 'Waiting for results...' with subtle animation." Currently, when no artifacts exist, the entire artifact panel disappears and the activity feed takes 100% vertical space. This is space-efficient but means the user never sees where results WILL appear until they actually arrive — missing a moment of anticipation.

**Missing tooltip on disabled "New Task."** When the gateway is disconnected, the "New Task" button is disabled but there's no tooltip or text explaining WHY. A developer who just signed up and sees a grayed-out button with no explanation will bounce.

### Accessibility Issues 🔴

- Activity entries use icons for type differentiation (Eye, Pencil, Terminal, etc.) but have NO `aria-label` or `title` attributes. Screen reader users get no information about the entry type.
- The activity detail expand/collapse button uses `<button>` but has no `aria-label` (just shows `ChevronRight`/`ChevronDown` icons).
- Task section headers ("Active", "Queued", "Completed") aren't wrapped in heading elements — they're just `<span>` elements inside a `<div>`. This makes it harder for screen reader users to navigate the task list.

---

## 2. DEPLOY PAGE — 7.0 / 10

### What Works ✅

**Clear provider options.** Three cards (Railway, Fly.io, Docker) with distinct icons, descriptions, and free-tier info. Each card has a clear primary action. The Docker option correctly uses "Copy Command" instead of "Deploy."

**"Already have a Gateway?" section is well-positioned.** At the bottom, clearly separated, with a link to `/connect`. Doesn't overshadow the deploy flow but is findable.

**DeployStatus component is smart.** Shows a stepped progress view (deploying → starting → connecting) that gives users visual feedback during the deploy wait.

**How-it-works section is clear.** Three numbered steps with icons and descriptions.

### What Needs Work ⚠️

**Template URLs are placeholders.** `https://railway.app/template/openclaw-gateway` and `https://fly.io/launch/openclaw-gateway` don't exist yet. Clicking "Deploy Now" will open a 404 page. At minimum, these should be marked as "Coming Soon" or disabled until the templates are published.

**No cost breakdown.** The deploy cards show brief free-tier info ("$5/mo credit on free tier", "Free tier: 3 shared VMs") but don't explain what happens AFTER the free tier. Users should see: "Typical cost: $3-5/mo after free tier." The pricing table mentions this in a note, but the deploy page should repeat it at the point of action.

**Docker command references a non-existent image.** `ghcr.io/openclaw/gateway:latest` — this container image doesn't exist in the registry yet. The command will fail.

**No "deploy in progress" guidance.** The DeployStatus only shows when the gateway is actively connecting. Between "Deploy Now" (opening Railway in a new tab) and the gateway connecting (1-3 minutes later), the user sees NOTHING. They don't know if they should wait, refresh, or do something else. Add a "Deployed? Wait for your agent to connect..." state with a subtle polling indicator.

**How-it-works section is buried.** It's at the very bottom of the page. Since this section explains the entire flow, it should be above the deploy cards or immediately below the hero.

---

## 3. LANDING PAGE — 8.0 / 10

### What Works ✅

**Hero immediately conveys the product.** "Mission Control for AI Agents" is a strong, differentiating headline. The subtitle ("Deploy your own AI agent in 5 minutes...") creates urgency. The gradient text treatment is visually striking.

**The mockup is excellent.** The hero mockup showing the three-panel layout (sidebar → tasks → activity feed → results) immediately communicates what the product IS. This is vastly better than the old v3 chat bubble mockup. The animated pulse dot on the active task and the typing indicator dots are nice touches.

**DemoPreview creates a "wow" moment.** The scroll-triggered animation showing an agent building a landing page line by line is compelling. The typing dots between lines add authenticity. This is the closest the landing page gets to the strategist's recommended "aha moment."

**Comparison section is smartly framed.** "Clawdify vs. Terminal" — not "Clawdify vs. ChatGPT." This follows the strategist's advice exactly. The table format is clean, and the closing line ("Love the terminal? So do we.") nails the tone.

**Pricing is clean and clear.** Two tiers, not three. Free tier for BYOG, Pro at $12/mo. The BYOK explainer at the bottom is a smart trust signal.

**FAQ is comprehensive.** 10 questions covering all the obvious objections (What is this? How is it different from ChatGPT? Where do my API keys go? What's OpenClaw?). The accordion UI is smooth.

**Tone is developer-friendly.** Confident without being hype-y. Technical enough to be credible. Casual enough to be approachable. The ICP (AI-curious professional developer) would feel spoken to, not marketed at.

### What Needs Work ⚠️

**DemoPreview has a memory leak bug.** The IntersectionObserver callback creates `setInterval` inside the observer callback, and the cleanup function (`return () => clearInterval(interval)`) is returned from the observer callback, not from the useEffect. This means:
  - Multiple scrolls past the section create stacking intervals
  - The intervals are never properly cleaned up
  - On a mobile device with frequent scrolling, this could cause noticeable performance degradation

**Footer social links are placeholders.** GitHub, Twitter/X, and Discord links all point to `#`. Clicking them scrolls to page top — broken UX. Either add real URLs or remove the links.

**No video/GIF demo.** The strategist review emphasizes that a 90-second demo video is the most important marketing asset. The DemoPreview animation is good but a real video of the actual product working would be far more convincing. Consider adding a "Watch Demo" link or embedding a video.

**"Built For" quotes could feel inauthentic.** The testimonials section uses persona-based quotes in italics with no names or companies. Savvy developers will spot these as fabricated. Consider framing them as "What you could accomplish" instead of implied testimonials, or remove the quotes entirely and just describe each persona.

**No anchor ID for Features section.** The nav links to `#features` and the Features section has `id="features"` — this works. But the "How It Works" link points to `#how-it-works` which matches `id="how-it-works"`. All good. However, the DemoPreview, Comparison, Testimonials, and FAQ sections have no nav links. The nav could include a "Demo" link.

---

## 4. CONSISTENCY — 5.0 / 10

This is where the product breaks down. The dashboard and landing page were built by separate agents, and the seams are showing.

### Critical Consistency Issues 🔴

**1. Onboarding wizard shows WRONG pricing.**  
`onboarding-wizard.tsx` line: `$15/mo` for Pro tier.  
`plans.ts` says: `$12/mo`.  
`pricing-table.tsx` says: `$12/mo`.  
This is a user trust destroyer. A user who sees $12 on the landing page and $15 in the signup wizard will think something is off.

**2. Onboarding wizard uses removed features.**  
Free tier in wizard: "Try Clawdify with Gemini Flash" + badges `[Gemini Flash]` `[3 projects]`.  
Reality: Gemini was removed from `API_PROVIDERS`. Free tier is BYOG with 2 projects (per `plans.ts`).

**3. Onboarding wizard uses V3 "chat" language.**  
Done step says:
- Free: "Start chatting with Gemini Flash. Upgrade anytime."
- Pro: "Your Pro workspace is ready. Enjoy Claude and GPT-4!"
- Gateway: "Connected to your Gateway. Start chatting!"
- Default: "Start chatting with your AI workspace."

NONE of this mentions tasks, Mission Control, or agents. It's entirely v3 chat-centric language. Every user who completes onboarding gets messaging that contradicts everything they just saw on the landing page.

**4. Brand color mismatch between dashboard and landing page.**  
Landing page: Violet/indigo gradient accent throughout (badges, icons, CTAs, backgrounds).  
Dashboard: Generic blue/green/red status colors. No violet anywhere.  
The visual identity established by the landing page completely vanishes when you enter the app.

**5. Onboarding wizard path options don't match V4 model.**  
The wizard offers four paths: Free (Gemini), Pro ($15), Deploy Agent, Self-Hosted (BYOG).  
The V4 model is: Free (BYOG) and Pro ($12/mo, BYOG or deploy). There is no "Gemini" path. The wizard's "Free" path and "Self-Hosted" path are functionally identical (both BYOG) but positioned as different options.

### Minor Consistency Issues ⚠️

- The dashboard's `AgentStatus` shows "Agent Connected/Disconnected" while the sidebar's `ConnectionStatus` shows "Connected/Disconnected" — slightly different labels for the same state.
- The landing page hero badges "Now in open beta" — but there's no beta badge or messaging anywhere in the dashboard.
- Active task indicator in the hero mockup uses GREEN, but the actual dashboard task list uses BLUE for active tasks. This means the product doesn't match its own marketing material.

---

## TOP 5 CRITICAL ISSUES (Must Fix Before Launch)

### 1. 🔴 Onboarding Wizard Is Entirely V3 — Needs Complete Update
**File:** `src/components/onboarding/onboarding-wizard.tsx`  
**Impact:** Every new user sees wrong pricing ($15 vs $12), removed features (Gemini Flash), wrong project limits (3 vs 2), and old chat language  
**Fix:** Update all text in the wizard to match V4 positioning:
- Pro price: $15 → $12
- Free tier: "Gemini Flash" → "Connect your own Gateway (BYOG)"
- Free projects: "3 projects" → "2 projects"
- Free badges: Remove `[Gemini Flash]`, add `[BYOG]`, `[2 projects]`
- Pro description: Remove "voice & artifacts", rewrite for task/deploy positioning
- Done step: Replace all "chatting" text with task-centric language
- Remove the separate "Self-Hosted" card or merge it with Free (they're the same thing now)

### 2. 🔴 DemoPreview Memory Leak — Stacking Intervals
**File:** `src/components/landing/demo-preview.tsx`  
**Impact:** Multiple scroll-past events create stacking `setInterval` calls that are never cleaned up. Causes performance degradation, especially on mobile.  
**Fix:** Use a `useRef` to track the interval ID. Clear the interval in the IntersectionObserver's "not intersecting" callback AND in the useEffect cleanup. Reset visible lines when element exits viewport.

### 3. 🔴 No Task Cancel/Retry in UI
**Files:** `src/components/tasks/task-card.tsx`, `src/components/tasks/task-list.tsx`  
**Impact:** Users cannot cancel runaway agent tasks or retry failed ones. With BYOK, a runaway agent could burn $50+ in API costs with no stop button.  
**Fix:** Add a context menu or action button on task cards:
- Active tasks: "Cancel" button (calls `cancelTask`)
- Failed tasks: "Retry" button (creates new task with same title/description)
- Done tasks: No action needed

### 4. 🔴 Activity Entry Icons Lack Accessibility
**File:** `src/components/activity/activity-entry.tsx`  
**Impact:** Screen reader users get no information about entry types. The icons are purely visual.  
**Fix:** Add `aria-label` to each icon based on type (e.g., "File read", "File write", "Command executed", "Thinking", "Error"). Add `role="img"` to the icon wrapper.

### 5. 🔴 Active Task Color Mismatch — Blue in Dashboard vs Green in Marketing
**Files:** `src/components/tasks/task-card.tsx`, `src/components/tasks/task-list.tsx`, `src/components/landing/hero.tsx`  
**Impact:** The landing page hero mockup uses green to indicate active tasks ("Agent Online" with green dot, active task with green border). The actual dashboard uses blue (`border-blue-500/30`, `text-blue-500`). Users who sign up expecting green-means-active will be confused.  
**Fix:** Unify on green for active tasks across both dashboard and landing page (green is the more intuitive "go/active" color).

---

## TOP 10 IMPROVEMENT SUGGESTIONS (Nice to Have)

### 1. Add `⌘T` Keyboard Shortcut for New Task
**File:** `src/app/(app)/project/[id]/page.tsx`  
Add a keyboard event listener for `Meta+T` / `Ctrl+T` that focuses the task creation input. This is a high-value low-effort feature for the developer ICP.

### 2. Add Violet Brand Accent to Dashboard
**Files:** Various dashboard components  
The landing page establishes violet/indigo as the brand color. Carry it through: use violet for selected states, primary buttons, and active indicators in the dashboard. This creates visual continuity from marketing → product.

### 3. Show "Waiting for Results" Placeholder in Artifact Area
**File:** `src/app/(app)/project/[id]/page.tsx`  
When a task is active but has no artifacts yet, show the artifact panel with a "Waiting for results..." message and a subtle shimmer animation. This teaches users where to look for output.

### 4. Add Cost Breakdown to Deploy Page
**File:** `src/components/deploy/deploy-page.tsx`  
Add a "Typical monthly cost: $3-5/mo after free tier" line to each provider card. Cost transparency builds trust.

### 5. Replace Footer Placeholder Social Links
**File:** `src/components/landing/footer.tsx`  
Either add real URLs (GitHub repo, Twitter account, Discord server) or remove the social icons entirely. Broken links erode credibility.

### 6. Add Task Action Menu
**File:** `src/components/tasks/task-card.tsx`  
Right-click or "..." menu with: Cancel (active), Retry (failed), Delete (any). This gives users essential task management controls.

### 7. Add Tooltip on Disabled "New Task" Button
**File:** `src/components/tasks/task-create.tsx`  
When `disabled={true}`, wrap the button in a tooltip: "Connect your Gateway to create tasks." Explains the disabled state.

### 8. Move How-It-Works Above Deploy Cards
**File:** `src/components/deploy/deploy-page.tsx`  
The "How it works" section is at the very bottom of the deploy page. Moving it above the provider cards gives users context before they choose a provider.

### 9. Add Swipe Gesture Support on Mobile Tabs
**File:** `src/app/(app)/project/[id]/page.tsx`  
Use touch event handlers to allow swiping between Tasks/Activity/Results tabs on mobile. Native-feeling navigation.

### 10. Show Suggested First Task for New Users
**File:** `src/components/tasks/task-list.tsx`  
In the empty state, add a "Try this:" button with a pre-filled example task: "Build a simple landing page for a portfolio site." Reduces the cold-start friction.

---

## SPECIFIC CODE FIXES

### Fix 1: Onboarding Wizard V4 Update
**File:** `src/components/onboarding/onboarding-wizard.tsx`

**Change:** Free card — Replace Gemini Flash positioning with BYOG
```tsx
// OLD
<div className="flex h-10 w-10 ... bg-green-100 ...">🆓</div>
<h4>Free</h4>
<p>Try Clawdify with Gemini Flash. No credit card needed.</p>
<Badge>Gemini Flash</Badge>
<Badge>3 projects</Badge>

// NEW
<div className="flex h-10 w-10 ... bg-green-100 ...">🆓</div>
<h4>Free</h4>
<p>Connect your own Gateway. 2 projects, free forever.</p>
<Badge>BYOG</Badge>
<Badge>2 projects</Badge>
```

**Change:** Pro card — Fix price and description
```tsx
// OLD
<h4>Pro</h4> <span>$15/mo</span>
<p>Claude, GPT-4, unlimited projects, voice & artifacts</p>

// NEW
<h4>Pro</h4> <span>$12/mo</span>
<p>One-click deploy, unlimited projects, notifications, and analytics</p>
```

**Change:** Done step — Replace chat language
```tsx
// OLD
{path === 'free' && 'Start chatting with Gemini Flash. Upgrade anytime.'}
{path === 'pro' && 'Your Pro workspace is ready. Enjoy Claude and GPT-4!'}
{path === 'gateway' && 'Connected to your Gateway. Start chatting!'}
{!path && 'Start chatting with your AI workspace.'}

// NEW
{path === 'free' && 'Your workspace is ready. Create your first task!'}
{path === 'pro' && 'Pro activated! Deploy an agent or connect your Gateway.'}
{path === 'gateway' && 'Gateway connected. Create your first task!'}
{!path && 'Your workspace is ready. Let\'s build something.'}
```

### Fix 2: DemoPreview Memory Leak
**File:** `src/components/landing/demo-preview.tsx`

Replace the useEffect with proper interval cleanup using useRef:
```tsx
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

useEffect(() => {
  const el = document.getElementById('demo-preview-section');
  if (!el) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        // Clear any existing interval
        if (intervalRef.current) clearInterval(intervalRef.current);
        setVisibleLines(0);
        let i = 0;
        intervalRef.current = setInterval(() => {
          i++;
          setVisibleLines(i);
          if (i >= activityLines.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }, 600);
      } else {
        // Clean up when element leaves viewport
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    },
    { threshold: 0.3 },
  );

  observer.observe(el);
  return () => {
    observer.disconnect();
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}, []);
```

### Fix 3: Task Cancel Button
**File:** `src/components/tasks/task-card.tsx`

Add a cancel button for active tasks:
```tsx
// After the status/time info in the card, add:
{task.status === 'active' && onCancel && (
  <button
    onClick={(e) => { e.stopPropagation(); onCancel(task.id); }}
    className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-600"
    aria-label="Cancel task"
  >
    Cancel
  </button>
)}
```

### Fix 4: Activity Entry Accessibility
**File:** `src/components/activity/activity-entry.tsx`

Add aria-label to icon wrapper:
```tsx
const typeLabels: Record<string, string> = {
  thinking: 'Thinking',
  tool_call: 'Tool call',
  file_read: 'File read',
  file_write: 'File write',
  command: 'Command',
  message: 'Message',
  complete: 'Complete',
  error: 'Error',
};

// In the render:
<span role="img" aria-label={typeLabels[entry.type] ?? entry.type}>
  <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', config.color)} />
</span>
```

### Fix 5: Active Task Color — Blue → Green
**File:** `src/components/tasks/task-card.tsx`

```tsx
// OLD
active: 'text-blue-500',
// ...
task.status === 'active' && 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20',

// NEW
active: 'text-green-500',
// ...
task.status === 'active' && 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20',
```

**File:** `src/components/tasks/task-list.tsx`
```tsx
// OLD
color === 'blue' ? 'bg-blue-500 animate-pulse' : 'bg-gray-400',
// ...
<TaskSection label="Active" count={active.length} color="blue">

// NEW
color === 'green' ? 'bg-green-500 animate-pulse' : 'bg-gray-400',
// ...
<TaskSection label="Active" count={active.length} color="green">
```

**File:** `src/app/(app)/dashboard/page.tsx`
```tsx
// OLD
active: 'text-blue-500',

// NEW
active: 'text-green-500',
```

---

## ADDITIONAL OBSERVATIONS

### Architecture Quality
The codebase is well-structured. Zustand stores are clean and follow consistent patterns. The activity mapper is a thoughtful abstraction layer. The gateway provider pattern keeps WebSocket concerns isolated.

### Performance Concerns
- The `ResizablePanelGroup` may cause layout thrashing during resize on lower-end devices.
- The activity store caps at 500 entries per task — good guard against memory issues.
- The task store does fire-and-forget Supabase updates — acceptable for real-time feel but could lose data on network interruptions.

### Security Notes
- The onboarding wizard says "🔒 Your key is encrypted and stored securely" for API keys — this should be verified. The mock validation (checking key prefix) should be replaced with actual API validation before launch.
- The gateway token is transmitted as a URL parameter in deploy template URLs — ensure this is adequately secured.

### What's Missing (Beyond V4 Scope)
- No notification system (mentioned as Pro feature)
- No scheduled tasks UI
- No agent analytics dashboard
- No task drag-and-drop reordering
- No file browser
- No terminal streaming view

These are correctly deferred per the strategist's advice. They're Phase 2+ features.

---

## VERDICT

The V4 codebase is a solid foundation. The Mission Control paradigm is genuinely differentiated. The landing page positioning is excellent — it immediately communicates what Clawdify is and why a developer should care.

The critical blocker is the onboarding wizard. It's the first thing every new user sees after signup, and it's entirely V3: wrong pricing, wrong features, wrong language. Fix this first. Everything else is polish.

After the critical fixes in this review are applied, the product is **launch-ready for private beta**. For public launch (Product Hunt / Hacker News), address the top 10 improvement suggestions as well.

---

*Review complete. Five critical fixes identified and specified. Priority: Onboarding wizard > DemoPreview bug > Task cancel UI > Accessibility > Color consistency.*
