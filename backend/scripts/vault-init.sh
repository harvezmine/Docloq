#!/bin/sh
# ============================================================
# Vault Initialization Script
# Run this after `docker compose up` to configure Vault Transit
# for document encryption key management.
#
# Usage: ./scripts/vault-init.sh
# ============================================================

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-docloq-dev-token}"

export VAULT_ADDR VAULT_TOKEN

echo "=== DocLoq Vault Initialization ==="
echo "Vault address: $VAULT_ADDR"

# Wait for Vault to be ready
echo "Waiting for Vault..."
until curl -sf "$VAULT_ADDR/v1/sys/health" > /dev/null 2>&1; do
  sleep 1
done
echo "Vault is ready."

# Enable Transit secrets engine (idempotent)
echo "Enabling Transit secrets engine..."
vault secrets enable transit 2>/dev/null || echo "Transit already enabled."

# Create the master encryption key for document envelope encryption
echo "Creating master Transit key (docloq-master)..."
vault write -f transit/keys/docloq-master \
  type=aes256-gcm96 \
  exportable=false \
  allow_plaintext_backup=false \
  2>/dev/null || echo "Key docloq-master already exists."

# Create a policy for the backend application
echo "Creating backend application policy..."
vault policy write docloq-backend - <<'EOF'
# Allow generating data encryption keys
path "transit/datakey/plaintext/docloq-*" {
  capabilities = ["update"]
}

# Allow encrypting data
path "transit/encrypt/docloq-*" {
  capabilities = ["update"]
}

# Allow decrypting data
path "transit/decrypt/docloq-*" {
  capabilities = ["update"]
}

# Allow reading key metadata (for health checks)
path "transit/keys/docloq-*" {
  capabilities = ["read"]
}

# Allow key rotation
path "transit/keys/docloq-*/rotate" {
  capabilities = ["update"]
}

# Allow creating per-document keys
path "transit/keys/docloq-doc-*" {
  capabilities = ["create", "read", "update", "delete"]
}

# Allow key config (needed for crypto shredding — enable deletion)
path "transit/keys/docloq-doc-*/config" {
  capabilities = ["update"]
}
EOF

echo ""
echo "=== Vault Initialization Complete ==="
echo "Transit engine: enabled"
echo "Master key:     docloq-master (aes256-gcm96)"
echo "Policy:         docloq-backend"
echo ""
echo "Test with: vault write transit/datakey/plaintext/docloq-master bits=256"
