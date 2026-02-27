# 🐒 Clawdify

**Mission Control for [OpenClaw](https://github.com/openclaw/openclaw)** — a project-based web interface for managing your AI agent.

## What is this?

Clawdify gives your OpenClaw agent a proper workspace: project-based chats with persistent memory, kanban boards, a file browser, and multi-device access. Think of it as the UI layer your agent deserves.

### Features

- **Project organization** — separate workspaces with their own conversations, files, tasks, and context memory
- **Chat** — talk to your agent with full project awareness (CONTEXT.md, file manifest, sub-project inheritance)
- **Kanban** — drag-and-drop task management, sub-tasks, sort ordering
- **File browser** — browse, edit, create files in the OpenClaw workspace. Hidden files toggle, inline rename
- **Docs tab** — rendered markdown viewer for project documentation
- **Voice messages** — record and send audio, transcribed via local Whisper STT
- **PWA** — installs as a native app on mobile and desktop
- **Multi-device sync** — SSE-based real-time sync across all connected devices
- **Instance naming** — custom name per install (useful when running multiple Clawdify instances)
- **Any model** — works with any model provider supported by OpenClaw (Anthropic, OpenAI, Google, local models via Ollama, etc.)

---

## Prerequisites

| Requirement | Why |
|---|---|
| **[OpenClaw](https://github.com/openclaw/openclaw)** | The AI agent runtime. Clawdify is its frontend. Must be running on the same machine. |
| **[Node.js](https://nodejs.org/) 18+** | Build and run Clawdify. v22+ recommended. |
| **[Tailscale](https://tailscale.com/)** *(recommended)* | Secure remote access from phone/laptop without exposing ports. Required for PWA install (needs HTTPS). |

---

## Setup

### Fresh OpenClaw — No Existing Projects

You just installed OpenClaw and want a project workspace.

```bash
# 1. Clone and install
git clone https://github.com/rcostica/clawdify.git ~/clawdify
cd ~/clawdify && npm install

# 2. Run setup wizard (auto-detects gateway token, workspace path, enables chat endpoint)
npm run setup

# 3. Restart gateway to apply the config change
openclaw gateway restart

# 4. Build and start
npm run build
npm start
```

Open `http://localhost:3000`. A **General** project is created automatically — click it and start chatting.

### Existing OpenClaw — Already Has Projects & Files

Your agent has been running via Telegram, Slack, or CLI. There are workspace files and project folders.

```bash
# 1–4: Same as above
git clone https://github.com/rcostica/clawdify.git ~/clawdify
cd ~/clawdify && npm install
npm run setup
openclaw gateway restart
npm run build
npm start
```

Then in the browser:

5. Go to **Settings → Discover Projects** → **Scan Workspace**
6. Clawdify finds all folders in your OpenClaw workspace
7. Check which folders should become projects
8. **Drag folders onto other folders** to set up parent/child hierarchy
9. Click **Create Projects** — done

> **💡 Sub-project tip:** If your agent created `project1/seo/`, `project1/content/`, and `project1/ads/` as separate folders, drag seo/content/ads onto project1 to import them as sub-projects.

### Docker

```bash
git clone https://github.com/rcostica/clawdify.git
cd clawdify
cp .env.example .env
# Edit .env with your gateway token
docker compose up -d
```

> Set `OPENCLAW_GATEWAY_URL=http://host.docker.internal:18789` to reach the host's gateway.

<details>
<summary><strong>Manual Setup</strong> (if you want full control)</summary>

```bash
git clone https://github.com/rcostica/clawdify.git ~/clawdify
cd ~/clawdify && npm install
```

Create `.env`:

```bash
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_GATEWAY_TOKEN=your-token-here          # find in ~/.openclaw/openclaw.json → gateway.auth.token
OPENCLAW_WORKSPACE_PATH=/home/you/.openclaw/workspace
CLAWDIFY_SESSION_SECRET=$(openssl rand -hex 32)
CLAWDIFY_PIN=1234                               # optional
PORT=3000
```

Enable the chat endpoint in `~/.openclaw/openclaw.json` (add to the `gateway` object):

```json
{
  "gateway": {
    "http": {
      "endpoints": {
        "chatCompletions": {
          "enabled": true
        }
      }
    }
  }
}
```

```bash
openclaw gateway restart
npm run build && npm start
```

</details>

---

## What the Setup Wizard Does

`npm run setup` is a zero-dependency Node.js script that:

1. **Detects** your gateway token from `~/.openclaw/openclaw.json`
2. **Detects** your workspace path and sessions path
3. **Enables** the `chatCompletions` endpoint in the gateway config (disabled by default in OpenClaw)
4. **Generates** a session secret
5. **Asks** for PIN and port (only 3 prompts)
6. **Writes** a complete `.env` file
7. **Optionally** creates a systemd user service

After setup, you must run `openclaw gateway restart` to apply the config change.

---

## Remote Access with Tailscale

Clawdify binds to `localhost:3000` by default. Tailscale extends access to your other devices securely:

1. Install [Tailscale](https://tailscale.com/download) on the server and your phone/laptop
2. Both devices join the same Tailscale network
3. Access Clawdify at `http://your-server:3000` from any device

### HTTPS (required for PWA install)

PWA installation requires HTTPS. [Tailscale Serve](https://tailscale.com/kb/1242/tailscale-serve) provides free auto-renewing certificates:

```bash
sudo tailscale serve --bg --https 8443 http://localhost:3000
```

Clawdify is now at: `https://your-machine.tailnet-name.ts.net:8443`

### Installing as a Mobile App

With HTTPS set up:

- **Android:** Chrome → Menu (⋮) → **"Install app"** (not "Add to Home Screen")
- **iOS:** Safari → Share → **"Add to Home Screen"**

> ⚠️ On Android, "Add to Home Screen" creates a browser bookmark. "Install app" creates a real PWA (fullscreen, no address bar). You need HTTPS for the PWA option.

---

## Running as a Service

The setup wizard can create this for you, or do it manually:

```ini
# ~/.config/systemd/user/clawdify.service
[Unit]
Description=Clawdify
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/you/clawdify
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now clawdify.service
```

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Any Device  │────▶│  Tailscale   │────▶│  Your Machine   │
│  (Phone,     │HTTPS│  (encrypted  │     │                 │
│   Laptop)    │     │   tunnel)    │     │  ┌───────────┐  │
└─────────────┘     └──────────────┘     │  │ Clawdify  │  │
                                          │  │ :3000     │  │
                                          │  └─────┬─────┘  │
                                          │        │ HTTP    │
                                          │  ┌─────▼─────┐  │
                                          │  │ OpenClaw  │  │
                                          │  │ Gateway   │  │
                                          │  │ :18789    │  │
                                          │  └───────────┘  │
                                          └─────────────────┘
```

- **Clawdify** = Next.js app on the same machine as OpenClaw
- **Gateway token** stays server-side (`.env`) — never sent to the browser
- **Tailscale** handles encryption and access control
- **SQLite** stores projects, tasks, messages, and settings locally

---

## Troubleshooting

### Chat returns "405 Method Not Allowed"

The gateway's `chatCompletions` endpoint is disabled (this is the default in OpenClaw).

**Fix:** Run `npm run setup` again (it auto-enables it), then `openclaw gateway restart`. Or manually edit `~/.openclaw/openclaw.json` — set `gateway.http.endpoints.chatCompletions.enabled` to `true`.

Check **Settings** in Clawdify — it shows the endpoint status with a green/red indicator.

### API errors (500) on first load

Database tables auto-create on startup. Restart Clawdify. If it persists, delete the DB and restart:

```bash
rm ~/.clawdify/clawdify.db
# restart clawdify
```

### Gateway shows "Connected" but chat fails

Test the gateway directly:

```bash
curl -X POST http://localhost:18789/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"openclaw:main","messages":[{"role":"user","content":"hi"}]}'
```

If this returns 405 → endpoint disabled (see above). If it hangs → gateway may not have an active agent session yet.

### Can't access from phone

- Both devices must be on the same network (or Tailscale)
- Check the PIN is correct
- Clear browser cache if you recently updated

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENCLAW_GATEWAY_URL` | Yes | `http://localhost:18789` | Gateway URL |
| `OPENCLAW_GATEWAY_TOKEN` | Yes | — | Gateway auth token |
| `OPENCLAW_WORKSPACE_PATH` | Yes* | — | OpenClaw workspace directory |
| `CLAWDIFY_SESSION_SECRET` | Yes | — | Session encryption key (32+ chars) |
| `CLAWDIFY_PIN` | No | — | Login PIN (empty = no auth) |
| `CLAWDIFY_DB_PATH` | No | `~/.clawdify/clawdify.db` | SQLite database path |
| `OPENCLAW_SESSIONS_PATH` | No | — | Session transcripts (for activity feed) |
| `PORT` | No | `3000` | Server port |

\* Auto-detected by setup wizard. Required for file browser and project discovery.

---

## Tech Stack

- [Next.js 16](https://nextjs.org/) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) + [Drizzle ORM](https://orm.drizzle.team/)
- [iron-session](https://github.com/vvo/iron-session) for encrypted cookies

## License

MIT
