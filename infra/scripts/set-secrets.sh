#!/usr/bin/env bash
# Interactively set the remaining .env secrets without echoing them.
# Usage: ./scripts/set-secrets.sh            (prompts for all empty ones)
#        ./scripts/set-secrets.sh SMTP_PASS  (prompts for just these keys)
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=./.env
[ -f "$ENV_FILE" ] || { echo "no .env here" >&2; exit 1; }

KEYS=("$@")
if [ ${#KEYS[@]} -eq 0 ]; then
  KEYS=(CLOUDFLARE_API_TOKEN SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM)
fi

set_key(){
  local k="$1" v="$2"
  # escape | & \ for sed replacement safety
  local esc=${v//\\/\\\\}; esc=${esc//|/\\|}; esc=${esc//&/\\&}
  if grep -q "^$k=" "$ENV_FILE"; then
    sed -i "s|^$k=.*|$k=$esc|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$k" "$v" >> "$ENV_FILE"
  fi
}

for k in "${KEYS[@]}"; do
  cur=$(grep -oP "(?<=^$k=).*" "$ENV_FILE" || true)
  if [ -n "$cur" ] && [ ${#KEYS[@]} -gt 6 ]; then continue; fi
  if [ -n "$cur" ]; then
    printf '%s is already set (%d chars). New value (blank = keep): ' "$k" "${#cur}"
  else
    printf '%s: ' "$k"
  fi
  # secrets hidden, non-secrets echoed so you can see typos
  case "$k" in
    *TOKEN|*PASS|*KEY|*SECRET) read -rs v; echo ;;
    *) read -r v ;;
  esac
  [ -n "$v" ] && set_key "$k" "$v" && echo "  -> $k set (${#v} chars)"
done

chmod 600 "$ENV_FILE"
echo
echo "Done. Current state:"
for k in CLOUDFLARE_API_TOKEN SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM; do
  v=$(grep -oP "(?<=^$k=).*" "$ENV_FILE" || true)
  case "$k" in
    *PASS|*TOKEN) [ -n "$v" ] && printf '  %-22s SET (%d chars)\n' "$k" "${#v}" || printf '  %-22s EMPTY\n' "$k";;
    *) printf '  %-22s %s\n' "$k" "${v:-EMPTY}";;
  esac
done
