#!/usr/bin/env bash
# ============================================================================
# DocLoq — backup everything that cannot be rebuilt from the repo
# ============================================================================
# Writes one timestamped tar.gz to BACKUP_DEST (default /var/backups/docloq).
#
# Cron it:  0 3 * * * /home/Docloq-new/infra/scripts/backup-home.sh >> /var/log/docloq-backup.log 2>&1
#
# What is in here is exactly what was lost with the old VPS. Copy it OFF this
# machine — a backup that only exists on the server being backed up is not one.
# ============================================================================
set -euo pipefail
INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"; cd "$INFRA_DIR"
COMPOSE="docker compose -f docker-compose.home.yml --env-file .env"
set -a; . ./.env; set +a

DEST="${BACKUP_DEST:-/var/backups/docloq}"
STAMP=$(date +%Y%m%d-%H%M%S)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$DEST"

echo "[backup] postgres dump"
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip > "$WORK/postgres-$POSTGRES_DB.sql.gz"

echo "[backup] mongo dump (AI cache)"
$COMPOSE exec -T mongodb sh -c \
  "mongodump --quiet --archive --username=docloq --password='$MONGO_PASSWORD' --authenticationDatabase=admin --db=docloq_ai_cache" \
  | gzip > "$WORK/mongo-ai-cache.archive.gz" || echo "[backup] mongo dump skipped"

echo "[backup] secrets + tunnel credentials + vault keys"
cp .env "$WORK/env"
[ -d cloudflared ] && tar czf "$WORK/cloudflared.tar.gz" cloudflared 2>/dev/null || true
[ -f vault-unseal-keys.txt ] && cp vault-unseal-keys.txt "$WORK/" || true

echo "[backup] volumes: documents, qdrant, vault, docuseal"
for vol in docloq_backend_storage docloq_qdrant_data docloq_vault_data docloq_docuseal_data; do
  docker volume inspect "$vol" >/dev/null 2>&1 || continue
  docker run --rm -v "$vol":/src:ro -v "$WORK":/out alpine:3 \
    tar czf "/out/$vol.tar.gz" -C /src . 2>/dev/null || echo "[backup] $vol skipped"
done

OUT="$DEST/docloq-$STAMP.tar.gz"
tar czf "$OUT" -C "$WORK" .
chmod 600 "$OUT"
echo "[backup] wrote $OUT ($(du -h "$OUT" | cut -f1))"

# keep 14 most recent
ls -1t "$DEST"/docloq-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "[backup] retained: $(ls -1 "$DEST"/docloq-*.tar.gz 2>/dev/null | wc -l) archive(s)"
