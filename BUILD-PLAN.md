# Clawdify (formerly ClawSpace) — Detailed Build Plan

> **Version:** 1.1 — February 3, 2026
> **Based on:** BUILD-BRIEF.md by Goat, corrected against actual Gateway protocol source code
> **Priority order:** 1. Security  2. Ease of use  3. UX/UI
> **Audience:** An autonomous AI coding agent building this from scratch

---

## Table of Contents

0. [Security Philosophy](#security-philosophy) ← READ THIS FIRST
1. [Before You Start](#before-you-start)
2. [Architecture Overview](#architecture-overview)
3. [Phase 0: Project Scaffolding](#phase-0-project-scaffolding) (~1.5h)
4. [Phase 1: Authentication & Database](#phase-1-authentication--database) (~4h)
5. [Phase 2: Gateway WebSocket Client](#phase-2-gateway-websocket-client) (~5h)
6. [Phase 3: Connection Setup UI](#phase-3-connection-setup-ui) (~2.5h)
7. [Phase 4: Project Spaces](#phase-4-project-spaces) (~3h)
8. [Phase 5: Chat Interface](#phase-5-chat-interface) (~5h)
9. [Phase 6: Streaming & Chat Integration](#phase-6-streaming--chat-integration) (~4h)
10. [Phase 7: Artifact Detection & Preview Panel](#phase-7-artifact-detection--preview-panel) (~3.5h)
11. [Phase 8: Polish & Edge Cases](#phase-8-polish--edge-cases) (~3h)
12. [Phase 9: Deploy](#phase-9-deploy) (~1.5h)
13. [Dependency Graph](#dependency-graph)
14. [What's Deferred to V1.1](#whats-deferred-to-v11)
15. [Security Checklist](#security-checklist) ← GATE EVERY PHASE AGAINST THIS

---

## Security Philosophy

> **Security is not a phase. It is a constraint on every line of code.**

ClawSpace handles gateway tokens that provide full operator access to a user's AI agent — including shell execution, file system access, and messaging. A leaked token is a compromised machine. Treat every token like a private SSH key.

### Priority Order (Non-Negotiable)

1. **🔒 Security** — Every feature ships secure or doesn't ship. No "we'll harden it later."
2. **🎯 Ease of use** — Secure defaults that don't require a PhD to configure.
3. **✨ UX/UI** — Beautiful, but never at the expense of #1 or #2.

### Core Security Principles

| Principle | What It Means in Practice |
|---|---|
| **Secrets never touch localStorage** | Gateway tokens stored only in Supabase (encrypted) or ephemeral memory. Device tokens are acceptable in localStorage (they are scoped, rotatable, and issued by the Gateway). User-provided gateway tokens are NOT. |
| **Validate everything from the wire** | Every WebSocket frame from the Gateway is parsed defensively. Unknown shapes are dropped, not passed through. Type-check before rendering. |
| **Sanitize all rendered content** | Assistant messages can contain arbitrary markdown, HTML, and code. Every render path goes through `rehype-sanitize`. No `dangerouslySetInnerHTML` outside sandboxed iframes. |
| **Iframe = jail** | HTML artifact previews run in sandboxed iframes with a strict `sandbox` attribute and a dedicated CSP. No `allow-same-origin`. |
| **RLS is the real auth** | Supabase RLS policies are the ground truth for data access. Client-side checks are UX conveniences, not security boundaries. Every table has RLS. No exceptions. |
| **Defense in depth** | Security headers (CSP, HSTS, X-Frame-Options) + RLS + input validation + output sanitization + auth middleware. Multiple layers, each independently sufficient. |
| **Fail closed** | If auth state is uncertain, redirect to login. If a WS frame is malformed, drop it. If token decryption fails, require re-entry. Never fall through to an insecure default. |
| **Minimal scopes** | Request only `operator.read` and `operator.write` scopes. Never `operator.admin` unless explicitly needed. |

### Threat Model (What Are We Defending Against?)

| Threat | Attack Vector | Mitigation |
|---|---|---|
| **Token theft via XSS** | Injected script reads localStorage | Tokens NOT in localStorage; CSP blocks inline scripts; `rehype-sanitize` on all markdown |
| **Token theft via URL leakage** | Quick-connect URL with `?token=...` in referrer headers, browser history, server logs | Strip token from URL immediately; `Referrer-Policy: no-referrer`; token stored in memory only until saved to Supabase |
| **Cross-site request forgery** | Attacker page triggers Supabase mutations | Supabase uses JWT in cookies with `SameSite=Lax`; state-changing operations require authenticated session |
| **Malicious assistant output** | AI returns HTML/JS that executes in ClawSpace context | `rehype-sanitize` with strict schema; HTML previews in sandboxed iframe without `allow-same-origin` |
| **Man-in-the-middle on WS** | Attacker intercepts gateway traffic | Recommend `wss://` (Tailscale Serve); warn visually on `ws://` non-localhost connections |
| **Privilege escalation via RLS bypass** | Attacker crafts Supabase queries for other users' data | RLS policies on every table; `auth.uid()` checks; no service role key in browser |
| **Prototype pollution / injection** | Malformed JSON from Gateway | `JSON.parse` + schema validation before processing; no `eval()`, no `new Function()` |

### Security Callout Format

Throughout this plan, security decisions are marked with:

> 🔒 **SECURITY:** Explanation of the security decision and why it matters.

If you see this marker, the described behavior is **mandatory**, not a suggestion.

---

## Before You Start

### 1. Study the Control UI Source (CRITICAL)

The existing OpenClaw Control UI at `dist/control-ui/` is a Vite + Lit SPA that speaks the **exact same protocol** ClawSpace will use. The minified source at `dist/control-ui/assets/index-CXUONUC9.js` contains the reference implementation for:

- **Handshake flow:** Server sends `connect.challenge` event → client responds with `connect` request
- **Device identity generation:** WebCrypto keypair → fingerprint as deviceId → sign the nonce
- **Device token persistence:** Stored per deviceId+role in localStorage, used as auth.token on reconnect
- **Chat events:** Listening for `event` frames where `event === "chat"`, payload matches `ChatEventSchema`
- **RPC pattern:** `{type:"req", id, method, params}` → awaits `{type:"res", id, ok, payload|error}`

Key patterns extracted from the Control UI source:

```typescript
// The Control UI uses these client IDs — we'll register our own
GATEWAY_CLIENT_IDS = {
  WEBCHAT_UI: "webchat-ui",
  CONTROL_UI: "openclaw-control-ui",
  WEBCHAT: "webchat",
  CLI: "cli",
  // ... etc
};

// Modes
GATEWAY_CLIENT_MODES = {
  WEBCHAT: "webchat",  // ← Control UI uses this for chat
  UI: "ui",            // ← Control UI also uses this
  // ...
};
```

> **Important:** The client ID must be one of the allowed values in `GatewayClientIdSchema`. For ClawSpace MVP, use `"webchat-ui"` as the client ID and `"webchat"` as the mode. These are already registered in the protocol. If a custom ID is needed later, it must be added to the OpenClaw source.

### 2. Supabase Project Setup

1. Go to [supabase.com](https://supabase.com) → Create new project
2. Note down:
   - **Project URL:** `https://xxxx.supabase.co`
   - **Anon Key:** (public, safe for browser)
   - **Service Role Key:** (secret, server-only)
3. Enable **Email/Password** auth in Authentication → Providers
4. Disable email confirmation for dev (Authentication → Settings → uncheck "Enable email confirmations")

### 3. Environment Variables

Create `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Defaults (user can override in UI)
NEXT_PUBLIC_DEFAULT_GATEWAY_URL=ws://localhost:18789
```

### 4. Key Protocol Facts (Corrections to BUILD-BRIEF)

The BUILD-BRIEF contains several simplifications that would cause connection failures. Here are the actual protocol details:

| Brief Says | Reality |
|---|---|
| Auth via query params: `?token=...` | Auth is in the `connect` request body: `params.auth.token` |
| Simple JSON-RPC: `{method, params}` | Framed: `{type:"req", id:"...", method:"...", params:{...}}` |
| Response: `{result}` | Response: `{type:"res", id:"...", ok:true, payload:{...}}` |
| Chat events: `{type:"chat", event:"text"}` | Chat events: `{type:"event", event:"chat", payload:{state:"delta", ...}}` |
| `idempotencyKey` is optional | `idempotencyKey` is **required** on `chat.send` |
| Connect with token in URL | Multi-step handshake: challenge → connect request → hello-ok |
| No device identity needed | Device identity required unless `allowInsecureAuth` is enabled |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Supabase │  │   Zustand    │  │   GatewayClient        │ │
│  │ Client   │  │   Stores     │  │   (WebSocket)          │ │
│  │ (auth,db)│  │ (UI state)   │  │                        │ │
│  └────┬─────┘  └──────┬───────┘  └───────────┬────────────┘ │
│       │               │                       │              │
│       │         ┌─────┴─────┐           ┌─────┴──────┐      │
│       │         │  React    │           │  OpenClaw   │      │
│       │         │  Components│←─events──│  Gateway    │      │
│       │         └───────────┘           │  (WS)      │      │
│       │                                 └────────────┘      │
└───────┼──────────────────────────────────────────────────────┘
        │
   ┌────┴────┐
   │Supabase │  (auth, database, storage)
   │ Cloud   │
   └─────────┘
```

**Data Flow:**
1. User authenticates with Supabase (email/password)
2. Gateway connection details stored in Supabase (per user)
3. Browser opens WebSocket directly to user's Gateway
4. Chat messages sent via WS, responses streamed back
5. Messages persisted to Supabase for fast reload + offline access

---

## Phase 0: Project Scaffolding

**Time estimate: ~1.5 hours**
**Dependencies: None**
**Security deliverables:** CSP headers, security headers, strict TypeScript, `.env` gitignore verification

### Step 0.1: Create Next.js App

```bash
npx create-next-app@latest clawspace \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm
```

### Step 0.2: Initialize shadcn/ui

```bash
cd clawspace
npx shadcn@latest init
```

Choose:
- Style: Default
- Base color: Slate
- CSS variables: Yes

Then add the components we'll need:

```bash
npx shadcn@latest add button input label card dialog dropdown-menu \
  separator scroll-area tooltip badge avatar sheet tabs textarea \
  alert skeleton popover command sonner resizable switch select
```

### Step 0.3: Install Dependencies

```bash
npm install zustand @supabase/supabase-js @supabase/ssr \
  react-markdown remark-gfm rehype-highlight \
  rehype-sanitize hast-util-sanitize \
  lucide-react nanoid
```

Dev dependencies:
```bash
npm install -D @types/node
```

### Step 0.4: Configure TypeScript Strict Mode

In `tsconfig.json`, ensure:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Step 0.5: Security Headers (next.config.ts)

> 🔒 **SECURITY:** These headers are set BEFORE any feature code is written. They are the outer perimeter.

**`next.config.ts`**:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking — ClawSpace should never be iframed by third parties
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME-type sniffing (stops browsers from executing uploaded files as scripts)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Prevent token leakage via Referer header (critical for quick-connect URLs)
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser features we don't need
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // CSP — defense-in-depth against XSS
          // NOTE: Next.js requires 'unsafe-eval' in dev; strip it for production
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: self + nonce-based (Next.js will inject nonces)
              "script-src 'self' 'unsafe-inline'",  // TODO: migrate to nonce-based CSP after MVP
              // Styles: self + inline (Tailwind + shadcn use inline styles)
              "style-src 'self' 'unsafe-inline'",
              // Connect: self + Supabase + any gateway WS (user-configured)
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} wss: ws:`,
              // Images: self + Supabase storage + data URIs (base64 images from AI)
              `img-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} data: blob:`,
              // Frames: only self (for artifact preview iframes using srcdoc)
              "frame-src 'self' blob:",
              // Fonts: self
              "font-src 'self'",
              // Block all object/embed
              "object-src 'none'",
              // Block form submissions to third parties
              "form-action 'self'",
              // Prevent framing by third parties (CSP version of X-Frame-Options)
              "frame-ancestors 'none'",
              // Upgrade insecure requests when on HTTPS
              "upgrade-insecure-requests",
            ].join('; '),
          },
          // HSTS — force HTTPS for 1 year (only effective over HTTPS)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

> 🔒 **SECURITY:** The CSP `connect-src` allows `wss:` and `ws:` broadly because gateway URLs are user-configured. This is intentional — the user chooses their own gateway. We compensate by never sending credentials via URL params and by validating the gateway URL format before connecting.

### Step 0.6: Verify .gitignore

Ensure `.gitignore` contains:
```
.env
.env.local
.env.*.local
```

> 🔒 **SECURITY:** Verify this immediately after scaffolding. A committed `.env.local` with `SUPABASE_SERVICE_ROLE_KEY` is a critical exposure.

### Step 0.7: Set Up Tailwind Dark Mode

Tailwind v4 uses CSS-first configuration. In `src/app/globals.css`, ensure dark mode support:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

### Step 0.8: Create Project File Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── project/[id]/page.tsx
│   │   ├── settings/page.tsx
│   │   └── connect/page.tsx       ← Connection health/troubleshooter
│   └── api/
│       └── auth/callback/route.ts
├── components/
│   ├── ui/                         ← shadcn components (auto-generated)
│   ├── providers.tsx               ← Theme + query providers
│   ├── sidebar/
│   │   ├── sidebar.tsx
│   │   ├── project-list.tsx
│   │   └── connection-status.tsx
│   ├── chat/
│   │   ├── message-list.tsx
│   │   ├── message-bubble.tsx
│   │   ├── message-input.tsx
│   │   ├── tool-call-card.tsx
│   │   ├── thinking-indicator.tsx
│   │   └── streaming-text.tsx
│   └── artifacts/
│       ├── artifact-panel.tsx
│       ├── html-preview.tsx
│       ├── markdown-preview.tsx
│       ├── code-preview.tsx
│       └── image-preview.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── gateway/
│   │   ├── client.ts              ← The WebSocket client (CORE)
│   │   ├── types.ts               ← Protocol types
│   │   ├── device-identity.ts     ← WebCrypto device keypair
│   │   └── hooks.ts               ← useGateway, useChat hooks
│   ├── artifacts/
│   │   └── detector.ts
│   └── utils.ts
├── stores/
│   ├── gateway-store.ts
│   ├── chat-store.ts
│   └── project-store.ts
└── types/
    └── index.ts
```

Create placeholder files for each.

---

## Phase 1: Authentication & Database

**Time estimate: ~4 hours**
**Dependencies: Phase 0 complete, Supabase project created**
**Security deliverables:** Encrypted token storage, RLS on every table, auth hardening, password policy

### Step 1.1: Database Schema Migration

Create `supabase/migrations/001_initial.sql`:

```sql
-- ============================================================
-- 🔒 SECURITY: Enable pgcrypto for gateway token encryption
-- ============================================================
create extension if not exists pgcrypto;

-- Encryption key stored as a Supabase Vault secret (or DB-level config).
-- In production, use Supabase Vault. For MVP, use a server-side env var
-- passed to the encryption functions via a Postgres function.
-- The key below is a PLACEHOLDER — replace with a real 32-byte hex key.
-- DO NOT hardcode in migration files for production.

-- Connection settings per user
create table gateway_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Default',
  gateway_url text not null,
  -- 🔒 SECURITY: Token stored as encrypted bytea, NOT plaintext.
  -- Encrypted using pgp_sym_encrypt with a server-side key.
  -- The anon/public role can read the row but NOT decrypt without the key.
  gateway_token_encrypted bytea,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, name)
);

-- 🔒 SECURITY: Server-side functions for token encrypt/decrypt.
-- These run with SECURITY DEFINER so the encryption key is never
-- exposed to the client. The key is read from a Supabase secret or
-- environment variable.

-- For MVP: store the encryption key in a Supabase Vault secret named
-- 'gateway_token_key', or fall back to a hardcoded dev key.
-- Production MUST use Vault.

create or replace function encrypt_gateway_token(plain_token text)
returns bytea as $$
begin
  -- Use current_setting to read a server-side variable, with fallback
  return pgp_sym_encrypt(
    plain_token,
    coalesce(
      current_setting('app.gateway_token_key', true),
      'CHANGE_ME_IN_PRODUCTION_32_BYTES!'
    )
  );
end;
$$ language plpgsql security definer;

create or replace function decrypt_gateway_token(encrypted_token bytea)
returns text as $$
begin
  return pgp_sym_decrypt(
    encrypted_token,
    coalesce(
      current_setting('app.gateway_token_key', true),
      'CHANGE_ME_IN_PRODUCTION_32_BYTES!'
    )
  );
end;
$$ language plpgsql security definer;

-- 🔒 SECURITY: Helper to save a connection (encrypts token server-side)
create or replace function save_gateway_connection(
  p_name text,
  p_gateway_url text,
  p_gateway_token text default null
)
returns uuid as $$
declare
  v_id uuid;
begin
  insert into gateway_connections (user_id, name, gateway_url, gateway_token_encrypted)
  values (
    auth.uid(),
    p_name,
    p_gateway_url,
    case when p_gateway_token is not null
      then encrypt_gateway_token(p_gateway_token)
      else null
    end
  )
  on conflict (user_id, name)
  do update set
    gateway_url = excluded.gateway_url,
    gateway_token_encrypted = case when p_gateway_token is not null
      then encrypt_gateway_token(p_gateway_token)
      else gateway_connections.gateway_token_encrypted
    end,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

-- 🔒 SECURITY: Helper to retrieve a connection (decrypts token server-side)
-- Only returns the token for the authenticated user's own connections.
create or replace function get_gateway_connection(p_name text default 'Default')
returns table (
  id uuid,
  name text,
  gateway_url text,
  gateway_token text,
  is_active boolean
) as $$
begin
  return query
  select
    gc.id,
    gc.name,
    gc.gateway_url,
    case when gc.gateway_token_encrypted is not null
      then decrypt_gateway_token(gc.gateway_token_encrypted)
      else null
    end as gateway_token,
    gc.is_active
  from gateway_connections gc
  where gc.user_id = auth.uid()
    and gc.name = p_name;
end;
$$ language plpgsql security definer;

-- Projects
create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  icon text default '📁',
  color text default '#6366f1',
  session_key text not null,
  model text,
  custom_instructions text,
  archived boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, session_key)
);

-- Chat messages (local mirror of Gateway transcripts)
create table messages (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_calls jsonb default '[]',
  run_id text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Artifacts extracted from messages
create table artifacts (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  message_id uuid references messages(id) on delete set null,
  name text not null,
  type text not null check (type in ('html', 'markdown', 'code', 'image', 'file')),
  language text,           -- for code artifacts
  content text,            -- inline content
  file_url text,           -- Supabase storage URL (binary)
  mime_type text,
  size_bytes bigint,
  created_at timestamptz default now()
);

-- Indexes
create index idx_messages_project_id on messages(project_id);
create index idx_messages_created_at on messages(project_id, created_at desc);
create index idx_artifacts_project_id on artifacts(project_id);
create index idx_projects_user_id on projects(user_id);

-- ============================================================
-- 🔒 SECURITY: Row Level Security (MANDATORY — every table)
-- This is the REAL authorization layer. Client-side checks are
-- convenience only. RLS is what prevents user A from reading
-- user B's data even if the client is compromised.
-- ============================================================
alter table gateway_connections enable row level security;
alter table projects enable row level security;
alter table messages enable row level security;
alter table artifacts enable row level security;

-- 🔒 SECURITY: Split policies by operation for audit clarity.
-- Using separate SELECT/INSERT/UPDATE/DELETE policies instead of
-- a single "for all" makes it easier to reason about permissions.

-- Gateway connections: users see only their own
create policy "connections_select" on gateway_connections
  for select using (auth.uid() = user_id);
create policy "connections_insert" on gateway_connections
  for insert with check (auth.uid() = user_id);
create policy "connections_update" on gateway_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "connections_delete" on gateway_connections
  for delete using (auth.uid() = user_id);

-- 🔒 SECURITY: Block direct reads of gateway_token_encrypted column.
-- Users should use get_gateway_connection() function instead.
-- The RLS policy allows row access but the encrypted column is opaque
-- without the decryption key (which only the SECURITY DEFINER functions have).

-- Projects: users see only their own
create policy "projects_select" on projects
  for select using (auth.uid() = user_id);
create policy "projects_insert" on projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update" on projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_delete" on projects
  for delete using (auth.uid() = user_id);

-- Messages: users access messages in their own projects only
create policy "messages_select" on messages
  for select using (project_id in (select id from projects where user_id = auth.uid()));
create policy "messages_insert" on messages
  for insert with check (project_id in (select id from projects where user_id = auth.uid()));
create policy "messages_update" on messages
  for update using (project_id in (select id from projects where user_id = auth.uid()));
create policy "messages_delete" on messages
  for delete using (project_id in (select id from projects where user_id = auth.uid()));

-- Artifacts: same pattern as messages
create policy "artifacts_select" on artifacts
  for select using (project_id in (select id from projects where user_id = auth.uid()));
create policy "artifacts_insert" on artifacts
  for insert with check (project_id in (select id from projects where user_id = auth.uid()));
create policy "artifacts_update" on artifacts
  for update using (project_id in (select id from projects where user_id = auth.uid()));
create policy "artifacts_delete" on artifacts
  for delete using (project_id in (select id from projects where user_id = auth.uid()));

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger gateway_connections_updated_at
  before update on gateway_connections
  for each row execute function update_updated_at();
```

Run via Supabase dashboard SQL editor or `supabase db push`.

### Step 1.2: Supabase Client Setup

**`src/lib/supabase/client.ts`** — Browser client:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

**`src/lib/supabase/server.ts`** — Server client:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component — can't set cookies
          }
        },
      },
    },
  );
}
```

### Step 1.3: Auth Middleware

**`src/middleware.ts`**:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const publicPaths = ['/login', '/signup', '/api/auth/callback'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### Step 1.4: Login & Signup Pages

**`src/app/(auth)/login/page.tsx`**:

Build a clean login form with:
- Email + password fields
- "Sign up" link
- Error display (toast via Sonner)
- Quick-connect support: check URL params `?gatewayUrl=...&token=...` and store them in localStorage before redirecting to the app (see Step 3.3)

**`src/app/(auth)/signup/page.tsx`**:

- Email + password + confirm password
- "Already have an account? Log in" link
- Redirect to `/` on success

### Step 1.5: Auth Callback Route

**`src/app/api/auth/callback/route.ts`**:

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/`);
}
```

### Step 1.6: Auth Hardening (Supabase Dashboard Configuration)

> 🔒 **SECURITY:** Configure these settings in the Supabase dashboard BEFORE any user-facing code ships.

**Authentication → Settings:**

1. **Password minimum length:** Set to 8 characters minimum (12+ recommended)
2. **Enable email confirmation** for production (disable only in development)
3. **Disable signup** if you want invite-only access during beta
4. **Session lifetime:** Set JWT expiry to 1 hour, refresh token to 7 days
5. **Rate limiting:** Supabase has built-in rate limits; verify they're enabled:
   - Sign-in: 30 requests per hour per IP
   - Sign-up: 6 per hour per IP
   - Token refresh: 30 per hour per session

**Authentication → URL Configuration:**

1. **Site URL:** Set to your production domain (`https://clawspace.app`)
2. **Redirect URLs:** Add only your known domains. Do NOT use wildcards in production.

**Database → Extensions:**

1. Enable `pgcrypto` (needed for token encryption)

**API → Settings:**

1. Verify the service role key is NEVER exposed in client-side code
2. The anon key is public by design — security comes from RLS, not key secrecy

> 🔒 **SECURITY:** Test RLS policies before proceeding. Create a test user, insert a project, then try to query it as a different user. The query must return zero rows. This is your most important security test.

---

## Phase 2: Gateway WebSocket Client

**Time estimate: ~5 hours**
**Dependencies: Phase 0**
**Security deliverables:** Gateway URL validation, frame schema validation, token handling hygiene, WS protocol security

This is the most critical module in the entire app. It must implement the Gateway protocol exactly.

> 🔒 **SECURITY:** This module directly handles gateway tokens and opens WebSocket connections to user-controlled URLs. Every input must be validated. Tokens must never appear in logs, URLs, error messages, or stack traces.

### Step 2.1: Protocol Types

**`src/lib/gateway/types.ts`**:

```typescript
// ===== Frame Types (the actual wire format) =====

export interface RequestFrame {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: ErrorShape;
}

export interface EventFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
}

export type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

export interface ErrorShape {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

// ===== Connect Handshake =====

export interface ConnectChallenge {
  nonce: string;
  ts: number;
}

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;           // Must be a valid GatewayClientId
    displayName?: string;
    version: string;
    platform: string;
    deviceFamily?: string;
    modelIdentifier?: string;
    mode: string;         // Must be a valid GatewayClientMode
    instanceId?: string;
  };
  role?: string;
  scopes?: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce?: string;
  };
  auth?: {
    token?: string;
    password?: string;
  };
  locale?: string;
  userAgent?: string;
}

export interface HelloOk {
  type: 'hello-ok';
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  snapshot: Snapshot;
  canvasHostUrl?: string;
  auth?: {
    deviceToken: string;
    role: string;
    scopes: string[];
    issuedAtMs?: number;
  };
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
}

export interface Snapshot {
  presence: PresenceEntry[];
  health: unknown;
  stateVersion: { presence: number; health: number };
  uptimeMs: number;
  configPath?: string;
  stateDir?: string;
  sessionDefaults?: {
    defaultAgentId: string;
    mainKey: string;
    mainSessionKey: string;
    scope?: string;
  };
}

export interface PresenceEntry {
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  mode?: string;
  lastInputSeconds?: number;
  ts: number;
  deviceId?: string;
  roles?: string[];
  scopes?: string[];
  instanceId?: string;
}

// ===== Chat Types =====

export interface ChatSendParams {
  sessionKey: string;
  message: string;
  thinking?: string;
  deliver?: boolean;
  attachments?: unknown[];
  timeoutMs?: number;
  idempotencyKey: string;  // REQUIRED — not optional
}

export interface ChatSendResult {
  runId: string;
  status: 'started' | 'in_flight' | 'ok';
}

export interface ChatHistoryParams {
  sessionKey: string;
  limit?: number;  // 1-1000
}

export interface ChatAbortParams {
  sessionKey: string;
  runId?: string;
}

export interface ChatInjectParams {
  sessionKey: string;
  message: string;
  label?: string;
}

/** Chat event payload — delivered as EventFrame with event="chat" */
export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';  // NOT "event" field
  message?: unknown;       // The content delta or final message
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}

// ===== Session Types =====

export interface SessionsListParams {
  limit?: number;
  activeMinutes?: number;
  includeGlobal?: boolean;
  includeUnknown?: boolean;
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
  label?: string;
  spawnedBy?: string;
  agentId?: string;
  search?: string;
}

export interface SessionsPatchParams {
  key: string;
  label?: string | null;
  thinkingLevel?: string | null;
  model?: string | null;
  // ... many more optional fields
}

export interface SessionsResetParams {
  key: string;
}

export interface SessionsDeleteParams {
  key: string;
  deleteTranscript?: boolean;
}

// ===== Agent Events (tool calls etc.) =====

export interface AgentEventPayload {
  runId: string;
  seq: number;
  stream: string;     // e.g. "agent:main:clawspace:xxx"
  ts: number;
  data: Record<string, unknown>;
}

// ===== Connection Config =====

export interface GatewayConnectionConfig {
  url: string;
  token?: string;
  password?: string;
  /** If true, skip device identity (only works with allowInsecureAuth on Gateway) */
  insecureAuth?: boolean;
}

// 🔒 SECURITY: Gateway URL validation — prevent connecting to arbitrary endpoints
export function validateGatewayUrl(url: string): { valid: boolean; error?: string; isInsecure?: boolean } {
  try {
    const parsed = new URL(url);
    // Must be ws: or wss: protocol
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return { valid: false, error: 'URL must use ws:// or wss:// protocol' };
    }
    // Block obviously dangerous targets
    if (parsed.hostname === '' || parsed.hostname === '0.0.0.0') {
      return { valid: false, error: 'Invalid hostname' };
    }
    // Warn about insecure connections (non-localhost ws://)
    const isLocalhost = parsed.hostname === 'localhost' ||
                        parsed.hostname === '127.0.0.1' ||
                        parsed.hostname === '::1';
    const isInsecure = parsed.protocol === 'ws:' && !isLocalhost;
    return { valid: true, isInsecure };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
```

### Step 2.2: Device Identity Module

**`src/lib/gateway/device-identity.ts`**:

The Gateway requires device identity for non-local connections. This involves:
1. Generating an ECDSA P-256 keypair via WebCrypto
2. Deriving a deviceId from the public key fingerprint
3. Signing the challenge nonce
4. Persisting the keypair in IndexedDB

```typescript
const DB_NAME = 'clawspace-device';
const STORE_NAME = 'keys';
const KEY_ID = 'device-keypair';

interface StoredIdentity {
  deviceId: string;
  publicKey: string;  // base64 SPKI
  privateKey: CryptoKey;
}

let cached: StoredIdentity | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,  // private key NOT extractable
    ['sign', 'verify'],
  );
}

function arrayToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToArray(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveDeviceId(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  const hash = await crypto.subtle.digest('SHA-256', spki);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 32);  // 32-char hex fingerprint
}

export async function getDeviceIdentity(): Promise<StoredIdentity | null> {
  // Check if WebCrypto is available (requires secure context)
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.warn('WebCrypto not available — device identity disabled');
    return null;
  }

  if (cached) return cached;

  try {
    const db = await openDB();

    // Try to load existing
    const existing = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(KEY_ID);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (existing?.privateKey && existing?.publicKeyB64 && existing?.deviceId) {
      cached = {
        deviceId: existing.deviceId,
        publicKey: existing.publicKeyB64,
        privateKey: existing.privateKey,
      };
      return cached;
    }

    // Generate new
    const keyPair = await generateKeyPair();
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyB64 = arrayToBase64(spki);
    const deviceId = await deriveDeviceId(keyPair.publicKey);

    // Store
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(
        { deviceId, publicKeyB64, privateKey: keyPair.privateKey },
        KEY_ID,
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    cached = { deviceId, publicKey: publicKeyB64, privateKey: keyPair.privateKey };
    return cached;
  } catch (err) {
    console.warn('Failed to create device identity:', err);
    return null;
  }
}

/**
 * Build the signing payload for challenge nonce.
 * Must match what the Gateway expects.
 */
function buildSignPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce: string | undefined;
}): string {
  // The Control UI builds a JSON payload to sign.
  // Exact format must match server expectation.
  return JSON.stringify({
    deviceId: params.deviceId,
    clientId: params.clientId,
    clientMode: params.clientMode,
    role: params.role,
    scopes: params.scopes,
    signedAt: params.signedAtMs,
    token: params.token,
    nonce: params.nonce,
  });
}

export async function signChallenge(
  privateKey: CryptoKey,
  payload: string,
): Promise<string> {
  const encoded = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoded,
  );
  return arrayToBase64(signature);
}

export { buildSignPayload };
```

### Step 2.3: Device Token Storage

**`src/lib/gateway/device-token.ts`**:

The Gateway issues device tokens after successful pairing. Store per deviceId+role:

```typescript
const STORAGE_KEY_PREFIX = 'clawspace.deviceToken.';

interface StoredDeviceToken {
  token: string;
  role: string;
  scopes: string[];
}

export function getStoredDeviceToken(deviceId: string, role: string): string | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${deviceId}.${role}`);
    if (!raw) return null;
    const parsed: StoredDeviceToken = JSON.parse(raw);
    return parsed.token || null;
  } catch {
    return null;
  }
}

export function storeDeviceToken(
  deviceId: string,
  role: string,
  token: string,
  scopes: string[],
): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${deviceId}.${role}`,
      JSON.stringify({ token, role, scopes }),
    );
  } catch {
    // localStorage full or unavailable
  }
}

export function clearDeviceToken(deviceId: string, role: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${deviceId}.${role}`);
  } catch {
    // ignore
  }
}
```

### Step 2.4: The Gateway WebSocket Client (CORE)

**`src/lib/gateway/client.ts`**:

This is the heart of the app. It handles:
- WebSocket connection lifecycle
- Multi-step handshake (challenge → connect → hello-ok)
- Request/response correlation by `id`
- Event routing (chat events, tick events, agent events)
- Reconnection with exponential backoff
- Device identity + token management

```typescript
import { nanoid } from 'nanoid';
import {
  type GatewayFrame,
  type RequestFrame,
  type ResponseFrame,
  type EventFrame,
  type ConnectParams,
  type HelloOk,
  type ConnectChallenge,
  type GatewayConnectionConfig,
  type ChatEventPayload,
  type AgentEventPayload,
} from './types';
import {
  getDeviceIdentity,
  signChallenge,
  buildSignPayload,
} from './device-identity';
import {
  getStoredDeviceToken,
  storeDeviceToken,
  clearDeviceToken,
} from './device-token';

const PROTOCOL_VERSION = 3;
const CLIENT_ID = 'webchat-ui';       // Must be valid GatewayClientId
const CLIENT_MODE = 'webchat';        // Must be valid GatewayClientMode
const CLIENT_VERSION = '0.1.0';
const ROLE = 'operator';
const SCOPES = ['operator.read', 'operator.write'];
const RPC_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 5_000;

type ConnectionStatus = 'disconnected' | 'connecting' | 'handshaking' | 'connected' | 'error';

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface GatewayClientEvents {
  onStatusChange?: (status: ConnectionStatus) => void;
  onHello?: (hello: HelloOk) => void;
  onChatEvent?: (payload: ChatEventPayload) => void;
  onAgentEvent?: (payload: AgentEventPayload) => void;
  onEvent?: (event: EventFrame) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: string) => void;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private config: GatewayConnectionConfig | null = null;
  private events: GatewayClientEvents = {};
  private status: ConnectionStatus = 'disconnected';
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 800;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private lastSeq: number | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private helloPayload: HelloOk | null = null;
  private instanceId = nanoid(12);

  constructor(events?: GatewayClientEvents) {
    if (events) this.events = events;
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  get isConnected(): boolean {
    return this.status === 'connected';
  }

  get hello(): HelloOk | null {
    return this.helloPayload;
  }

  /** Update event handlers (e.g. when React re-renders) */
  setEvents(events: GatewayClientEvents): void {
    this.events = events;
  }

  /** Connect to a Gateway */
  connect(config: GatewayConnectionConfig): void {
    this.closed = false;
    this.config = config;
    this.doConnect();
  }

  /** Disconnect and stop reconnecting */
  disconnect(): void {
    this.closed = true;
    this.cleanup();
    this.setStatus('disconnected');
  }

  /** Send an RPC request and await the response */
  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway not connected');
    }

    const id = nanoid();
    const frame: RequestFrame = { type: 'req', id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, RPC_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (payload) => resolve(payload as T),
        reject,
        timer,
      });

      this.ws!.send(JSON.stringify(frame));
    });
  }

  // ── Private ──────────────────────────────────────────────

  private setStatus(s: ConnectionStatus): void {
    if (this.status !== s) {
      this.status = s;
      this.events.onStatusChange?.(s);
    }
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.flushPending(new Error('Connection closed'));
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.connectNonce = null;
    this.connectSent = false;
    this.lastSeq = null;
  }

  private doConnect(): void {
    if (this.closed || !this.config) return;
    this.cleanup();
    this.setStatus('connecting');

    // 🔒 SECURITY: Validate URL before connecting
    const validation = (await import('./types')).validateGatewayUrl(this.config.url);
    if (!validation.valid) {
      this.setStatus('error');
      this.events.onError?.(new Error(validation.error ?? 'Invalid gateway URL'));
      return;
    }

    const wsUrl = this.config.url;
    // 🔒 SECURITY: Token is NEVER sent as a URL query parameter.
    // Query params leak into server logs, browser history, Referer headers, and
    // proxy logs. The token is sent inside the connect handshake body over the
    // encrypted WS connection.
    this.ws = new WebSocket(wsUrl);

    // Set a timeout for the connect handshake
    this.connectTimer = setTimeout(() => {
      if (this.status !== 'connected') {
        this.ws?.close(4000, 'connect timeout');
        this.setStatus('error');
        this.events.onError?.(new Error('Connection timeout — no challenge received'));
        this.scheduleReconnect();
      }
    }, CONNECT_TIMEOUT_MS);

    this.ws.onopen = () => {
      this.setStatus('handshaking');
      // Wait for server to send connect.challenge event
      // (the connectTimer handles timeout)
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data as string);
    };

    this.ws.onclose = (event) => {
      const reason = event.reason || 'unknown';
      this.flushPending(new Error(`Gateway closed (${event.code}): ${reason}`));
      this.events.onClose?.(event.code, reason);
      if (!this.closed) {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onerror fires before onclose — actual handling in onclose
    };
  }

  private handleMessage(raw: string): void {
    // 🔒 SECURITY: Defensive parsing — never trust data from the wire.
    // Malformed frames are dropped silently (fail closed).
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(raw);
    } catch {
      return; // Drop malformed JSON
    }

    // 🔒 SECURITY: Validate frame shape before processing.
    // Must have a 'type' field that matches known frame types.
    if (typeof frame !== 'object' || frame === null || !('type' in frame)) {
      return; // Drop shapeless frames
    }

    if (frame.type === 'event') {
      const event = frame as EventFrame;
      if (typeof event.event !== 'string') return; // Drop invalid events
      this.handleEvent(event);
      return;
    }

    if (frame.type === 'res') {
      const res = frame as ResponseFrame;
      if (typeof res.id !== 'string' || typeof res.ok !== 'boolean') return; // Drop invalid responses
      this.handleResponse(res);
      return;
    }

    // Unknown frame type — drop it (fail closed)
  }

  private handleEvent(event: EventFrame): void {
    // ── Connect challenge ──
    if (event.event === 'connect.challenge') {
      const payload = event.payload as ConnectChallenge | undefined;
      const nonce = payload && typeof payload.nonce === 'string' ? payload.nonce : null;
      if (nonce) {
        this.connectNonce = nonce;
        this.sendConnect();
      }
      return;
    }

    // ── Sequence tracking ──
    if (typeof event.seq === 'number') {
      if (this.lastSeq !== null && event.seq > this.lastSeq + 1) {
        console.warn(`[gateway] seq gap: expected ${this.lastSeq + 1}, got ${event.seq}`);
      }
      this.lastSeq = event.seq;
    }

    // ── Chat events ──
    if (event.event === 'chat') {
      const payload = event.payload as ChatEventPayload;
      this.events.onChatEvent?.(payload);
      return;
    }

    // ── Agent events (tool calls, etc.) ──
    if (event.event === 'agent') {
      const payload = event.payload as AgentEventPayload;
      this.events.onAgentEvent?.(payload);
      return;
    }

    // ── Tick (keepalive) ──
    if (event.event === 'tick') {
      // No action needed — the server sends these to keep the connection alive
      return;
    }

    // ── Shutdown ──
    if (event.event === 'shutdown') {
      console.warn('[gateway] Server shutting down:', event.payload);
      return;
    }

    // ── Forward all other events ──
    this.events.onEvent?.(event);
  }

  private handleResponse(res: ResponseFrame): void {
    const pending = this.pending.get(res.id);
    if (!pending) return;
    this.pending.delete(res.id);
    clearTimeout(pending.timer);

    if (res.ok) {
      pending.resolve(res.payload);
    } else {
      const msg = res.error?.message ?? 'Request failed';
      const err = new Error(msg);
      (err as any).code = res.error?.code;
      (err as any).retryable = res.error?.retryable;
      pending.reject(err);
    }
  }

  private async sendConnect(): Promise<void> {
    if (this.connectSent || !this.config) return;
    this.connectSent = true;

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const hasSubtle = typeof crypto !== 'undefined' && !!crypto.subtle;
    let device: ConnectParams['device'] = undefined;
    let authToken = this.config.token;
    let usedStoredDeviceToken = false;

    // ── Build device identity (if WebCrypto available and not insecure mode) ──
    if (hasSubtle && !this.config.insecureAuth) {
      try {
        const identity = await getDeviceIdentity();
        if (identity) {
          // Check for stored device token (from prior pairing)
          const storedToken = getStoredDeviceToken(identity.deviceId, ROLE);
          if (storedToken) {
            authToken = storedToken;
            usedStoredDeviceToken = true;
          }

          // Sign the challenge nonce
          const signedAtMs = Date.now();
          const payload = buildSignPayload({
            deviceId: identity.deviceId,
            clientId: CLIENT_ID,
            clientMode: CLIENT_MODE,
            role: ROLE,
            scopes: SCOPES,
            signedAtMs,
            token: authToken ?? null,
            nonce: this.connectNonce ?? undefined,
          });

          const signature = await signChallenge(identity.privateKey, payload);

          device = {
            id: identity.deviceId,
            publicKey: identity.publicKey,
            signature,
            signedAt: signedAtMs,
            nonce: this.connectNonce ?? undefined,
          };
        }
      } catch (err) {
        console.warn('[gateway] Device identity failed:', err);
      }
    }

    // ── Build auth ──
    const auth: ConnectParams['auth'] =
      authToken || this.config.password
        ? { token: authToken, password: this.config.password }
        : undefined;

    // ── Build connect params ──
    const params: ConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: CLIENT_ID,
        version: CLIENT_VERSION,
        platform: navigator?.platform ?? 'web',
        mode: CLIENT_MODE,
        instanceId: this.instanceId,
      },
      role: ROLE,
      scopes: SCOPES,
      device,
      caps: [],
      auth,
      userAgent: navigator?.userAgent,
      locale: navigator?.language,
    };

    try {
      const hello = await this.request<HelloOk>('connect', params);

      // ── Store device token if issued ──
      if (hello?.auth?.deviceToken && device) {
        storeDeviceToken(
          device.id,
          hello.auth.role ?? ROLE,
          hello.auth.deviceToken,
          hello.auth.scopes ?? [],
        );
      }

      this.helloPayload = hello;
      this.backoffMs = 800;
      this.setStatus('connected');
      this.events.onHello?.(hello);
    } catch (err) {
      // If we used a stored device token and it failed, clear it
      if (usedStoredDeviceToken && device) {
        clearDeviceToken(device.id, ROLE);
      }
      this.events.onError?.(err instanceof Error ? err : new Error(String(err)));
      this.ws?.close(4001, 'connect failed');
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private flushPending(error: Error): void {
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(error);
    }
    this.pending.clear();
  }
}
```

### Step 2.5: React Hooks for Gateway

**`src/lib/gateway/hooks.ts`**:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { GatewayClient } from './client';
import { useGatewayStore } from '@/stores/gateway-store';
import { useChatStore } from '@/stores/chat-store';
import type { ChatEventPayload, HelloOk, GatewayConnectionConfig } from './types';

/** Singleton client instance (shared across the app) */
let clientInstance: GatewayClient | null = null;

export function getGatewayClient(): GatewayClient {
  if (!clientInstance) {
    clientInstance = new GatewayClient();
  }
  return clientInstance;
}

/**
 * Hook to manage Gateway connection lifecycle.
 * Mount this ONCE at the app layout level.
 */
export function useGatewayConnection() {
  const setStatus = useGatewayStore((s) => s.setStatus);
  const setHello = useGatewayStore((s) => s.setHello);
  const config = useGatewayStore((s) => s.config);
  const handleChatEvent = useChatStore((s) => s.handleChatEvent);

  const clientRef = useRef(getGatewayClient());

  useEffect(() => {
    const client = clientRef.current;

    client.setEvents({
      onStatusChange: (status) => setStatus(status),
      onHello: (hello) => setHello(hello),
      onChatEvent: (payload) => handleChatEvent(payload),
      onError: (err) => console.error('[gateway]', err),
    });

    if (config) {
      client.connect(config);
    }

    return () => {
      // Don't disconnect on unmount — keep connection alive
      // Only disconnect when user explicitly disconnects
    };
  }, [config, setStatus, setHello, handleChatEvent]);

  const connect = useCallback((cfg: GatewayConnectionConfig) => {
    useGatewayStore.getState().setConfig(cfg);
    clientRef.current.connect(cfg);
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current.disconnect();
  }, []);

  const testConnection = useCallback(async (cfg: GatewayConnectionConfig): Promise<HelloOk> => {
    // Create a temporary client for testing
    const testClient = new GatewayClient();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        testClient.disconnect();
        reject(new Error('Connection test timeout'));
      }, 10_000);

      testClient.setEvents({
        onHello: (hello) => {
          clearTimeout(timer);
          testClient.disconnect();
          resolve(hello);
        },
        onError: (err) => {
          clearTimeout(timer);
          testClient.disconnect();
          reject(err);
        },
      });

      testClient.connect(cfg);
    });
  }, []);

  return { connect, disconnect, testConnection };
}

/**
 * Hook for chat operations in a specific project.
 */
export function useChat(projectId: string, sessionKey: string) {
  const client = getGatewayClient();
  const addMessage = useChatStore((s) => s.addMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const messages = useChatStore((s) => s.messagesByProject[projectId] ?? []);
  const streaming = useChatStore((s) => s.streamingByProject[projectId]);
  const loading = useChatStore((s) => s.loadingByProject[projectId] ?? false);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!client.isConnected) {
        throw new Error('Not connected to Gateway');
      }

      // Add user message to local store
      addMessage(projectId, {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      });

      setLoading(projectId, true);

      // Send to Gateway — idempotencyKey is REQUIRED
      const idempotencyKey = crypto.randomUUID();
      const result = await client.request('chat.send', {
        sessionKey,
        message: content,
        idempotencyKey,
      });

      return result;
    },
    [client, projectId, sessionKey, addMessage, setLoading],
  );

  const abortGeneration = useCallback(async () => {
    await client.request('chat.abort', { sessionKey });
  }, [client, sessionKey]);

  const loadHistory = useCallback(async () => {
    const result = await client.request<unknown>('chat.history', {
      sessionKey,
      limit: 100,
    });
    return result;
  }, [client, sessionKey]);

  return {
    messages,
    streaming,
    loading,
    sendMessage,
    abortGeneration,
    loadHistory,
  };
}
```

