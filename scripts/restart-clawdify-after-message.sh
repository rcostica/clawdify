#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-00000000-0000-0000-0000-000000000000}"
PRE_MESSAGE="${2:-🔄 Clawdify needs a restart. I’m saving this message first, then restarting now.}"
POST_MESSAGE="${3:-✅ Clawdify restarted safely and is live.}"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
Usage:
  scripts/restart-clawdify-after-message.sh [projectId] [fullPreRestartMessage] [postRestartMessage]

Best UX for restarting Clawdify from inside a Clawdify chat:
1. posts the full assistant message to the chat DB first,
2. immediately restarts Clawdify,
3. posts a completion message after Clawdify is live.

After calling this helper from an assistant turn, reply with NO_REPLY to avoid a duplicate streamed copy.
EOF
  exit 0
fi

cd /home/you/clawdify
./scripts/safe-restart-clawdify.sh "$PROJECT_ID" "$POST_MESSAGE" "$PRE_MESSAGE"
