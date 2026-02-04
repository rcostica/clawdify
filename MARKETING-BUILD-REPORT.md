# Marketing Build Report — V4 Landing Page Rewrite

> **Date:** February 4, 2026  
> **Agent:** Marketing (subagent)  
> **Build status:** ✅ `next build` passes with zero errors  

---

## Summary

Complete rewrite of the Clawdify landing page and marketing content for the new "Mission Control + One-Click Deploy" positioning. All 10 landing components updated, 1 new component created, billing plans data updated, and page compositions adjusted.

---

## What Changed

### Core Positioning Shift
- **FROM:** "One workspace for Claude, GPT-4, and Gemini" (chat-centric AI wrapper)
- **TO:** "Mission Control for AI Agents" (task-centric dashboard + deploy)

### Files Modified (10)

| File | What Changed | Why |
|------|-------------|-----|
| `src/components/landing/hero.tsx` | Complete rewrite. New headline "Mission Control for AI Agents." New mockup showing task list + activity feed + result panel instead of chat bubbles. | The old hero positioned Clawdify as a ChatGPT alternative. The new hero immediately communicates the Mission Control paradigm — tasks, activity feed, real-time monitoring. |
| `src/components/landing/features.tsx` | Replaced 8 feature cards. New features: real-time activity feed, task-based workflow, one-click deploy, BYOG, multi-device, artifact preview, notifications, BYOK privacy. Uses lucide-react icons instead of emoji. | Old features (multi-model, privacy, dark mode) were for a chat app. New features reflect the Mission Control dashboard value props. |
| `src/components/landing/how-it-works.tsx` | Rewritten 3-step flow: Click Deploy → Add API Key → Create Task. Uses lucide icons. Added detail lines under each step. Updated header copy. | Old flow (Sign up → Connect → Chat) was generic. New flow specifically shows the deploy-button acquisition path with clear time-to-value ("5 minutes"). |
| `src/components/landing/pricing-table.tsx` | Reduced from 3 tiers (Free/Pro $15/Self-Hosted) to 2 tiers (Free/Pro $12). 2-column layout. Updated feature lists for Mission Control features. Added note about deploy-button infrastructure costs. | Old pricing compared a chat app. New pricing reflects the BYOG-free / Pro-$12 strategy from the strategist analysis. Two tiers is cleaner and matches the middle-ground strategy. |
| `src/components/landing/comparison.tsx` | Replaced "Clawdify vs ChatGPT vs Claude" table with "Clawdify vs Terminal" comparison. | We're NOT competing with ChatGPT/Claude (per positioning brief). The real comparison for our ICP is "why use a dashboard vs the terminal I already have?" |
| `src/components/landing/faq.tsx` | Complete rewrite. 10 new questions covering: what is Clawdify, how it differs from ChatGPT, deploy vs BYOG, API key security, what the agent runs on, data safety, model support, cancellation, what is OpenClaw. | Old FAQs were for a chat wrapper. New FAQs address the real questions our ICP will have — especially around the deploy-button flow, infrastructure ownership, and key custody. |
| `src/components/landing/cta-section.tsx` | Updated headline ("Your AI agent is 5 minutes away"), copy, and CTA button text ("Deploy Your Agent"). Added "Free tier available" subtext. | Matches the deploy-centric positioning. Creates urgency with the 5-minute time-to-value claim. |
| `src/components/landing/testimonials.tsx` | Replaced trust badges with "Built For" developer personas section. 4 personas: freelancers, side-project builders, startup engineers, AI-curious devs. Each has a description + aspirational quote. | We don't have real testimonials yet (pre-launch). Persona-based messaging lets visitors self-identify. The aspirational quotes set expectations for what the product delivers. |
| `src/components/landing/nav.tsx` | Added "How It Works" link. Changed CTA button to "Deploy Your Agent". | Nav should reflect the new page structure and primary action. |
| `src/components/landing/footer.tsx` | Updated tagline to "Mission Control for AI agents." Added "How It Works" link. Expanded brand description column. | Consistent messaging throughout. |

### Files Created (1)

| File | What It Does |
|------|-------------|
| `src/components/landing/demo-preview.tsx` | Animated activity feed demo. Uses IntersectionObserver to trigger a line-by-line reveal animation when scrolled into view. Shows a simulated agent building a landing page — reading files, installing deps, creating components, running build. Includes typing indicator dots while "working." |

### Files Updated (3)

| File | What Changed |
|------|-------------|
| `src/app/(marketing)/page.tsx` | New section order: Hero → Features → DemoPreview → HowItWorks → Comparison → Testimonials → Pricing → CTA → FAQ. Added DemoPreview import. Moved Comparison after HowItWorks (logical flow: what → how → why us). |
| `src/app/(marketing)/pricing/page.tsx` | Updated metadata description for new pricing. Added FAQ section between pricing table and CTA. |
| `src/lib/billing/plans.ts` | Updated pricing: Free (2 projects, BYOG) and Pro ($12/mo, unlimited + deploy + cloud features). Kept `byog` PlanId for backward compatibility with dashboard components. Removed Google/Gemini from API_PROVIDERS (not in scope for agent-centric product). Maintained `model`/`modelLabel` fields to avoid breaking billing page. |

---

## Design Decisions

### Why "Mission Control" and not "Dashboard"
"Dashboard" is generic and passive. "Mission Control" evokes NASA — active monitoring, real-time telemetry, commanding something powerful. It differentiates from every other "AI dashboard" out there.

### Why the mockup shows tasks, not chat
The old mockup showed chat bubbles — which made it look like another ChatGPT clone. The new mockup immediately communicates the three-panel Mission Control paradigm: task list → activity feed → results. This is the single biggest visual differentiator.

### Why 2 pricing tiers instead of 3
The old Self-Hosted tier at $0 was confusing alongside Free. Now BYOG IS the free tier, and Pro adds deploy-buttons + cloud features. Simpler to understand, easier to convert.

### Why $12/mo and not $15 or $19
Per the strategist analysis: at $12, we're in the "impulse buy" zone for developers who already spend $40-80/mo on AI tools. $3/mo difference doesn't affect unit economics (99% margin either way) but improves conversion psychology.

### Why no ChatGPT/Claude comparison
Per positioning brief: we're NOT a ChatGPT competitor. Comparing to them signals "we're another AI chat wrapper." The terminal comparison resonates with our ICP (developers who already use CLI tools) and highlights what makes a dashboard genuinely better.

### Why demo-preview uses IntersectionObserver
Scroll-triggered animation creates a "wow" moment as visitors scroll down — they see an agent working line by line. It's lightweight (no Framer Motion dependency needed), works on all browsers, and degrades gracefully (all lines show if JS doesn't trigger).

---

## What I Did NOT Change (Per Boundary Rules)

- `src/app/(app)/*` — Dashboard routes (Dev Agent's territory)
- `src/components/chat/*` — Chat components
- `src/components/tasks/*` — Task components
- `src/components/activity/*` — Activity components
- `src/components/deploy/*` — Deploy page components
- `src/stores/*` — State management
- `src/lib/gateway/*` — Gateway client code
- `src/components/billing/*` — Billing dashboard components

---

## Build Verification

```
$ npx next build
✓ Compiled successfully in 4.3s
✓ Generating static pages (19/19)

Route (app)                    Size  First Load JS
┌ ○ /                       3.35 kB         192 kB
├ ○ /pricing                2.44 kB         191 kB
└ ... (all routes pass)
```

Zero errors. Zero type errors. All pages generate correctly.
