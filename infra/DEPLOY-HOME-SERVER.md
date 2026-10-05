# DocLoq — Home Server Deployment Runbook

Reconstructed 2026-10-05 from the repo + `DOCLOQ-FULL-DOCUMENTATION (1).txt`
after the original migration guide and the VPS were both lost. This file is the
replacement for §18 (Docker Swarm) and §23 (Traefik VPS) of that document —
both of those describe infrastructure that no longer exists.

Target host: `harvez` (Ubuntu 26.04, 4 vCPU, 15 GB RAM, 108 GB disk, LAN
192.168.100.141, behind NAT with no public IP).

---

## 1. Why this deployment differs from the old VPS

| | Old VPS | This home server |
|---|---|---|
| Ingress | Traefik on public IP :80/:443 | Cloudflare Tunnel (`cloudflared`) |
| TLS | Let's Encrypt via Traefik `le` resolver | Terminated at the Cloudflare edge |
| Published ports | 80, 443 on the host | **none at all** |
| Orchestration | Docker Swarm stack / compose + Traefik labels | plain `docker compose` |
| Secrets | Docker Swarm secrets in `/run/secrets` | `infra/.env`, mode 600 |
| CI/CD | Gitea Actions on a self-hosted runner | manual `scripts/deploy-home.sh` |
| Object storage | Cloudflare R2 | local Docker volume (R2 still switchable) |
| Key wrapping | Vault Transit (HA, 3 nodes) | local master key, Vault optional |

The host has no public IP, so nothing can be port-forwarded to. `cloudflared`
dials **out** to Cloudflare and Cloudflare routes the four hostnames back down
that connection. Because of that, no container publishes a host port — which
also means zero collision with the `milo`, `portalio` and `jp-supabase` stacks
already running on this box.

### Topology

```
                   Cloudflare edge (TLS, WAF, caching)
                             │
          docloq.site  api.  office.  sign.
                             │
                   ┌─────────▼──────────┐
                   │    cloudflared     │   outbound-only tunnel
                   └─────────┬──────────┘
                             │  docloq_edge  (bridge, has egress)
   ┌──────────┬──────────┬───┴──────┬───────────┬──────────┬─────────┐
   │ frontend │ backend  │onlyoffice│ docuseal  │  clamav  │ searxng │
   │  nginx   │ express  │          │           │ (needs   │ (needs  │
   └──────────┴────┬─────┴──────────┴───────────┴  egress) ┴ egress) ┘
                   │  docloq_data  (internal: true — NO route out)
      ┌────────────┼────────────┬──────────┬─────────┐
      │ postgres   │  redis     │ mongodb  │ qdrant  │  vault
      └────────────┴────────────┴──────────┴─────────┴─────────
```

`docloq_data` is `internal: true`: those containers have no default route, so
even a full RCE in Postgres has no path to the internet. `clamav` and `searxng`
sit on the edge network instead because they genuinely need egress — ClamAV for
`freshclam` virus definitions, SearXNG to query search engines.

### Domain map

| Hostname | Container | Port |
|---|---|---|
| `docloq.site` | `frontend` (nginx) | 80 |
| `api.docloq.site` | `backend` (express) | 3000 |
| `office.docloq.site` | `onlyoffice` | 80 |
| `sign.docloq.site` | `docuseal` | 3000 |

---

## 2. Files added by this deployment

```
infra/
  docker-compose.home.yml       the stack (11 services, memory-capped)
  .env                          REAL secrets, mode 600, gitignored
  .env.home.example             committed template, secrets blanked
  DEPLOY-HOME-SERVER.md         this file
  cloudflared/
    config.yml.template         ingress rules (committed)
    config.yml                  generated — gitignored
    <tunnel-id>.json            tunnel credentials — gitignored, BACK THIS UP
  searxng/
    settings.yml.template       committed
    settings.yml                generated with a fresh secret — gitignored
  scripts/
    deploy-home.sh              build + up + verify
    cf-tunnel-setup.sh          create tunnel + repoint DNS (needs API token)
    switch-captcha.sh           flip Turnstile test <-> real pair
    vault-init-home.sh          init/unseal Vault, switch KEY_PROVIDER
    backup-home.sh              dump everything unrecoverable
    set-secrets.sh              fill .env secrets interactively, no shell history
    cf-dns-point.sh             repoint DNS at an EXISTING tunnel (DNS scope only)
```

