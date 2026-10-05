
# Cron: 0 3 * * * /opt/docloq/scripts/backup.sh >> /opt/docloq/backups/backup.log 2>&1

# Backs up:
#   - PostgreSQL (application database)
#   - PostgreSQL (Gitea database)
#   - Vault Raft snapshot
#   - MongoDB (AI cache)


set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/docloq/backups}"
DATE=$(date +%Y%m%d_%H%M)
STACK_NAME="docloq"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }


# PostgreSQL — Application Database
log "Backing up PostgreSQL (app)..."
APP_DB_CONTAINER=$(docker ps -q -f name="${STACK_NAME}_db" | head -1)
if [ -n "$APP_DB_CONTAINER" ]; then
  docker exec "$APP_DB_CONTAINER" pg_dump -U docloq docloq_db | gzip > "$BACKUP_DIR/pg_app_$DATE.sql.gz"
  log "  -> pg_app_$DATE.sql.gz ($(du -h "$BACKUP_DIR/pg_app_$DATE.sql.gz" | cut -f1))"
else
  log "  [SKIP] App DB container not found"
fi

# PostgreSQL — Gitea Database
log "Backing up PostgreSQL (Gitea)..."
GITEA_DB_CONTAINER=$(docker ps -q -f name="${STACK_NAME}_gitea-db" | head -1)
if [ -n "$GITEA_DB_CONTAINER" ]; then
  docker exec "$GITEA_DB_CONTAINER" pg_dump -U gitea gitea | gzip > "$BACKUP_DIR/pg_gitea_$DATE.sql.gz"
  log "  -> pg_gitea_$DATE.sql.gz ($(du -h "$BACKUP_DIR/pg_gitea_$DATE.sql.gz" | cut -f1))"
else
  log "  [SKIP] Gitea DB container not found"
fi


# Vault Raft Snapshot
log "Backing up Vault (Raft snapshot)..."
VAULT_CONTAINER=$(docker ps -q -f name="${STACK_NAME}_vault-1" | head -1)
if [ -n "$VAULT_CONTAINER" ]; then
  docker exec "$VAULT_CONTAINER" vault operator raft snapshot save /vault/data/backup.snap 2>/dev/null || true
  docker cp "$VAULT_CONTAINER:/vault/data/backup.snap" "$BACKUP_DIR/vault_$DATE.snap" 2>/dev/null || log "  [SKIP] Vault snapshot failed (sealed or not initialized)"
  if [ -f "$BACKUP_DIR/vault_$DATE.snap" ]; then
    log "  -> vault_$DATE.snap ($(du -h "$BACKUP_DIR/vault_$DATE.snap" | cut -f1))"
  fi
else
  log "  [SKIP] Vault container not found"
fi


# MongoDB — AI Cache 
log "Backing up MongoDB (AI cache)..."
MONGO_CONTAINER=$(docker ps -q -f name="${STACK_NAME}_mongodb" | head -1)
if [ -n "$MONGO_CONTAINER" ]; then
  docker exec "$MONGO_CONTAINER" mongodump --archive --gzip -u docloq --authenticationDatabase admin 2>/dev/null > "$BACKUP_DIR/mongo_$DATE.archive.gz" || log "  [SKIP] MongoDB dump failed"
  if [ -s "$BACKUP_DIR/mongo_$DATE.archive.gz" ]; then
    log "  -> mongo_$DATE.archive.gz ($(du -h "$BACKUP_DIR/mongo_$DATE.archive.gz" | cut -f1))"
  else
    rm -f "$BACKUP_DIR/mongo_$DATE.archive.gz"
  fi
else
  log "  [SKIP] MongoDB container not found"
fi


# Cleanup old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
DELETED=$(find "$BACKUP_DIR" -name "*.gz" -o -name "*.snap" | xargs -I{} find {} -mtime +$RETENTION_DAYS -delete -print 2>/dev/null | wc -l)
log "  Deleted $DELETED old backup files"


TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log "Backup complete. Total backup dir size: $TOTAL_SIZE"
