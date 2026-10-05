#!/bin/bash
# ============================================================================
# DocLoq — Docker Swarm Deploy Script
# ============================================================================
# Usage: ./scripts/deploy.sh [--build] [--secrets]
#
# Options:
#   --build     Rebuild Docker images before deploying
#   --secrets   Create/update Docker secrets (first-time setup)
#   --init      Full first-time setup (secrets + configs + build + deploy)
# ============================================================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STACK_NAME="docloq"
STACK_FILE="$REPO_DIR/docker-stack.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[Deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[Warn]${NC} $1"; }
error() { echo -e "${RED}[Error]${NC} $1" >&2; }

# --------------------------------------------------------------------------
# Create Docker secrets from files in /opt/docloq/secrets/
# Each file name = secret name, file content = secret value
# --------------------------------------------------------------------------
create_secrets() {
  log "Creating Docker secrets..."
  SECRETS_DIR="${SECRETS_DIR:-/opt/docloq/secrets}"

  REQUIRED_SECRETS=(
    db_password jwt_secret encryption_master_key vault_token
    s3_access_key s3_secret_key openai_api_key cloudflare_tunnel_token
    mongo_password mail_password docuseal_api_key qr_signing_secret
    gitea_db_password
  )

  for secret in "${REQUIRED_SECRETS[@]}"; do
    if docker secret inspect "$secret" >/dev/null 2>&1; then
      warn "Secret '$secret' already exists — skipping (remove first to update)"
    elif [ -f "$SECRETS_DIR/$secret" ]; then
      docker secret create "$secret" "$SECRETS_DIR/$secret"
      log "Created secret: $secret"
    else
      error "Missing secret file: $SECRETS_DIR/$secret"
      echo "  Create it with: echo 'your-value' > $SECRETS_DIR/$secret"
    fi
  done

  log "Secrets done. You can now delete $SECRETS_DIR for security."
}

# --------------------------------------------------------------------------
# Create Docker configs (Vault HCL files)
# --------------------------------------------------------------------------
create_configs() {
  log "Creating Docker configs..."

  for i in 1 2 3; do
    config_name="vault_config_$i"
    config_file="$REPO_DIR/backend/vault/config/vault-$i.hcl"
    if docker config inspect "$config_name" >/dev/null 2>&1; then
      warn "Config '$config_name' already exists — skipping"
    elif [ -f "$config_file" ]; then
      docker config create "$config_name" "$config_file"
      log "Created config: $config_name"
    else
      error "Missing config file: $config_file"
    fi
  done
}

# --------------------------------------------------------------------------
# Build Docker images
# --------------------------------------------------------------------------
build_images() {
  log "Building backend image..."
  docker build -t docloq-backend:latest "$REPO_DIR/backend"

  log "Building frontend image..."
  docker build -t docloq-frontend:latest \
    --build-arg VITE_API_URL=https://api.docloq.site/api \
    --build-arg VITE_ONLYOFFICE_URL=https://office.docloq.site \
    --build-arg VITE_HCAPTCHA_ENABLED=false \
    "$REPO_DIR/frontend"

  log "Images built successfully."
}

# --------------------------------------------------------------------------
# Deploy / Update the Swarm stack
# --------------------------------------------------------------------------
deploy_stack() {
  log "Deploying stack '$STACK_NAME'..."
  docker stack deploy -c "$STACK_FILE" "$STACK_NAME"
  log "Stack deployed. Checking services..."
  sleep 5
  docker service ls --filter "label=com.docker.stack.namespace=$STACK_NAME"
}

# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

case "${1:-deploy}" in
  --init)
    log "=== Full initialization ==="
    create_secrets
    create_configs
    build_images
    deploy_stack
    log "=== Init complete! ==="
    echo ""
    echo "Next steps:"
    echo "  1. Initialize Vault: docker exec \$(docker ps -q -f name=${STACK_NAME}_vault-1) vault operator init"
    echo "  2. Unseal Vault (3 nodes, 2 keys each)"
    echo "  3. Enable Transit: vault secrets enable transit"
    echo "  4. Create key: vault write transit/keys/docloq-master type=aes256-gcm96"
    echo "  5. Configure Cloudflare Tunnel routes in Zero Trust dashboard"
    echo "  6. Set up backup cron: crontab -e → 0 3 * * * /opt/docloq/scripts/backup.sh"
    ;;
  --secrets)
    create_secrets
    create_configs
    ;;
  --build)
    build_images
    deploy_stack
    ;;
  deploy|"")
    deploy_stack
    ;;
  *)
    echo "Usage: $0 [--init | --build | --secrets | deploy]"
    exit 1
    ;;
esac
