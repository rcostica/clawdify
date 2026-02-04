# BUILD-PLAN-V4: Mission Control + One-Click Deploy

> **Date:** February 4, 2026
> **Strategy:** Middle Ground — BYOG + One-Click Deploy + Cloud Features (future)
> **Reference:** STRATEGIST-BYOG-ANALYSIS.md, STRATEGIST-REVIEW.md

---

## 1. WHAT WE'RE BUILDING

### The Product
A **task-centric Mission Control dashboard** for AI agents (OpenClaw), with **one-click deploy buttons** so new users can deploy their own Gateway to Fly.io/Railway without touching a terminal.

### The Pivot
- FROM: Chat-centric UI (basically another ChatGPT clone)
- TO: Task-centric Mission Control (create tasks → watch agent work → see results)

### Pricing
- **Free:** BYOG, 2 projects, basic activity feed, 7-day history
- **Pro ($12/mo):** BYOG or deploy-button Gateway, unlimited projects, full history, notifications, scheduled tasks, analytics
- **Team ($20/seat/mo):** Future — deferred

### Core Flows
1. **New user (deploy button):** Sign up → "Deploy your agent" → Click Railway/Fly.io → Gateway deploys on THEIR account → auto-connects → enter API key → create first task → wow
2. **Existing user (BYOG):** Sign up → "Connect your Gateway" → enter WS URL + token → connected → create first task
3. **Daily use:** Open dashboard → see task list → create task → watch activity feed → review artifacts

---

## 2. ARCHITECTURE OVERVIEW

### What Changes

```
BEFORE (v2/v3 — Chat-Centric):
┌──────────┬──────────────────────────────────┐
│ Sidebar  │  Chat Messages (message bubbles)  │
│ Projects │  [Message Input]                   │
│          │                    [Artifact Panel]│
└──────────┴──────────────────────────────────┘

AFTER (v4 — Mission Control):
┌──────────┬──────────────┬──────────────────┐
│ Sidebar  │ TASKS        │ ACTIVITY + RESULT│
│ Projects │ ┌──────────┐ │ ┌──────────────┐ │
│ + Agent  │ │ 🟢 Active│ │ │ Activity Feed│ │
│   Status │ │ Build... │ │ │ 14:32 Reading│ │
│          │ ├──────────┤ │ │ 14:33 Writing│ │
│          │ │ ✅ Done  │ │ │ 14:34 Running│ │
│          │ │ Fix bug  │ │ ├──────────────┤ │
│          │ ├──────────┤ │ │ RESULT/ARTIFACT│
│          │ │ 📋 Queued│ │ │ [Code][Preview]│
│          │ │ Write... │ │ │ (rendered)     │
│          │ └──────────┘ │ └──────────────┘ │
│          │ [+ New Task] │                  │
└──────────┴──────────────┴──────────────────┘
```

### What Stays
- Auth (Supabase, Google/GitHub OAuth) ✅
- Project management (create, list, switch) ✅
- Artifact panel (code preview, HTML preview, markdown, images) ✅
- Gateway WebSocket client + types ✅
- Sidebar shell ✅
- UI components library ✅
- Supabase client/server utilities ✅

### What Changes
- Project page layout: chat → Mission Control (task list + activity feed + artifacts)
- Chat store → Task store + Activity store
- Message input → Task creation input
- Message bubbles → Activity feed entries
- Dashboard home → shows agent status + recent tasks across projects
- Sidebar → add agent health indicator
- Onboarding wizard → deploy flow or BYOG connect flow
- Landing page → complete rewrite for middle-ground positioning
- Pricing → Free / Pro $12/mo
- Connect page → enhanced with deploy buttons

### What's New
- Task management system (create, queue, execute, complete, fail)
- Activity feed component (real-time agent action streaming)
- One-click deploy page (Fly.io + Railway buttons)
- Deploy template configs (Dockerfile, fly.toml, railway.json)
- Task store (Zustand)
- Activity store (Zustand)
- Database: `tasks` table

---

## 3. DATABASE SCHEMA

### New Table: `tasks`

```sql
-- Migration: 003_tasks.sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Task content
  title TEXT NOT NULL,
  description TEXT, -- optional longer description
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued', 'active', 'done', 'failed', 'cancelled')),
  
  -- Agent execution
  run_id TEXT, -- OpenClaw run ID when executing
  session_key TEXT, -- OpenClaw session key
  
  -- Results
  result_summary TEXT, -- Brief summary of what the agent did
  error_message TEXT, -- If failed, why
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);
```

### Updated Table: `gateway_connections` (already exists, may need deploy_provider column)

