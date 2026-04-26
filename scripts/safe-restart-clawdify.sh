#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-aa9caffb-22fc-4459-87f8-73abd95c2857}"
POST_MESSAGE="${2:-✅ Clawdify restarted and is live.}"
PRE_MESSAGE="${3:-}"
BASE_URL="${CLAWDIFY_URL:-http://127.0.0.1:3000}"

post_message() {
  local message="$1"
  [[ -z "$message" ]] && return 0
  python3 - "$PROJECT_ID" "$message" <<'PY' | curl -fsS -X POST "$BASE_URL/api/messages/save" -H 'Content-Type: application/json' --data-binary @- >/dev/null
import json, sys
print(json.dumps({
    "projectId": sys.argv[1],
    "role": "assistant",
    "content": sys.argv[2],
}))
PY
}

restart_service() {
  systemctl --user restart clawdify.service || true

  # next-server sometimes survives TERM and leaves the unit stuck deactivating.
  # If that happens, kill the cgroup and start cleanly.
  local deadline=$((SECONDS + 20))
  while (( SECONDS < deadline )); do
    state="$(systemctl --user show clawdify.service -p ActiveState --value 2>/dev/null || true)"
    sub="$(systemctl --user show clawdify.service -p SubState --value 2>/dev/null || true)"
    if [[ "$state" == "active" && "$sub" == "running" ]]; then
      return 0
    fi
    sleep 1
  done

  systemctl --user kill --kill-who=all clawdify.service || true
  sleep 2
  systemctl --user reset-failed clawdify.service || true
  systemctl --user start clawdify.service
}

wait_ready() {
  local deadline=$((SECONDS + 45))
  while (( SECONDS < deadline )); do
    if curl -fsS "$BASE_URL/api/gateway/status" >/dev/null 2>&1 || curl -fsS "$BASE_URL/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# Persist the context/progress note before killing the server. This prevents the
# live streamed assistant turn from being the only place where the explanation exists.
post_message "$PRE_MESSAGE"
restart_service
wait_ready
post_message "$POST_MESSAGE"

echo "Clawdify restarted and completion message posted."