---

## Phase 3: Connection Setup UI

**Time estimate: ~2.5 hours**
**Dependencies: Phase 1, Phase 2**
**Security deliverables:** Token never in localStorage, URL param token scrubbing, insecure connection warnings

### Step 3.1: Gateway Store

**`src/stores/gateway-store.ts`**:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GatewayConnectionConfig, HelloOk } from '@/lib/gateway/types';

type ConnectionStatus = 'disconnected' | 'connecting' | 'handshaking' | 'connected' | 'error';

interface GatewayState {
  status: ConnectionStatus;
  config: GatewayConnectionConfig | null;
  hello: HelloOk | null;
  errorMessage: string | null;

  setStatus: (status: ConnectionStatus) => void;
  setConfig: (config: GatewayConnectionConfig | null) => void;
  setHello: (hello: HelloOk | null) => void;
  setError: (message: string | null) => void;
  /** Load connection config from Supabase (decrypts token server-side) */
  loadFromSupabase: () => Promise<void>;
}

export const useGatewayStore = create<GatewayState>()(
  persist(
    (set) => ({
      status: 'disconnected',
      config: null,
      hello: null,
      errorMessage: null,

      setStatus: (status) => set({ status, errorMessage: status === 'error' ? undefined : null }),
      setConfig: (config) => set({ config }),
      setHello: (hello) => set({ hello }),
      setError: (errorMessage) => set({ errorMessage }),

      loadFromSupabase: async () => {
        // Fetch the decrypted connection from Supabase server-side function
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data, error } = await supabase.rpc('get_gateway_connection', {
          p_name: 'Default',
        });
        if (!error && data?.[0]) {
          const conn = data[0];
          set({
            config: {
              url: conn.gateway_url,
              token: conn.gateway_token ?? undefined,
            },
          });
        }
      },
    }),
    {
      name: 'clawspace-gateway',
      partialize: (state) => ({
        // 🔒 SECURITY: Only persist the gateway URL, NEVER the token.
        // The token is loaded from Supabase (encrypted) on each session start.
        // This prevents token theft via localStorage access (XSS, browser extensions,
        // shared computers, dev tools).
        config: state.config
          ? { url: state.config.url }  // Strip token and password
          : null,
      }),
    },
  ),
);
```

> 🔒 **SECURITY — CRITICAL:** The gateway token provides full operator access to the user's AI agent, including shell execution. It must NEVER be stored in localStorage or sessionStorage. The flow is:
> 1. User enters token in settings → saved to Supabase via `save_gateway_connection()` (encrypted with pgcrypto)
> 2. On page load → `loadFromSupabase()` decrypts and loads into memory-only Zustand state
> 3. On tab close → token is gone from browser memory
> 4. On next visit → token is re-fetched from Supabase (requires authentication)
>
> **Device tokens** (issued by the Gateway after pairing) ARE acceptable in localStorage because they are: scoped to a specific device, rotatable, revocable, and useless without the device's private key.

### Step 3.2: Settings / Connection Page

**`src/app/(app)/settings/page.tsx`**:

Build a settings page with:

1. **Connection Section:**
   - Gateway URL input (text) with protocol hint ("ws:// or wss://")
     - 🔒 Validate URL on blur with `validateGatewayUrl()` — reject non-ws/wss protocols
     - 🔒 Show orange warning banner if `ws://` is used on a non-localhost address: _"⚠️ Unencrypted connection — your gateway token will be sent in plaintext. Use wss:// (Tailscale Serve) for secure connections."_
   - Token input (password field, with show/hide toggle)
     - 🔒 Token is sent to Supabase via `save_gateway_connection()` RPC — never stored client-side
     - 🔒 Show/hide toggle, but default to hidden
     - 🔒 Autocomplete disabled (`autoComplete="off"`)
   - "Allow insecure auth" toggle (checkbox, with warning text about device identity)
     - 🔒 Show explicit warning: _"Disables device identity verification. Only use on trusted networks."_
   - "Test Connection" button → shows success (server version, protocol, features) or error
   - "Save & Connect" button → stores encrypted in Supabase via RPC + loads into Zustand memory
   - Connection status indicator with live state

