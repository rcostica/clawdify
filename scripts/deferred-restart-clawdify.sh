#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-aa9caffb-22fc-4459-87f8-73abd95c2857}"
POST_MESSAGE="${2:-✅ Clawdify restarted safely and is live.}"
DELAY_SECONDS="${3:-2}"
UNIT="clawdify-deferred-restart-$(date +%s)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
Usage:
  scripts/deferred-restart-clawdify.sh [projectId] [postRestartMessage] [delaySeconds]

Schedules a detached Clawdify restart through systemd-run. Use this from inside
Clawdify chats so the current assistant response can finish streaming before the
server is restarted. After restart, safe-restart-clawdify.sh posts the completion
message into the project chat.
EOF
  exit 0
fi

systemd-run --user \
  --unit="$UNIT" \
  --description="Deferred Clawdify safe restart" \
  --on-active="${DELAY_SECONDS}s" \
  --setenv="PROJECT_ID=$PROJECT_ID" \
  --setenv="POST_MESSAGE=$POST_MESSAGE" \
  /bin/bash -lc 'cd /home/ubuntu/clawdify && ./scripts/safe-restart-clawdify.sh "$PROJECT_ID" "$POST_MESSAGE"'

echo "Scheduled deferred Clawdify restart: unit=$UNIT delay=${DELAY_SECONDS}s"
