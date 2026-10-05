#!/usr/bin/env bash
# ============================================================================
# DocLoq — home server deploy (build images, start stack, verify)
# ============================================================================
#   ./scripts/deploy-home.sh              start/update everything
#   ./scripts/deploy-home.sh --build      rebuild both images first
#   ./scripts/deploy-home.sh --build-be   rebuild backend only
#   ./scripts/deploy-home.sh --build-fe   rebuild frontend only
#   ./scripts/deploy-home.sh --no-tunnel  skip the cloudflared container
# ============================================================================
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$INFRA_DIR/.." && pwd)"
cd "$INFRA_DIR"
COMPOSE="docker compose -f docker-compose.home.yml --env-file .env"

GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; RED=$'\033[0;31m'; NC=$'\033[0m'
log(){ echo "${GRN}[deploy]${NC} $*"; }
warn(){ echo "${YEL}[deploy]${NC} $*"; }
die(){ echo "${RED}[deploy] $*${NC}" >&2; exit 1; }

[ -f .env ] || die ".env not found in $INFRA_DIR"
# shellcheck disable=SC1091
set -a; . ./.env; set +a

# --- generated-once local config -------------------------------------------
if [ ! -f searxng/settings.yml ]; then
  log "generating searxng/settings.yml with a fresh instance secret"
  sed "s|__SEARXNG_SECRET__|$(openssl rand -hex 32)|" \
      searxng/settings.yml.template > searxng/settings.yml
fi

BUILD_BE=0; BUILD_FE=0; TUNNEL=1
for arg in "$@"; do case "$arg" in
  --build)     BUILD_BE=1; BUILD_FE=1 ;;
  --build-be)  BUILD_BE=1 ;;
  --build-fe)  BUILD_FE=1 ;;
  --no-tunnel) TUNNEL=0 ;;
  *) die "unknown flag: $arg" ;;
esac; done

# --- images ----------------------------------------------------------------
if [ "$BUILD_BE" = 1 ]; then
  log "building docloq-backend:latest"
  docker build -t docloq-backend:latest "$REPO_DIR/backend"
fi
if [ "$BUILD_FE" = 1 ]; then
  # VITE_* are baked into the bundle at build time, so the public URLs and the
  # Turnstile SITE key must be passed here — changing them needs a rebuild.
  SITE_KEY="${VITE_TURNSTILE_SITE_KEY:-1x00000000000000000000AA}"
  log "building docloq-frontend:latest (turnstile site key ${SITE_KEY})"
  docker build -t docloq-frontend:latest \
    --build-arg "VITE_API_URL=https://${DOMAIN_API}/api" \
    --build-arg "VITE_ONLYOFFICE_URL=https://${DOMAIN_OFFICE}" \
    --build-arg "VITE_TURNSTILE_SITE_KEY=${SITE_KEY}" \
    "$REPO_DIR/frontend"
fi

# --- which tunnel profile? -------------------------------------------------
PROFILE=()
if [ "$TUNNEL" = 1 ]; then
  if [ -f cloudflared/config.yml ]; then
    PROFILE=(--profile tunnel-file)
    log "ingress: locally-managed tunnel (cloudflared/config.yml)"
  elif [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
    PROFILE=(--profile tunnel-token)
    log "ingress: dashboard-managed tunnel (CLOUDFLARE_TUNNEL_TOKEN)"
  else
    warn "no tunnel configured — starting without ingress."
    warn "  run scripts/cf-tunnel-setup.sh (API token) or set CLOUDFLARE_TUNNEL_TOKEN"
  fi
fi

# --- up --------------------------------------------------------------------
log "starting stack"
$COMPOSE "${PROFILE[@]}" up -d --remove-orphans

# --- wait for the API ------------------------------------------------------
log "waiting for backend to answer (migrations run on boot)..."
for i in $(seq 1 60); do
  if $COMPOSE exec -T backend curl -fsS http://localhost:3000/ >/dev/null 2>&1; then
    log "backend healthy after ${i}0s"; break
  fi
  [ "$i" = 60 ] && { warn "backend did not come up in 10min — logs:"; $COMPOSE logs --tail=40 backend; exit 1; }
  sleep 10
done

echo
$COMPOSE "${PROFILE[@]}" ps
echo
log "internal reachability:"
for t in "frontend http://frontend/health" "backend http://backend:3000/" "onlyoffice http://onlyoffice/healthcheck" "docuseal http://docuseal:3000/" "searxng http://searxng:8080/"; do
  name="${t%% *}"; url="${t#* }"
  code=$($COMPOSE exec -T backend curl -s -o /dev/null -w '%{http_code}' -m 10 "$url" 2>/dev/null || echo "---")
  printf '  %-12s %-34s %s\n' "$name" "$url" "$code"
done
echo
log "done"