2. **Tailscale Guidance Section** (informational):
   - Heading: "Connecting via Tailscale (Recommended)"
   - Steps:
     1. Install Tailscale on both machines
     2. On the Gateway host: `openclaw gateway --tailscale serve`
     3. Use `wss://<magicdns>` as the Gateway URL
     4. Token-based auth or Tailscale identity auth
   - Link to OpenClaw Tailscale docs

3. **Account Section:**
   - Email (read-only)
   - Change password
   - Sign out button

### Step 3.3: URL-Based Quick Connect

**WHY:** Frictionless onboarding — users can click a link or scan a QR code from their Gateway to connect instantly.

In the root layout or a dedicated route handler, check URL params on app load:

**`src/app/(app)/layout.tsx`** (client component wrapper):

```typescript
'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGatewayStore } from '@/stores/gateway-store';
import { validateGatewayUrl } from '@/lib/gateway/types';

function QuickConnectHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setConfig = useGatewayStore((s) => s.setConfig);

  useEffect(() => {
    const gatewayUrl = searchParams.get('gatewayUrl');
    const token = searchParams.get('token');

    if (gatewayUrl) {
      // 🔒 SECURITY: Validate the URL before accepting it
      const validation = validateGatewayUrl(gatewayUrl);
      if (!validation.valid) {
        console.warn('[quick-connect] Invalid gateway URL:', validation.error);
      } else {
        // Set config in memory (token stays in Zustand memory, NOT localStorage)
        setConfig({
          url: gatewayUrl,
          token: token ?? undefined,
          insecureAuth: searchParams.get('insecure') === '1',
        });

        // 🔒 SECURITY: If user is authenticated, immediately persist the
        // connection to Supabase (encrypted) so the token doesn't need
        // to stay in-memory or be passed around.
        if (token) {
          import('@/lib/supabase/client').then(({ createClient }) => {
            const supabase = createClient();
            supabase.rpc('save_gateway_connection', {
              p_name: 'Default',
              p_gateway_url: gatewayUrl,
              p_gateway_token: token,
            }).catch(console.error);
          });
        }
      }

      // 🔒 SECURITY: Strip sensitive params from URL IMMEDIATELY.
      // This prevents token leakage via:
      // - Browser history
      // - Referer headers on outbound requests
      // - Browser extensions that read URLs
      // - Screen sharing / screenshots
      // - Server access logs (if URL is visited server-side)
      const url = new URL(window.location.href);
      url.searchParams.delete('gatewayUrl');
      url.searchParams.delete('token');
      url.searchParams.delete('insecure');
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, setConfig, router]);

  return null;
}
```

