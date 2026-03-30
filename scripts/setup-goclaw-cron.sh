#!/bin/bash
# Setup GoClaw cron jobs via config.json (the correct way per docs)
# Usage: sshpass -p 'PASS' ssh root@VPS 'bash -s' < scripts/setup-goclaw-cron.sh

set -e

echo "=== Cleaning old cron jobs from DB ==="
docker exec rebalance-goclaw-postgres psql -U goclaw -d goclaw -c "DELETE FROM cron_jobs;"
docker exec rebalance-goclaw-postgres psql -U goclaw -d goclaw -c "DELETE FROM cron_run_logs;"

echo "=== Building config.json with cron ==="
docker exec rebalance-goclaw ./goclaw config show | python3 -c "
import sys, json
d = json.load(sys.stdin)
d['cron'] = [
  {
    'schedule': '0 1 * * *',
    'agent_id': 'fox-spirit',
    'message': 'Dùng mcp_rb__get_portfolio và mcp_rb__get_health. Gửi báo cáo portfolio hàng ngày tiếng Việt.',
    'channel': 'telegram',
    'target': '1119792006'
  },
  {
    'schedule': '0 1 * * 0',
    'agent_id': 'fox-spirit',
    'message': 'Tổng kết hiệu suất tuần bằng mcp_rb__get_portfolio và mcp_rb__list_trades. Tiếng Việt.',
    'channel': 'telegram',
    'target': '1119792006'
  },
  {
    'schedule': '0 7 * * *',
    'agent_id': 'fox-spirit',
    'message': 'Phân tích portfolio, đề xuất hành động. Tiếng Việt.',
    'channel': 'telegram',
    'target': '1119792006'
  }
]
json.dump(d, sys.stdout, indent=2)
" > /tmp/gc.json

echo "=== Copying config into container ==="
docker cp /tmp/gc.json rebalance-goclaw:/app/config.json

echo "=== Restarting GoClaw ==="
docker restart rebalance-goclaw
sleep 15

echo "=== Verifying config ==="
docker exec rebalance-goclaw ./goclaw config show | python3 -c "
import sys, json
d = json.load(sys.stdin)
c = d.get('cron', [])
print(f'Config cron: {len(c)} jobs')
for j in c:
  print(f'  schedule={j[\"schedule\"]} channel={j[\"channel\"]}')
"

echo "=== Cron list ==="
docker exec rebalance-goclaw ./goclaw cron list --all

echo "=== Done ==="