```sql
-- Add to existing gateway_connections or create if not exists
ALTER TABLE gateway_connections 
  ADD COLUMN IF NOT EXISTS deploy_provider TEXT 
    CHECK (deploy_provider IN ('flyio', 'railway', 'manual', NULL)),
  ADD COLUMN IF NOT EXISTS deploy_app_name TEXT,
  ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ;
```

---

## 4. UI SPECIFICATIONS

### 4.1 Mission Control — Project Page (MAIN VIEW)

The project page is a **three-column layout** on desktop, collapsing to panels on mobile.

**Left Column — Task List (280-320px fixed)**
- Section: "Active" (tasks with status='active') — highlighted with green pulse
- Section: "Queued" (status='queued') — ordered by sort_order
- Section: "Completed" (status='done' or 'failed') — collapsible, shows last 10
- Each task card shows: title (truncated), status icon, time ago
- Click task → shows its activity + artifacts in right columns
- "+ New Task" button at bottom (opens task creation)
- Task creation: simple text input (title) + optional description textarea
  - On submit: creates task in DB, sends to Gateway as chat message, sets status='active'

**Right Area — Split: Activity Feed (top) + Result/Artifact (bottom)**

**Activity Feed (top 50-60% of right area)**
- Real-time streaming of agent actions for the selected task
- Each entry: timestamp + icon + description
  - 🔍 "Reading file: src/app/page.tsx"
  - 📝 "Creating file: src/components/header.tsx"
  - ⚡ "Running command: npm install"
  - 💭 "Thinking about approach..."
  - ✅ "Task completed"
  - ❌ "Error: ..."
- Source: Map chat events + tool calls from Gateway to activity entries
- Auto-scroll to latest entry
- Clicking an entry with a file → opens in artifact panel

**Result/Artifact Panel (bottom 40-50%)**
- Reuse existing ArtifactPanel component
- Shows artifacts produced by the selected task
- Tabs for multiple artifacts (code files, HTML preview, etc.)
- If no artifacts yet, show "Waiting for results..." with subtle animation

**Mobile Layout:**
- Full-width tabs: [Tasks] [Activity] [Results]
- Swipe between panels

### 4.2 Dashboard Home (Updated)

- Agent status card (connected/disconnected, uptime, model info)
- Recent tasks across all projects (last 5-10)
- Quick-create task (project selector + task input)
- If not connected: prominent "Connect your agent" CTA

### 4.3 Deploy Page (`/deploy` or integrated into `/connect`)

**Hero Section:**
"Deploy your AI agent in 5 minutes. No terminal required."

**Deploy Options (cards):**

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 🚂 Railway      │  │ 🪁 Fly.io       │  │ 🐳 Docker       │
│                  │  │                  │  │                  │
│ Free tier: $5/mo │  │ Free: 3 machines │  │ Self-hosted      │
│ credit           │  │                  │  │                  │
│ One-click deploy │  │ One-click deploy │  │ Copy command     │
│                  │  │                  │  │                  │
│ [Deploy Now →]   │  │ [Deploy Now →]   │  │ [Copy & Run →]   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Already have a Gateway? section:**
"Connect your existing OpenClaw Gateway"
→ Link to /connect (existing BYOG flow)

**How it works (3 steps):**
1. Click "Deploy" → redirects to Railway/Fly.io with pre-configured template
2. Enter your Anthropic/OpenAI API key
3. Your agent connects to Clawdify automatically

### 4.4 Connect Page (Updated for BYOG)

Current connect page exists. Enhance with:
- Clearer instructions
- Test connection button with visual feedback
- Link to deploy page for users without a Gateway

### 4.5 Sidebar Updates

- Add agent health indicator (green dot = connected, red = disconnected)
- Under project list, add "Tasks" count badge per project
- Quick task creation shortcut (Cmd+T)

### 4.6 Onboarding Wizard (Updated)

Step 1: "How do you want to connect?"
- Option A: "Deploy a new agent" → /deploy
- Option B: "Connect existing Gateway" → /connect

Step 2 (after connected): "Create your first task"
- Pre-filled example: "Build a simple landing page for my portfolio"
- Submit → user sees agent working → WOW

---

## 5. STORE ARCHITECTURE

### 5.1 Task Store (`src/stores/task-store.ts`)

```typescript
interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'queued' | 'active' | 'done' | 'failed' | 'cancelled';
  runId?: string;
  sessionKey?: string;
  resultSummary?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  sortOrder: number;
}

interface TaskState {
  tasksByProject: Record<string, Task[]>;
  selectedTaskId: string | null;
  
  // Actions
  loadTasks: (projectId: string) => Promise<void>;
  createTask: (projectId: string, title: string, description?: string) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  selectTask: (taskId: string | null) => void;
  cancelTask: (taskId: string) => void;
}
```