> 🔒 **SECURITY:** The quick-connect URL `?token=...` is a convenience feature with inherent risks. The token appears in browser history and potentially in server logs. Mitigations:
> 1. Token is stripped from URL immediately on load (before any outbound requests)
> 2. `Referrer-Policy: strict-origin-when-cross-origin` header prevents full URL in referrers
> 3. Token is persisted to Supabase (encrypted) and removed from the URL in one atomic operation
> 4. Users should be advised to use this feature only over HTTPS

Supported URL format:
```
https://clawspace.app/?gatewayUrl=wss://my-server.tail1234.ts.net&token=abc123
```

### Step 3.4: Connection Health / Troubleshooter Page

**`src/app/(app)/connect/page.tsx`**:

A diagnostic page that helps users troubleshoot connection issues:

1. **Current Status:** Connected / Disconnected / Error
2. **Connectivity Checks:**
   - Is the Gateway URL reachable? (try WS connection)
   - Is the token valid? (did handshake succeed?)
   - Is device identity working? (WebCrypto available? Secure context?)
   - Protocol version match?
3. **Common Issues:**
   - "Connection refused" → Gateway not running, wrong port
   - "Device identity required" → Need HTTPS or `allowInsecureAuth`
   - "Protocol mismatch" → OpenClaw version too old/new
   - "Token rejected" → Wrong token
