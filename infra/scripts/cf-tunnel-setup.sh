#!/usr/bin/env bash
# ============================================================================
# DocLoq — create/refresh the Cloudflare Tunnel and point DNS at it
# ============================================================================
# Idempotent: re-running reuses an existing tunnel of the same name and
# updates the four DNS records in place.
#
# Requires in ../.env:
#   CLOUDFLARE_API_TOKEN   Account -> Cloudflare Tunnel -> Edit
#                          Zone    -> DNS -> Edit  (zone docloq.site)
#   CLOUDFLARE_ACCOUNT_ID  (auto-detected if the token can list accounts)
# ============================================================================
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$INFRA_DIR"
# shellcheck disable=SC1091
set -a; . ./.env; set +a

TUNNEL_NAME="${TUNNEL_NAME:-docloq-home}"
API=https://api.cloudflare.com/client/v4
RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; NC=$'\033[0m'
log(){ echo "${GRN}[cf-tunnel]${NC} $*"; }
warn(){ echo "${YEL}[cf-tunnel]${NC} $*"; }
die(){ echo "${RED}[cf-tunnel] $*${NC}" >&2; exit 1; }

command -v jq >/dev/null || die "jq is required (apt-get install -y jq)"
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || die "CLOUDFLARE_API_TOKEN is empty in .env"

cf(){ # cf METHOD PATH [JSON_BODY]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$API$path" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" --data "$body"
  else
    curl -sS -X "$method" "$API$path" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  fi
}
ok(){ jq -e '.success == true' >/dev/null 2>&1; }

# --- 1. token sanity -------------------------------------------------------
resp=$(cf GET /user/tokens/verify)
echo "$resp" | ok || die "token verify failed: $(echo "$resp" | jq -c '.errors')"
log "API token valid"

# --- 2. account ------------------------------------------------------------
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
if [ -z "$ACCOUNT_ID" ]; then
  ACCOUNT_ID=$(cf GET /accounts | jq -r '.result[0].id // empty')
  [ -n "$ACCOUNT_ID" ] || die "could not detect account id — set CLOUDFLARE_ACCOUNT_ID in .env"
fi
log "account $ACCOUNT_ID"

# --- 3. zone ---------------------------------------------------------------
ZONE="${CLOUDFLARE_ZONE:-docloq.site}"
ZONE_ID=$(cf GET "/zones?name=$ZONE" | jq -r '.result[0].id // empty')
[ -n "$ZONE_ID" ] || die "zone $ZONE not found, or the token lacks Zone:DNS:Edit on it"
log "zone $ZONE -> $ZONE_ID"

# --- 4. tunnel (reuse by name, else create) --------------------------------
TUNNEL_ID=$(cf GET "/accounts/$ACCOUNT_ID/cfd_tunnel?name=$TUNNEL_NAME&is_deleted=false" \
            | jq -r '.result[0].id // empty')

if [ -n "$TUNNEL_ID" ]; then
  log "reusing tunnel '$TUNNEL_NAME' ($TUNNEL_ID)"
  if [ ! -f "cloudflared/$TUNNEL_ID.json" ]; then
    die "tunnel '$TUNNEL_NAME' exists but cloudflared/$TUNNEL_ID.json is missing.
     The tunnel secret cannot be read back from the API. Either restore that
     file, or delete the tunnel in the Zero Trust dashboard and re-run:
       Networks -> Tunnels -> $TUNNEL_NAME -> Delete"
  fi
else
  log "creating tunnel '$TUNNEL_NAME'"
  SECRET=$(openssl rand -base64 32)
  resp=$(cf POST "/accounts/$ACCOUNT_ID/cfd_tunnel" \
    "$(jq -nc --arg n "$TUNNEL_NAME" --arg s "$SECRET" \
        '{name:$n, tunnel_secret:$s, config_src:"local"}')")
  echo "$resp" | ok || die "tunnel create failed: $(echo "$resp" | jq -c '.errors')"
  TUNNEL_ID=$(echo "$resp" | jq -r '.result.id')
  jq -nc --arg a "$ACCOUNT_ID" --arg t "$TUNNEL_ID" --arg s "$SECRET" \
     '{AccountTag:$a, TunnelID:$t, TunnelSecret:$s}' > "cloudflared/$TUNNEL_ID.json"
  chmod 600 "cloudflared/$TUNNEL_ID.json"
  log "tunnel created ($TUNNEL_ID), credentials -> cloudflared/$TUNNEL_ID.json"
  warn "BACK UP cloudflared/$TUNNEL_ID.json — Cloudflare will not show the secret again"
fi

# --- 5. ingress config -----------------------------------------------------
sed -e "s|__TUNNEL_ID__|$TUNNEL_ID|g" \
    -e "s|__DOMAIN_APP__|${DOMAIN_APP}|g" \
    -e "s|__DOMAIN_API__|${DOMAIN_API}|g" \
    -e "s|__DOMAIN_OFFICE__|${DOMAIN_OFFICE}|g" \
    -e "s|__DOMAIN_SIGN__|${DOMAIN_SIGN}|g" \
    cloudflared/config.yml.template > cloudflared/config.yml
log "wrote cloudflared/config.yml"

# --- 6. DNS: CNAME each hostname at the tunnel -----------------------------
TARGET="$TUNNEL_ID.cfargotunnel.com"
for host in "$DOMAIN_APP" "$DOMAIN_API" "$DOMAIN_OFFICE" "$DOMAIN_SIGN"; do
  existing=$(cf GET "/zones/$ZONE_ID/dns_records?name=$host")
  rec_id=$(echo "$existing" | jq -r '.result[0].id // empty')
  rec_type=$(echo "$existing" | jq -r '.result[0].type // empty')
  body=$(jq -nc --arg n "$host" --arg c "$TARGET" \
         '{type:"CNAME", name:$n, content:$c, proxied:true, ttl:1}')
  if [ -n "$rec_id" ]; then
    resp=$(cf PUT "/zones/$ZONE_ID/dns_records/$rec_id" "$body")
    echo "$resp" | ok && log "DNS $host: $rec_type -> CNAME $TARGET (replaced)" \
      || die "DNS update failed for $host: $(echo "$resp" | jq -c '.errors')"
  else
    resp=$(cf POST "/zones/$ZONE_ID/dns_records" "$body")
    echo "$resp" | ok && log "DNS $host: created CNAME $TARGET" \
      || die "DNS create failed for $host: $(echo "$resp" | jq -c '.errors')"
  fi
done

echo
log "done. Start the tunnel with:"
echo "    cd $INFRA_DIR && docker compose -f docker-compose.home.yml --profile tunnel-file up -d cloudflared"