### 5.2 Activity Store (`src/stores/activity-store.ts`)

```typescript
interface ActivityEntry {
  id: string;
  taskId: string;
  timestamp: string;
  type: 'thinking' | 'tool_call' | 'file_read' | 'file_write' | 'command' | 'message' | 'error' | 'complete';
  title: string; // Short description
  detail?: string; // Full content (code, output, etc.)
  artifactId?: string; // Link to artifact if produced
}

interface ActivityState {
  entriesByTask: Record<string, ActivityEntry[]>;
  
  // Actions  
  addEntry: (taskId: string, entry: ActivityEntry) => void;
  clearEntries: (taskId: string) => void;
}
```

### 5.3 Chat Store Adapter

The existing chat store receives raw Gateway events (chat deltas, tool calls). We need a **translation layer** that:
1. Receives ChatEventPayload + AgentEventPayload from Gateway
2. Maps them to ActivityEntry objects
3. Detects task completion (final state) and updates task status

This lives in a new hook: `src/lib/gateway/activity-mapper.ts`

```typescript
// Maps raw Gateway events to activity entries
export function mapChatEventToActivity(event: ChatEventPayload, taskId: string): ActivityEntry | null { ... }
export function mapAgentEventToActivity(event: AgentEventPayload, taskId: string): ActivityEntry | null { ... }
```

---

## 6. ONE-CLICK DEPLOY TECHNICAL SPEC

### 6.1 The Flow

```
Clawdify Sign-up
    ↓
/deploy page
    ↓
User clicks [Deploy on Railway]
    ↓
Redirect to: https://railway.app/template/<TEMPLATE_ID>
  - Pre-filled env vars:
    - CLAWDIFY_RELAY_URL=wss://relay.clawdify.app
    - CLAWDIFY_USER_TOKEN=<generated-token>
    - CLAWDIFY_GATEWAY_ID=<generated-id>
  - User fills in:
    - ANTHROPIC_API_KEY (or OPENAI_API_KEY)
    ↓
Railway deploys the container
    ↓
Gateway boots → connects to relay.clawdify.app with user token
    ↓
Clawdify detects connection → shows "Connected!" in UI
    ↓
User creates first task → WOW
```

### 6.2 Railway Template

Create a Railway template with:

**Dockerfile** (in a public repo like `rcostica/openclaw-gateway-template`):
```dockerfile
FROM node:22-slim
RUN npm install -g openclaw
WORKDIR /app
COPY gateway-config.yaml .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh
EXPOSE 3000
CMD ["./entrypoint.sh"]
```

**entrypoint.sh:**
```bash
#!/bin/bash
# Generate config from env vars
cat > /app/config.yaml << EOF
model: ${AI_MODEL:-anthropic/claude-sonnet-4-20250514}
providers:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY:-}
  openai:
    apiKey: ${OPENAI_API_KEY:-}
relay:
  url: ${CLAWDIFY_RELAY_URL}
  token: ${CLAWDIFY_USER_TOKEN}
  gatewayId: ${CLAWDIFY_GATEWAY_ID}
EOF

openclaw gateway start --config /app/config.yaml
```

