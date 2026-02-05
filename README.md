# 🐾 Clawdify

**A web dashboard for your OpenClaw AI agent.**

Clawdify is an open-source web interface for [OpenClaw](https://github.com/openclaw/openclaw) — the AI agent runtime. It gives you a project-based workspace to manage tasks, watch your agent work in real-time, and organize your AI-assisted projects.

> **Note:** This is a personal/community project, not a commercial product. Self-host it, fork it, make it yours.

<!-- ![Clawdify Screenshot](./screenshots/hero.png) -->

---

## ✨ Features

- **🔗 Gateway Connection** — Connect to any OpenClaw Gateway via WebSocket (ws/wss)
- **📂 Project Spaces** — Organize conversations into separate projects with custom icons & colors
- **💬 Real-time Chat** — Stream AI responses with full markdown rendering
- **🎨 Artifact Preview** — View HTML, code, markdown, and image artifacts in a split pane
- **📥 Import Conversations** — Import existing sessions from your Gateway with one click
- **🌓 Dark Mode** — Light, dark, and system theme support
- **⌨️ Keyboard Shortcuts** — Cmd+K project search, Cmd+N new project, and more
- **🔒 Security First** — Encrypted token storage, sandboxed iframes, XSS protection, CSP headers

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase](https://supabase.com/) project (free tier works)
- [OpenClaw](https://github.com/nichochar/openclaw) Gateway running

### 1. Clone & Install

```bash
git clone https://github.com/your-username/clawdify.git
cd clawdify
npm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_DEFAULT_GATEWAY_URL=ws://localhost:18789
```

### 3. Set Up Supabase Database

Run the SQL migration in your Supabase SQL editor. The migration file is at `supabase/migrations/001_initial.sql` (referenced in BUILD-PLAN.md).

Key tables:
- `gateway_connections` — Encrypted gateway credentials
- `projects` — Chat project spaces
- `messages` — Chat message history
- `artifacts` — Detected code/HTML/markdown artifacts

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Connect Your Gateway

1. Sign up / log in
2. Go to **Settings** → Enter your Gateway URL and token
3. Click **Test & Connect**
4. Create your first project and start chatting!

---

## 🐳 Self-Hosting with Docker

```bash
# Build
docker build -t clawdify .

# Run
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  clawdify
```

The Docker image:
- Uses multi-stage build (builder + runner)
- Runs as non-root user (`nextjs`)
- Uses Next.js standalone output for minimal image size
- Exposes port 3000

---

## 🔌 Connection Options

### Local (Same Machine)

If you're running Clawdify and OpenClaw on the same machine:

1. Start your OpenClaw Gateway: `openclaw gateway start`
2. In Clawdify → **Settings**, use `ws://localhost:18789`
3. Get your token: `openclaw config get gateway.auth.token`
4. Paste the token and click **Test & Connect**

### Remote Access via Tailscale (Recommended)

For accessing your Gateway from anywhere (including mobile):

1. Install [Tailscale](https://tailscale.com/) on your Gateway machine
2. Install Tailscale on your client device (laptop, phone, etc.)
3. Sign in to the same Tailscale account on both
4. In Clawdify → **Settings**, use `ws://your-machine.tailnet:18789`

Tailscale creates a secure, encrypted tunnel — no SSL certs or port forwarding needed.

### Remote Access via wss://

For more advanced setups, expose your Gateway over wss:// using:
- **Caddy/nginx** reverse proxy with Let's Encrypt
- **Cloudflare Tunnel** for zero-config SSL
- Any reverse proxy that terminates TLS

---

## 🔐 Security

Clawdify is built with security as the #1 priority:

| Feature | Implementation |
|---------|---------------|
| **Token Storage** | Gateway tokens encrypted with pgcrypto in Supabase, never in localStorage |
| **XSS Prevention** | `rehype-sanitize` on all markdown rendering with strict schema |
| **Iframe Sandbox** | HTML previews run in `sandbox="allow-scripts"` only — no `allow-same-origin` |
| **CSP Headers** | Content-Security-Policy with restrictive defaults |
| **RLS** | Row-Level Security on every Supabase table |
| **Auth** | Supabase auth middleware on all protected routes |
| **Frame Injection** | `connect-src 'none'` CSP injected into preview iframes |
| **Link Safety** | All external links use `target="_blank" rel="noopener noreferrer"` |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette / project search |
| `Cmd/Ctrl + N` | New project |
| `Enter` | Send message |
| `Shift + Enter` | New line in message |
| `Escape` | Close dialogs / panels |

---

## 🏗️ Tech Stack

- **Framework:** Next.js 15+ (App Router)
- **UI:** shadcn/ui + Tailwind CSS v4
- **State:** Zustand
- **Database:** Supabase (PostgreSQL + Auth)
- **Protocol:** OpenClaw Gateway WebSocket
- **Language:** TypeScript (strict mode)

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login/signup pages
│   ├── (app)/              # Authenticated app pages
│   │   ├── project/[id]/   # Project chat page
│   │   ├── settings/       # Gateway settings
│   │   └── connect/        # Connection diagnostics
│   └── api/                # API routes
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── chat/               # Chat components
│   ├── artifacts/          # Artifact preview components
│   ├── sidebar/            # Navigation sidebar
│   ├── import/             # Import dialog
│   └── onboarding/         # First-run wizard
├── lib/
│   ├── gateway/            # WebSocket client & protocol
│   ├── supabase/           # Database client
│   └── artifacts/          # Detection & persistence
├── stores/                 # Zustand state stores
└── hooks/                  # Custom React hooks
```

---

## 📝 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only, never in client code) |
| `NEXT_PUBLIC_DEFAULT_GATEWAY_URL` | ❌ | Default Gateway URL for the settings form |

---

## 🤝 Contributing

Contributions welcome! This is a community project.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/awesome`)
3. Commit your changes (`git commit -m 'Add awesome feature'`)
4. Push to the branch (`git push origin feature/awesome`)
5. Open a Pull Request

**Areas where help is appreciated:**
- Wiring up real data for Files/Media/Crons cards (currently mocked)
- Mobile responsiveness improvements
- Additional artifact types (PDF, images, etc.)
- Documentation and examples

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

---

Built with ❤️ for the OpenClaw community.
