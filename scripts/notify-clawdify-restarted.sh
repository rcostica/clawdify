#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${CLAWDIFY_NOTIFY_PROJECT_ID:-aa9caffb-22fc-4459-87f8-73abd95c2857}"
BASE_URL="${CLAWDIFY_URL:-http://127.0.0.1:3000}"
BASE_MESSAGE="${CLAWDIFY_RESTART_MESSAGE:-✅ Clawdify restarted successfully and is live.}"
MESSAGE="$BASE_MESSAGE ($(date -u +'%H:%M:%S UTC'))"
STAMP_FILE="${XDG_RUNTIME_DIR:-/tmp}/clawdify-last-restart-notify"

# Avoid duplicate notifications if systemd rapidly restarts or ExecStartPost is retried.
now="$(date +%s)"
if [[ -f "$STAMP_FILE" ]]; then
  last="$(cat "$STAMP_FILE" 2>/dev/null || echo 0)"
  if [[ "$last" =~ ^[0-9]+$ ]] && (( now - last < 8 )); then
    exit 0
  fi
fi
printf '%s' "$now" > "$STAMP_FILE"

# Wait until Next.js is actually responding.
for _ in $(seq 1 45); do
  if curl -fsS "$BASE_URL/api/gateway/status" >/dev/null 2>&1 || curl -fsS "$BASE_URL/" >/dev/null 2>&1; then
    # Give browser EventSource clients a moment to reconnect after restart.
    sleep 2
    python3 - "$PROJECT_ID" "$MESSAGE" <<'PY' | curl -fsS -X POST "$BASE_URL/api/messages/save" -H 'Content-Type: application/json' --data-binary @- >/dev/null
import json, sys
print(json.dumps({
    "projectId": sys.argv[1],
    "role": "assistant",
    "content": sys.argv[2],
}))
PY
    exit 0
  fi
  sleep 1
done

exit 0
