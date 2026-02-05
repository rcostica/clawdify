# Agent Dashboard Design — v5

> **Goal:** Rich, modern dashboard that surfaces everything about your AI agent(s) at a glance
> **Rename:** Mission Control → Agent Dashboard everywhere

---

## Design Philosophy

**Different from the reference:** Instead of a kanban board focus, I'm proposing a **"Command Center" bento-grid layout** — information-dense but visually clean, inspired by modern observability dashboards (Vercel, Linear, Raycast).

**Key principles:**
1. **Glanceable stats** — see health at a glance without clicking
2. **Activity-first** — what's happening NOW is most important
3. **Progressive disclosure** — summary cards expand to detail views
4. **Dark-first** — optimized for the dark theme you're using

---

## Layout: Bento Grid

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CLAWDIFY    [All Projects ▾]  [Search ⌘K]    🟢 Agent Online │ 847 tok │ 62% ctx │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────┐  ┌─────────────────────────────────┐│
│  │  ⚡ ACTIVITY                          │  │  👥 TEAM                        ││
│  │                                       │  │                                 ││
│  │  14:32  Created src/app/page.tsx      │  │  🟢 Main Agent      Working...  ││
│  │  14:31  Installed 3 dependencies      │  │     "Building landing page"     ││
│  │  14:30  Started task: Build landing   │  │                                 ││
│  │  14:28  Completed: Fix auth bug       │  │  💤 QA Agent        Idle        ││
│  │  ○      Waiting for next task...      │  │     Last: "Test suite passed"   ││
│  │                                       │  │                                 ││
│  │  [View Full Log →]                    │  │  [Manage Agents →]              ││
│  └───────────────────────────────────────┘  └─────────────────────────────────┘│
│                                                                                 │
│  ┌───────────────────────────────────────┐  ┌─────────────────────────────────┐│
│  │  📋 TASKS                      [+ New]│  │  📁 FILES                       ││
│  │                                       │  │                                 ││
│  │  ● Build landing page          ▶ NOW  │  │  src/app/page.tsx       2m ago  ││
│  │  ○ Write unit tests           QUEUED  │  │  package.json           5m ago  ││
│  │  ✓ Fix auth bug                 DONE  │  │  README.md             12m ago  ││
│  │  ✓ Setup CI pipeline            DONE  │  │  tsconfig.json         12m ago  ││
│  │                                       │  │                                 ││
│  │  [View All Tasks →]                   │  │  [Browse All →]                 ││
│  └───────────────────────────────────────┘  └─────────────────────────────────┘│
│                                                                                 │
│  ┌───────────────────────────────────────┐  ┌─────────────────────────────────┐│
│  │  🖼️ MEDIA                             │  │  ⏰ CRONS                       ││
│  │                                       │  │                                 ││
│  │  [img] [img] [img] [img]  [+5 more]   │  │  ● Daily backup      09:00 UTC  ││
│  │                                       │  │  ● Check inbox       */30 * *   ││
│  │  [View Gallery →]                     │  │  ○ Weekly report     Mon 08:00  ││
│  └───────────────────────────────────────┘  │                                 ││
│                                             │  [Manage Crons →]               ││
│                                             └─────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Header bar (stats as sidenote):**
- Agent status indicator (🟢 Online / 🟡 Busy / 🔴 Offline)
- Tokens used (session)
- Context window % full
- Small, unobtrusive — info at a glance, not the focus

---

## Bento Cards

### 1. Header Stats Bar (inline, not a card)
**Compact stats in the header — info sidenote, not focus:**
- **Agent status** (🟢 Online / 🟡 Busy / 🔴 Offline)
- **Tokens used** (session count)
- **Context window** (% full)

**Visual treatment:**
- Small text (12-14px) inline in header
- Subtle separators between stats
- Status dot color-coded
- Optional: hover for more detail (cost, time, etc.)

### 2. Live Activity Feed (top-left, 2x2)
**Real-time stream of agent actions:**
- Scrolling log of what agent is doing NOW
- Status indicators: 🟢 active, ○ idle, 🔴 error
- Timestamps relative ("2s ago", "just now")
- Truncated messages with hover to expand
- Auto-scrolls to latest, but user can scroll up to pause

**Visual treatment:**
- Monospace font for log feel
- Subtle left border color indicates status
- "View Full Log" links to detailed activity page

### 3. Team Card (top-right, 2x2)
**Your agents at a glance:**
- Lists main agent + any spawned sub-agents
- Status: 🟢 Working / 💤 Idle / 🔴 Error
- Current task or last completed task
- Timestamp of last activity

