#!/bin/bash
set -e

# Generate config from env vars
cat > /app/config.yaml << EOF
model: ${AI_MODEL:-anthropic/claude-sonnet-4-20250514}

providers:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY:-}
  openai:
    apiKey: ${OPENAI_API_KEY:-}

relay:
  url: ${CLAWDIFY_RELAY_URL:-wss://relay.clawdify.app}
  token: ${CLAWDIFY_USER_TOKEN:-}
  gatewayId: ${CLAWDIFY_GATEWAY_ID:-}

server:
  port: ${PORT:-18789}
  host: 0.0.0.0
EOF

echo "[entrypoint] Starting OpenClaw Gateway..."
echo "[entrypoint] Model: ${AI_MODEL:-anthropic/claude-sonnet-4-20250514}"
echo "[entrypoint] Relay: ${CLAWDIFY_RELAY_URL:-wss://relay.clawdify.app}"

exec openclaw gateway start --config /app/config.yaml
