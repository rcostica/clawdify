# @clawdify/relay

WebSocket relay server for Clawdify. Bridges browser clients to OpenClaw Gateway agents through a central relay, solving NAT/firewall traversal.

## Architecture

```
Browser ←→ WSS ←→ [ Relay Server ] ←→ WSS ←→ Agent (OpenClaw Gateway)
```

Both sides connect **outbound** to the relay. The relay pairs them into a "room" and forwards all WebSocket frames bidirectionally.

## Quick Start

```bash
# Install
npm install

# Development
RELAY_SECRET=dev-secret npm run dev

# Build
npm run build

# Production
RELAY_SECRET=your-secret node dist/index.js
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP/WS listen port |
| `RELAY_SECRET` | *required* | HMAC secret for signing/verifying room tokens |
| `MAX_MESSAGE_SIZE` | `1048576` | Max WebSocket message size in bytes (1MB) |
| `ROOM_TTL_MS` | `86400000` | Max room lifetime in ms (24h) |
| `GRACE_PERIOD_MS` | `30000` | Time to keep empty room alive for reconnection (30s) |
| `STATS_TOKEN` | *optional* | Bearer token for `/stats` endpoint |

## Protocol

### Connection

```
wss://relay.clawdify.app/ws?token=ROOM_TOKEN&role=agent|browser
```

1. Client connects with a signed room token and its role (`agent` or `browser`)
2. Server validates the token, assigns the connection to a room
3. When both peers are present, all messages are forwarded bidirectionally
4. Binary and text frames are relayed as-is (opaque)

### Room Tokens

HMAC-SHA256 signed tokens encoding:

```json
{ "roomId": "abc123", "userId": "user_1", "role": "agent", "exp": 1700000000 }
```

Format: `<base64url(payload)>.<base64url(hmac)>`

Generate tokens using the `createRoomToken()` function from `src/auth.ts`.

### Control Messages

Server → Client:
```json
{ "type": "relay:connected", "roomId": "abc123" }
{ "type": "relay:peer_joined", "role": "browser" }
{ "type": "relay:peer_left", "role": "browser" }
{ "type": "relay:error", "message": "token expired" }
```

Client → Server:
```json
{ "type": "relay:ping" }
```

All non-control messages are forwarded to the peer as-is.

## HTTP Endpoints

- `GET /health` — `{ "status": "ok", "rooms": N, "connections": N }`
- `GET /stats` — Detailed room stats (requires `Authorization: Bearer <STATS_TOKEN>`)

## Deployment

### Fly.io

```bash
fly launch --copy-config
fly secrets set RELAY_SECRET=your-secret
fly deploy
```

### Docker

```bash
npm run build
docker build -t clawdify-relay .
docker run -p 8080:8080 -e RELAY_SECRET=your-secret clawdify-relay
```

## Security

- HMAC-SHA256 token verification with timing-safe comparison
- Rate limiting: 10 connections per IP per minute
- Configurable max message size
- No message content is ever logged
- Room auto-expiry after 24h
- Graceful reconnection with 30s grace period
