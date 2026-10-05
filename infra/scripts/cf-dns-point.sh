#!/usr/bin/env bash
# ============================================================================
# DocLoq — repoint the four hostnames at an EXISTING Cloudflare Tunnel
# ============================================================================
# Use this when the tunnel already exists (e.g. created in the Zero Trust
# dashboard and its credentials derived from the tunnel token) and all that is
# left is to move DNS off the old origin. Unlike cf-tunnel-setup.sh this never
# creates or modifies a tunnel — it only touches DNS records.
#
# Requires in ../.env:
#   CLOUDFLARE_API_TOKEN   Zone -> DNS -> Edit  on the zone (that is all)
#   CLOUDFLARE_ZONE        default docloq.site
# Tunnel ID is read from cloudflared/config.yml, or from
# CLOUDFLARE_TUNNEL_TOKEN, or passed as $1.
#
#   ./scripts/cf-dns-point.sh                 # auto-detect tunnel id
#   ./scripts/cf-dns-point.sh <tunnel-uuid>   # explicit
#   DRY_RUN=1 ./scripts/cf-dns-point.sh       # show what would change
# ============================================================================
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$INFRA_DIR"
# shellcheck disable=SC1091
set -a; . ./.env; set +a

API=https://api.cloudflare.com/client/v4
RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; NC=$'\033[0m'
log(){  echo "${GRN}[cf-dns]${NC} $*"; }
warn(){ echo "${YEL}[cf-dns]${NC} $*"; }
die(){  echo "${RED}[cf-dns] $*${NC}" >&2; exit 1; }

command -v jq >/dev/null || die "jq is required (apt-get install -y jq)"
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || die "CLOUDFLARE_API_TOKEN is empty in .env.
     Create one at dash.cloudflare.com/profile/api-tokens with
     Zone -> DNS -> Edit on ${CLOUDFLARE_ZONE:-docloq.site}, then:
       ./scripts/set-secrets.sh CLOUDFLARE_API_TOKEN"

# --- tunnel id -------------------------------------------------------------
TUNNEL_ID="${1:-}"
if [ -z "$TUNNEL_ID" ] && [ -f cloudflared/config.yml ]; then
  TUNNEL_ID=$(awk '/^tunnel:/{print $2; exit}' cloudflared/config.yml)
fi
if [ -z "$TUNNEL_ID" ] && [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  TUNNEL_ID=$(printf '%s' "$CLOUDFLARE_TUNNEL_TOKEN" \
    | tr -d '\n' | sed -e 's/-/+/g' -e 's/_/\//g' \
    | awk '{n=length($0)%4; if(n)printf "%s%s", $0, substr("===",1,4-n); else print $0}' \
    | base64 -d 2>/dev/null | jq -r '.t // empty')
fi
[ -n "$TUNNEL_ID" ] || die "could not determine the tunnel id — pass it as \$1"
case "$TUNNEL_ID" in
  [0-9a-f]*-[0-9a-f]*-[0-9a-f]*-[0-9a-f]*-[0-9a-f]*) ;;
  *) die "'$TUNNEL_ID' does not look like a tunnel UUID" ;;
esac
TARGET="$TUNNEL_ID.cfargotunnel.com"
log "tunnel $TUNNEL_ID"

cf(){
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$API$path" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" --data "$body"
  else
    curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  fi
}
ok(){ jq -e '.success == true' >/dev/null 2>&1; }

resp=$(cf GET /user/tokens/verify)
echo "$resp" | ok || die "token verify failed: $(echo "$resp" | jq -c '.errors')"
log "API token valid"

ZONE="${CLOUDFLARE_ZONE:-docloq.site}"
ZONE_ID=$(cf GET "/zones?name=$ZONE" | jq -r '.result[0].id // empty')
[ -n "$ZONE_ID" ] || die "zone $ZONE not found, or the token lacks Zone:DNS:Edit on it"
log "zone $ZONE -> $ZONE_ID"

# --- repoint ---------------------------------------------------------------
changed=0
for host in "$DOMAIN_APP" "$DOMAIN_API" "$DOMAIN_OFFICE" "$DOMAIN_SIGN" ${DOMAIN_PORTAINER:+"$DOMAIN_PORTAINER"} ${DOMAIN_DB:+"$DOMAIN_DB"}; do
  recs=$(cf GET "/zones/$ZONE_ID/dns_records?name=$host")
  echo "$recs" | ok || die "could not list DNS for $host: $(echo "$recs" | jq -c '.errors')"

  # A/AAAA/CNAME all occupy the same name — drop every extra one, keep the first
  mapfile -t ids   < <(echo "$recs" | jq -r '.result[] | select(.type=="A" or .type=="AAAA" or .type=="CNAME") | .id')
  mapfile -t descr < <(echo "$recs" | jq -r '.result[] | select(.type=="A" or .type=="AAAA" or .type=="CNAME") | "\(.type) \(.content)"')

  body=$(jq -nc --arg n "$host" --arg c "$TARGET" \
         '{type:"CNAME", name:$n, content:$c, proxied:true, ttl:1}')

  if [ "${#ids[@]}" -eq 0 ]; then
    if [ -n "${DRY_RUN:-}" ]; then log "DRY $host: would CREATE CNAME -> $TARGET"; continue; fi
    resp=$(cf POST "/zones/$ZONE_ID/dns_records" "$body")
    echo "$resp" | ok && { log "$host: created CNAME -> $TARGET"; changed=$((changed+1)); } \
      || die "create failed for $host: $(echo "$resp" | jq -c '.errors')"
    continue
  fi

  if [ "${descr[0]}" = "CNAME $TARGET" ] && [ "${#ids[@]}" -eq 1 ]; then
    log "$host: already CNAME -> $TARGET (unchanged)"
    continue
  fi

  if [ -n "${DRY_RUN:-}" ]; then
    log "DRY $host: would REPLACE '${descr[0]}' with CNAME -> $TARGET"
    for i in $(seq 1 $(( ${#ids[@]} - 1 )) ); do
      [ "$i" -lt "${#ids[@]}" ] && log "DRY $host: would DELETE duplicate '${descr[$i]}'"
    done
    continue
  fi

  resp=$(cf PUT "/zones/$ZONE_ID/dns_records/${ids[0]}" "$body")
  echo "$resp" | ok && { log "$host: '${descr[0]}' -> CNAME $TARGET"; changed=$((changed+1)); } \
    || die "update failed for $host: $(echo "$resp" | jq -c '.errors')"

  # remove leftovers so the edge cannot still resolve to the dead origin
  for i in $(seq 1 $(( ${#ids[@]} - 1 )) ); do
    [ "$i" -ge "${#ids[@]}" ] && break
    resp=$(cf DELETE "/zones/$ZONE_ID/dns_records/${ids[$i]}")
    echo "$resp" | ok && warn "$host: deleted duplicate '${descr[$i]}'" \
      || warn "$host: could not delete duplicate '${descr[$i]}'"
  done
done

echo
log "$changed record(s) changed. Verify from outside (allow ~30s for propagation):"
echo "    for h in $DOMAIN_APP $DOMAIN_API $DOMAIN_OFFICE $DOMAIN_SIGN; do"
echo "      curl -sS -o /dev/null -w \"\$h %{http_code}\\n\" \"https://\$h/\"; done"
