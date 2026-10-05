#!/bin/sh
# DocLoq Backend Entrypoint
# Loads Docker Swarm secrets as environment variables and optionally runs migrations.

# Load secrets from /run/secrets/ as env vars
# Each secret file name becomes the env var name (uppercased)
if [ -d /run/secrets ]; then
  for f in /run/secrets/*; do
    if [ -f "$f" ]; then
      varname=$(basename "$f" | tr '[:lower:]' '[:upper:]')
      export "$varname"="$(cat "$f")"
    fi
  done
fi

# Construct composite URLs from secret components (Docker Swarm secret files
# cannot be interpolated inside docker-stack.yml environment values, so we
# build them here after the secret vars are loaded above).
if [ -n "$DB_PASSWORD" ] && [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://docloq:${DB_PASSWORD}@db:5432/docloq_db"
fi

if [ -n "$MONGO_PASSWORD" ] && [ -z "$MONGO_URL" ]; then
  export MONGO_URL="mongodb://docloq:${MONGO_PASSWORD}@mongodb:27017/docloq_ai_cache?authSource=admin"
fi

# Run database migrations if this replica is the migration leader.
# migrate.js is transactional per file and exits non-zero on failure; abort the
# boot instead of serving on a half-migrated schema. With restart:unless-stopped
# the container then restart-loops visibly rather than silently running wrong.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[Entrypoint] Running database migrations..."
  if ! node src/scripts/migrate.js; then
    echo "[Entrypoint] Migrations FAILED — refusing to start the server." >&2
    exit 1
  fi
  echo "[Entrypoint] Migrations complete."
fi

exec "$@"
