#!/usr/bin/env bash
# ============================================================================
# DocLoq — one-command deploy
# ============================================================================
# Pulls the latest code, works out what actually changed, backs the database up
# BEFORE any migration runs, rebuilds only the images that need it, applies
# migrations with the NEW image while the OLD backend keeps serving, and only
# then swaps the stack over. Verifies health at the end.
#
#   ./deploy.sh                 pull + deploy whatever changed
#   ./deploy.sh --build         force-rebuild both images
#   ./deploy.sh --build-be      force-rebuild backend only
#   ./deploy.sh --build-fe      force-rebuild frontend only  (needed after a
#                               VITE_* / Turnstile change in .env — those are
#                               baked in at build time and git can't see them)
#   ./deploy.sh --no-pull       deploy the working tree as-is (skip git)
#   ./deploy.sh --no-backup     skip the pre-migration DB backup (discouraged)
#   ./deploy.sh --yes           don't prompt (for cron / CI)
#   ./deploy.sh --branch main   pull a specific branch (default: current)
#
# Design rules (this stack runs next to milo/portalio/supabase — do no harm):
#   * Only ever touches the `docloq` compose project.
#   * A build failure or a migration failure ABORTS before the running stack is
#     replaced, so a bad deploy leaves the previous working stack untouched.
#   * The DB is dumped before migrations run; migrate.js is transactional per
#     file, so a failed migration rolls itself back and the dump is the floor.
#   * Safe to re-run; every step is idempotent.
# ============================================================================
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$REPO_DIR/infra"
COMPOSE_FILE="$INFRA_DIR/docker-compose.home.yml"
ENV_FILE="$INFRA_DIR/.env"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
LOG_DIR="/var/log"
LOG_FILE="$LOG_DIR/docloq-deploy.log"

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; BLU=$'\033[0;34m'; NC=$'\033[0m'
ts(){ date '+%Y-%m-%d %H:%M:%S'; }
log(){  echo "${GRN}[deploy $(ts)]${NC} $*"; }
info(){ echo "${BLU}[deploy $(ts)]${NC} $*"; }
warn(){ echo "${YEL}[deploy $(ts)]${NC} $*"; }
die(){  echo "${RED}[deploy $(ts)] FATAL: $*${NC}" >&2; exit 1; }
trap 'die "aborted on line $LINENO (see output above). The previous stack was left running."' ERR

# --- flags -----------------------------------------------------------------
DO_PULL=1; DO_BACKUP=1; ASSUME_YES=0
FORCE_BE=0; FORCE_FE=0; BRANCH=""
for arg in "$@"; do case "$arg" in
  --no-pull)    DO_PULL=0 ;;
  --no-backup)  DO_BACKUP=0 ;;
  --yes|-y)     ASSUME_YES=1 ;;
  --build)      FORCE_BE=1; FORCE_FE=1 ;;
  --build-be)   FORCE_BE=1 ;;
  --build-fe)   FORCE_FE=1 ;;
  --branch=*)   BRANCH="${arg#*=}" ;;
  --branch)     die "use --branch=<name>" ;;
  -h|--help)    sed -n '2,36p' "$0"; exit 0 ;;
  *) die "unknown flag: $arg" ;;
esac; done

# mirror everything to a log without hiding it from the terminal
mkdir -p "$LOG_DIR" 2>/dev/null || true
if : >>"$LOG_FILE" 2>/dev/null; then exec > >(tee -a "$LOG_FILE") 2>&1; fi
echo; log "==================== DocLoq deploy start ===================="

# --- preflight -------------------------------------------------------------
command -v docker >/dev/null || die "docker not found"
docker info >/dev/null 2>&1 || die "docker daemon not reachable (are you root / in the docker group?)"
[ -f "$COMPOSE_FILE" ] || die "compose file missing: $COMPOSE_FILE"
[ -f "$ENV_FILE" ]     || die ".env missing: $ENV_FILE — copy infra/.env.home.example and fill it in"
$COMPOSE config >/dev/null 2>&1 || die "compose file / .env did not validate — run: $COMPOSE config"

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
PG_USER="${POSTGRES_USER:-docloq}"; PG_DB="${POSTGRES_DB:-docloq_db}"

running(){ [ -n "$($COMPOSE ps -q "$1" 2>/dev/null)" ] && \
           [ "$(docker inspect -f '{{.State.Running}}' "$($COMPOSE ps -q "$1")" 2>/dev/null)" = "true" ]; }