4. **Gateway Info (when connected):**
   - Server version, protocol version
   - Available methods and events
   - Uptime
   - Active sessions

---

## Phase 4: Project Spaces

**Time estimate: ~3 hours**
**Dependencies: Phase 1 (database), Phase 3 (connection)**
**Security deliverables:** Input validation on project names, session key integrity, project ID validation in routes

### Step 4.1: Project Store

**`src/stores/project-store.ts`**:

```typescript
import { create } from 'zustand';

interface Project {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sessionKey: string;
  model: string | null;
  customInstructions: string | null;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;

  setProjects: (projects: Project[]) => void;
  setActiveProject: (id: string | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProjectId: null,
  loading: false,

  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProjectId) => set({ activeProjectId }),
  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    })),
  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    })),
  setLoading: (loading) => set({ loading }),
}));
```

### Step 4.2: Project CRUD Operations

**`src/lib/projects.ts`**:

```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createProject(params: {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 🔒 SECURITY: Validate and sanitize inputs
  const name = params.name.trim().slice(0, 100);
  if (!name) throw new Error('Project name is required');

  // 🔒 SECURITY: Validate icon is a single emoji or short string, not arbitrary HTML
  const icon = (params.icon ?? '📁').slice(0, 8);

  // 🔒 SECURITY: Validate color is a hex color
  const color = /^#[0-9a-fA-F]{6}$/.test(params.color ?? '')
    ? params.color!
    : '#6366f1';

  // 🔒 SECURITY: Session key is derived from a crypto-random UUID.
  // This prevents users from crafting session keys that collide with
  // other users' sessions or system sessions (e.g. "agent:main:main").
  const projectId = crypto.randomUUID();
  const sessionKey = `agent:main:clawspace:${projectId}`;

  const { data, error } = await supabase
    .from('projects')
    .insert({
      id: projectId,
      user_id: user.id,
      name,
      description: params.description?.trim().slice(0, 500) ?? null,
      icon,
      color,
      session_key: sessionKey,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}
```