Nothing under `backend/` or `frontend/` was modified.

---

## 3. First-time deploy from nothing

Assumes Docker is installed and `docloq.site` is on Cloudflare nameservers.

```bash
cd /home/Docloq-new/infra

# 1. Secrets. Copy the template and fill it in.
cp .env.home.example .env && chmod 600 .env
#    Generate each one — do NOT reuse values from anywhere:
#      openssl rand -hex 24    POSTGRES_PASSWORD, MONGO_PASSWORD, ADMIN_GATE_SECRET
#      openssl rand -hex 32    ENCRYPTION_MASTER_KEY (must be exactly 64 hex chars),
#                              QR_SIGNING_SECRET, ONLYOFFICE_SECRET
#      openssl rand -hex 48    JWT_SECRET
#    Then fill the >>> NEEDS YOUR INPUT <<< entries (see §6).

# 2. Build images and start the stack (no ingress yet)
./scripts/deploy-home.sh --build --no-tunnel

# 3. Tunnel + DNS
#    Put CLOUDFLARE_API_TOKEN in .env, then:
./scripts/cf-tunnel-setup.sh
docker compose -f docker-compose.home.yml --env-file .env --profile tunnel-file up -d cloudflared

# 4. Verify from outside
curl -sS https://api.docloq.site/ ; curl -sI https://docloq.site/
```

Migrations run automatically — the backend entrypoint has `RUN_MIGRATIONS=true`
and `src/scripts/migrate.js` applies `drizzle/*.sql` in order, tracking state in
the `_migrations` table. On a fresh database all 25 files apply; on an existing
one it baselines instead of re-running. There is no manual migration step.

### If you only have a dashboard tunnel token (no API token)

A tunnel token is just base64 JSON — `{"a": accountTag, "t": tunnelID,
"s": tunnelSecret}` — which is **exactly** the three fields of a credentials
file. So a dashboard-created tunnel does not force you into dashboard-managed
ingress: derive the credentials file from the token and run the preferred
locally-managed mode instead, keeping ingress in version control rather than
clicked into a web UI.

```bash
cd /home/Docloq-new/infra
TOKEN=$(grep -oP '(?<=^CLOUDFLARE_TUNNEL_TOKEN=).*' .env)
TID=$(printf '%s' "$TOKEN" | base64 -d | jq -r .t)
printf '%s' "$TOKEN" | base64 -d \
  | jq '{AccountTag:.a, TunnelID:.t, TunnelSecret:.s}' > "cloudflared/$TID.json"

# cloudflared runs as uid 65532, so a root-owned 0600 file is unreadable:
#   "couldn't read tunnel credentials ...: permission denied"
chown 65532:65532 "cloudflared/$TID.json" && chmod 600 "cloudflared/$TID.json"

sed -e "s|__TUNNEL_ID__|$TID|g" -e "s|__DOMAIN_APP__|$DOMAIN_APP|g" \
    -e "s|__DOMAIN_API__|$DOMAIN_API|g" -e "s|__DOMAIN_OFFICE__|$DOMAIN_OFFICE|g" \
    -e "s|__DOMAIN_SIGN__|$DOMAIN_SIGN|g" \
    cloudflared/config.yml.template > cloudflared/config.yml

docker compose -f docker-compose.home.yml --env-file .env \
  --profile tunnel-file up -d cloudflared
```

Confirm it took the **local** config rather than pulling the dashboard's:

```bash
docker run --rm --network docloq_edge curlimages/curl -sS \
  http://cloudflared:2000/ready    # {"status":200,"readyConnections":4,...}
docker run --rm --network docloq_edge curlimages/curl -sS \
  http://cloudflared:2000/metrics | grep orchestration_config_version
# cloudflared_orchestration_config_version 0   <- 0 means local config.yml.
#                                                 Non-zero = remote config won.
```