# --- 1. git pull (fast-forward only) ---------------------------------------
BUILD_BE=$FORCE_BE; BUILD_FE=$FORCE_FE
if [ "$DO_PULL" = 1 ] && [ -d "$REPO_DIR/.git" ]; then
  cd "$REPO_DIR"
  [ -z "$BRANCH" ] && BRANCH="$(git rev-parse --abbrev-ref HEAD)"

  # Refuse to pull over local edits to TRACKED files — they'd be clobbered or
  # block the merge. (Untracked/gitignored files like .env are fine.)
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git status --short | grep -vE '^\?\?' || true
    die "tracked files have local changes. Commit/stash them, or run with --no-pull."
  fi

  OLD_REV="$(git rev-parse HEAD)"
  info "fetching origin/$BRANCH ..."
  git fetch --prune origin "$BRANCH" || die "git fetch failed (is a credential configured for the remote?)"
  if ! git merge-base --is-ancestor "$OLD_REV" "origin/$BRANCH"; then
    die "local and origin/$BRANCH have diverged — not fast-forwardable. Resolve by hand."
  fi
  git merge --ff-only "origin/$BRANCH" >/dev/null || die "fast-forward merge failed"
  NEW_REV="$(git rev-parse HEAD)"

  if [ "$OLD_REV" = "$NEW_REV" ]; then
    log "already up to date at ${NEW_REV:0:9}"
  else
    log "updated ${OLD_REV:0:9} -> ${NEW_REV:0:9}"
    CHANGED="$(git diff --name-only "$OLD_REV" "$NEW_REV")"
    echo "$CHANGED" | sed 's/^/    /'
    echo "$CHANGED" | grep -q '^backend/'  && BUILD_BE=1
    echo "$CHANGED" | grep -q '^frontend/' && BUILD_FE=1
  fi
elif [ "$DO_PULL" = 1 ]; then
  warn "not a git repo — skipping pull"
fi

# First-ever deploy (image missing) must build regardless of git diff.
docker image inspect docloq-backend:latest  >/dev/null 2>&1 || { warn "backend image absent — will build";  BUILD_BE=1; }
docker image inspect docloq-frontend:latest >/dev/null 2>&1 || { warn "frontend image absent — will build"; BUILD_FE=1; }

info "plan: build-backend=$BUILD_BE  build-frontend=$BUILD_FE"
if [ "$ASSUME_YES" != 1 ] && [ -t 0 ]; then
  read -r -p "$(echo -e "${YEL}Proceed with deploy? [y/N] ${NC}")" a; case "$a" in y|Y) ;; *) die "cancelled by user";; esac
fi

# --- 2. build images (failure aborts before anything is swapped) -----------
# Build to :latest only on success; the running containers keep their current
# image until we recreate them in step 5, so a failed build changes nothing.
if [ "$BUILD_BE" = 1 ]; then
  log "building docloq-backend:latest"
  docker build -t docloq-backend:latest "$REPO_DIR/backend" || die "backend build failed — stack untouched"
fi
if [ "$BUILD_FE" = 1 ]; then
  SITE_KEY="${VITE_TURNSTILE_SITE_KEY:-1x00000000000000000000AA}"
  log "building docloq-frontend:latest (turnstile ${SITE_KEY})"
  docker build -t docloq-frontend:latest \
    --build-arg "VITE_API_URL=https://${DOMAIN_API}/api" \
    --build-arg "VITE_ONLYOFFICE_URL=https://${DOMAIN_OFFICE}" \
    --build-arg "VITE_TURNSTILE_SITE_KEY=${SITE_KEY}" \
    "$REPO_DIR/frontend" || die "frontend build failed — stack untouched"
fi

# --- 3. make sure the datastores are up (needed for backup + migrate) ------
log "ensuring datastores are up"
$COMPOSE up -d postgres redis mongodb qdrant >/dev/null
# wait for postgres to accept connections
for i in $(seq 1 30); do
  $COMPOSE exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1 && break
  [ "$i" = 30 ] && die "postgres did not become ready"
  sleep 2
done

# --- 4. DB backup BEFORE migrations ----------------------------------------
if [ "$DO_BACKUP" = 1 ]; then
  if running postgres; then
    log "backing up the database before migrating"
    if [ -x "$INFRA_DIR/scripts/backup-home.sh" ]; then
      "$INFRA_DIR/scripts/backup-home.sh" || die "pre-deploy backup failed — refusing to migrate"
    else
      warn "backup-home.sh missing — taking a minimal pg_dump instead"
      mkdir -p /var/backups/docloq
      $COMPOSE exec -T postgres pg_dump -U "$PG_USER" -d "$PG_DB" --clean --if-exists \
        | gzip > "/var/backups/docloq/predeploy-$(date +%Y%m%d-%H%M%S).sql.gz" \
        || die "pg_dump failed — refusing to migrate"
    fi
  else
    warn "postgres not running yet (first deploy?) — nothing to back up"
  fi