**Visual treatment:**
- Agent avatar/icon (configurable per agent)
- Status badge with pulse animation when active
- Truncated task description with full on hover
- "Manage Agents" links to full team management page

**Data source:** OpenClaw sessions_list + sessions_history APIs

### 4. Tasks Card (middle-left, 2x2)
**Quick task overview:**
- Shows 4-6 most relevant tasks (active first, then recent)
- Status indicator: ● active (pulsing), ○ queued, ✓ done, ✗ failed
- Click task to expand inline OR navigate to detail
- "+ New" button opens quick task creation modal

**NOT a full kanban** — that's in the dedicated Tasks page. This is a summary widget.

### 5. Files Card (middle-right, 2x2)
**All workspace files (not just task-generated):**
- Shows last 5-8 modified files
- File icon based on extension
- Relative timestamp
- Click to preview (code, markdown, images inline)
- "Browse All" links to full file browser with tree view

### 6. Media Card (bottom-left, 2x1)
**Visual outputs:**
- Thumbnail grid of images, charts, screenshots, PDFs
- Click to view full size in modal
- Shows "+N more" if many items
- "View Gallery" for full media browser

### 7. Crons Card (bottom-right, 2x1)
**Scheduled automations (from OpenClaw gateway):**
- List of active cron jobs
- Next run time or schedule expression
- Status indicator: ● enabled, ○ disabled
- Quick enable/disable toggle
- "Manage Crons" for full CRUD interface

---

## Project Scope Toggle

**Top bar dropdown: "All Projects" | "Project Name"**

- **All Projects:** Aggregates stats/tasks/files across everything
- **Specific Project:** Filters to that project only

The same dashboard layout works for both — just filtered data.

---

## Color Palette (Dark Theme)

| Element | Color |
|---------|-------|
| Background | `#0a0a0b` (near-black) |
| Card background | `#141416` (dark gray) |
| Card border | `#1f1f23` (subtle) |
| Primary accent | `#a78bfa` (violet-400) |
| Success | `#22c55e` (green-500) |
| Warning | `#f59e0b` (amber-500) |
| Error | `#ef4444` (red-500) |
| Text primary | `#fafafa` |
| Text secondary | `#71717a` (zinc-500) |

---

## Responsive Behavior

**Desktop (1200px+):** Full 4-column bento grid
**Tablet (768-1199px):** 2-column stack
**Mobile (<768px):** Single column, cards stack vertically

---

## Pages Structure

```
/dashboard              → Agent Dashboard (this design)
/dashboard/tasks        → Full task management (kanban/list toggle)
/dashboard/activity     → Full activity log with search/filter
/dashboard/files        → File browser with tree view
/dashboard/media        → Media gallery
/dashboard/crons        → Cron job management
/dashboard/team         → Agent management (main + sub-agents)
/dashboard/stats        → Detailed usage analytics (optional, lower priority)

/project/[id]           → Same layout, but scoped to one project
/project/[id]/tasks     → Project-specific task view
/project/[id]/files     → Project-specific files
/project/[id]/team      → Project-specific agents
... etc
```

---

## Implementation Plan

### Phase 1: Core Dashboard (3-4 days)
1. Rename all "Mission Control" → "Agent Dashboard"
2. Build bento grid layout shell with header stats bar
3. Activity feed card (major actions only, mock initially)
4. Team card (main agent + sub-agents)
5. Tasks card with real data from task-store

### Phase 2: Real Data Integration (3-4 days)
1. Wire up activity feed to gateway WebSocket (major actions filter)
2. Team card → sessions_list + sessions_history APIs
3. Files card → all workspace files
4. Media card → scan for images/artifacts
5. Crons card → gateway cron API

### Phase 3: Detail Pages (4-5 days)
1. Full task management page (kanban/list toggle)
2. Activity log page with search/filter
3. File browser with tree view + preview
4. Media gallery
5. Cron management CRUD
6. Team/agents management page

### Phase 4: Project Scoping (2 days)
1. Project selector in header
2. Filter all data by project
3. Per-project views for each card

**Total estimate:** ~2 weeks for full implementation

---

## Decisions Made

| Question | Answer |
|----------|--------|
| Stats priority | Sidenote in header — agent status, tokens, context % |
| Activity granularity | Major actions only (not every file read) |
| Cron source | Pull from OpenClaw gateway directly |
| File scope | All workspace files |
| Team view | Yes — persistent agents + sub-agents with status/activity |

---

Ready to build!
