# ClawSpace — Complete Build Brief

> This is a self-contained brief for an autonomous AI agent to build the ClawSpace MVP.
> Read this entire document before writing any code.

---

## What You're Building

**ClawSpace** is a web-based workspace for OpenClaw (https://github.com/openclaw/openclaw) users. It replaces messaging apps (Telegram, Discord) as the primary interface for interacting with an OpenClaw AI assistant.

**Core concept:** Project-based conversations with file management and artifact previews — everything messaging apps can't do.

**This is a commercial product**, not a personal tool. It will be sold to OpenClaw users as a SaaS ($15/mo Pro) and self-hosted license ($49).

---

## Tech Stack (Non-Negotiable)

- **Framework:** Next.js 15+ (App Router, Server Components, Server Actions)
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (install via CLI: `npx shadcn@latest init`, then add components as needed)
- **Database + Auth + Storage:** Supabase
- **Real-time:** WebSocket (native, connecting to OpenClaw Gateway)
- **Hosting:** Vercel (primary), self-host option via Docker
- **Language:** TypeScript (strict mode)
- **Package Manager:** npm

---

## How OpenClaw Works (Essential Context)

OpenClaw is a self-hosted AI assistant platform. It runs a **Gateway** server that:
- Connects to AI models (Claude, GPT, Gemini, etc.)
- Manages sessions (conversation history, context)
- Provides tools (file ops, web search, browser, exec, etc.)
- Routes messages between channels (Telegram, Discord, etc.) and the AI

### Gateway WebSocket API

The Gateway exposes a WebSocket server (default: `ws://127.0.0.1:18789`). This is our integration point.

**Authentication:** Connect with token via query params:
```
ws://gateway-host:18789/?token=<gateway-token>
```

**Key RPC methods (send as JSON over WS):**

```typescript
// Send a message to a session
{
  "method": "chat.send",
  "params": {
    "sessionKey": "agent:main:main",  // or any session key
    "message": "Hello",
    "idempotencyKey": "unique-id"     // optional, prevents duplicates
  }
}
// Response: { runId, status: "started" }
// Then stream events arrive as { type: "chat", ... }

// Get chat history
{
  "method": "chat.history",
  "params": {
    "sessionKey": "agent:main:main",
    "limit": 50
  }
}

// Abort a running response
{
  "method": "chat.abort",
  "params": {
    "sessionKey": "agent:main:main"
  }
}

// List all sessions
{
  "method": "sessions.list",
  "params": {}
}

// Inject an assistant message (no AI run)
{
  "method": "chat.inject",
  "params": {
    "sessionKey": "agent:main:main",
    "content": "Note: this is injected"
  }
}

// Get gateway status
{
  "method": "status",
  "params": {}
}
```

**Streaming responses:** After `chat.send`, the gateway emits `chat` events over the WebSocket:
```typescript
{
  "type": "chat",
  "sessionKey": "agent:main:main",
  "runId": "...",
  "event": "text",      // or "tool_call", "tool_result", "done", "error"
  "content": "partial response text..."
}
```

### Session Keys

Sessions are identified by keys. For ClawSpace, each project gets its own session:
- Default main session: `agent:main:main`
- We'll create project sessions using custom keys
- Format: `agent:main:clawspace:<projectId>`

This gives each project its own context window (200K tokens), conversation history, and memory.

---

## MVP Features (Build These)

### 1. Authentication & Connection Setup

**Supabase Auth:**
- Email/password signup + login
- Google OAuth (configure in Supabase dashboard)
- Protected routes (middleware)

**OpenClaw Connection:**
- Settings page where user enters:
  - Gateway URL (e.g., `ws://localhost:18789` or `wss://my-server.tail1234.ts.net`)
  - Gateway Token
- Test connection button (calls `status` RPC)
- Store connection details in Supabase (encrypted token)
- Connection status indicator in sidebar (green/yellow/red dot)

### 2. Project Spaces

**Data model:**
```sql
create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  icon text default '📁',
  color text default '#6366f1',
  session_key text not null unique,
  model text,                        -- optional model override
  custom_instructions text,          -- appended to session context
  pinned_files text[],               -- file paths always loaded
  archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table messages (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  attachments jsonb default '[]',
  tool_calls jsonb default '[]',
  run_id text,
  created_at timestamptz default now()
);

create table artifacts (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  name text not null,
  type text not null,                -- 'html', 'markdown', 'image', 'pdf', 'code', 'file'
  content text,                      -- inline content (for html/md/code)
  file_url text,                     -- Supabase Storage URL (for binary files)
  mime_type text,
  size_bytes bigint,
  created_at timestamptz default now()
);
```

**UI:**
- Sidebar with project list (icon + name + unread indicator)
- "New Project" button → modal with name, description, icon picker, color
- Project settings page (model, custom instructions, pinned files)
- Archive/unarchive projects
- Session key auto-generated: `agent:main:clawspace:<projectId>`

### 3. Chat Interface

**Layout:** Split view
- Left panel (resizable, ~60%): Chat messages
- Right panel (~40%): Artifact preview (collapsible)

**Chat features:**
- Message input with:
  - Multi-line support (Shift+Enter for newline, Enter to send)
  - File attachment button (upload to Supabase Storage, send path to AI)
  - Send button
- Message display:
  - User messages: right-aligned, colored bubble
  - Assistant messages: left-aligned, white/dark bubble
  - Full markdown rendering (use `react-markdown` + `remark-gfm` + `rehype-highlight`)
  - Code blocks with syntax highlighting and copy button
  - Inline images
  - Tool call/result collapsible sections (show what the AI did)
- Streaming: show tokens as they arrive (typing effect)
- Thinking indicator: "Thinking..." with animated dots while waiting
- Stop button: calls `chat.abort` to cancel generation
- Auto-scroll to bottom on new messages
- Load more (scroll up to load older history)

**WebSocket management:**
- Single WebSocket connection to Gateway (shared across projects)
- Route incoming `chat` events to the correct project by `sessionKey`
- Reconnect on disconnect with exponential backoff
- Queue messages if disconnected, send when reconnected

### 4. Artifact Panel

When the AI generates a file or rich content, it appears in the artifact panel.

**Detection:** Parse assistant messages for:
- Code blocks with language hints (```html, ```markdown, etc.)
- File references (paths mentioned in tool results)
- Generated images (base64 or file paths)

**Preview types:**
- **HTML:** Rendered in sandboxed iframe
- **Markdown:** Rendered with react-markdown
- **Images:** Displayed with zoom capability
- **Code:** Syntax-highlighted with copy button
- **PDF:** Link to download (no inline preview for MVP)

**Artifact list:** Scrollable list of all artifacts in the project, newest first. Click to preview.

### 5. File Browser

- Per-project file list (stored in Supabase Storage under `projects/<projectId>/`)
- Upload files (drag-and-drop + button)
- Download files
- Preview supported formats inline
- File metadata (name, type, size, date)
- Delete files

---

## UI/UX Specifications

### Color Scheme
- **Primary:** Indigo (#6366f1)
- **Background:** White (light) / Slate-900 (dark)
- **Support dark mode** from day one (use Tailwind's dark: variant)

### Layout (Desktop)
```
┌──────────────────────────────────────────────────────────┐
│ ┌─────────┐ ┌──────────────────────┐ ┌────────────────┐ │
│ │         │ │                      │ │                │ │
│ │ Sidebar │ │    Chat Messages     │ │   Artifact     │ │
│ │         │ │                      │ │   Preview      │ │
│ │ Projects│ │                      │ │                │ │
│ │ List    │ │                      │ │   (collapsible)│ │
│ │         │ │                      │ │                │ │
│ │         │ │──────────────────────│ │                │ │
│ │         │ │  Message Input       │ │                │ │
│ └─────────┘ └──────────────────────┘ └────────────────┘ │
└──────────────────────────────────────────────────────────┘
  ~250px        ~flexible                ~400px (or hidden)
```

### Layout (Mobile)
- Sidebar becomes a slide-out drawer (hamburger menu)
- Artifact panel becomes a bottom sheet or full-screen overlay
- Chat takes full width

### Key Interactions
- Click project in sidebar → switch to that project's chat
- Click artifact in message → open in artifact panel
- Drag divider between chat and artifact panel to resize
- Cmd+K / Ctrl+K → quick project switcher
- Cmd+N / Ctrl+N → new project

---

## Project Structure

```
clawspace/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (providers, sidebar)
│   │   ├── page.tsx                # Landing/dashboard (redirect to first project)
│   │   ├── login/
│   │   │   └── page.tsx            # Login page
│   │   ├── signup/
│   │   │   └── page.tsx            # Signup page
│   │   ├── project/
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Chat + artifact view
│   │   │       ├── settings/
│   │   │       │   └── page.tsx    # Project settings
│   │   │       └── files/
│   │   │           └── page.tsx    # File browser
│   │   └── settings/
│   │       └── page.tsx            # User settings + connection config
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── sidebar.tsx             # Project sidebar
│   │   ├── chat/
│   │   │   ├── message-list.tsx    # Scrollable message list
│   │   │   ├── message-bubble.tsx  # Single message (user/assistant)
│   │   │   ├── message-input.tsx   # Input with attachments
│   │   │   ├── tool-call.tsx       # Collapsible tool call display
│   │   │   └── thinking.tsx        # Thinking indicator
│   │   ├── artifacts/
│   │   │   ├── artifact-panel.tsx  # Right panel container
│   │   │   ├── html-preview.tsx    # Sandboxed iframe renderer
│   │   │   ├── markdown-preview.tsx
│   │   │   ├── code-preview.tsx
│   │   │   └── image-preview.tsx
│   │   ├── files/
│   │   │   ├── file-browser.tsx
│   │   │   ├── file-upload.tsx
│   │   │   └── file-preview.tsx
│   │   └── connection-status.tsx   # Gateway connection indicator
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser Supabase client
│   │   │   ├── server.ts           # Server Supabase client
│   │   │   └── middleware.ts       # Auth middleware
│   │   ├── gateway/
│   │   │   ├── ws-client.ts        # WebSocket client for OpenClaw Gateway
│   │   │   ├── types.ts            # Gateway message types
│   │   │   └── hooks.ts            # React hooks (useGateway, useChat, useSession)
│   │   ├── artifacts/
│   │   │   └── detector.ts         # Parse messages for artifacts
│   │   └── utils.ts
│   ├── stores/
│   │   ├── gateway-store.ts        # Zustand store for WS connection state
│   │   ├── chat-store.ts           # Messages, streaming state per project
│   │   └── project-store.ts        # Active project, project list
│   └── types/
│       └── index.ts                # Shared TypeScript types
├── supabase/
│   └── migrations/
│       └── 001_initial.sql         # Database schema
├── public/
│   └── logo.svg
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
└── .env.local.example
```

---

## State Management

Use **Zustand** for client-side state (lightweight, no boilerplate):

```typescript
// gateway-store.ts
interface GatewayStore {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  ws: WebSocket | null;
  gatewayUrl: string | null;
  gatewayToken: string | null;
  connect: (url: string, token: string) => void;
  disconnect: () => void;
  send: (method: string, params: Record<string, any>) => Promise<any>;
}

// chat-store.ts
interface ChatStore {
  messagesByProject: Record<string, Message[]>;
  streamingByProject: Record<string, string>;  // partial streaming text
  loadingByProject: Record<string, boolean>;
  sendMessage: (projectId: string, sessionKey: string, content: string) => void;
  appendStreamChunk: (projectId: string, chunk: string) => void;
  finalizeStream: (projectId: string, fullMessage: Message) => void;
}
```

---

## Critical Implementation Details

### WebSocket Client (`gateway/ws-client.ts`)

```typescript
class GatewayClient {
  private ws: WebSocket | null = null;
  private pendingRPC: Map<string, { resolve, reject }> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect(url: string, token: string) {
    const wsUrl = new URL(url);
    wsUrl.searchParams.set('token', token);
    this.ws = new WebSocket(wsUrl.toString());

    this.ws.onopen = () => { /* set connected, reset reconnect counter */ };
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.pendingRPC.has(data.id)) {
        // RPC response
        this.pendingRPC.get(data.id).resolve(data.result);
        this.pendingRPC.delete(data.id);
      } else if (data.type === 'chat') {
        // Streaming chat event — route to correct project by sessionKey
        this.emit('chat', data);
      }
    };
    this.ws.onclose = () => { /* reconnect with exponential backoff */ };
  }

  async rpc(method: string, params: any = {}): Promise<any> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pendingRPC.set(id, { resolve, reject });
      this.ws?.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pendingRPC.has(id)) {
          this.pendingRPC.delete(id);
          reject(new Error('RPC timeout'));
        }
      }, 30000);
    });
  }

  // Event emitter for streaming
  on(event: string, handler: Function) { /* ... */ }
  off(event: string, handler: Function) { /* ... */ }
  private emit(event: string, data: any) { /* ... */ }
}
```

### Message Streaming Pattern

When user sends a message:
1. Add user message to local store + Supabase
2. Call `chat.send` via WS with the project's sessionKey
3. Create a placeholder assistant message (loading state)
4. As `chat` events arrive with `event: "text"`, append to streaming buffer
5. On `event: "done"`, finalize the message, save to Supabase
6. Parse the final message for artifacts

### Artifact Detection

```typescript
function detectArtifacts(content: string): Artifact[] {
  const artifacts: Artifact[] = [];

  // Detect code blocks with language
  const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const [, language, code] = match;
    if (['html', 'css', 'javascript', 'typescript', 'python', 'json', 'markdown', 'md'].includes(language)) {
      artifacts.push({
        type: language === 'md' ? 'markdown' : language === 'html' ? 'html' : 'code',
        name: `snippet.${language}`,
        content: code.trim(),
      });
    }
  }

  // Detect file paths in tool results
  const filePathRegex = /(?:saved|wrote|created|generated)\s+(?:to\s+)?[`"]?([\/\w\-\.]+\.\w+)[`"]?/gi;
  while ((match = filePathRegex.exec(content)) !== null) {
    artifacts.push({
      type: 'file',
      name: match[1].split('/').pop() || match[1],
      content: null,
      filePath: match[1],
    });
  }

  return artifacts;
}
```

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Default gateway (optional, user can override in settings)
NEXT_PUBLIC_DEFAULT_GATEWAY_URL=ws://localhost:18789
```

---

## Supabase Setup

### Row Level Security (RLS)

Every table needs RLS enabled. Users can only access their own data:

```sql
-- Enable RLS
alter table projects enable row level security;
alter table messages enable row level security;
alter table artifacts enable row level security;

-- Projects: users see only their own
create policy "Users can CRUD their own projects"
  on projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Messages: users see messages in their projects
create policy "Users can CRUD messages in their projects"
  on messages for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

-- Artifacts: same pattern
create policy "Users can CRUD artifacts in their projects"
  on artifacts for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));
```

### Storage Buckets

```sql
-- Create bucket for project files
insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false);

-- RLS: users can access files in their projects
create policy "Users can manage files in their projects"
  on storage.objects for all
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] in (
      select id::text from projects where user_id = auth.uid()
    )
  );
```

---

## Design Decisions (Already Made — Don't Revisit)

1. **Next.js App Router** — Not Pages Router. Use Server Components where possible.
2. **Supabase** — Not Firebase, not Prisma+PostgreSQL. Supabase handles auth, db, storage, realtime.
3. **shadcn/ui** — Not Material UI, not Chakra. shadcn gives us ownership of component code.
4. **Zustand** — Not Redux, not Jotai. Lightweight, minimal boilerplate.
5. **Direct Gateway WS** — Not building a channel plugin for MVP. Direct WebSocket is simpler and the Control UI already proves this works.
6. **Session per project** — Each project gets `agent:main:clawspace:<projectId>` as its session key.
7. **Messages stored in Supabase** — Even though OpenClaw stores transcripts, we keep our own copy for fast loading, search, and offline access.
8. **Dark mode from day one** — Not an afterthought.

---

## Build Order (Follow This Sequence)

### Phase 1: Foundation
1. `npx create-next-app@latest clawspace --typescript --tailwind --app --src-dir`
2. Initialize shadcn/ui: `npx shadcn@latest init`
3. Install dependencies: `zustand`, `react-markdown`, `remark-gfm`, `rehype-highlight`
4. Set up Supabase project (create via dashboard or CLI)
5. Run database migration (create tables + RLS)
6. Set up auth (login, signup, middleware for protected routes)
7. Create basic layout with sidebar skeleton

### Phase 2: Core
8. Build Gateway WebSocket client (`lib/gateway/ws-client.ts`)
9. Build connection settings page (enter gateway URL + token, test connection)
10. Build Zustand stores (gateway, projects, chat)
11. Build project CRUD (create, list, archive)
12. Build chat interface (message list, input, streaming)
13. Integrate chat with Gateway WS (send messages, receive streams)

### Phase 3: Rich Features
14. Build artifact detection and panel
15. Build file browser (upload, list, download, preview)
16. Build markdown/HTML/code preview components
17. Add tool call display (collapsible sections in messages)

### Phase 4: Polish
18. Responsive design (mobile sidebar drawer, bottom sheet for artifacts)
19. Loading states, error handling, empty states
20. Keyboard shortcuts (Cmd+K, Cmd+N)
21. Dark mode toggle
22. Connection reconnection logic with backoff

### Phase 5: Ship
23. Deploy to Vercel
24. Write README with screenshots
25. Create .env.local.example
26. Test end-to-end with a real OpenClaw instance

---

## Quality Requirements

- **No console errors** in production
- **Lighthouse score > 90** on performance
- **Responsive** — works on 375px (iPhone SE) through 2560px (ultrawide)
- **Accessible** — proper ARIA labels, keyboard navigation, focus management
- **Type-safe** — no `any` types except in external library interfaces
- **Error boundaries** — graceful error handling, never a white screen

---

## What NOT to Build (MVP Scope Control)

- ❌ Dynamic forms / form builder (V2)
- ❌ Template workflows (V2)
- ❌ Inline charts/visualizations (V2)
- ❌ Team collaboration / shared workspaces (V3)
- ❌ Plugin system (V3)
- ❌ Mobile app / PWA (V3)
- ❌ Relay server for NAT traversal (V2)
- ❌ Payment / subscription system (post-launch)
- ❌ Admin panel (post-launch)
- ❌ Analytics / usage tracking (post-launch)

---

## Reference: OpenClaw Docs

- Full docs: https://docs.openclaw.ai
- Source: https://github.com/openclaw/openclaw
- Community: https://discord.com/invite/clawd
- Gateway WebSocket: uses JSON-RPC-like protocol over WS
- Control UI source: see `dist/control-ui` in the openclaw npm package for reference implementation

---

## Success Criteria (Definition of Done)

The MVP is done when:
1. ✅ User can sign up, log in, connect to an OpenClaw gateway
2. ✅ User can create projects and switch between them
3. ✅ User can chat with the AI in each project (with streaming responses)
4. ✅ Each project has its own OpenClaw session (isolated context)
5. ✅ Artifacts (HTML, markdown, code) are detected and previewed in the side panel
6. ✅ Files can be uploaded, browsed, and downloaded per project
7. ✅ Works on desktop and mobile
8. ✅ Dark mode works
9. ✅ Deployed to Vercel and accessible via URL

---

*Brief v1 — February 3, 2026*
*Author: Goat (OpenClaw agent on Razvan's AWS instance)*