If you would rather use dashboard-managed ingress, add the four public
hostnames there (the token mode ignores `cloudflared/config.yml`):

| Public hostname | Service |
|---|---|
| `docloq.site` | `HTTP` → `frontend:80` |
| `api.docloq.site` | `HTTP` → `backend:3000` |
| `office.docloq.site` | `HTTP` → `onlyoffice:80` |
| `sign.docloq.site` | `HTTP` → `docuseal:3000` |

For `office.docloq.site` also set *Additional application settings → HTTP Host
Header* to `office.docloq.site`, otherwise OnlyOffice builds its self-URLs from
the container name and the editor fails to load. Then:

```bash
docker compose -f docker-compose.home.yml --env-file .env --profile tunnel-token up -d cloudflared-token
```

### A connected tunnel is not a reachable site — DNS is separate

`cloudflared` dialling out successfully says nothing about whether traffic can
reach it. The edge only sends a hostname down the tunnel if that hostname's DNS
record is a CNAME to `<tunnel-id>.cfargotunnel.com`. While the four records
still pointed at the dead VPS, all four hostnames returned **HTTP 522** with a
fully healthy 4-connection tunnel running.

A tunnel token carries no zone authority, so it cannot fix DNS. That step needs
an API token with `Zone → DNS → Edit` — and nothing else, no account or tunnel
scope:

```bash
./scripts/set-secrets.sh CLOUDFLARE_API_TOKEN
DRY_RUN=1 ./scripts/cf-dns-point.sh     # show the changes first
./scripts/cf-dns-point.sh               # replace A records with proxied CNAMEs
```

`cf-dns-point.sh` only touches DNS — it never creates or alters a tunnel, which
is what makes it safe to run against a tunnel somebody else created. It also
deletes leftover `A`/`AAAA` records on the same name, since one stale record is
enough to keep sending a share of traffic to the old origin.

---|---|
| `docloq.site` | `HTTP` → `frontend:80` |
| `api.docloq.site` | `HTTP` → `backend:3000` |
| `office.docloq.site` | `HTTP` → `onlyoffice:80` |
| `sign.docloq.site` | `HTTP` → `docuseal:3000` |

For `office.docloq.site` also set *Additional application settings → HTTP Host
Header* to `office.docloq.site`, otherwise OnlyOffice builds its self-URLs from
the container name and the editor fails to load. Then:

```bash
docker compose -f docker-compose.home.yml --env-file .env --profile tunnel-token up -d cloudflared-token
```

---

## 4. Day-to-day operations

```bash
cd /home/Docloq-new/infra
C="docker compose -f docker-compose.home.yml --env-file .env"

$C ps                          # status
$C logs -f backend             # follow API logs
$C logs --tail=100 onlyoffice
$C restart backend

./scripts/deploy-home.sh --build-be      # ship a backend change
./scripts/deploy-home.sh --build-fe      # ship a frontend change (rebuilds the bundle)
./scripts/deploy-home.sh                 # restart/update without rebuilding
```

**After a code change you must rebuild the image** — there is no bind mount and
no CI on this host. `VITE_API_URL`, `VITE_ONLYOFFICE_URL` and
`VITE_TURNSTILE_SITE_KEY` are compiled into the frontend bundle, so changing any
of them means `--build-fe`.

### Reboot behaviour

Docker is enabled at boot and every service is `restart: unless-stopped`, so the
whole stack returns by itself. **Exception:** if you have switched
`KEY_PROVIDER=vault`, Vault comes back *sealed* and documents cannot be
decrypted until you run `./scripts/vault-init-home.sh unseal`. That is the
reason this deploy ships with `KEY_PROVIDER=local`.

### Backups

The nightly cron is **already installed** on this host (verified 2026-10-05):

