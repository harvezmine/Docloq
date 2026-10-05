#!/usr/bin/env bash
# ============================================================================
# DocLoq — initialise Vault Transit and switch KEY_PROVIDER to vault
# ============================================================================
# The deploy ships with KEY_PROVIDER=local because a home server reboots and a
# sealed Vault means documents cannot be decrypted until someone unseals it by
# hand. Run this only if you accept that operational cost.
#
# Safe to run on a live system: decryptDocumentKey() dispatches on the
# ciphertext prefix ("vault:v1:..." vs raw base64), so documents already
# wrapped with the local master key keep decrypting after the switch.
#
#   ./scripts/vault-init-home.sh init      first time: init + unseal + transit
#   ./scripts/vault-init-home.sh unseal    after a reboot
#   ./scripts/vault-init-home.sh status
# ============================================================================
set -euo pipefail
INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"; cd "$INFRA_DIR"
COMPOSE="docker compose -f docker-compose.home.yml --env-file .env"
KEYFILE="$INFRA_DIR/vault-unseal-keys.txt"
GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; NC=$'\033[0m'
log(){ echo "${GRN}[vault]${NC} $*"; }
warn(){ echo "${YEL}[vault]${NC} $*"; }
v(){ $COMPOSE exec -T -e VAULT_ADDR=http://127.0.0.1:8200 vault vault "$@"; }

case "${1:-status}" in
  init)
    [ -f "$KEYFILE" ] && { echo "$KEYFILE already exists — refusing to re-init (that would orphan the existing Vault data)"; exit 1; }
    log "initialising (3 key shares, threshold 2)"
    v operator init -key-shares=3 -key-threshold=2 > "$KEYFILE"
    chmod 600 "$KEYFILE"
    warn "unseal keys + root token written to $KEYFILE"
    warn "COPY IT OFF THIS MACHINE. Losing it means losing every document key."
    k1=$(grep 'Unseal Key 1:' "$KEYFILE" | awk '{print $NF}')
    k2=$(grep 'Unseal Key 2:' "$KEYFILE" | awk '{print $NF}')
    root=$(grep 'Initial Root Token:' "$KEYFILE" | awk '{print $NF}')
    v operator unseal "$k1" >/dev/null
    v operator unseal "$k2" >/dev/null
    log "unsealed"
    $COMPOSE exec -T -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN="$root" vault vault secrets enable transit || true
    $COMPOSE exec -T -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN="$root" vault vault write -f transit/keys/docloq-master
    log "transit engine + key docloq-master ready"
    sed -i "s|^KEY_PROVIDER=.*|KEY_PROVIDER=vault|" .env
    sed -i "s|^VAULT_TOKEN=.*|VAULT_TOKEN=$root|" .env
    log "KEY_PROVIDER=vault and VAULT_TOKEN written to .env"
    $COMPOSE up -d --force-recreate backend
    log "backend restarted. New uploads wrap their DEK with Vault Transit."
    ;;
  unseal)
    [ -f "$KEYFILE" ] || { echo "$KEYFILE not found — cannot unseal"; exit 1; }
    k1=$(grep 'Unseal Key 1:' "$KEYFILE" | awk '{print $NF}')
    k2=$(grep 'Unseal Key 2:' "$KEYFILE" | awk '{print $NF}')
    v operator unseal "$k1" >/dev/null && v operator unseal "$k2" >/dev/null
    log "unsealed"; v status || true
    ;;
  status) v status || true ;;
  *) echo "usage: $0 {init|unseal|status}" >&2; exit 1 ;;
esac
