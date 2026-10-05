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

Create the tunnel in Zero Trust → Networks → Tunnels, paste the token into
`CLOUDFLARE_TUNNEL_TOKEN` in `.env`, then add these four public hostnames
**in the dashboard** (the token mode ignores `cloudflared/config.yml`):

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
| backend | healthy | `GET /` 200, register + login verified |
| frontend | healthy | `/health` 200 |
| onlyoffice | up | `/healthcheck` 200 |
| docuseal | up | 302 to setup |
| clamav | healthy | ~1 GB resident, freshclam running, `clamdcheck.sh` passes |
| searxng | up | 200 |
| cloudflared | **not started** | waiting on a Cloudflare token — everything else is ready for it |

Footprint: ~2 GB RAM for the whole stack, 7.6 GB still available on the host.
Disk went from 34 GB to 21 GB free (OnlyOffice alone is 4.9 GB).

Three defects had to be worked around; none is in the old compose files:

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

## 6. Still needed before this is usable

### Blocker — nobody can log in without this

**SMTP credentials.** `login` in `backend/src/controllers/auth.controller.js:116`
makes 2FA mandatory for every account (`// 2FA is always required`), and the only
second factor a new user can actually complete is the emailed OTP
(`POST /api/totp/send-email-otp`). The TOTP path needs an authenticator secret
the user has never been shown. With `SMTP_*` empty that endpoint returns
`Failed to send verification email` — verified against the running stack. The
dev shortcut codes `123456`/`000000` are gated on `NODE_ENV !== 'production'`.

Fill in `.env` (the old deploy used Brevo):

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<brevo login>
SMTP_PASS=<brevo SMTP key>
SMTP_FROM=no-reply@docloq.site
```

Use `./scripts/set-secrets.sh` rather than editing by hand — it prompts for
each value, hides the ones that are secrets instead of echoing them, keeps them
out of your shell history, and re-applies mode 600 afterwards. It takes key
names too: `./scripts/set-secrets.sh SMTP_PASS CLOUDFLARE_API_TOKEN`.
Then `docker compose ... restart backend` to pick the new values up.

### Needed for the tunnel (pick one)

- `CLOUDFLARE_API_TOKEN` — scopes `Account → Cloudflare Tunnel → Edit` and
  `Zone → DNS → Edit` on `docloq.site`. Then `./scripts/cf-tunnel-setup.sh`
  does the rest. Account ID already in `.env`:
  `7644bc065a6f2d87aca679eb300af542` (read off the existing portalio tunnel —
  confirm `docloq.site` is in that same account).
- or `CLOUDFLARE_TUNNEL_TOKEN` plus the four hostnames added by hand (§3).

All four DNS records currently exist and are proxied, pointing at the dead VPS.
`cf-tunnel-setup.sh` replaces them with CNAMEs to `<tunnel-id>.cfargotunnel.com`.

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
