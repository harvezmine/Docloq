ui            = true
disable_mlock = true

storage "raft" {
  path    = "/vault/data"
  node_id = "vault_1"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

api_addr     = "http://vault:8200"
cluster_addr = "http://vault:8201"
