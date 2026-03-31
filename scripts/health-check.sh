#!/bin/bash
# Health check: containers, memory, API reachability
# Usage: crontab -e → */5 * * * * /opt/rebalance-bot/scripts/health-check.sh
set -uo pipefail

STATE_FILE="/tmp/rebalance-health-state"
source /opt/rebalance-bot/.env

ALERT=""

# 1. Check containers are running and healthy
DOWN=$(docker ps -a --filter "name=rebalance-" --format '{{.Names}} {{.Status}}' \
  | grep -v "Up\|autoheal" || true)
[ -n "$DOWN" ] && ALERT+="Containers down: $DOWN\n"

# 2. Check memory usage (alert if > 90%)
HIGH_MEM=$(docker stats --no-stream --format '{{.Name}} {{.MemPerc}}' \
  | grep "rebalance-" \
  | while read name pct; do
      num=$(echo "$pct" | tr -d '%')
      if [ "$(echo "$num > 90" | bc 2>/dev/null || echo 0)" = "1" ]; then
        echo "$name $pct"
      fi
    done || true)
[ -n "$HIGH_MEM" ] && ALERT+="High memory: $HIGH_MEM\n"

# 3. Check backend API
if ! curl -sf http://127.0.0.1:3001/api/health > /dev/null 2>&1; then
  ALERT+="Backend API unreachable\n"
fi

# 4. Check frontend
if ! curl -sf http://127.0.0.1:3000/health > /dev/null 2>&1; then
  ALERT+="Frontend unreachable\n"
fi

# Compare with previous state — only alert on change
PREV=$(cat "$STATE_FILE" 2>/dev/null || echo "")
echo -e "$ALERT" > "$STATE_FILE"

send_telegram() {
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    -d text="$1" > /dev/null 2>&1 || true
}

if [ -n "$ALERT" ] && [ "$ALERT" != "$PREV" ]; then
  send_telegram "$(echo -e "⚠️ ALERT:\n$ALERT")"
elif [ -z "$ALERT" ] && [ -n "$PREV" ]; then
  send_telegram "✅ All systems recovered"
fi
