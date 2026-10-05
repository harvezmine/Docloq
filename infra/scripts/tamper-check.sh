#!/bin/bash
set -uo pipefail
ALERT_TO=rafaeljosh18@gmail.com
OPS_DIR=/opt/docloq/infra/ops
docker exec infra-backend-1 mkdir -p /app/ops 2>/dev/null || true
docker cp "$OPS_DIR/mail-template.mjs" infra-backend-1:/app/ops/mail-template.mjs >/dev/null 2>&1 || true
docker cp "$OPS_DIR/tamper-check.mjs" infra-backend-1:/app/ops/tamper-check.mjs >/dev/null 2>&1 || { echo "cp failed"; exit 0; }
docker exec -e ALERT_TO="$ALERT_TO" -w /app infra-backend-1 node /app/ops/tamper-check.mjs