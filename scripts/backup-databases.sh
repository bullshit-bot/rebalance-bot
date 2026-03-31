#!/bin/bash
# Daily database backup: MongoDB + GoClaw PostgreSQL
# Usage: crontab -e → 0 3 * * * /opt/rebalance-bot/scripts/backup-databases.sh
set -euo pipefail

BACKUP_DIR="/opt/rebalance-backups"
DATE=$(date +%Y-%m-%d)
TODAY_DIR="$BACKUP_DIR/$DATE"
mkdir -p "$TODAY_DIR"

# Load Telegram credentials
source /opt/rebalance-bot/.env

send_telegram() {
  local msg="$1"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    -d text="$msg" > /dev/null 2>&1 || true
}

ERRORS=""

# MongoDB backup
echo "[$(date)] Starting MongoDB backup..."
docker exec rebalance-mongodb mongodump \
  --username admin --password "$MONGO_PASSWORD" \
  --authenticationDatabase admin \
  --archive --gzip > "$TODAY_DIR/mongodb.archive.gz" 2>&1
if [ -s "$TODAY_DIR/mongodb.archive.gz" ]; then
  echo "[$(date)] MongoDB backup OK: $(du -sh "$TODAY_DIR/mongodb.archive.gz" | cut -f1)"
else
  ERRORS+="MongoDB backup failed (empty file). "
fi

# GoClaw PostgreSQL backup
echo "[$(date)] Starting PostgreSQL backup..."
if docker exec rebalance-goclaw-postgres pg_dump -U goclaw goclaw \
  | gzip > "$TODAY_DIR/goclaw-postgres.sql.gz" 2>/dev/null; then
  echo "[$(date)] PostgreSQL backup OK: $(du -sh "$TODAY_DIR/goclaw-postgres.sql.gz" | cut -f1)"
else
  ERRORS+="PostgreSQL backup failed. "
fi

# Rotate: delete backups older than 7 days
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -type d | wc -l)

# Notify
if [ -n "$ERRORS" ]; then
  send_telegram "❌ Backup $DATE FAILED: $ERRORS"
  echo "[$(date)] FAILED: $ERRORS"
  exit 1
else
  SIZES=$(du -sh "$TODAY_DIR"/* 2>/dev/null | awk '{printf "%s %s, ", $1, $2}')
  send_telegram "✅ Backup $DATE OK ($BACKUP_COUNT backups kept): $SIZES"
  echo "[$(date)] SUCCESS"
fi