### Step 4.3: Sidebar Component

**`src/components/sidebar/sidebar.tsx`**:

Build a sidebar with:
- **Header:** App logo + "ClawSpace" title
- **Connection status indicator** (colored dot: green=connected, yellow=connecting, red=disconnected)
- **Project list:** Scrollable list of projects
  - Each item: icon + name + unread badge
  - Active project highlighted
  - Click to navigate to `/project/[id]`
- **"New Project" button** at the bottom → opens create dialog
- **"Settings" link** at the very bottom (gear icon)

On mobile (< 768px), sidebar becomes a sheet (slide-out drawer) triggered by hamburger menu.

### Step 4.4: New Project Dialog

A dialog/modal with:
- Name input (required)
- Description textarea (optional)
- Icon picker (grid of common emojis)
- Color picker (predefined palette of 12 colors)
- Submit → calls `createProject` → navigates to the new project

### Step 4.5: Project Settings Page

**`src/app/(app)/project/[id]/settings/page.tsx`** (or a dialog from the project view):

- Name, description, icon, color (editable)
- Model override (dropdown or text input)
- Custom instructions (textarea — "These instructions will be appended to every message in this project")
- Session management:
  - "Reset Session" button → calls `sessions.reset` (clears context window)
  - "Delete Session" button → calls `sessions.delete`
- Archive / Delete project

---

## Phase 5: Chat Interface

**Time estimate: ~5 hours**
**Dependencies: Phase 4 (projects exist), Phase 2 (gateway client)**
**Security deliverables:** XSS-safe markdown rendering, sanitized HTML output, safe link handling

### Step 5.1: Chat Store

**`src/stores/chat-store.ts`**:

```typescript
import { create } from 'zustand';
import type { ChatEventPayload } from '@/lib/gateway/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: unknown[];
  runId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  /** True while this message is still streaming */
  isStreaming?: boolean;
}

interface ChatState {
  messagesByProject: Record<string, ChatMessage[]>;
  streamingByProject: Record<string, { runId: string; content: string; seq: number } | undefined>;
  loadingByProject: Record<string, boolean>;

  addMessage: (projectId: string, message: ChatMessage) => void;
  setMessages: (projectId: string, messages: ChatMessage[]) => void;
  setLoading: (projectId: string, loading: boolean) => void;
  handleChatEvent: (payload: ChatEventPayload) => void;
  clearMessages: (projectId: string) => void;
}

/**
 * Resolve projectId from sessionKey.
 * Session keys are: agent:main:clawspace:<projectId>
 */
function projectIdFromSessionKey(sessionKey: string): string | null {
  const prefix = 'agent:main:clawspace:';
  if (sessionKey.startsWith(prefix)) {
    return sessionKey.slice(prefix.length);
  }
  return null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByProject: {},
  streamingByProject: {},
  loadingByProject: {},

  addMessage: (projectId, message) =>
    set((state) => ({
      messagesByProject: {
        ...state.messagesByProject,
        [projectId]: [...(state.messagesByProject[projectId] ?? []), message],
      },
    })),

  setMessages: (projectId, messages) =>
    set((state) => ({
      messagesByProject: {
        ...state.messagesByProject,
        [projectId]: messages,
      },
    })),

  setLoading: (projectId, loading) =>
    set((state) => ({
      loadingByProject: {
        ...state.loadingByProject,
        [projectId]: loading,
      },
    })),

  handleChatEvent: (payload: ChatEventPayload) => {
    const projectId = projectIdFromSessionKey(payload.sessionKey);
    if (!projectId) return;

    const state = get();

    switch (payload.state) {
      case 'delta': {
        // Append streaming content
        const existing = state.streamingByProject[projectId];
        const messageContent = typeof payload.message === 'string'
          ? payload.message
          : (payload.message as any)?.content ?? '';

        if (!existing || existing.runId !== payload.runId) {
          // New stream — create streaming state
          set((s) => ({
            streamingByProject: {
              ...s.streamingByProject,
              [projectId]: {
                runId: payload.runId,
                content: messageContent,
                seq: payload.seq,
              },
            },
            loadingByProject: {
              ...s.loadingByProject,
              [projectId]: false,  // No longer "loading" — now "streaming"
            },
          }));
        } else {
          // Append to existing stream
          set((s) => ({
            streamingByProject: {
              ...s.streamingByProject,
              [projectId]: {
                runId: payload.runId,
                content: existing.content + messageContent,
                seq: payload.seq,
              },
            },
          }));
        }
        break;
      }

      case 'final': {
        // Stream complete — finalize into a message
        const streaming = state.streamingByProject[projectId];
        const finalContent = streaming?.content ?? '';

        set((s) => {
          const messages = s.messagesByProject[projectId] ?? [];
          return {
            messagesByProject: {
              ...s.messagesByProject,
              [projectId]: [
                ...messages,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant' as const,
                  content: finalContent,
                  runId: payload.runId,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
            streamingByProject: {
              ...s.streamingByProject,
              [projectId]: undefined,
            },
            loadingByProject: {
              ...s.loadingByProject,
              [projectId]: false,
            },
          };
        });
        break;
      }

      case 'aborted': {
        // Aborted — finalize whatever we have
        const streaming = state.streamingByProject[projectId];
        if (streaming?.content) {
          set((s) => {
            const messages = s.messagesByProject[projectId] ?? [];
            return {
              messagesByProject: {
                ...s.messagesByProject,
                [projectId]: [
                  ...messages,
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant' as const,
                    content: streaming.content + '\n\n*(generation aborted)*',
                    runId: payload.runId,
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
              streamingByProject: {
                ...s.streamingByProject,
                [projectId]: undefined,
              },
              loadingByProject: {
                ...s.loadingByProject,
                [projectId]: false,
              },
            };
          });
        } else {
          set((s) => ({
            streamingByProject: {
              ...s.streamingByProject,
              [projectId]: undefined,
            },
            loadingByProject: {
              ...s.loadingByProject,
              [projectId]: false,
            },
          }));
        }
        break;
      }

      case 'error': {
        set((s) => ({
          streamingByProject: {
            ...s.streamingByProject,
            [projectId]: undefined,
          },
          loadingByProject: {
            ...s.loadingByProject,
            [projectId]: false,
          },
        }));
        console.error('[chat] Error event:', payload.errorMessage);
        break;
      }
    }
  },

  clearMessages: (projectId) =>
    set((state) => ({
      messagesByProject: {
        ...state.messagesByProject,
        [projectId]: [],
      },
    })),
}));
```

### Step 5.2: Message List Component

**`src/components/chat/message-list.tsx`**:

- Scrollable container using `ScrollArea` from shadcn
- Auto-scroll to bottom on new messages (with smart scroll — only if user is near bottom)
- Load older messages on scroll to top (calls `chat.history` with pagination)
- Render each message via `MessageBubble`
- Show streaming text at the bottom when active
- Empty state: "Start a conversation" with suggestions

### Step 5.3: Message Bubble Component

**`src/components/chat/message-bubble.tsx`**:

- **User messages:** Right-aligned, colored background (project color)
- **Assistant messages:** Left-aligned, neutral background
- **Content rendering:** Full markdown with:
  - `react-markdown` + `remark-gfm` (tables, strikethrough, etc.)
  - `rehype-highlight` (syntax highlighting in code blocks)
  - `rehype-sanitize` (XSS protection — **mandatory**, see below)
  - Custom code block component with copy button + language label
  - Click on code blocks to open in artifact panel
- **Tool call sections:** Collapsible cards showing tool name, input, output
- **Timestamp:** Subtle relative time ("2m ago")
- **Copy button:** On hover, show copy-to-clipboard button

> 🔒 **SECURITY — XSS PREVENTION (CRITICAL):** Assistant messages can contain ANYTHING — the AI or a compromised gateway could emit malicious HTML, JavaScript, or event handlers. EVERY markdown render MUST use `rehype-sanitize` with a strict schema.

**`src/lib/markdown-config.ts`** — Shared sanitization config:

```typescript
import { defaultSchema } from 'hast-util-sanitize';
import type { Schema } from 'hast-util-sanitize';

// 🔒 SECURITY: Custom sanitization schema.
// Start from the GitHub-flavored default and REMOVE dangerous elements.
export const sanitizeSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow class names for syntax highlighting (rehype-highlight)
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className'],
    // 🔒 Block all event handler attributes globally
    '*': (defaultSchema.attributes?.['*'] ?? []).filter(
      (attr) => typeof attr !== 'string' || !attr.startsWith('on')
    ),
  },
  // 🔒 Remove dangerous tags that could execute scripts
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (tag) => !['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'select'].includes(tag)
  ),
  // 🔒 Only allow safe URL protocols in links and images
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],  // No javascript: or data:
    src: ['http', 'https'],             // No data: in img src (prevents data exfil)
  },
};

// Usage in react-markdown:
// <ReactMarkdown rehypePlugins={[[rehypeSanitize, sanitizeSchema], rehypeHighlight]}>
```

> 🔒 **SECURITY:** Links in assistant messages MUST open in a new tab with `rel="noopener noreferrer"`. This prevents the opened page from accessing `window.opener` (which could manipulate ClawSpace). Configure this as a custom `a` component in react-markdown:
>
> ```typescript
> components={{
>   a: ({ href, children }) => (
>     <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
>   ),
> }}
> ```

### Step 5.4: Message Input Component

**`src/components/chat/message-input.tsx`**:

- Multi-line textarea (auto-growing)
- **Enter** to send, **Shift+Enter** for newline
- Send button (arrow icon) — disabled when empty or disconnected
- **Stop button** (square icon) — visible during generation, calls `chat.abort`
- Character count (subtle, when > 1000 chars)
- Disabled state with message when not connected to Gateway

### Step 5.5: Thinking Indicator

**`src/components/chat/thinking-indicator.tsx`**:

- Animated dots or pulse animation
- Shows "Thinking..." while waiting for first `delta` event
- Transitions to streaming text once deltas arrive
- Shows in assistant message position (left-aligned)

### Step 5.6: Streaming Text Display

**`src/components/chat/streaming-text.tsx`**:

- Renders the current streaming content with markdown
- Adds a blinking cursor at the end
- Updates in real-time as `delta` events arrive
- Uses `useMemo` to avoid re-rendering entire markdown on each character

