#!/bin/bash
set -uo pipefail
BACKUP_DIR=/opt/docloq/backups
RETENTION_DAYS=14
CONTAINER=infra-postgres-1
DB=docloq_db
DBUSER=docloq
ALERT_TO=rafaeljosh18@gmail.com
OPS_DIR=/opt/docloq/infra/ops
DATE=$(date +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/pg_docloq_${DATE}.sql.gz"
mkdir -p "$BACKUP_DIR"
echo "[$(date "+%F %T")] backup start -> $OUT"
if ! docker exec "$CONTAINER" pg_dump -U "$DBUSER" -d "$DB" | gzip -9 > "$OUT"; then echo "[$(date "+%F %T")] ERROR pg_dump failed"; exit 1; fi
SIZE=$(du -h "$OUT" | cut -f1)
CNT=$(gzip -dc "$OUT" | grep -c "COPY public.audit_logs" || true)
if [ ! -s "$OUT" ] || [ "${CNT:-0}" -lt 1 ]; then echo "[$(date "+%F %T")] ERROR dump invalid (audit_logs=$CNT size=$SIZE)"; exit 1; fi
find "$BACKUP_DIR" -name "pg_docloq_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date "+%F %T")] backup OK ($SIZE) audit_logs=ok"
docker exec infra-backend-1 mkdir -p /app/ops 2>/dev/null || true
docker cp "$OPS_DIR/mail-template.mjs" infra-backend-1:/app/ops/mail-template.mjs >/dev/null 2>&1 || true
docker cp "$OPS_DIR/backup-mail.mjs" infra-backend-1:/app/ops/backup-mail.mjs >/dev/null 2>&1 || true
docker exec -e ALERT_TO="$ALERT_TO" -e BK_FILE="$(basename "$OUT")" -e BK_SIZE="$SIZE" -e BK_RETENTION="$RETENTION_DAYS" -e BK_HOST="$(hostname)" -w /app infra-backend-1 node /app/ops/backup-mail.mjs || echo "[$(date "+%F %T")] warn success-email failed"