```bash
crontab -l
# 0 3 * * * /home/Docloq-new/infra/scripts/backup-home.sh >> /var/log/docloq-backup.log 2>&1

./scripts/backup-home.sh                 # or run one by hand, any time
```

The archive holds the Postgres dump, the Mongo AI cache, `.env`, the tunnel
credentials, the Vault unseal keys and the document/qdrant/vault/docuseal
volumes — i.e. exactly the set that was lost with the old VPS. **Copy it off
this machine.** A backup that only exists on the server it backs up is not a
backup. The script keeps the 14 most recent archives locally.

A restore-readiness check was run on the first archive: it contains the
Postgres dump (all 70 tables present as `CREATE TABLE`), the Mongo archive,
`env`, `cloudflared.tar.gz` and the four volume tarballs. Note the archive
embeds `.env` in cleartext, so it is mode 600 and must stay that way wherever
you copy it.

### What is genuinely unrecoverable

Losing `ENCRYPTION_MASTER_KEY` (or the Vault unseal keys, if you switch) makes
**every stored document permanently undecryptable**. The encrypted blobs are
useless without it. This is also why the old R2 data cannot be recovered: the
blobs may still exist in the bucket, but their DEKs were wrapped by the Vault
Transit key that lived on the terminated VPS.

---

## 5. Current state of this deployment

Deployed and verified 2026-10-05:

| Service | State | Verified |
|---|---|---|
| postgres 16 | healthy | 25 migrations applied, 0 users (clean DB) |
| redis 7 | healthy | rate limiter attached |
| mongodb 7 | healthy | `[AI Cache] MongoDB connected` |
| qdrant 1.13.1 | up | reachable on `:6333` |
| vault 1.17 | up | **uninitialised** (`KEY_PROVIDER=local`) |
| backend | healthy | `GET /` 200; register, 2FA email-OTP, upload, encrypt/decrypt round-trip, QR verify, signed OnlyOffice convert all verified end-to-end through the tunnel |
| frontend | healthy | `/health` 200 |
| onlyoffice | healthy | `/healthcheck` 200; **JWT now enforced** (see defect 5) |
| docuseal | up | 302 to setup |
| clamav | healthy | ~1 GB resident, freshclam running, `clamdcheck.sh` passes |
| searxng | up | 200 |
| cloudflared | **live** | locally-managed tunnel, 4 QUIC conns to Cloudflare; all four hostnames return 200/302 from the public internet |

Footprint: ~2 GB RAM for the whole stack, 7.6 GB still available on the host.
Disk went from 34 GB to 21 GB free (OnlyOffice alone is 4.9 GB).

Live as of the second session (2026-10-05): the tunnel is up in locally-managed
mode (credentials derived from a dashboard tunnel token — see §3), DNS for all
four hostnames was repointed off the dead VPS at `141.11.25.76` with
`cf-dns-point.sh`, and SMTP (Brevo), the OpenAI key, blockchain anchoring
(Amoy, wallet `0x6B92…`), Serper and the GitHub OSINT token were all filled in
from the recovered env. The login blocker is cleared — an email OTP was sent
and accepted end-to-end.

Five defects had to be worked around; none is in the old compose files. The
first three are infra-only; defects 4 and 5 are genuine application bugs that
would hit **any** fresh deploy of this repo, not just this host:

1. **Vault crash-loop.** The `vault_data` volume is created root-owned but
   `hashicorp/vault` runs as uid 100, so Vault died on
   `open /vault/data/vault.db: permission denied`. Fixed once with
   `docker run --rm -v docloq_vault_data:/d alpine:3 chown -R 100:1000 /d`.

2. **Frontend always reported unhealthy.** `frontend/Dockerfile`'s healthcheck
   probes `http://localhost/health`; busybox `wget` resolves `localhost` to `::1`
   first and `nginx.conf` only has `listen 80` (IPv4), so the probe is refused
   from inside the container while working fine from every other container. The
   compose file overrides the healthcheck to use `127.0.0.1`. The image itself is
   untouched — worth fixing in `frontend/Dockerfile` eventually, since any future
   `depends_on: {frontend: {condition: service_healthy}}` would deadlock.

