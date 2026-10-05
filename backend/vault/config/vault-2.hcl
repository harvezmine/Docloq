# Vault Node 2 — HA Configuration (Raft Storage Backend)
# Part of 3-node Vault cluster for DocLoq production

storage "raft" {
  path    = "/vault/data"
  node_id = "vault_2"

  retry_join {
    leader_api_addr = "http://vault-1:8200"
  }
  retry_join {
    leader_api_addr = "http://vault-2:8200"
  }
  retry_join {
    leader_api_addr = "http://vault-3:8200"
  }
}

listener "tcp" {
  address         = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_disable     = 1  # TLS terminated at Cloudflare Tunnel
}

api_addr     = "http://vault-2:8200"
cluster_addr = "http://vault-2:8201"

disable_mlock = true
ui            = true