**railway.json:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "dockerfilePath": "Dockerfile" },
  "deploy": {
    "startCommand": "./entrypoint.sh",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 6.3 Fly.io Template

Similar, with `fly.toml`:
```toml
app = "openclaw-gateway-USER_ID"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  CLAWDIFY_RELAY_URL = "wss://relay.clawdify.app"

[[services]]
  internal_port = 3000
  protocol = "tcp"

[processes]
  app = "./entrypoint.sh"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

### 6.4 Docker One-Liner (for self-hosters)

```bash
curl -fsSL https://clawdify.app/install.sh | sh
```

The script:
1. Checks for Docker
2. Prompts for API key
3. Generates a Clawdify connection token (via API call)
4. Runs the container with docker run

### 6.5 Relay Server

The existing relay server at `packages/relay/` needs to:
- Accept connections from deployed Gateways (authenticated by user token)
- Route WebSocket frames between Clawdify dashboard ↔ user's Gateway
- Handle reconnection gracefully

**NOTE:** The relay is a passthrough. It never reads API keys, never executes code, never stores conversation content. It's a WebSocket proxy.

### 6.6 Auto-Connection Detection

When a Gateway connects to the relay with a Clawdify user token:
1. Relay notifies the Clawdify dashboard (via existing WebSocket connection)
2. Dashboard updates the connection status to "Connected"
3. Gateway info (version, uptime, model) is displayed in sidebar

---

## 7. IMPLEMENTATION PHASES

### Phase A: Mission Control Dashboard (Dev Agent — PRIMARY)

**Goal:** Transform the chat-centric project page into the Mission Control layout.

**Files to create:**
- `src/stores/task-store.ts` — Task state management
- `src/stores/activity-store.ts` — Activity feed state
- `src/lib/gateway/activity-mapper.ts` — Gateway events → activity entries
- `src/components/tasks/task-list.tsx` — Task list panel
- `src/components/tasks/task-card.tsx` — Individual task card
- `src/components/tasks/task-create.tsx` — Task creation form
- `src/components/tasks/task-detail.tsx` — Task detail view (expanded)
- `src/components/activity/activity-feed.tsx` — Real-time activity stream
- `src/components/activity/activity-entry.tsx` — Single activity entry
- `src/components/activity/agent-status.tsx` — Agent health indicator
- `src/components/deploy/deploy-page.tsx` — Deploy button cards
- `src/components/deploy/deploy-status.tsx` — Deploy progress/status
- `supabase/migrations/003_tasks.sql` — Tasks table migration

**Files to modify:**
- `src/app/(app)/project/[id]/page.tsx` — Restructure to Mission Control layout
- `src/app/(app)/dashboard/page.tsx` — Add agent status + recent tasks
- `src/app/(app)/layout.tsx` — If layout changes needed
- `src/components/sidebar/sidebar.tsx` — Add agent health dot, task counts
- `src/components/sidebar/connection-status.tsx` — Enhanced status display
- `src/components/gateway-provider.tsx` — Wire activity mapper
- `src/stores/chat-store.ts` — May still be used, but augmented with activity mapping
- `src/components/onboarding/onboarding-wizard.tsx` — Updated flow (deploy vs BYOG)

**Files to create (deploy flow):**
- `src/app/(app)/deploy/page.tsx` — Deploy page route
- `deploy-templates/Dockerfile` — Gateway container image
- `deploy-templates/entrypoint.sh` — Container entrypoint
- `deploy-templates/railway.json` — Railway template config
- `deploy-templates/fly.toml` — Fly.io config

**DO NOT modify:** Landing page, marketing components, pricing table (Marketing Agent handles those)

### Phase B: Marketing & Landing Page (Marketing Agent)

**Goal:** Rewrite the landing page and all marketing content for the middle-ground strategy.

**Files to modify:**
- `src/components/landing/hero.tsx` — New hero: "Mission Control for AI Agents"
- `src/components/landing/features.tsx` — Updated feature cards
- `src/components/landing/how-it-works.tsx` — New 3-step flow (deploy-button focused)
- `src/components/landing/pricing-table.tsx` — Free / Pro $12/mo
- `src/components/landing/comparison.tsx` — Updated or removed
- `src/components/landing/faq.tsx` — Updated FAQ
- `src/components/landing/cta-section.tsx` — Updated CTA
- `src/components/landing/testimonials.tsx` — Update or replace with "Built for" section
- `src/components/landing/footer.tsx` — If needed

**Files to create (if needed):**
- `src/components/landing/demo-preview.tsx` — Animated demo/screenshot section showing Mission Control
- `src/components/landing/deploy-preview.tsx` — Shows the deploy button flow

**DO NOT modify:** Dashboard components, stores, gateway code, API routes

### Phase C: UX Review (After A+B complete)

**Goal:** Review the complete product, score it, suggest improvements.

---

## 8. COMPONENT SPECIFICATIONS

### 8.1 TaskList Component

```
Props:
  projectId: string
  selectedTaskId: string | null
  onSelectTask: (id: string) => void
  onCreateTask: (title: string, description?: string) => void

Behavior:
  - Groups tasks by status: Active (green), Queued (gray), Completed (muted)
  - Active tasks show a subtle pulse animation
  - Completed section is collapsible (default: collapsed if >5 tasks)
  - Each task card shows: status icon, title (1 line truncated), time ago
  - "+ New Task" button at bottom opens inline form
  - Task form: text input for title, Enter to submit, Escape to cancel
  - Optional: expand for description textarea

Styling:
  - Width: 280-320px
  - Scrollable within its panel
  - Selected task has highlighted border (primary color)
```

### 8.2 ActivityFeed Component

```
Props:
  taskId: string
  entries: ActivityEntry[]
  isStreaming: boolean

Behavior:
  - Renders entries in chronological order
  - Auto-scrolls to latest entry when streaming
  - Each entry: timestamp (HH:MM:SS) | icon | description
  - Icons by type:
    💭 thinking → Brain icon (muted)
    🔍 file_read → Eye icon
    📝 file_write → Pencil icon
    ⚡ command → Terminal icon
    💬 message → MessageSquare icon
    ✅ complete → CheckCircle icon (green)
    ❌ error → XCircle icon (red)
  - Expandable entries: click to show full detail (code block, command output)
  - If streaming, show typing indicator at bottom

Styling:
  - Monospaced timestamps
  - Compact spacing (not chat bubble spacing — think log viewer)
  - Alternating row backgrounds for readability
```

### 8.3 AgentStatus Component

```
Props:
  (reads from gateway store)

Behavior:
  - Green dot + "Connected" when gateway is connected
  - Red dot + "Disconnected" when not connected
  - Shows: model name, uptime, last activity time
  - Click expands to show: gateway version, host, connection details

Placement:
  - In sidebar, above project list
  - Compact: just a dot + "Agent" label + status
```

### 8.4 DeployPage Component

```
Route: /deploy

Sections:
  1. Hero: "Deploy your AI agent in 5 minutes"
  2. Provider cards (Railway, Fly.io, Docker)
     - Each card: logo, name, brief description, free tier info, deploy button
     - Railway button: links to railway.app/template with pre-filled env vars
     - Fly.io button: links to fly.io deploy or shows CLI command
     - Docker: shows docker run command with copy button
  3. "Already have a Gateway?" link to /connect
  4. How it works: 3 visual steps
  5. FAQ: common deploy questions

Pre-deploy:
  - Clawdify generates a unique connection token for the user
  - Token is embedded in the deploy button URL as an env var
  - Token is also stored in Supabase (gateway_connections table)
```

---

## 9. TASK → AGENT MESSAGE MAPPING

How tasks become agent instructions:

1. User creates task with title "Build a landing page for my portfolio"
2. Clawdify sends to Gateway via WebSocket:
   ```json
   {
     "type": "req",
     "id": "...",
     "method": "chat.send",
     "params": {
       "sessionKey": "agent:main:clawdify:<projectId>",
       "message": "Task: Build a landing page for my portfolio",
       "idempotencyKey": "task-<taskId>"
     }
   }
   ```
3. Task status updated to 'active', runId stored from response
4. Gateway streams chat events back → mapped to activity entries
5. When `state: 'final'` received → task status updated to 'done'
6. If `state: 'error'` or `state: 'aborted'` → task status updated to 'failed'

---

## 10. ACCEPTANCE CRITERIA

### Dev Agent Must Deliver:
- [ ] Mission Control layout renders on project page (task list + activity + artifacts)
- [ ] Tasks can be created, listed, and selected
- [ ] Creating a task sends it to the Gateway as a chat message
- [ ] Activity feed shows real-time agent actions (mapped from Gateway events)
- [ ] Task status updates when agent completes or fails
- [ ] Agent health indicator in sidebar (connected/disconnected)
- [ ] Deploy page with Railway + Fly.io + Docker options
- [ ] Deploy templates (Dockerfile, entrypoint.sh, railway.json, fly.toml)
- [ ] 003_tasks.sql migration
- [ ] Mobile-responsive layout (tasks/activity/results as tabs)
- [ ] `next build` passes with zero errors

### Marketing Agent Must Deliver:
- [ ] Landing page hero rewritten for Mission Control positioning
- [ ] Features section updated (task management, activity feed, one-click deploy, BYOG)
- [ ] How-it-works section shows deploy button flow
- [ ] Pricing table updated (Free / Pro $12/mo)
- [ ] FAQ updated for new positioning
- [ ] CTA section updated
- [ ] `next build` passes with zero errors

---

## 11. IMPORTANT CONSTRAINTS

1. **No server-side rendering for dashboard** — all (app) routes are `'use client'`
2. **Zustand for state** — don't introduce Redux or other state libs
3. **Tailwind v4 + shadcn/ui** — use existing component library
4. **Don't break existing features** — auth, projects, artifacts, settings, billing must still work
5. **Don't modify files the other agent owns** — Dev touches dashboard/stores/gateway, Marketing touches landing/marketing
6. **Gateway WebSocket protocol is fixed** — use existing client.ts and types.ts methods
7. **Supabase for persistence** — tasks stored in Supabase, not just local state
8. **The chat system still works underneath** — tasks are sent as chat messages. The activity feed is a VIEW on top of chat events. Don't delete the chat infrastructure, transform its display.