3. **ClamAV always reported unhealthy.** The healthcheck ran `clamdcheck`, but
   the `clamav/clamav` image ships the script as `clamdcheck.sh` — the probe
   failed with `executable file not found in $PATH` on every interval while
   `clamd` itself was fine. Corrected in the compose file. This mattered more
   than a cosmetic status: `SCANNER_ENABLED=true`, so an unhealthy-looking
   scanner invites someone to "fix" it by turning scanning off.

4. **Every document upload failed (schema drift).** `document_qr_codes` is only
   ever created by `0000_goofy_magma.sql`, but `src/db/schema.js` later grew a
   QR lifecycle (`status`, `superseded_*`, `purged_at`) and three issue-time
   snapshot columns with no migration behind them. A DB built purely from
   `drizzle/*.sql` was seven columns short of what the upload pipeline inserts,
   so step 9 (QR generation) threw and the whole upload transaction rolled back
   — a fresh deploy could not store a single file. The previous production DB
   had the columns applied out-of-band, which is why nobody noticed. Fixed by
   the new `0024_qr_lifecycle_columns.sql`; a full Drizzle introspection of all
   69 tables confirmed this was the only drift.

5. **OnlyOffice was a public SSRF.** `JWT_ENABLED` was `"false"`, so
   `office.docloq.site/ConvertService.ashx` — reachable from the internet —
   would fetch any URL it was handed and return the body. A single unauthenticated
   request made it pull the internal-only `backend:3000`. The backend already
   had a dormant `ONLYOFFICE_SECRET` and `jsonwebtoken`; the signing was simply
   never wired. Now the backend signs the editor config, ConvertService and
   CommandService calls, the container runs `JWT_ENABLED=true`, and
   `ALLOW_META_IP_ADDRESS` is off (`ALLOW_PRIVATE_IP_ADDRESS` must stay on,
   since `backend:3000` is a Docker-private address). Verified: an unsigned
   ConvertService call now returns `Error -8`, while the backend's own signed
   convert path still produces a valid `.docx`.

### Two things are deliberately set to a non-production value

1. **Turnstile is on Cloudflare's public test pair** (site key
   `1x00000000000000000000AA`, secret `1x0000...AA`). It always passes, so the
   captcha is effectively off and only the 15-request/15-minute auth rate
   limiter stands between an attacker and password guessing. The real site key
   from the repo's CI config is `0x4AAAAAADVVXAV9IObkcwD2`; put its secret in
   `.env` and run `./scripts/switch-captcha.sh real`. The real-key frontend is
   already built and tagged `docloq-frontend:realcaptcha`, so the switch takes
   seconds, no rebuild.

2. **`KEY_PROVIDER=local`** — DEKs are wrapped by `ENCRYPTION_MASTER_KEY` from
   `.env` rather than Vault Transit. Weaker than the old VPS setup, but it
   survives an unattended reboot. `scripts/vault-init-home.sh init` switches
   over; it is safe to run later because `decryptDocumentKey()` dispatches on
   the ciphertext prefix, so documents already wrapped locally keep working.

---

## 6. Configuration status

### Login blocker — RESOLVED

Login needs email OTP as the mandatory second factor (`login` in
`backend/src/controllers/auth.controller.js` makes 2FA mandatory, and the emailed
OTP via `POST /api/totp/send-email-otp` is the only factor a new user can
complete — the dev shortcut codes `123456`/`000000` are gated on
`NODE_ENV !== 'production'`). SMTP is now configured (Brevo, recovered from the
old env) and an OTP was sent and accepted end-to-end. If you ever rotate it, use
`./scripts/set-secrets.sh SMTP_HOST SMTP_USER SMTP_PASS` (it hides secrets, keeps
them out of shell history, re-applies mode 600) then restart the backend.

### Tunnel + DNS — DONE