---

## Phase 6: Streaming & Chat Integration

**Time estimate: ~4 hours**
**Dependencies: Phase 5 (UI), Phase 2 (gateway client)**
**Security deliverables:** Event payload validation, safe session key routing, message content bounds checking

### Step 6.1: Wire Up Chat to Gateway

In the project page, connect the chat components to the gateway:

**`src/app/(app)/project/[id]/page.tsx`**:

```typescript
'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { useChat } from '@/lib/gateway/hooks';
import { useGatewayStore } from '@/stores/gateway-store';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { ArtifactPanel } from '@/components/artifacts/artifact-panel';

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === projectId),
  );
  const isConnected = useGatewayStore((s) => s.status === 'connected');

  const {
    messages,
    streaming,
    loading,
    sendMessage,
    abortGeneration,
    loadHistory,
  } = useChat(projectId, project?.sessionKey ?? '');

  // Load history from Gateway on mount
  useEffect(() => {
    if (isConnected && project?.sessionKey) {
      loadHistory().catch(console.error);
    }
  }, [isConnected, project?.sessionKey, loadHistory]);

  // ... render split layout with chat + artifact panel
}
```

### Step 6.2: Message Persistence to Supabase

After each message (user sent, assistant finalized), persist to Supabase:

```typescript
async function persistMessage(projectId: string, message: ChatMessage) {
  const supabase = createClient();
  await supabase.from('messages').insert({
    project_id: projectId,
    role: message.role,
    content: message.content,
    tool_calls: message.toolCalls ?? [],
    run_id: message.runId,
    metadata: message.metadata ?? {},
  });
}
```

Load from Supabase on initial page load (before Gateway history, for instant render):

```typescript
async function loadPersistedMessages(projectId: string): Promise<ChatMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(200);

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls,
    runId: row.run_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}
```

**Strategy:** Load from Supabase first (instant), then reconcile with Gateway history (authoritative). This gives fast initial render + eventual consistency.

### Step 6.3: Handle the `chat.history` Response

The `chat.history` method returns the server's transcript. Map it to our `ChatMessage` format.

> **Note:** The exact shape of the `chat.history` response should be investigated at runtime. It returns the Gateway's internal transcript representation. Parse it defensively.

> 🔒 **SECURITY:** When processing chat history or streaming events from the Gateway:
> 1. **Validate the `sessionKey`** — only process events for sessions that match `agent:main:clawspace:*` where `*` is a UUID that exists in the user's project list. Drop events for unknown session keys.
> 2. **Bound content size** — if a single delta delivers more than 1MB of content, truncate it. This prevents memory exhaustion from a rogue gateway.
> 3. **Never use `eval()` or `new Function()`** on any content from the gateway.
> 4. **Type-check `payload.message`** — it can be a string, an object, or undefined. Handle all cases without crashing.

### Step 6.4: Handle Agent Events (Tool Calls)

Agent events arrive as `{type:"event", event:"agent", payload:{...}}` with:

```typescript
interface AgentEventPayload {
  runId: string;
  seq: number;
  stream: string;   // The session key
  ts: number;
  data: Record<string, unknown>;
}
```

The `data` field contains tool call information. Key data patterns to handle:

- `data.type === "tool_use"` → Tool is being called (name, input)
- `data.type === "tool_result"` → Tool returned a result (content)
- `data.type === "text"` → Text delta
- `data.type === "thinking"` → Thinking/reasoning content

Build a `ToolCallCard` component that shows:
- Tool name (e.g., "exec", "web_search", "Read")
- Input (collapsible JSON)
- Output/result (collapsible, syntax highlighted)
- Status: running → complete

### Step 6.5: Session Initialization

When a project is first opened and the Gateway is connected, ensure the session exists:

1. The session key `agent:main:clawspace:<projectId>` is auto-created by OpenClaw when the first `chat.send` is made to it
2. Optionally, call `sessions.patch` to set a label: `{key: sessionKey, label: projectName}`
3. If the project has a `model` override, call `sessions.patch` with `{key: sessionKey, model: modelId}`
4. If the project has `customInstructions`, these should be prepended to the first message or injected via `chat.inject`

---

## Phase 7: Artifact Detection & Preview Panel

**Time estimate: ~3.5 hours**
**Dependencies: Phase 5 (chat messages exist)**
**Security deliverables:** Sandboxed iframe with strict CSP, no `allow-same-origin`, image validation

### Step 7.1: Artifact Detector

**`src/lib/artifacts/detector.ts`**:

```typescript
export interface DetectedArtifact {
  id: string;
  type: 'html' | 'markdown' | 'code' | 'image';
  name: string;
  language?: string;
  content: string;
  /** Byte position in the source message */
  startOffset: number;
  endOffset: number;
}

const PREVIEWABLE_LANGUAGES = new Set([
  'html', 'css', 'javascript', 'typescript', 'jsx', 'tsx',
  'python', 'json', 'yaml', 'toml', 'xml', 'sql',
  'markdown', 'md', 'bash', 'sh', 'shell',
  'rust', 'go', 'java', 'c', 'cpp', 'ruby', 'php',
  'swift', 'kotlin', 'dart', 'svelte', 'vue',
]);

export function detectArtifacts(content: string): DetectedArtifact[] {
  const artifacts: DetectedArtifact[] = [];

  // Detect fenced code blocks with language
  const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1]!.toLowerCase();
    const code = match[2]!.trim();

    // Only create artifacts for substantial code blocks
    if (code.length < 20) continue;
    if (!PREVIEWABLE_LANGUAGES.has(language)) continue;

    const type = language === 'html' ? 'html'
      : (language === 'markdown' || language === 'md') ? 'markdown'
      : 'code';

    const ext = language === 'typescript' ? 'ts'
      : language === 'javascript' ? 'js'
      : language === 'python' ? 'py'
      : language;

    artifacts.push({
      id: crypto.randomUUID(),
      type,
      name: `snippet.${ext}`,
      language,
      content: code,
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    });
  }

  // Detect base64 images
  const imgRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
  while ((match = imgRegex.exec(content)) !== null) {
    artifacts.push({
      id: crypto.randomUUID(),
      type: 'image',
      name: match[1] || 'image',
      content: match[2]!,
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    });
  }

  return artifacts;
}
```

### Step 7.2: Artifact Panel

**`src/components/artifacts/artifact-panel.tsx`**:

A resizable right panel (using shadcn `ResizablePanelGroup`):
- **Header:** Artifact name + type badge + close button
- **Tab bar:** If multiple artifacts, show tabs
- **Preview area:** Renders based on artifact type
- **Collapsed state:** When no artifact selected, show a minimal bar or hide entirely

### Step 7.3: HTML Preview (Security-Critical Component)

**`src/components/artifacts/html-preview.tsx`**:

> 🔒 **SECURITY — CRITICAL:** HTML artifact previews execute user-generated (AI-generated) HTML and JavaScript. This is the single highest-risk component in the entire app. The sandbox configuration is a security boundary — get it wrong and XSS can compromise the entire ClawSpace session.

```typescript
/**
 * 🔒 SECURITY: HTML Preview uses a heavily sandboxed iframe.
 *
 * NEVER add 'allow-same-origin' to the sandbox. With allow-same-origin,
 * scripts inside the iframe can access the parent page's cookies, localStorage,
 * and Supabase auth tokens. This would be a critical XSS vulnerability.
 *
 * The sandbox attribute set is:
 * - allow-scripts: Let the HTML run JavaScript (needed for interactive previews)
 *
 * Explicitly BLOCKED by omission:
 * - allow-same-origin: Blocks access to parent page's origin/storage/cookies
 * - allow-forms: Blocks form submission (prevents data exfiltration via POST)
 * - allow-popups: Blocks window.open() and target="_blank" links
 * - allow-top-navigation: Blocks redirecting the parent page
 * - allow-modals: Blocks alert(), confirm(), prompt()
 *
 * Additionally, we inject a CSP meta tag into the HTML to further restrict it.
 */

function wrapWithCSP(html: string): string {
  // 🔒 Inject a Content-Security-Policy meta tag that restricts the iframe content
  const cspTag = `<meta http-equiv="Content-Security-Policy" content="${[
    "default-src 'none'",
    // Allow inline scripts (the whole point of the preview)
    "script-src 'unsafe-inline' 'unsafe-eval'",
    // Allow inline styles
    "style-src 'unsafe-inline'",
    // Allow images from data: and https:
    "img-src data: https:",
    // Block ALL network requests (no fetch, XHR, WebSocket, etc.)
    // This prevents the preview from exfiltrating data or loading external resources
    "connect-src 'none'",
    // Block fonts from external sources
    "font-src 'none'",
    // Block frames-within-frames
    "frame-src 'none'",
    // Block form submission
    "form-action 'none'",
  ].join('; ')}">`;

  // Inject before </head> if it exists, otherwise prepend
  if (html.includes('</head>')) {
    return html.replace('</head>', `${cspTag}</head>`);
  }
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${cspTag}`);
  }
  return `<head>${cspTag}</head>${html}`;
}

export function HtmlPreview({ content }: { content: string }) {
  // 🔒 SECURITY: Wrap content with CSP before rendering
  const safeContent = wrapWithCSP(content);

  return (
    <iframe
      srcDoc={safeContent}
      sandbox="allow-scripts"
      // 🔒 No allow-same-origin, no allow-forms, no allow-popups, no allow-top-navigation
      className="w-full h-full border-0 bg-white rounded"
      title="HTML Preview"
      // 🔒 Block the iframe from using certain browser APIs
      allow=""
      referrerPolicy="no-referrer"
    />
  );
}
```

> 🔒 **SECURITY:** The injected CSP `connect-src 'none'` is critical. Without it, a malicious HTML preview could:
> - Make fetch/XHR requests to exfiltrate data visible in the DOM
> - Open WebSocket connections
> - Load external scripts via dynamic `<script src="...">` tags
>
> With the CSP, the preview is a sealed sandbox: it can run JS and render HTML, but it cannot communicate with the outside world.

### Step 7.4: Code Preview

**`src/components/artifacts/code-preview.tsx`**:

- Syntax-highlighted code (same `rehype-highlight` as chat)
- Line numbers
- Copy button (top-right)
- Language label
- Word wrap toggle

### Step 7.5: Markdown Preview

**`src/components/artifacts/markdown-preview.tsx`**:

- Full markdown rendering (same renderer as chat messages)
- Styled container with proper typography

### Step 7.6: Artifact Persistence

After detecting artifacts in a finalized assistant message, save to Supabase:

```typescript
async function persistArtifacts(
  projectId: string,
  messageId: string,
  artifacts: DetectedArtifact[],
) {
  const supabase = createClient();
  const rows = artifacts.map((a) => ({
    project_id: projectId,
    message_id: messageId,
    name: a.name,
    type: a.type,
    language: a.language ?? null,
    content: a.content,
  }));

  if (rows.length > 0) {
    await supabase.from('artifacts').insert(rows);
  }
}
```

---

## Phase 8: Polish & Edge Cases

**Time estimate: ~3 hours**
**Dependencies: All prior phases**

