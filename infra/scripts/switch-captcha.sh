#!/usr/bin/env bash
# Swap the frontend between the Cloudflare Turnstile TEST pair (always passes)
# and the real production pair. The site key is compiled into the bundle, so
# switching swaps the prebuilt image tag; the secret half lives in .env.
#
#   ./scripts/switch-captcha.sh test    # test site key  + test secret
#   ./scripts/switch-captcha.sh real    # real site key  + your real secret
set -euo pipefail
INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"; cd "$INFRA_DIR"
REAL_SITE_KEY="${REAL_SITE_KEY:-0x4AAAAAADVVXAV9IObkcwD2}"
TEST_SITE_KEY=1x00000000000000000000AA
TEST_SECRET=1x0000000000000000000000000000000AA
COMPOSE="docker compose -f docker-compose.home.yml --env-file .env"

case "${1:-}" in
  test)
    docker image inspect docloq-frontend:testcaptcha >/dev/null 2>&1 \
      || { echo "building test-captcha frontend"; docker build -t docloq-frontend:testcaptcha \
           --build-arg VITE_API_URL=https://api.docloq.site/api \
           --build-arg VITE_ONLYOFFICE_URL=https://office.docloq.site \
           --build-arg "VITE_TURNSTILE_SITE_KEY=$TEST_SITE_KEY" ../frontend; }
    docker tag docloq-frontend:testcaptcha docloq-frontend:latest
    sed -i "s|^TURNSTILE_SECRET_KEY=.*|TURNSTILE_SECRET_KEY=$TEST_SECRET|" .env
    echo "switched to TEST captcha (always passes — not for real use)"
    ;;
  real)
    secret=$(grep '^TURNSTILE_SECRET_KEY=' .env | cut -d= -f2-)
    if [ -z "$secret" ] || [ "$secret" = "$TEST_SECRET" ]; then
      echo "ERROR: put the real secret in .env first:" >&2
      echo "  TURNSTILE_SECRET_KEY=<Cloudflare dashboard -> Turnstile -> docloq.site -> Secret Key>" >&2
      exit 1
    fi
    docker image inspect docloq-frontend:realcaptcha >/dev/null 2>&1 \
      || { echo "building real-captcha frontend"; docker build -t docloq-frontend:realcaptcha \
           --build-arg VITE_API_URL=https://api.docloq.site/api \
           --build-arg VITE_ONLYOFFICE_URL=https://office.docloq.site \
           --build-arg "VITE_TURNSTILE_SITE_KEY=$REAL_SITE_KEY" ../frontend; }
    docker tag docloq-frontend:realcaptcha docloq-frontend:latest
    echo "switched to REAL captcha (site key $REAL_SITE_KEY)"
    ;;
  *) echo "usage: $0 {test|real}" >&2; exit 1 ;;
esac
$COMPOSE up -d --force-recreate frontend backend
