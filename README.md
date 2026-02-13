# 🐒 Clawdify

Mission Control for [OpenClaw](https://github.com/openclaw/openclaw) — a project-based web interface for managing your AI agent.

Clawdify replaces chat apps (Telegram, Slack, Discord) as your primary OpenClaw frontend, giving you a proper workspace with project organization, kanban boards, file browsing, and conversation threads.

## Features

- **Project-based organization** — separate workspaces with their own conversations, files, and tasks
- **Chat interface** — talk to your OpenClaw agent with full context awareness
- **Kanban board** — drag-and-drop task management
- **File browser** — browse and download files from the OpenClaw workspace
- **PWA support** — installs as a native-feeling app on mobile and desktop
- **PIN authentication** — simple security for personal use
- **Multi-device access** — works from any device on your network

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (22+ recommended)
- [OpenClaw](https://github.com/openclaw/openclaw) running on the same machine
- [Tailscale](https://tailscale.com/) (optional, for secure remote access + HTTPS)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/rcostica/clawdify.git
cd clawdify
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```bash
# Required: OpenClaw Gateway connection
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_GATEWAY_TOKEN=your-gateway-token-here

# Required: Session encryption (must be 32+ characters)
CLAWDIFY_SESSION_SECRET=generate-a-random-string-at-least-32-chars

# Optional: PIN authentication (leave empty to disable)
CLAWDIFY_PIN=1234

# Optional: Custom paths
CLAWDIFY_DB_PATH=~/.clawdify/clawdify.db
OPENCLAW_WORKSPACE_PATH=/path/to/openclaw/workspace
OPENCLAW_SESSIONS_PATH=/path/to/openclaw/agents/main/sessions

# Optional: Session expiry in seconds (default: 7 days)
CLAWDIFY_SESSION_MAX_AGE=604800
```

**Finding your Gateway token:**
```bash
# The token is in your OpenClaw config
cat ~/.openclaw/config.yaml | grep token
```

### 3. Run in development

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 4. Build for production

```bash
npm run build
npm start
```

## Deployment (Recommended Setup)

The recommended setup runs Clawdify as a systemd service on the same machine as OpenClaw, with Tailscale providing secure HTTPS access from any device.

### Systemd Service

Create `~/.config/systemd/user/clawdify.service`:

```ini
[Unit]
Description=Clawdify
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/clawdify
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

> **Note:** For development, use `ExecStart=/usr/bin/npm run dev` instead.

### HTTPS via Tailscale (Required for PWA)

PWA installation (native app feel on mobile) **requires HTTPS**. Without it, "Add to Home Screen" creates a browser bookmark instead of a proper app install.

[Tailscale Serve](https://tailscale.com/kb/1242/tailscale-serve) provides free, auto-renewing HTTPS certificates for devices on your tailnet:

```bash
# Expose Clawdify over HTTPS on port 8443
sudo tailscale serve --bg --https 8443 http://localhost:3000
```

This makes Clawdify available at:
```
https://your-machine-name.tailnet-name.ts.net:8443
```

The `--bg` flag makes it persistent across reboots.

> **Why port 8443?** Port 443 may already be in use (e.g., by OpenClaw gateway). Use any available port.

**Check your Tailscale hostname:**
```bash
tailscale status --self
```

### Installing as a Mobile App (PWA)

Once you have HTTPS set up:

1. Open the Tailscale HTTPS URL on your phone (Chrome on Android, Safari on iOS)
2. **Android:** Menu (⋮) → **"Install app"** (not "Add to Home Screen")
3. **iOS:** Share button → **"Add to Home Screen"**

The app will launch fullscreen with no browser chrome — just like a native app.

> ⚠️ **"Add to Home Screen" ≠ "Install app" on Android.** The former creates a browser shortcut (with address bar). The latter installs a proper PWA (fullscreen, standalone). You need HTTPS for the "Install app" option to appear.

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

- **Clawdify** runs on the same machine as OpenClaw
- **Gateway token** stays server-side (in `.env`) — never sent to the browser
- **Tailscale** handles encryption and access control — only your devices can connect
- **PIN auth** adds a lightweight defense-in-depth layer
- **SQLite** stores projects, tasks, and settings locally

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENCLAW_GATEWAY_URL` | Yes | `http://localhost:18789` | OpenClaw Gateway HTTP URL |
| `OPENCLAW_GATEWAY_TOKEN` | Yes | — | Gateway authentication token |
| `CLAWDIFY_SESSION_SECRET` | Yes | (insecure default) | Session encryption key (32+ chars) |
| `CLAWDIFY_PIN` | No | — | PIN for login (empty = no auth) |
| `CLAWDIFY_DB_PATH` | No | `~/.clawdify/clawdify.db` | SQLite database location |
| `OPENCLAW_WORKSPACE_PATH` | No | — | OpenClaw workspace directory |
| `OPENCLAW_SESSIONS_PATH` | No | `~/.openclaw/agents/main/sessions` | Session transcripts path |
| `CLAWDIFY_SESSION_MAX_AGE` | No | `604800` (7 days) | Session cookie expiry (seconds) |

## Tech Stack

- [Next.js 15](https://nextjs.org/) — React framework
- [Tailwind CSS v4](https://tailwindcss.com/) — Styling
- [shadcn/ui](https://ui.shadcn.com/) — Component library
- [Zustand](https://zustand-demo.pmnd.rs/) — State management
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Local database
- [iron-session](https://github.com/vvo/iron-session) — Encrypted session cookies

## License

MIT