else
  warn "--no-backup: skipping the pre-migration DB backup"
fi

# --- 5. migrate with the NEW image, old backend still serving --------------
# Run migrations in a throwaway container built from the freshly-built image.
# It joins the service's networks so it can reach postgres. If it exits non-zero
# the ERR trap aborts here — the running backend has NOT been replaced yet.
log "applying migrations (new image, one-off container)"
$COMPOSE run --rm --no-deps -e RUN_MIGRATIONS=false backend node src/scripts/migrate.js \
  || die "migration failed — DB rolled back to its pre-run state; the dump from step 4 is your floor. Running stack left as-is."

# --- 6. bring the whole stack to desired state -----------------------------
# Pick the tunnel profile the same way deploy-home.sh does.
PROFILE=()
if [ -f "$INFRA_DIR/cloudflared/config.yml" ]; then PROFILE=(--profile tunnel-file)
elif [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ];     then PROFILE=(--profile tunnel-token)
else warn "no tunnel configured — bringing the stack up without ingress"; fi

# generate the searxng secret once, like deploy-home.sh
if [ ! -f "$INFRA_DIR/searxng/settings.yml" ] && [ -f "$INFRA_DIR/searxng/settings.yml.template" ]; then
  log "generating searxng/settings.yml"
  sed "s|__SEARXNG_SECRET__|$(openssl rand -hex 32)|" \
    "$INFRA_DIR/searxng/settings.yml.template" > "$INFRA_DIR/searxng/settings.yml"
fi

log "converging the stack (docker compose up -d)"
$COMPOSE "${PROFILE[@]}" up -d --remove-orphans

# reload cloudflared file-config if it changed (file config isn't hot-reloaded)
if [ -f "$INFRA_DIR/cloudflared/config.yml" ] && running cloudflared; then
  $COMPOSE "${PROFILE[@]}" restart cloudflared >/dev/null 2>&1 || true
fi

# --- 7. wait for the backend, then verify ----------------------------------
log "waiting for the backend to answer"
ok=0
for i in $(seq 1 60); do
  if $COMPOSE exec -T backend curl -fsS http://localhost:3000/ >/dev/null 2>&1; then
    log "backend healthy after $((i*5))s"; ok=1; break
  fi
  sleep 5
done
if [ "$ok" != 1 ]; then
  warn "backend did not come up — last 60 log lines:"
  $COMPOSE logs --tail=60 backend || true
  die "backend unhealthy after deploy. DB dump from step 4 is available under /var/backups/docloq."
fi

# migration state sanity: applied count vs shipped files
APPLIED=$($COMPOSE exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -tAc \
          "select count(*) from _migrations" 2>/dev/null | tr -d '[:space:]' || echo "?")
FILES=$(ls "$REPO_DIR"/backend/drizzle/*.sql 2>/dev/null | wc -l | tr -d '[:space:]')
if [ "$APPLIED" = "$FILES" ]; then log "migrations: $APPLIED/$FILES applied"
else warn "migrations: $APPLIED applied vs $FILES shipped — review 'migrate' output above"; fi

# --- 8. health summary ------------------------------------------------------
echo; log "service status:"
$COMPOSE "${PROFILE[@]}" ps
echo; log "internal reachability:"
for t in "frontend http://frontend/health" "backend http://backend:3000/" \
         "onlyoffice http://onlyoffice/healthcheck" "docuseal http://docuseal:3000/" \
         "searxng http://searxng:8080/"; do
  name="${t%% *}"; url="${t#* }"
  code=$($COMPOSE exec -T backend curl -s -o /dev/null -w '%{http_code}' -m 10 "$url" 2>/dev/null || echo "---")
  printf '  %-12s %-34s %s\n' "$name" "$url" "$code"
done

# optional: external check through the tunnel (best-effort, never fails deploy)
if command -v curl >/dev/null && [ -n "${DOMAIN_API:-}" ]; then
  ext=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "https://${DOMAIN_API}/" 2>/dev/null || echo "---")
  info "external https://${DOMAIN_API}/ -> $ext"
fi

trap - ERR
echo; log "==================== deploy OK ===================="