The tunnel runs in locally-managed mode. It was created in the Zero Trust
dashboard; its credentials file was derived from the tunnel token (§3) so
ingress lives in `cloudflared/config.yml` under version control rather than in
the dashboard. DNS for all four hostnames was moved off the dead VPS
(`141.11.25.76`) onto `<tunnel-id>.cfargotunnel.com` with
`./scripts/cf-dns-point.sh`, which needs only a `Zone → DNS → Edit` API token
and never touches the tunnel itself.

### Needed per feature


| Variable | Without it |
|---|---|
| `OPENAI_API_KEY` | document analysis, DoKi chatbot, AI Projects, embeddings and semantic search all fail; everything else works |
| `TURNSTILE_SECRET_KEY` | captcha stays on the always-pass test pair |
| `DOCUSEAL_API_KEY` | e-signature inert. Open `https://sign.docloq.site`, create the admin account, Settings → API → copy token, restart backend |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_ENDPOINT` | only if you want R2 instead of the local volume; then set `STORAGE_PROVIDER=r2` |
| `GOOGLE_CLIENT_ID` / `_SECRET` | "Sign in with Google" unavailable |
| `POLYGON_PRIVATE_KEY` | blockchain anchoring stays off. Contract `0x8CAeedf1dF7EE5119D18630EfC271C30cbc3909A` on Amoy is reusable — no redeploy |
| `GOOGLE_CSE_KEY` / `SERPER_API_KEY` | optional; self-hosted SearXNG already covers OSINT discovery |

Filled in this session from the recovered env: `OPENAI_API_KEY` (validated against
`/v1/models`), `POLYGON_PRIVATE_KEY` + `BLOCKCHAIN_ENABLED=true` +
`AUDIT_ANCHOR_ENABLED=true` (backend logs `[Blockchain] Connected to chain 80002,
wallet 0x6B92…` and `[AuditAnchor] scheduled`), `SERPER_API_KEY`, `GITHUB_TOKEN`
(OSINT), `PQC_WRAP_ENABLED=true`. Still open: `DOCUSEAL_API_KEY` (create the admin
at `https://sign.docloq.site` first), `TURNSTILE_SECRET_KEY` (still the always-pass
test pair — see below), and the Google OAuth pair (burned, must be rotated).

### Security debt found while reading the repo

`backend/.env.example` has **live-looking credentials committed**:
`GOOGLE_CLIENT_ID=AIzaSy...` and `GOOGLE_CLIENT_SECRET=GOCSPX-...`. They are in
git history and must be treated as burned — rotate them in Google Cloud Console
and replace the example values with placeholders. `infra/.env` deliberately
leaves both blank rather than reusing them.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Login always fails, "Captcha verification failed" | `TURNSTILE_SECRET_KEY` empty while `NODE_ENV=production` — `turnstile.service.js:9` throws. Set it, or use the test pair |
| Login reaches 2FA then dies | SMTP not configured — see §6 |
| OnlyOffice editor blank / "download failed" | `office.docloq.site` must arrive with `Host: office.docloq.site`. Check `httpHostHeader` in `cloudflared/config.yml`, or the dashboard's HTTP Host Header setting |
| Vault `permission denied` on `/vault/data/vault.db` | volume is root-owned: `docker run --rm -v docloq_vault_data:/d alpine:3 chown -R 100:1000 /d` |
| Uploads rejected after a restart | if `KEY_PROVIDER=vault`, Vault is sealed — `./scripts/vault-init-home.sh unseal` |
| `cf-tunnel-setup.sh`: "tunnel exists but credentials missing" | the tunnel secret is write-once. Delete the tunnel in the dashboard and re-run, or restore the json from a backup |
| Upload of a big file fails at the edge | Cloudflare free plan caps request bodies at 100 MB; `MAX_FILE_SIZE_MB=50` stays under it |
| ClamAV unhealthy for the first few minutes | `freshclam` is downloading the virus DB; `start_period` is 420s. `SCANNER_ENABLED=false` disables scanning entirely if you need the ~1 GB of RAM back |
| Host memory pressure | lower `mem_limit` in the compose, or drop ClamAV (~1 GB) and DocuSeal (~170 MB) |
