# Clawdify v2 Architecture

## Overview
Clawdify v2 adds hosted mode, relay connectivity, free tier, and billing to the existing workspace app.

## User Tiers & Connection Modes

### 1. Free (Hosted)
- User signs up, gets Gemini Flash via Clawdify's hosted Gateway
- No API key needed, no Gateway, no config
- Limited: 3 projects, basic model
- Revenue: $0 (acquisition funnel)

### 2. Pro (Hosted) — $15/mo
- User provides API key OR buys credits
- Clawdify runs Gateway in cloud on their behalf
- Full features: unlimited projects, Claude/GPT-4, voice, artifacts
- Revenue: $15/mo subscription

### 3. BYOK (Bring Your Own Key) — $10/mo
- User pastes their own API key
- Clawdify hosts the Gateway but user's key is used
- Slightly cheaper since user pays their own API costs
- Revenue: $10/mo

### 4. BYOG (Bring Your Own Gateway) — Free / $5/mo
- User has own OpenClaw Gateway
- Connects via direct WebSocket or relay
- Free for direct WS, $5/mo for relay access
- Revenue: $0-5/mo

## New Pages & Routes

### Public (no auth)
- `/` — Landing page (hero, features, pricing, CTA)
- `/pricing` — Detailed pricing comparison
- `/login` — Auth (existing)
- `/signup` — Auth (existing)

### Authenticated
- `/onboarding` — New multi-path wizard
- `/dashboard` — Main workspace (existing, was `/`)
- `/project/[id]` — Project view (existing)
- `/settings` — Settings (existing, expanded)
- `/settings/billing` — Subscription management
- `/settings/gateway` — Gateway connection config
- `/connect` — Quick connect (existing)

### API Routes
- `/api/auth/callback` — Auth callback (existing)
- `/api/billing/checkout` — Stripe checkout session
- `/api/billing/webhook` — Stripe webhook
- `/api/billing/usage` — Usage stats
- `/api/gateway/provision` — Provision hosted Gateway
- `/api/gateway/status` — Gateway health check

## Database Changes

### New tables (add to Supabase)
```sql
-- User profiles with plan info
ALTER TABLE profiles ADD COLUMN plan TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN api_key_encrypted TEXT;
ALTER TABLE profiles ADD COLUMN api_provider TEXT DEFAULT 'gemini';
ALTER TABLE profiles ADD COLUMN gateway_mode TEXT DEFAULT 'hosted';
ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;

-- Usage tracking
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hosted gateway instances
CREATE TABLE gateway_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'provisioning',
  region TEXT DEFAULT 'iad',
  internal_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now()
);
```

## Relay Server (separate package)
- Location: `packages/relay/`
- Standalone Node.js WebSocket server
- Handles: agent registration, browser pairing, frame forwarding
- Deployable independently to Fly.io
- ~500-1000 lines of code

## File Structure Changes
```
projects/clawdify/
├── packages/
│   └── relay/              # NEW: standalone relay server
│       ├── src/
│       │   ├── server.ts
│       │   ├── room.ts
│       │   └── auth.ts
│       ├── Dockerfile
│       └── package.json
├── src/
│   ├── app/
│   │   ├── (marketing)/    # NEW: public marketing pages
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx    # Landing page
│   │   │   └── pricing/
│   │   │       └── page.tsx
│   │   ├── (app)/          # Existing authenticated pages
│   │   ├── (auth)/         # Existing auth pages
│   │   └── api/
│   │       ├── auth/       # Existing
│   │       └── billing/    # NEW
│   ├── components/
│   │   ├── landing/        # NEW: landing page components
│   │   ├── billing/        # NEW: billing components
│   │   └── onboarding/     # UPDATED: multi-path wizard
│   └── lib/
│       ├── billing/        # NEW: Stripe integration
│       └── relay/          # NEW: relay client
```

## Tech Stack Additions
- `stripe` — billing
- `@stripe/stripe-js` — client-side Stripe
- `ws` — WebSocket server (relay)
- No other new dependencies