### Step 8.1: Dark Mode

- Implement theme toggle (light/dark/system) using `next-themes` or manual class toggle
- Store preference in localStorage
- All components should use Tailwind `dark:` variants
- Test every component in both modes

### Step 8.2: Responsive Design

- **Mobile sidebar:** Use shadcn `Sheet` component as a slide-out drawer
- **Mobile artifact panel:** Bottom sheet or full-screen overlay (dialog)
- **Touch targets:** Minimum 44px
- **Breakpoints:** 
  - < 768px: mobile (drawer sidebar, stacked layout)
  - 768-1024px: tablet (collapsible sidebar, chat only)
  - > 1024px: desktop (sidebar + chat + artifact panel)

### Step 8.3: Keyboard Shortcuts

- **Cmd/Ctrl + K:** Quick project switcher (command palette using shadcn `Command`)
- **Cmd/Ctrl + N:** New project dialog
- **Escape:** Close artifact panel / dialogs
- **Cmd/Ctrl + Shift + S:** Toggle sidebar

### Step 8.4: Error Handling

- **Error boundaries:** Wrap main layout sections in React error boundaries
- **Toast notifications:** Use Sonner for:
  - Connection errors
  - RPC failures
  - Message send failures
- **Empty states:** Design empty states for:
  - No projects yet
  - No messages in project
  - No artifacts
  - Not connected to Gateway
- **Loading skeletons:** Use shadcn `Skeleton` for:
  - Project list loading
  - Message list loading
  - Settings loading

### Step 8.5: Connection Resilience

- Reconnection logic is built into `GatewayClient` (Phase 2)
- Add visual indicators:
  - Banner at top of chat: "Reconnecting..." with countdown
  - Queued messages indicator (messages sent while disconnected)
- Re-send queued messages after reconnect
- Re-subscribe to active project session after reconnect

### Step 8.6: Performance

- **Virtualized message list:** For projects with 1000+ messages, use `react-virtuoso` or similar
- **Debounced search:** If implementing project search
- **Lazy loading:** Artifact previews, especially HTML iframes
- **Memoization:** `React.memo` on message bubbles, `useMemo` on markdown rendering

---

## Phase 9: Deploy

**Time estimate: ~1.5 hours**
**Dependencies: All prior phases**
**Security deliverables:** Security header verification, HTTPS enforcement, Docker hardening, env var audit

### Step 9.1: Pre-Deploy Security Audit

> 🔒 **SECURITY:** Run this checklist BEFORE deploying to production.

1. **Grep for secrets:** `grep -rn "SUPABASE_SERVICE_ROLE_KEY\|CHANGE_ME\|password\|secret" src/` — must return zero matches outside of `.env.example` files
2. **Verify no `dangerouslySetInnerHTML`:** `grep -rn "dangerouslySetInnerHTML" src/` — must be zero (all HTML rendering goes through sandboxed iframes)
3. **Verify `rehype-sanitize`** is used on every `ReactMarkdown` instance: `grep -rn "ReactMarkdown" src/` → each must include `rehypeSanitize` in plugins
4. **Verify CSP headers** load correctly: run `npm run build && npm run start`, then check headers with `curl -I http://localhost:3000`
5. **Test RLS:** Sign up as User A, create a project. Sign up as User B, attempt to query User A's project via Supabase client — must fail.
6. **Verify token not in localStorage:** Open DevTools → Application → Local Storage → search for any gateway token value — must not appear.
7. **Test iframe sandbox:** Create an HTML artifact containing `<script>fetch('https://evil.com')</script>` — must be blocked by CSP.

### Step 9.2: Vercel Deployment

1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — 🔒 Mark as "Sensitive" in Vercel (hides from logs)
4. **Verify HTTPS** is enforced (Vercel does this by default)
5. Deploy
6. Post-deploy: verify security headers at [securityheaders.com](https://securityheaders.com)

### Step 9.3: Self-Host Docker

Create `Dockerfile`:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 🔒 SECURITY: Run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 🔒 SECURITY: Non-root execution
USER nextjs

EXPOSE 3000

# 🔒 SECURITY: Set NODE_ENV explicitly (prevents dev-mode debug info leaking)
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

> 🔒 **SECURITY:** The Docker image runs as a non-root user (`nextjs`). Never run as root in production — container escape + root = full host compromise.

Update `next.config.ts`:
```typescript
const nextConfig = {
  output: 'standalone',
};
```

### Step 9.4: Documentation

Create `README.md` with:
- What ClawSpace is
- Screenshots
- Quick start (Vercel deploy button)
- Self-host instructions
- Environment variables reference
- Connecting to your OpenClaw Gateway
- Tailscale setup guide
- Troubleshooting

### Step 9.5: Create `.env.local.example`

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Default gateway URL (optional — users configure in UI)
NEXT_PUBLIC_DEFAULT_GATEWAY_URL=ws://localhost:18789
```

---

## Dependency Graph

```
Phase 0 (Scaffold)
  ├─→ Phase 1 (Auth + DB)
  │     ├─→ Phase 3 (Connection UI) ─→ Phase 4 (Projects)
  │     └─→ Phase 4 (Projects)
  └─→ Phase 2 (Gateway Client)
        ├─→ Phase 3 (Connection UI)
        └─→ Phase 6 (Chat Integration)

Phase 4 (Projects) ─→ Phase 5 (Chat UI) ─→ Phase 6 (Integration)
                                              ↓
Phase 5 (Chat UI) ──────────────────→ Phase 7 (Artifacts)
                                              ↓
                                    Phase 8 (Polish) ─→ Phase 9 (Deploy)
```

**Critical path:** Phase 0 → Phase 2 → Phase 6 (Gateway client must work before chat integration)

**Parallel work possible:**
- Phase 1 (auth) and Phase 2 (gateway client) can be built simultaneously
- Phase 5 (chat UI) can be built with mock data while Phase 2 is in progress
- Phase 7 (artifacts) can start once chat messages render

---

## What's Deferred to V1.1

| Feature | Reason for Deferral |
|---|---|
| **File browser** | Complex, not core to chat experience. Ship project spaces + chat + artifacts first. |
| **File attachments in chat** | Depends on file browser + Supabase Storage integration |
| **Google OAuth** | Start with email/password, add OAuth later |
| **Team collaboration** | Single-user MVP first |
| **Relay server for NAT** | Tailscale covers this use case |
| **Payment/subscription** | Post-launch |
| **PWA / mobile app** | V3 |

---

## Summary of Protocol Corrections Applied

This plan uses the **actual** protocol from the OpenClaw source code, not the simplified version in the BUILD-BRIEF. Key differences:

1. ✅ **Framing:** All messages use `{type, id, method/event, params/payload}` — not bare `{method, params}`
2. ✅ **Handshake:** Server sends `connect.challenge` event → client sends `connect` request → server responds with `hello-ok`
3. ✅ **Auth:** Token sent in `connect.params.auth.token` — NOT as a URL query parameter
4. ✅ **`idempotencyKey`:** Required field on `chat.send` (NonEmptyString) — not optional
5. ✅ **Chat events:** Use `state` field with values `delta | final | aborted | error` — not `event: "text" | "done"`
6. ✅ **Device identity:** Required for non-local connections; uses WebCrypto ECDSA P-256 keypair
7. ✅ **Client ID:** Must be a valid `GatewayClientId` — using `"webchat-ui"` which is already registered
8. ✅ **Protocol version:** `minProtocol: 3, maxProtocol: 3` — the current version

---

## Security Checklist

> **Gate every phase against this checklist.** No phase is "done" unless these items are verified.

### Token & Secret Handling
- [ ] Gateway tokens NEVER stored in localStorage or sessionStorage
- [ ] Gateway tokens encrypted at rest in Supabase (pgcrypto)
- [ ] Gateway tokens NEVER appear in URL query parameters (except transiently in quick-connect, immediately scrubbed)
- [ ] Gateway tokens NEVER logged to console (even in debug mode)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` NEVER referenced in client-side code
- [ ] `.env.local` is in `.gitignore`
- [ ] Device tokens (issued by Gateway, scoped + rotatable) are the ONLY tokens acceptable in localStorage

### Authentication & Authorization
- [ ] Supabase auth middleware on all protected routes
- [ ] RLS enabled on EVERY table (gateway_connections, projects, messages, artifacts)
- [ ] RLS policies tested with cross-user queries (must return zero rows)
- [ ] Session JWT validated server-side (via `supabase.auth.getUser()`, not `getSession()`)
- [ ] Password minimum length ≥ 8 characters
- [ ] No `any` type assertions that bypass auth checks

### XSS Prevention
- [ ] `rehype-sanitize` with custom strict schema on EVERY `ReactMarkdown` render
- [ ] Custom sanitize schema blocks: `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<button>`
- [ ] Link protocols restricted to `http:`, `https:`, `mailto:` (no `javascript:`)
- [ ] All external links: `target="_blank" rel="noopener noreferrer"`
- [ ] Zero uses of `dangerouslySetInnerHTML` outside of controlled sandboxed iframes
- [ ] No `eval()`, `new Function()`, or `document.write()` anywhere in the codebase

### Iframe Sandbox (HTML Artifacts)
- [ ] `sandbox="allow-scripts"` only — NO `allow-same-origin`
- [ ] Injected CSP: `connect-src 'none'` (blocks all network requests from iframe)
- [ ] Injected CSP: `form-action 'none'` (blocks form submissions)
- [ ] `referrerPolicy="no-referrer"` on all iframes
- [ ] `allow=""` attribute (blocks camera, microphone, etc.)

### WebSocket Security
- [ ] Gateway URL validated before connection (must be `ws://` or `wss://`)
- [ ] Token sent in handshake body, NEVER as URL query parameter
- [ ] All incoming frames validated for expected shape before processing
- [ ] Unknown frame types silently dropped (fail closed)
- [ ] Content size bounded (reject deltas > 1MB)
- [ ] Non-localhost `ws://` connections show security warning to user

### HTTP Security Headers
- [ ] `Content-Security-Policy` set with restrictive policy
- [ ] `X-Frame-Options: DENY` (prevents clickjacking)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Strict-Transport-Security` with max-age ≥ 31536000
- [ ] `Permissions-Policy` disabling unused browser features
- [ ] Headers verified at [securityheaders.com](https://securityheaders.com) post-deploy

### Input Validation
- [ ] Project names: trimmed, max 100 chars
- [ ] Project icons: max 8 chars (single emoji)
- [ ] Project colors: validated as hex color
- [ ] Session keys: always derived from `agent:main:clawspace:` + crypto UUID (never user-provided)
- [ ] Message content: no maximum enforced client-side (Gateway handles limits), but bounded in streaming buffer

### Deployment
- [ ] Docker container runs as non-root user
- [ ] `NODE_ENV=production` in all deployed environments
- [ ] No debug endpoints or development-only routes in production build
- [ ] Service role key marked as "Sensitive" in Vercel dashboard
- [ ] HTTPS enforced in production

---

*Plan v1.1 — February 3, 2026*
*Derived from BUILD-BRIEF.md + actual OpenClaw Gateway source code analysis*
*Priority: Security → Ease of use → UX/UI*
