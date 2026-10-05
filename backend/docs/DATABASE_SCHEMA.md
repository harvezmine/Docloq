# DocLoq Database Schema Documentation

## Overview

DocLoq adalah Secure Document Management System (SDMS) yang dirancang dengan keamanan tinggi untuk perusahaan. Database schema ini mendukung semua fitur sesuai dengan compliance **GDPR** dan **UU PDP Indonesia**.

### Key Features:
- 🔐 **AES-256 Encryption** dengan key management via AWS KMS
- 🔗 **Blockchain Anchoring** untuk immutable ledger (pseudonymized)
- 🕵️ **Honeytoken & Watermarking** untuk tracking kebocoran dokumen
- 📊 **Versioning System** - tidak ada overwrite, selalu buat versi baru
- 🗑️ **Crypto Shredding** untuk hard delete sesuai GDPR Art 17
- ☁️ **AWS S3 + Glacier** untuk storage dan archiving

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCUMENT UPLOAD FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User Upload (HTTPS)                                                      │
│         ↓                                                                    │
│  2. Temporary Folder (isolated) ──→ ClamAV Malware Scan                     │
│         ↓                              ↓ (jika terinfeksi: REJECT)          │
│  3. Honeytoken Injection + Invisible Watermarking                           │
│         ↓                                                                    │
│  4. SHA-256 Hashing ──→ Optional: Blockchain Anchor (pseudonymized)         │
│         ↓                                                                    │
│  5. AES-256 Encryption (server-side)                                        │
│         ↓                    Private Key → AWS KMS (terpisah dari DB)       │
│  6. Temp Folder Overwrite dengan 0 (secure delete)                          │
│         ↓                                                                    │
│  7. Upload ke AWS S3 (ap-southeast-3 Jakarta) + Encryption at Rest          │
│         ↓                                                                    │
│  8. Metadata disimpan di Database                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCUMENT ACCESS FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User request file                                                        │
│         ↓                                                                    │
│  2. Check permissions (folder + document level)                             │
│         ↓                                                                    │
│  3. Server request AWS KMS untuk decrypt key                                │
│         ↓                                                                    │
│  4. Generate Presigned URL (temporary, secure)                              │
│         ↓                                                                    │
│  5. User download langsung dari S3                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Organizations](#1-organizations)
2. [Users & Authentication](#2-users--authentication)
3. [Teams & RBAC](#3-teams--role-based-access-control)
4. [Folders & Hierarchy](#4-folders--hierarchy)
5. [Permissions](#5-permissions)
6. [Documents & Versioning](#6-documents--versioning)
7. [Watermarks & Honeytokens](#7-watermarks--honeytokens)
8. [QR Codes](#8-qr-codes)
9. [Blockchain Anchoring](#9-blockchain-anchoring)
10. [Document Sharing](#10-document-sharing)
11. [Document Verification](#11-document-verification)
12. [Trash Management](#12-trash-management)
13. [Crypto Shredding](#13-crypto-shredding)
14. [Templates](#14-templates)
15. [Forms](#15-forms)
16. [Tasks](#16-tasks)
17. [AI Chatbot](#17-ai-chatbot)
18. [OSINT & Leak Checker](#18-osint--leak-checker)
19. [Temporary Uploads](#19-temporary-uploads)
20. [Audit & Security](#20-audit--security)
21. [Archive Jobs](#21-archive-jobs)
22. [Notifications](#22-notifications)
23. [Support Tickets](#23-support-tickets)
24. [AI Analysis & AI Projects](#24-ai-analysis--ai-projects)
25. [Tables Added Since Initial Schema](#tables-added-since-initial-schema)
26. [Migrations](#migrations)

---

## Enums

```sql
-- User roles dalam sistem (collapsed di migration 0013 dari super_admin/admin/manager/user/auditor/viewer)
user_role: 'owner' | 'admin' | 'user'

-- Tipe permission untuk folder/dokumen
permission_type: 'read' | 'read_edit' | 'full_access'

-- Status dokumen
document_status: 'active' | 'archived' | 'revoked' | 'expired' | 'deleted'

-- Status verifikasi dokumen
verification_status: 'pending' | 'verified' | 'failed' | 'revoked' | 'expired'

-- Status task
task_status: 'pending' | 'in_progress' | 'completed' | 'cancelled'

-- Prioritas task
task_priority: 'low' | 'medium' | 'high' | 'urgent'

-- Aksi untuk audit log
audit_action: 'create' | 'read' | 'update' | 'delete' | 'download' | 'share' | 'verify' | 'restore' | 'archive'

-- Tipe share link
share_type: 'view_only' | 'can_edit'

-- Status archive (untuk GDPR compliance)
archive_status: 'active' | 'glacier' | 'deep_archive' | 'deleted'

-- Status form instance (workflow)
form_instance_status: 'draft' | 'active' | 'completed' | 'cancelled'

-- Aksi per step workflow form
workflow_action: 'fill' | 'review' | 'approve' | 'sign'

-- Status step workflow form
workflow_step_status: 'pending' | 'in_progress' | 'completed' | 'skipped'

-- Role admin platform (tabel admin_users, terpisah dari user_role tenant)
admin_role: 'super_admin' | 'admin' | 'support'
```

---

## 1. Organizations

Tabel untuk menyimpan data perusahaan/organisasi yang menggunakan DocLoq.

```sql
CREATE TABLE organizations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  VARCHAR(100) NOT NULL UNIQUE,  -- URL-friendly identifier
  company_code          VARCHAR(8) NOT NULL UNIQUE,    -- Kode perusahaan (join code), migration 0009
  
  -- Subscription & Features
  subscription_tier     TEXT DEFAULT 'basic',          -- basic, professional, enterprise
  has_blockchain_feature BOOLEAN DEFAULT false,        -- Fitur blockchain untuk enterprise
  
  -- AWS Configuration (Region Indonesia untuk UU PDP)
  aws_region            TEXT DEFAULT 'ap-southeast-3', -- Jakarta region
  s3_bucket             TEXT,                          -- Nama bucket S3
  kms_key_arn           TEXT,                          -- ARN key di AWS KMS (bukan key-nya!)
  
  -- GDPR & Compliance Settings
  data_retention_days   INTEGER DEFAULT 2555,          -- ~7 tahun default
  archive_after_days    INTEGER DEFAULT 365,           -- Pindah ke deep archive setelah 1 tahun
  gdpr_compliant        BOOLEAN DEFAULT true,
  pdp_compliant         BOOLEAN DEFAULT true,          -- UU PDP Indonesia
  
  settings              JSONB DEFAULT '{}',
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

### Notes:
- **aws_region**: Harus `ap-southeast-3` (Jakarta) untuk compliance UU PDP Indonesia
- **kms_key_arn**: Hanya menyimpan reference ke AWS KMS, BUKAN private key-nya
- **data_retention_days**: Berapa lama data disimpan sebelum dihapus permanen
- **archive_after_days**: Kapan data dipindahkan ke AWS Glacier/Deep Archive

---

## 2. Users & Authentication

### users
Tabel utama untuk menyimpan data user.

```sql
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  email                 TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,                 -- bcrypt/argon2 hash
  google_id             TEXT UNIQUE,                   -- Google OAuth subject (migration 0008)
  
  -- Profile
  first_name            TEXT,
  last_name             TEXT,
  avatar_url            TEXT,
  phone                 TEXT,
  position              TEXT,                          -- Jabatan
  department_id         UUID REFERENCES departments(id) ON DELETE SET NULL, -- migration 0004
  
  -- Role & Status
  role                  user_role DEFAULT 'user',      -- owner | admin | user (default 'user')
  is_active             BOOLEAN DEFAULT true,
  is_email_verified     BOOLEAN DEFAULT false,
  
  -- Security (Two-Factor Auth)
  two_factor_enabled    BOOLEAN DEFAULT false,
  two_factor_secret     TEXT,                          -- TOTP secret (encrypted)
  last_login_at         TIMESTAMP,
  last_login_ip         TEXT,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until          TIMESTAMP,                     -- Account lockout
  
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

### user_sessions
Menyimpan session aktif user untuk JWT token management.

```sql
CREATE TABLE user_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  token                 TEXT NOT NULL UNIQUE,          -- JWT atau session token
  refresh_token         TEXT,
  
  user_agent            TEXT,                          -- Browser/device info
  ip_address            TEXT,
  
  last_activity_at      TIMESTAMP DEFAULT NOW(),        -- Idle-timeout tracking (migration 0004)
  expires_at            TIMESTAMP NOT NULL,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### email_verification_tokens
Token untuk verifikasi email saat registrasi.

```sql
CREATE TABLE email_verification_tokens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token                 TEXT NOT NULL UNIQUE,
  expires_at            TIMESTAMP NOT NULL,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### password_reset_tokens
Token untuk reset password.

```sql
CREATE TABLE password_reset_tokens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token                 TEXT NOT NULL UNIQUE,
  expires_at            TIMESTAMP NOT NULL,
  used_at               TIMESTAMP,                     -- Tandai sudah dipakai
  created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 3. Teams & Role-Based Access Control

### teams
Tim dalam organisasi untuk grouping users.

```sql
CREATE TABLE teams (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  name                  TEXT NOT NULL,
  description           TEXT,
  color                 VARCHAR(7),                    -- Hex color untuk UI (#FF5733)
  
  created_by            UUID REFERENCES users(id),
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

### team_members
Relasi many-to-many antara users dan teams.

```sql
CREATE TABLE team_members (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id               UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  is_team_lead          BOOLEAN DEFAULT false,         -- Team leader flag
  
  added_by              UUID REFERENCES users(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(team_id, user_id)                             -- User hanya bisa 1x per team
);
```

---

## 4. Folders & Hierarchy

### folders
Struktur folder hierarkis menggunakan materialized path pattern.

```sql
CREATE TABLE folders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  name                  TEXT NOT NULL,
  parent_id             UUID,                          -- Self-reference untuk hierarchy
  path                  TEXT NOT NULL,                 -- Materialized path: /root/sub1/sub2
  depth                 INTEGER DEFAULT 0,             -- Kedalaman level
  
  -- Untuk drag & drop ordering
  sort_order            INTEGER DEFAULT 0,
  
  -- Visual customization
  color                 VARCHAR(7),
  icon                  TEXT,
  description           TEXT,
  
  created_by            UUID REFERENCES users(id),
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

### folder_tags
Tags untuk kategorisasi folder (Confidential, Finance, Legal, dll).

```sql
CREATE TABLE folder_tags (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id             UUID REFERENCES folders(id) ON DELETE CASCADE NOT NULL,
  
  tag                   TEXT NOT NULL,                 -- confidential, finance, legal, hr, custom
  color                 VARCHAR(7),
  
  created_at            TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(folder_id, tag)                               -- 1 tag per folder
);
```

---

## 5. Permissions

### folder_permissions
Permission level folder - bisa untuk team atau individual user.

```sql
CREATE TABLE folder_permissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id             UUID REFERENCES folders(id) ON DELETE CASCADE NOT NULL,
  
  -- Permission bisa untuk team ATAU user (salah satu)
  team_id               UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  
  permission_type       permission_type NOT NULL,      -- read, read_edit, full_access
  
  inherit_to_subfolders BOOLEAN DEFAULT true,          -- Inherit ke child folders
  
  granted_by            UUID REFERENCES users(id),
  expires_at            TIMESTAMP,                     -- Temporary permission
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### document_permissions
Permission level file - untuk override folder permission.

```sql
CREATE TABLE document_permissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  
  team_id               UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  
  permission_type       permission_type NOT NULL,
  
  granted_by            UUID REFERENCES users(id),
  expires_at            TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### Permission Hierarchy:
```
1. Document Permission (highest priority - override semua)
2. Folder Permission (inherited ke dokumen di dalamnya)
3. Team Permission (user mewarisi permission dari team)
4. Organization Role (owner, admin, user — lihat enum user_role)
```

---

## 6. Documents & Versioning

### documents
Metadata dokumen utama (bukan file-nya, file di S3).

```sql
CREATE TABLE documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  folder_id             UUID REFERENCES folders(id) ON DELETE SET NULL,
  
  -- Basic Info
  filename              TEXT NOT NULL,                 -- Nama file yang ditampilkan
  original_filename     TEXT NOT NULL,                 -- Nama file asli saat upload
  mime_type             TEXT NOT NULL,
  file_size             BIGINT NOT NULL,               -- Ukuran dalam bytes
  
  -- Versioning
  current_version_id    UUID,                          -- Reference ke versi aktif
  version_count         INTEGER DEFAULT 1,
  
  -- Status
  status                document_status DEFAULT 'active',
  
  -- Ownership
  owner_id              UUID REFERENCES users(id) NOT NULL,
  is_public             BOOLEAN DEFAULT false,
  
  -- Document DNA (untuk duplicate detection)
  content_hash          TEXT,                          -- SHA-256 dari normalized content
  ssdeep_hash           TEXT,                          -- Fuzzy hash untuk similarity
  sim_hash              TEXT,                          -- SimHash untuk near-duplicate
  
  -- Expiration
  expires_at            TIMESTAMP,

  -- AI Analysis Access Control (migration 0006 / 0022). Dokumen diblokir dari AI sampai grant eksplisit.
  ai_redaction_mode     TEXT,                          -- 'censored' | 'full', dipilih saat grant (diterapkan di INGEST)
  ai_access_granted     BOOLEAN DEFAULT false,
  ai_access_granted_at  TIMESTAMP,
  ai_access_granted_by  UUID REFERENCES users(id),

  -- Blockchain Anchoring (migration 0007)
  blockchain_anchored   BOOLEAN DEFAULT false,
  blockchain_anchor_id  UUID,
  auto_anchor_on_edit   BOOLEAN DEFAULT false,

  -- OSINT Document Tracking (migration 0014)
  tracking_enabled      BOOLEAN DEFAULT false,
  tracking_code         TEXT,                          -- stable per-doc discovery code (docCode), null until enabled

  -- QR on download (migration 0015) — embed verification QR ke copy yang di-download (PDF/DOCX)
  qr_on_download        BOOLEAN DEFAULT false,

  -- Soft delete
  deleted_at            TIMESTAMP,
  deleted_by            UUID REFERENCES users(id),

  -- OnlyOffice edit lock (migration 0011) — 2 jam absolute, single editor at a time
  edit_locked_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  edit_lock_acquired_at TIMESTAMP,
  edit_lock_expires_at  TIMESTAMP,

  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

### document_versions
**PENTING**: Setiap edit membuat versi baru, TIDAK overwrite yang lama!

```sql
CREATE TABLE document_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  
  version_number        INTEGER NOT NULL,
  
  -- Storage di AWS S3
  s3_key                TEXT NOT NULL,                 -- Path di S3
  s3_bucket             TEXT NOT NULL,
  file_size             BIGINT NOT NULL,
  
  -- Encryption (AES-256-GCM). NULLABLE (migration 0020): nulling these tiga kolom IS
  -- the crypto-shred primitive (GDPR Art. 17) — destroyed key sah dianggap absen.
  -- Reader fail-closed pada NULL (unwrapVersionKey() throws, decryptDocument() guard).
  -- Terisi untuk setiap versi live.
  encryption_key_id     TEXT,                          -- wrapped DEK (v1) / sentinel 'pqc_v2_hybrid' (v2)
  encryption_iv         TEXT,                          -- Initialization Vector
  encryption_salt       TEXT,                          -- Salt untuk key derivation

  -- Post-quantum hybrid key-wrap (Feature 2, migration 0018). v1_vault = envelope lama
  -- (DEK di encryption_key_id); v2_hybrid_pqc = DEK di-wrap X25519+ML-KEM-768 (envelope di
  -- pqc_envelope, keypair di pqc_keypair_id; encryption_key_id berisi sentinel).
  key_wrap_version      TEXT NOT NULL DEFAULT 'v1_vault',
  pqc_keypair_id        UUID,                          -- FK ke pqc_keypairs (keypair yang dipakai wrap DEK)
  pqc_envelope          JSONB,                         -- { mlkemCiphertext, x25519EphemeralPublic, wrapSalt, wrappedDek, wrapIv, wrapTag }
  
  -- Hashing (untuk integritas)
  sha256_hash           TEXT NOT NULL,                 -- Hash sebelum enkripsi
  body_hash             TEXT,                          -- Hash body saja (tanpa header)
  
  -- Archive Status (GDPR compliance)
  archive_status        archive_status DEFAULT 'active',
  archived_at           TIMESTAMP,
  archive_job_id        TEXT,                          -- Reference ke AWS Glacier job
  
  -- Tracking
  created_by            UUID REFERENCES users(id) NOT NULL,
  change_note           TEXT,                          -- Catatan perubahan
  
  created_at            TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(document_id, version_number)
);
```

### Versioning Flow:
```
1. User edit dokumen
2. Sistem TIDAK overwrite file lama
3. Buat version baru dengan version_number + 1
4. Update current_version_id di tabel documents
5. Versi lama tetap tersimpan
6. Setelah archive_after_days → pindah ke Glacier
7. Setelah data_retention_days → crypto shredding
```

---

## 7. Watermarks & Honeytokens

### document_watermarks
Invisible watermark menggunakan LSB steganography di gambar.

```sql
CREATE TABLE document_watermarks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  version_id            UUID REFERENCES document_versions(id) ON DELETE CASCADE NOT NULL,
  
  watermark_type        TEXT DEFAULT 'lsb_steganography',
  
  -- Payload info (hash saja, bukan payload asli)
  payload_hash          TEXT NOT NULL,
  embedding_positions   JSONB,                         -- Posisi pixel yang di-embed
  redundancy_level      INTEGER DEFAULT 3,             -- 3-5x redundancy
  
  -- Info gambar yang di-watermark
  image_count           INTEGER DEFAULT 0,
  image_details         JSONB,
  
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### document_honeytokens
Multiple honeytoken methods untuk tracking kebocoran.

```sql
CREATE TABLE document_honeytokens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  version_id            UUID REFERENCES document_versions(id) ON DELETE CASCADE NOT NULL,
  
  -- Method 1: Zero-Width Characters
  zwc_token             TEXT,                          -- Encoded payload
  zwc_positions         JSONB,                         -- Posisi di dokumen
  
  -- Method 2: Homoglyph Substitution
  homoglyph_token       TEXT,
  homoglyph_positions   JSONB,
  
  -- Method 3: Whitespace Encoding
  whitespace_token      TEXT,
  whitespace_positions  JSONB,
  
  -- Combined hash untuk validasi
  combined_payload_hash TEXT NOT NULL,
  
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### Honeytoken Methods:
```
1. Zero-Width Characters (ZWC):
   - Sisipkan karakter tak terlihat (U+200B, U+200C, dll)
   - Encode payload dalam binary → ZWC sequence
   
2. Homoglyph Substitution:
   - Ganti huruf dengan karakter mirip (a → а, o → ο)
   - Pattern substitusi unik per dokumen
   
3. Whitespace Encoding:
   - Sisipkan space/tab di akhir baris
   - Pattern spacing encode payload
```

---

## 8. QR Codes

### document_qr_codes
QR code untuk verifikasi dokumen.

```sql
CREATE TABLE document_qr_codes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SET NULL + nullable (bukan CASCADE/NOT NULL): baris QR bertahan setelah dokumen di-purge
  -- agar tetap jadi audit trail. Snapshot di bawah menjaga info display tetap ada.
  document_id           UUID REFERENCES documents(id) ON DELETE SET NULL,
  version_id            UUID REFERENCES document_versions(id) ON DELETE SET NULL,
  
  -- QR Payload
  payload_hash          TEXT NOT NULL,
  signature_hash        TEXT NOT NULL,                 -- HMAC-SHA256 signature
  
  -- Verification
  verification_url      TEXT NOT NULL,
  short_code            VARCHAR(20) NOT NULL UNIQUE,   -- URL shortener: docloq.io/v/ABC123
  
  -- QR Image
  qr_image_s3_key       TEXT,
  
  -- Blockchain proof
  has_blockchain_proof  BOOLEAN DEFAULT false,
  
  -- Statistics
  scan_count            INTEGER DEFAULT 0,
  last_scanned_at       TIMESTAMP,

  -- Lifecycle: active | superseded | revoked | purged
  status                TEXT DEFAULT 'active',
  superseded_by_qr_id   UUID,                          -- self-ref ke QR pengganti (versi lebih baru)
  superseded_at         TIMESTAMP,
  purged_at             TIMESTAMP,

  -- Snapshot saat issue — bertahan setelah dokumen dihapus untuk display audit
  document_version_number INTEGER,
  content_hash_snapshot TEXT,                          -- documents.content_hash saat QR di-issue
  doc_name_snapshot     TEXT,                          -- original_filename saat QR di-issue

  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 9. Blockchain Anchoring

### blockchain_anchors
Pseudonymized document hash di blockchain.

```sql
CREATE TABLE blockchain_anchors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  version_id            UUID REFERENCES document_versions(id) ON DELETE CASCADE NOT NULL,
  
  -- Blockchain Info
  blockchain_network    TEXT DEFAULT 'polygon',        -- polygon, ethereum, etc.
  transaction_hash      TEXT NOT NULL UNIQUE,
  block_number          BIGINT,
  block_timestamp       TIMESTAMP,
  
  -- Data yang di-anchor (PSEUDONYMIZED - tidak ada PII!)
  anchored_hash         TEXT NOT NULL,                 -- Hash dokumen
  pseudonymized_org_id  TEXT NOT NULL,                 -- Pseudonym, bukan org ID asli
  
  -- Merkle proof (untuk batch anchoring)
  merkle_root           TEXT,
  merkle_proof          JSONB,
  
  -- Status
  status                TEXT DEFAULT 'pending',        -- pending, confirmed, failed
  confirmations         INTEGER DEFAULT 0,
  
  -- Gas info
  gas_used              BIGINT,
  gas_cost              TEXT,
  
  created_at            TIMESTAMP DEFAULT NOW(),
  confirmed_at          TIMESTAMP
);
```

### Pseudonymization:
```
Data yang TIDAK boleh on-chain:
❌ User ID/Email
❌ Organization ID/Name
❌ Filename
❌ File content
❌ Metadata apapun

Data yang BOLEH on-chain:
✅ Document hash
✅ Pseudonymized identifiers (one-way hash)
✅ Timestamp
✅ Merkle proof
```

### Smart Contract

Detail kontrak, deploy, dan env: lihat **backend/README.md → Blockchain Anchoring**.

| Item | Nilai |
|------|-------|
| Kontrak | `contracts/DocLoqAnchor.sol` (Solidity 0.8.20) |
| Network testnet | Polygon Amoy (chainId `80002`) |
| Network produksi | Polygon Mainnet (chainId `137`) |
| `anchorId` | `keccak256(documentUUID)` |
| `pseudonymized_org_id` | `keccak256(organizationUUID)` |
| Verifikasi | view call on-chain, **tanpa gas** |
| Batch | 1 Merkle root untuk N dokumen |

> Kontrak di-deploy **sekali** per network; `transaction_hash` per anchor tetap disimpan di
> tabel `blockchain_anchors` untuk audit + link ke explorer (amoy.polygonscan.com / polygonscan.com).

---

## 10. Document Sharing

### document_shares
Share link untuk berbagi dokumen.

```sql
CREATE TABLE document_shares (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  
  share_type            share_type NOT NULL,           -- view_only, can_edit
  share_token           TEXT NOT NULL UNIQUE,
  share_url             TEXT NOT NULL,
  
  -- Restrictions
  allowed_emails        JSONB,                         -- Hanya email dari company yang sama
  require_auth          BOOLEAN DEFAULT true,
  
  -- Limits
  max_views             INTEGER,
  view_count            INTEGER DEFAULT 0,
  
  expires_at            TIMESTAMP,
  
  created_by            UUID REFERENCES users(id) NOT NULL,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### document_share_access
Log akses share link.

```sql
CREATE TABLE document_share_access (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id              UUID REFERENCES document_shares(id) ON DELETE CASCADE NOT NULL,
  
  accessed_by           UUID REFERENCES users(id),
  ip_address            TEXT,
  user_agent            TEXT,
  
  accessed_at           TIMESTAMP DEFAULT NOW()
);
```

---

## 11. Document Verification

### verification_requests
Request verifikasi keaslian dokumen.

```sql
CREATE TABLE verification_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Input method
  -- Active: qr_scan, upload_softcopy, manual_hash.
  -- 'upload_hardcopy' is LEGACY — hardcopy (photo-of-paper) verification was
  -- removed in the 2026-06-28 redesign; no code writes it anymore.
  input_method          TEXT NOT NULL,
  
  -- Input data
  input_hash            TEXT,
  input_qr_code         TEXT,
  uploaded_file_s3_key  TEXT,
  
  -- Result
  status                verification_status DEFAULT 'pending',
  matched_document_id   UUID REFERENCES documents(id),
  matched_version_id    UUID REFERENCES document_versions(id),
  
  -- Fuzzy comparison results
  is_hardcopy_scan      BOOLEAN DEFAULT false,          -- LEGACY: always false (hardcopy verify removed 2026-06-28)
  ssdeep_similarity     INTEGER,                       -- PLACEHOLDER: always NULL (no native ssdeep build in Alpine)
  sim_hash_distance     INTEGER,                       -- Hamming distance (active fuzzy metric)
  
  -- Chunk analysis
  chunk_analysis        JSONB,
  differing_chunks      JSONB,
  
  -- Blockchain verification
  blockchain_verified   BOOLEAN,
  blockchain_anchor_id  UUID REFERENCES blockchain_anchors(id),
  
  -- Requester
  requested_by          UUID REFERENCES users(id),
  ip_address            TEXT,
  
  result_message        TEXT,
  result_details        JSONB,
  
  created_at            TIMESTAMP DEFAULT NOW(),
  completed_at          TIMESTAMP
);
```

### Verification Flow:
```
1. User scan QR / upload softcopy / input hash
2. Sistem cari di database
3. Jika ketemu:
   - Check status (active/revoked/expired)
   - Softcopy tidak exact-match: SimHash Hamming distance (sim_hash_distance) = fuzzy path aktif.
     (SSDEEP dihapus di redesign 2026-06-28 — tidak ada native build di Alpine; ssdeep_similarity selalu NULL.
     Hardcopy/photo-of-paper verification juga dihapus di redesign yang sama.)
   - Jika ada blockchain: verify on-chain
4. Return hasil verifikasi
```

---

## 12. Trash Management

### trash_items
Soft delete dengan 30 hari retention.

```sql
CREATE TABLE trash_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Reference ke item yang dihapus
  item_type             TEXT NOT NULL,                 -- document, folder
  item_id               UUID NOT NULL,
  
  -- Original location (untuk restore)
  original_folder_id    UUID,
  original_path         TEXT,
  
  -- Snapshot metadata
  item_metadata         JSONB NOT NULL,
  
  -- Auto-delete (30 hari dari deleted_at)
  auto_delete_at        TIMESTAMP NOT NULL,
  
  deleted_by            UUID REFERENCES users(id) NOT NULL,
  deleted_at            TIMESTAMP DEFAULT NOW()
);
```

### Trash Flow:
```
1. User delete → pindah ke trash (soft delete)
2. 30 hari di trash
3. User bisa restore selama 30 hari
4. Setelah 30 hari → permanent delete via background job
5. Permanent delete = crypto shredding
```

---

## 13. Crypto Shredding

### crypto_shredding
**GDPR Article 17** - Right to Erasure implementation.

```sql
CREATE TABLE crypto_shredding (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) NOT NULL,
  
  -- Target
  target_type           TEXT NOT NULL,                 -- user, document, organization
  target_id             UUID NOT NULL,
  
  -- Keys yang dihapus
  kms_key_ids           JSONB NOT NULL,                -- Array of KMS key IDs
  
  -- Status
  status                TEXT DEFAULT 'pending',        -- pending, completed, failed
  
  -- Audit
  reason                TEXT NOT NULL,                 -- gdpr_request, user_request, retention_expired
  requested_by          UUID REFERENCES users(id),
  
  -- Affected count
  affected_documents    INTEGER DEFAULT 0,
  affected_versions     INTEGER DEFAULT 0,
  
  completed_at          TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### Crypto Shredding Process:
```
1. Identify semua encryption key IDs terkait
2. Request AWS KMS untuk schedule key deletion
3. Setelah key dihapus → semua data terenkripsi TIDAK BISA di-decrypt
4. Data tetap ada tapi tidak readable (sama dengan dihapus)
5. Ini comply dengan GDPR Art 17 karena data efektif "terhapus"
```

---

## 14. Templates

### templates
Template dokumen (sistem dan user-created).

```sql
CREATE TABLE templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  name                  TEXT NOT NULL,
  description           TEXT,
  category              TEXT,                          -- contract, invoice, letter, report
  
  -- Template file
  s3_key                TEXT,
  mime_type             TEXT,
  thumbnail_url         TEXT,
  
  -- Type
  is_system_template    BOOLEAN DEFAULT false,         -- Template bawaan sistem
  is_public             BOOLEAN DEFAULT false,
  
  -- Usage tracking
  usage_count           INTEGER DEFAULT 0,
  
  created_by            UUID REFERENCES users(id),
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 15. Forms

### forms
Form builder untuk input data.

```sql
CREATE TABLE forms (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  title                 TEXT NOT NULL,
  description           TEXT,
  icon                  TEXT DEFAULT 'document',       -- document, user, calendar, receipt, star, clipboard
  category              TEXT,                          -- hr, finance, legal, operations, general
  
  -- JSON Schema format
  schema                JSONB NOT NULL,
  ui_schema             JSONB,                         -- UI customization
  
  -- Settings
  is_public             BOOLEAN DEFAULT false,
  require_auth          BOOLEAN DEFAULT true,
  allow_anonymous       BOOLEAN DEFAULT false,
  
  -- Limits
  max_submissions       INTEGER,
  submission_count      INTEGER DEFAULT 0,
  
  -- Usage tracking
  usage_count           INTEGER DEFAULT 0,
  
  -- Linked template (generate document dari form)
  linked_template_id    UUID REFERENCES templates(id),
  
  created_by            UUID REFERENCES users(id) NOT NULL,
  is_active             BOOLEAN DEFAULT true,
  expires_at            TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

### form_submissions
Submission dari form (encrypted).

```sql
CREATE TABLE form_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id               UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
  
  -- Data (encrypted)
  encrypted_data        TEXT NOT NULL,
  data_hash             TEXT NOT NULL,
  
  -- Generated document
  generated_document_id UUID REFERENCES documents(id),
  
  -- Submitter
  submitted_by          UUID REFERENCES users(id),
  submitter_email       TEXT,
  ip_address            TEXT,
  
  status                TEXT DEFAULT 'submitted',      -- submitted, processed, rejected
  
  created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 16. Tasks

### tasks
Task management linked ke dokumen.

```sql
CREATE TABLE tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  title                 TEXT NOT NULL,
  description           TEXT,
  
  -- Task type (migration 0002)
  task_type             TEXT DEFAULT 'general',        -- general, fill, review, approve, sign
  
  -- Assignment
  assigned_to           UUID REFERENCES users(id),
  assigned_team         UUID REFERENCES teams(id),
  
  -- Related entities
  related_document_id   UUID REFERENCES documents(id),
  related_folder_id     UUID REFERENCES folders(id),
  related_form_id       UUID,                          -- migration 0002
  related_form_instance_id UUID,                       -- migration 0002
  
  -- Status & Priority
  status                task_status DEFAULT 'pending',
  priority              task_priority DEFAULT 'medium',
  
  -- Dates
  due_date              TIMESTAMP,
  completed_at          TIMESTAMP,
  
  -- Checklist
  checklist             JSONB,                         -- Array of checklist items
  
  created_by            UUID REFERENCES users(id) NOT NULL,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

### task_comments
Komentar di task.

```sql
CREATE TABLE task_comments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  
  content               TEXT NOT NULL,
  
  created_by            UUID REFERENCES users(id) NOT NULL,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 17. AI Chatbot

### chat_sessions
Session chat dengan AI.

```sql
CREATE TABLE chat_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  title                 TEXT,
  
  -- Context documents
  context_document_ids  JSONB,                         -- Dokumen yang di-analyze
  
  message_count         INTEGER DEFAULT 0,
  
  is_active             BOOLEAN DEFAULT true,
  last_message_at       TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### chat_messages
Pesan dalam chat session.

```sql
CREATE TABLE chat_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  
  role                  TEXT NOT NULL,                 -- user, assistant, system
  content               TEXT NOT NULL,
  
  metadata              JSONB,                         -- Tokens, model, etc.
  
  -- Document analysis
  analyzed_documents    JSONB,
  
  -- Vector DB reference
  qdrant_point_id       TEXT,                          -- Reference ke Qdrant
  
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### chat_cache
Cache untuk response yang sama.

```sql
CREATE TABLE chat_cache (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  query_hash            TEXT NOT NULL UNIQUE,          -- Hash dari query
  query                 TEXT NOT NULL,
  response              TEXT NOT NULL,
  
  organization_id       UUID REFERENCES organizations(id),
  document_ids          JSONB,
  
  hit_count             INTEGER DEFAULT 0,
  last_hit_at           TIMESTAMP,
  
  expires_at            TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 18. OSINT & Leak Checker

### leak_scans
Scan untuk deteksi kebocoran dokumen.

```sql
CREATE TABLE leak_scans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  document_id           UUID REFERENCES documents(id),
  
  scan_type             TEXT NOT NULL,                 -- manual, scheduled, honeytoken_triggered
  
  -- Search parameters
  search_queries        JSONB,
  sources_searched      JSONB,                         -- paste sites, forums, etc.
  
  -- Results
  leaks_found           INTEGER DEFAULT 0,
  status                TEXT DEFAULT 'pending',        -- pending, running, completed, failed
  
  started_at            TIMESTAMP,
  completed_at          TIMESTAMP,
  
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### leak_reports
Report kebocoran yang ditemukan.

```sql
CREATE TABLE leak_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id               UUID REFERENCES leak_scans(id) ON DELETE CASCADE NOT NULL,
  document_id           UUID REFERENCES documents(id),
  
  -- Source info
  source_url            TEXT,
  source_name           TEXT,
  source_type           TEXT,                          -- paste_site, forum, dark_web, public_web
  
  -- Match info
  match_type            TEXT,                          -- exact, partial, honeytoken
  match_confidence      INTEGER,                       -- Persentase
  
  -- Honeytoken trace
  honeytoken_id         UUID REFERENCES document_honeytokens(id),
  watermark_id          UUID REFERENCES document_watermarks(id),
  traced_to_user_id     UUID REFERENCES users(id),     -- LEAKER!
  
  -- Evidence
  evidence_snapshot     TEXT,
  evidence_s3_key       TEXT,
  
  discovered_at         TIMESTAMP DEFAULT NOW(),
  
  -- Response
  is_acknowledged       BOOLEAN DEFAULT false,
  acknowledged_by       UUID REFERENCES users(id),
  acknowledged_at       TIMESTAMP,
  
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### honeytoken_triggers
Ketika honeytoken terdeteksi di wild.

```sql
CREATE TABLE honeytoken_triggers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  honeytoken_id         UUID REFERENCES document_honeytokens(id) NOT NULL,
  document_id           UUID REFERENCES documents(id) NOT NULL,
  
  -- Trigger info
  trigger_source        TEXT,
  trigger_ip            TEXT,
  trigger_user_agent    TEXT,
  
  -- Decoded payload
  decoded_payload       JSONB,
  
  -- Investigation
  investigation_status  TEXT DEFAULT 'new',            -- new, investigating, confirmed, false_positive
  investigation_notes   TEXT,
  
  triggered_at          TIMESTAMP DEFAULT NOW(),
  created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 19. Temporary Uploads

### temporary_uploads
Temporary storage untuk upload processing.

```sql
CREATE TABLE temporary_uploads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_session_id     TEXT NOT NULL UNIQUE,
  user_id               UUID REFERENCES users(id) NOT NULL,
  organization_id       UUID REFERENCES organizations(id) NOT NULL,
  
  -- File info
  original_filename     TEXT NOT NULL,
  temp_file_path        TEXT NOT NULL,
  file_size             BIGINT NOT NULL,
  mime_type             TEXT,
  
  -- Processing status
  status                TEXT DEFAULT 'uploaded',       -- uploaded, scanning, processing, completed, failed, rejected
  
  -- Malware scan
  malware_scan_status   TEXT,                          -- pending, clean, infected
  malware_scan_result   JSONB,
  
  -- Processing progress
  processing_stage      TEXT,                          -- extraction, normalization, hashing, watermarking, honeytoken, qr, encryption
  processing_progress   INTEGER DEFAULT 0,             -- Persentase
  
  -- Result
  result_document_id    UUID REFERENCES documents(id),
  error_message         TEXT,
  
  -- Secure delete flag
  is_secure_deleted     BOOLEAN DEFAULT false,         -- File sudah di-overwrite dengan 0
  
  expires_at            TIMESTAMP NOT NULL,            -- Auto-delete jika tidak selesai
  created_at            TIMESTAMP DEFAULT NOW(),
  completed_at          TIMESTAMP
);
```

### Temp Upload Flow:
```
1. File masuk ke temp folder (isolated)
2. ClamAV scan untuk malware
3. Jika bersih: process (watermark, honeytoken, hash, encrypt)
4. Upload hasil ke S3
5. OVERWRITE temp file dengan 0 (secure delete)
6. Update is_secure_deleted = true
```

---

## 20. Audit & Security

### audit_logs
Complete audit trail untuk compliance.

```sql
CREATE TABLE audit_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id),
  user_id               UUID REFERENCES users(id),
  
  -- Action
  action                audit_action NOT NULL,
  resource_type         TEXT NOT NULL,                 -- document, folder, user, team, etc.
  resource_id           UUID,
  
  -- Details
  details               JSONB,
  previous_state        JSONB,                         -- State sebelum action
  new_state             JSONB,                         -- State setelah action
  
  -- Request info
  ip_address            TEXT,
  user_agent            TEXT,
  
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### security_events
Log event keamanan.

```sql
CREATE TABLE security_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id),
  user_id               UUID REFERENCES users(id),
  
  event_type            TEXT NOT NULL,                 -- malware_detected, unauthorized_access, brute_force, honeytoken_triggered
  severity              TEXT NOT NULL,                 -- low, medium, high, critical
  
  description           TEXT NOT NULL,
  details               JSONB,
  
  related_document_id   UUID REFERENCES documents(id),
  
  -- Response
  is_resolved           BOOLEAN DEFAULT false,
  resolved_by           UUID REFERENCES users(id),
  resolved_at           TIMESTAMP,
  resolution            TEXT,
  
  ip_address            TEXT,
  
  created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 21. Archive Jobs

### archive_jobs
Job untuk pindah ke AWS Glacier/Deep Archive.

```sql
CREATE TABLE archive_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) NOT NULL,
  
  job_type              TEXT NOT NULL,                 -- archive, restore, delete
  
  -- Target
  version_ids           JSONB NOT NULL,                -- Array of version IDs
  
  -- AWS Job Info
  aws_job_id            TEXT,
  glacier_vault_arn     TEXT,
  
  -- Status
  status                TEXT DEFAULT 'pending',        -- pending, processing, completed, failed
  
  -- Progress
  total_items           INTEGER DEFAULT 0,
  processed_items       INTEGER DEFAULT 0,
  
  error_message         TEXT,
  
  scheduled_at          TIMESTAMP,
  started_at            TIMESTAMP,
  completed_at          TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 22. Notifications

### notifications
In-app notifications.

```sql
CREATE TABLE notifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  type                  TEXT NOT NULL,                 -- task_assigned, document_shared, security_alert
  title                 TEXT NOT NULL,
  message               TEXT NOT NULL,
  
  -- Related entity
  related_type          TEXT,
  related_id            UUID,
  
  is_read               BOOLEAN DEFAULT false,
  read_at               TIMESTAMP,
  
  created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 23. Support Tickets

### support_tickets
Customer support tickets.

```sql
CREATE TABLE support_tickets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id),
  organization_id       UUID REFERENCES organizations(id),
  
  subject               TEXT NOT NULL,
  description           TEXT NOT NULL,
  category              TEXT,                          -- technical, billing, security, feature_request
  
  status                TEXT DEFAULT 'open',           -- open, in_progress, resolved, closed
  priority              TEXT DEFAULT 'medium',
  
  assigned_to           TEXT,                          -- Support staff email
  
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  resolved_at           TIMESTAMP
);
```

### support_messages
Messages dalam ticket.

```sql
CREATE TABLE support_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  
  sender_type           TEXT NOT NULL,                 -- user, support
  sender_id             UUID,
  
  message               TEXT NOT NULL,
  attachments           JSONB,
  
  created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 24. AI Analysis & AI Projects

DocLoq punya dua subsistem AI: **AI Analysis** (analisis satu dokumen, Q&A + chart) dan
**AI Projects** (workspace ala NotebookLM — multi-source, chat dengan citation). Keduanya
berbagi kuota organisasi (`ai_quotas`) dan pipeline OCR/ekstraksi (`extractText` + tesseract.js).

### ai_quotas
Kuota AI per organisasi, reset bulanan otomatis.

```sql
CREATE TABLE ai_quotas (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Batas bulanan
  monthly_analysis_limit   INTEGER DEFAULT 100,
  monthly_pages_limit      INTEGER DEFAULT 500,

  -- Pemakaian periode berjalan (reset bulanan)
  analysis_used_this_month INTEGER DEFAULT 0,
  pages_used_this_month    INTEGER DEFAULT 0,

  -- Periode tracking
  current_period_start     TIMESTAMP DEFAULT NOW(),
  current_period_end       TIMESTAMP,

  -- Statistik seumur hidup
  total_analyses_all_time  INTEGER DEFAULT 0,
  total_pages_all_time     INTEGER DEFAULT 0,
  total_tokens_all_time    INTEGER DEFAULT 0,

  created_at               TIMESTAMP DEFAULT NOW(),
  updated_at               TIMESTAMP DEFAULT NOW()
);
```

> Catatan AI Analysis: kontrol akses per-dokumen ada di tabel `documents`
> (`ai_access_granted`, `ai_access_granted_at`, `ai_access_granted_by`). Dokumen
> diblokir dari AI secara default sampai user memberi grant eksplisit.

### ai_projects
Workspace AI Project.

```sql
CREATE TABLE ai_projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  custom_instructions TEXT,                          -- addendum system prompt (maks 2000 char)
  -- Project-level DEK untuk generated outputs (migration 0021). Output berasal dari BANYAK
  -- source, jadi tidak ada single document DEK yang bisa diwarisi — artinya crypto-shred
  -- TIDAK menjangkau output; erasure eksplisit. Di-mint lazily saat generation pertama.
  content_key         TEXT,
  -- GDrive-style share link (migration 0022). Pembawa link tetap butuh akun DocLoq org yang sama.
  share_link_token    TEXT,
  share_link_enabled  BOOLEAN DEFAULT false,
  icon                TEXT DEFAULT 'sparkles',
  color               TEXT DEFAULT 'indigo',
  created_by          UUID REFERENCES users(id) NOT NULL,
  archived_at         TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);
```

### ai_project_sources
Sumber per project (polimorfik: dokumen | url | youtube). Ekstraksi teks/OCR berjalan
**asinkron** — baris dibuat `processing`, lalu jadi `active`/`failed`.

```sql
CREATE TABLE ai_project_sources (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID REFERENCES ai_projects(id) ON DELETE CASCADE NOT NULL,
  source_type        TEXT NOT NULL,                 -- 'document' | 'url' | 'youtube'
  document_id        UUID REFERENCES documents(id) ON DELETE CASCADE,
  source_url         TEXT,
  title              TEXT NOT NULL,
  -- LEGACY plaintext cache. Digantikan ai_source_chunks (migration 0019); di-null oleh backfill
  -- dan akan di-drop di migration lanjutan setelah semua deploy backfill.
  content_text       TEXT,
  content_hash       TEXT,
  -- Wrapped DEK untuk source tanpa dokumen sendiri (url). Source dokumen memakai DEK versi
  -- dokumennya, jadi crypto-shred meng-erase chunk-nya gratis.
  content_key        TEXT,
  -- Versi mana yang DEK-nya dipakai enkripsi chunk. Setiap versi punya DEK baru, jadi
  -- resolve "latest" akan gagal GCM auth begitu dokumen diedit. Null untuk source url
  -- (pakai content_key) dan baris legacy.
  content_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
  chunk_count        INTEGER DEFAULT 0,
  qdrant_point_id    TEXT,                          -- untuk source url/youtube
  status             TEXT DEFAULT 'active',         -- active | processing | failed | revoked
  error_message      TEXT,
  added_by           UUID REFERENCES users(id) NOT NULL,
  added_at           TIMESTAMP DEFAULT NOW()
);
-- Dedup unik per project: (project_id, document_id) dan (project_id, source_url)
```

**Status flow source dokumen** (async OCR):
```
add source → INSERT status='processing' (balik cepat ke user)
           → background: decrypt → extractText / OCR (scanned PDF + gambar)
           → sukses: status='active' + content_text
           → gagal:  status='failed' + error_message  (bisa di-retry)
```

### ai_project_chats
Riwayat chat per project. `citations` menyimpan referensi `[N]` ke source.

```sql
CREATE TABLE ai_project_chats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES ai_projects(id) ON DELETE CASCADE NOT NULL,
  role        TEXT NOT NULL,                        -- 'user' | 'assistant'
  content     TEXT NOT NULL,
  citations   JSONB DEFAULT '[]',                   -- [{ n, sourceId, title, quote, ... }]
  metadata    JSONB DEFAULT '{}',                   -- { model, promptTokens, completionTokens, latencyMs }
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### ai_project_notes
Catatan tersimpan (panel Studio), opsional terkait satu pesan chat.

```sql
CREATE TABLE ai_project_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID REFERENCES ai_projects(id) ON DELETE CASCADE NOT NULL,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  source_chat_id UUID REFERENCES ai_project_chats(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES users(id) NOT NULL,
  created_at     TIMESTAMP DEFAULT NOW()
);
```

### Batas (default, dapat di-override via env)
| Batas | Default | Env |
|-------|---------|-----|
| Source aktif per project | 10 | `AI_PROJECT_MAX_SOURCES` |
| Project per organisasi | 20 | `AI_PROJECT_MAX_PER_ORG` |
| Chat per project / 24 jam | 50 | `AI_PROJECT_CHAT_LIMIT_24H` |

---

## Tables Added Since Initial Schema

Bagian ini mendokumentasikan tabel yang ditambahkan setelah schema awal (migration 0000).
Section 1–24 di atas adalah base schema; di bawah ini dikelompokkan per subsistem. Lihat
daftar **Migrations** di bawah untuk kronologi.

### Identity & Org

#### company_profiles
Branding/identity tenant (terpisah dari `organizations` — 1:1 per org). Migration 0010.

```sql
CREATE TABLE company_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,

  display_name      TEXT,
  description       TEXT,
  industry          VARCHAR(100),
  founded_year      INTEGER,
  employee_count    VARCHAR(20),

  contact_email     TEXT,
  phone             VARCHAR(20),
  website           TEXT,

  address           TEXT,
  city              VARCHAR(100),
  province          VARCHAR(100),
  postal_code       VARCHAR(10),
  country           VARCHAR(100) DEFAULT 'Indonesia',

  logo_url          TEXT,
  cover_url         TEXT,
  primary_color     VARCHAR(7),
  tax_id            VARCHAR(50),

  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

#### departments
Departemen dalam organisasi; direferensikan `users.department_id`. Migration 0004/0005.

```sql
CREATE TABLE departments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,

  name              TEXT NOT NULL,
  description       TEXT,
  color             VARCHAR(7),

  created_by        UUID,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, name)
);
```

### RBAC (Custom Roles)

Subsistem role kustom per-organisasi untuk akses folder/dokumen (migration 0006 role_management),
terpisah dari enum `user_role` tenant.

#### custom_roles
```sql
CREATE TABLE custom_roles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,

  name              TEXT NOT NULL,
  description       TEXT,
  color             VARCHAR(20) DEFAULT 'indigo',

  is_active         BOOLEAN DEFAULT true,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, name)
);
```

#### role_permissions
Folder/dokumen mana yang bisa diakses sebuah role.
```sql
CREATE TABLE role_permissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id           UUID REFERENCES custom_roles(id) ON DELETE CASCADE NOT NULL,

  resource_type     TEXT NOT NULL,                 -- 'folder' | 'document'
  resource_id       UUID NOT NULL,
  permission_level  TEXT NOT NULL DEFAULT 'none',  -- 'none' | 'viewer' | 'editor' | 'admin'

  created_at        TIMESTAMP DEFAULT NOW(),

  UNIQUE(role_id, resource_type, resource_id)
);
```

#### user_role_assignments
User mana yang di-assign ke custom role mana.
```sql
CREATE TABLE user_role_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role_id           UUID REFERENCES custom_roles(id) ON DELETE CASCADE NOT NULL,

  assigned_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at       TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, role_id)
);
```

### Documents & Collaboration

#### document_comments
Komentar dokumen (threaded via self-ref, dengan @mention). Migration 0011.
```sql
CREATE TABLE document_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  author_id         UUID REFERENCES users(id) NOT NULL,
  content           TEXT NOT NULL,
  mentions          JSONB DEFAULT '[]',            -- array of userId
  parent_comment_id UUID,                          -- self-ref (thread)
  edited_at         TIMESTAMP,
  deleted_at        TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW()
);
```

#### document_presence
Presence ephemeral — siapa yang sedang view/edit dokumen (heartbeat). Migration 0011.
```sql
CREATE TABLE document_presence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  mode              TEXT NOT NULL,                 -- 'view' | 'edit'
  last_heartbeat_at TIMESTAMP DEFAULT NOW() NOT NULL,

  UNIQUE(document_id, user_id)
);
```

#### document_signatures
Integrasi tanda tangan digital DocuSeal. Migration 0005.
```sql
CREATE TABLE document_signatures (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,

  task_id               UUID REFERENCES tasks(id) ON DELETE SET NULL,
  document_id           UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  form_instance_id      UUID,

  -- DocuSeal IDs
  docuseal_submission_id INTEGER,
  docuseal_template_id   INTEGER,
  docuseal_submitter_id  INTEGER,
  docuseal_slug          VARCHAR(100),

  -- Signer
  signer_user_id        UUID REFERENCES users(id),
  signer_email          TEXT NOT NULL,
  signer_name           TEXT,
  signer_role           TEXT DEFAULT 'First Party',

  status                TEXT DEFAULT 'pending',    -- pending, sent, opened, completed, declined, expired

  sent_at               TIMESTAMP,
  opened_at             TIMESTAMP,
  completed_at          TIMESTAMP,
  declined_at           TIMESTAMP,
  decline_reason        TEXT,

  signed_document_url   TEXT,
  signed_document_path  TEXT,
  audit_log_url         TEXT,
  embed_src             TEXT,

  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

#### download_watermarks
Watermark unik per-event download untuk identifikasi kebocoran (siapa men-download). Migration 0006.
```sql
CREATE TABLE download_watermarks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  version_id        UUID REFERENCES document_versions(id) ON DELETE CASCADE NOT NULL,

  downloaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,

  watermark_id      TEXT NOT NULL UNIQUE,          -- ID unik per download
  watermark_token   TEXT NOT NULL,                 -- SHA-256(positions+payload)
  watermark_positions JSONB,                       -- Array of injection positions
  payload_hash      TEXT NOT NULL,                 -- SHA-256 of full payload
  payload           JSONB NOT NULL,                -- {w, d, u, t}

  document_format   TEXT,                          -- pdf, docx, txt
  watermark_method  TEXT DEFAULT 'unicode_invisible',
  visible_code      TEXT,                          -- OSINT canary code yang di-stamp (null jika tidak ada)

  ip_address        TEXT,
  user_agent        TEXT,

  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMP DEFAULT NOW()
);
```

### Crypto (Post-Quantum)

#### pqc_keypairs
Keypair hybrid post-quantum per-organisasi (Feature 2, migration 0018). Public key disimpan
terbuka; private key di-wrap (Vault/master key) at rest. `document_versions.pqc_keypair_id`
menunjuk keypair yang dipakai wrap tiap DEK.
```sql
CREATE TABLE pqc_keypairs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID REFERENCES organizations(id) NOT NULL,
  kem_public_key         TEXT NOT NULL,            -- ML-KEM-768 public (NOT secret)
  kem_private_key_wrapped TEXT NOT NULL,           -- ML-KEM-768 private, wrapped
  x25519_public          TEXT NOT NULL,            -- X25519 public (NOT secret)
  x25519_private_wrapped TEXT NOT NULL,            -- X25519 private, wrapped
  is_active              BOOLEAN DEFAULT true,
  created_at             TIMESTAMP DEFAULT NOW()
);
```

### Forms (Workflow)

#### form_instances
Instance form dari template dengan workflow. Migration 0003 (+ start_date). Status enum `form_instance_status`.
```sql
CREATE TABLE form_instances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  form_id               UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,

  name                  TEXT NOT NULL,
  status                form_instance_status DEFAULT 'draft',

  start_date            TIMESTAMP,
  due_date              TIMESTAMP,
  completed_at          TIMESTAMP,

  generated_document_id UUID REFERENCES documents(id),  -- saat workflow selesai

  created_by            UUID REFERENCES users(id) NOT NULL,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

#### form_workflow_steps
Step terurut untuk sebuah form instance. Migration 0002. Enum `workflow_action` + `workflow_step_status`.
```sql
CREATE TABLE form_workflow_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_instance_id  UUID REFERENCES form_instances(id) ON DELETE CASCADE NOT NULL,

  step_order        INTEGER NOT NULL,
  action            workflow_action NOT NULL,          -- fill | review | approve | sign

  assigned_to       UUID REFERENCES users(id) NOT NULL,

  status            workflow_step_status DEFAULT 'pending',  -- pending | in_progress | completed | skipped
  completed_at      TIMESTAMP,
  notes             TEXT,

  task_id           UUID REFERENCES tasks(id),         -- auto-linked task

  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

### Audit Hash Chain

Tamper-evident audit (Feature 1, migration 0016). Melengkapi kolom `sequence_number` /
`prev_hash` / `entry_hash` di `audit_logs`.

#### audit_chain_head
Chain head per-org — target append cepat + baris yang di-lock (`SELECT ... FOR UPDATE`) untuk
serialize append konkuren dalam satu organisasi. **PK = organization_id.**
```sql
CREATE TABLE audit_chain_head (
  organization_id   UUID PRIMARY KEY REFERENCES organizations(id),
  last_seq          BIGINT NOT NULL DEFAULT 0,
  last_hash         TEXT NOT NULL DEFAULT '0000...00', -- 64 hex zeros (genesis)
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

#### audit_chain_anchors
Satu baris per Merkle root yang di-anchor on-chain (mencakup entri `from_seq..to_seq`).
Mendeteksi rewrite full-history yang tidak bisa dideteksi hash-chaining saja.
```sql
CREATE TABLE audit_chain_anchors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id),
  from_seq          BIGINT NOT NULL,
  to_seq            BIGINT NOT NULL,
  entry_count       INTEGER NOT NULL,
  root_hash         TEXT NOT NULL,
  blockchain_tx_hash TEXT,
  block_number      BIGINT,
  status            TEXT DEFAULT 'pending',        -- pending, confirmed, failed
  anchored_at       TIMESTAMP DEFAULT NOW()
);
```

### AI Projects (Encrypted Store & Provenance)

#### ai_source_chunks
Store chunk terenkripsi (menggantikan `ai_project_sources.content_text`). Migration 0019.
`cipher_text` = AES-256-GCM di bawah DEK versi dokumen (atau `content_key` source untuk source url),
IV fresh per chunk. `char_len` = panjang plaintext agar context builder bisa budget tanpa decrypt.
```sql
CREATE TABLE ai_source_chunks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         UUID REFERENCES ai_project_sources(id) ON DELETE CASCADE NOT NULL,
  document_id       UUID REFERENCES documents(id) ON DELETE CASCADE,  -- denormalized (erasure-by-doc satu query)
  chunk_index       INTEGER NOT NULL,
  page              INTEGER,
  cipher_text       TEXT NOT NULL,                 -- AES-256-GCM
  iv                TEXT NOT NULL,                 -- fresh per chunk
  auth_tag          TEXT NOT NULL,
  char_len          INTEGER NOT NULL,              -- panjang plaintext
  qdrant_point_id   UUID,
  created_at        TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, chunk_index)
);
```

#### ai_project_outputs
Studio outputs generated (summary/faq/timeline/datatable/mindmap/slides). Migration 0021.
`cipher_text` menampung SELURUH payload (content + citations) AES-256-GCM di bawah **project DEK**
(`ai_projects.content_key`). Keyed ke PROJECT, jadi crypto-shred dokumen TIDAK membuatnya unreadable —
erasure eksplisit.
```sql
CREATE TABLE ai_project_outputs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES ai_projects(id) ON DELETE CASCADE NOT NULL,
  kind              TEXT NOT NULL,                 -- summary|faq|timeline|datatable|mindmap|slides
  title             TEXT NOT NULL,
  cipher_text       TEXT,                          -- null setelah di-erase (baris jadi tombstone)
  iv                TEXT,
  auth_tag          TEXT,
  char_len          INTEGER DEFAULT 0,
  source_ids        JSONB DEFAULT '[]',            -- source yang memberi makan output ini (drive erasure/staleness)
  model             TEXT,
  prompt_tokens     INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  status            TEXT DEFAULT 'generating',     -- generating|ready|failed|revoked
  error_message     TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

#### ai_project_members
Member project yang di-share (migration 0022). Creator implisit (`ai_projects.created_by`),
bukan baris di sini. Member accepted dapat full edit; hanya creator yang bisa delete project.
```sql
CREATE TABLE ai_project_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES ai_projects(id) ON DELETE CASCADE NOT NULL,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status            TEXT DEFAULT 'pending',        -- 'pending' | 'accepted' | 'declined'
  source            TEXT DEFAULT 'invite',         -- 'invite' | 'link'
  invited_by        UUID REFERENCES users(id),
  invited_at        TIMESTAMP DEFAULT NOW(),
  responded_at      TIMESTAMP,

  UNIQUE(project_id, user_id)
);
```

#### ai_provenance
Receipt provenance untuk satu jawaban/output AI (migration 0022). Tamper-evidence ada di audit chain;
tabel ini meng-index subject ke entry chain + fingerprint untuk re-verify. **Menyimpan hash saja —
tidak pernah konten source.**
```sql
CREATE TABLE ai_provenance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  project_id          UUID REFERENCES ai_projects(id) ON DELETE CASCADE NOT NULL,
  subject_type        TEXT NOT NULL,               -- 'chat' | 'output'
  subject_id          UUID NOT NULL,
  answer_hash         TEXT NOT NULL,
  prompt_hash         TEXT NOT NULL,
  source_fingerprints JSONB DEFAULT '[]',
  model               TEXT,
  redaction_modes     JSONB DEFAULT '{}',
  audit_log_id        UUID,
  entry_hash          TEXT NOT NULL,               -- receipt id yang ditampilkan ke user

  created_at          TIMESTAMP DEFAULT NOW(),

  UNIQUE(subject_type, subject_id)
);
```

### Admin Platform (Migration 0001)

Subsistem admin DocLoq — terpisah dari user/organisasi tenant. Enum `admin_role`.

#### admin_users
```sql
CREATE TABLE admin_users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  first_name        TEXT,
  last_name         TEXT,
  avatar_url        TEXT,
  role              admin_role DEFAULT 'admin',    -- super_admin | admin | support
  is_active         BOOLEAN DEFAULT true,
  last_login_at     TIMESTAMP,
  last_login_ip     TEXT,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until      TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

#### admin_sessions
```sql
CREATE TABLE admin_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id          UUID REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
  token             TEXT NOT NULL UNIQUE,
  refresh_token     TEXT,
  user_agent        TEXT,
  ip_address        TEXT,
  expires_at        TIMESTAMP NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW()
);
```

#### api_request_logs
Tracking request API (user/org di-SET NULL saat dihapus agar log bertahan).
```sql
CREATE TABLE api_request_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint          TEXT NOT NULL,
  method            TEXT NOT NULL,
  status_code       INTEGER,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ip_address        TEXT,
  user_agent        TEXT,
  request_duration  INTEGER,                       -- milliseconds
  created_at        TIMESTAMP DEFAULT NOW()
);
```

#### payment_history
```sql
CREATE TABLE payment_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  amount            INTEGER NOT NULL,              -- cents/smallest unit
  currency          VARCHAR(3) DEFAULT 'IDR',
  payment_method    TEXT,                          -- credit_card, bank_transfer, etc.
  payment_provider  TEXT,                          -- stripe, midtrans, etc.
  transaction_id    TEXT,
  status            TEXT DEFAULT 'pending',        -- pending, completed, failed, refunded
  description       TEXT,
  metadata          JSONB DEFAULT '{}',
  paid_at           TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

#### system_settings
Config platform key/value.
```sql
CREATE TABLE system_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key               TEXT NOT NULL UNIQUE,
  value             JSONB,
  description       TEXT,
  updated_by        UUID REFERENCES admin_users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

#### admin_audit_logs
Audit trail aksi admin (terpisah dari `audit_logs` tenant).
```sql
CREATE TABLE admin_audit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id          UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action            TEXT NOT NULL,                 -- user_created, user_suspended, settings_changed, etc.
  target_type       TEXT,                          -- user, organization, document, setting, etc.
  target_id         UUID,
  details           JSONB DEFAULT '{}',
  ip_address        TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);
```

---

## Compliance Summary

### GDPR Compliance:
| Article | Implementation |
|---------|----------------|
| Art. 17 (Right to Erasure) | Crypto Shredding - hapus encryption keys |
| Art. 25 (Data Protection by Design) | AES-256 encryption, AWS KMS |
| Art. 30 (Records of Processing) | Audit Logs |
| Art. 32 (Security) | Encryption at rest & transit, 2FA |
| Art. 33 (Breach Notification) | Security Events table |

### UU PDP Indonesia Compliance:
| Requirement | Implementation |
|-------------|----------------|
| Data Localization | AWS ap-southeast-3 (Jakarta) |
| Consent Management | User consent fields |
| Data Retention | Configurable per organization |
| Encryption | AES-256 + AWS KMS |

---

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│Organizations│───1:N─│   Users     │───1:N─│  Sessions   │
└─────────────┘       └─────────────┘       └─────────────┘
      │                     │
      │                     │
      ├───1:N───┐          ├───N:M───┐
      │         │          │         │
      ▼         ▼          ▼         ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────────┐
│ Folders │ │  Teams  │ │Team     │ │Folder/Doc     │
└─────────┘ └─────────┘ │Members  │ │Permissions    │
      │                 └─────────┘ └───────────────┘
      │
      ├───1:N───────────────┐
      │                     │
      ▼                     ▼
┌─────────────┐       ┌─────────────┐
│  Documents  │───1:N─│  Versions   │
└─────────────┘       └─────────────┘
      │                     │
      ├───1:N───┬───────────┤
      │         │           │
      ▼         ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│Watermarks│ │Honeytokens│ │QR Codes │
└──────────┘ └──────────┘ └──────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │Blockchain    │
                    │Anchors       │
                    └──────────────┘
```

---

## Index Strategy

Semua foreign keys dan kolom yang sering di-query sudah memiliki index:
- UUID primary keys
- Foreign key references
- Email (unique)
- Organization lookups
- Document status & hash
- Audit log timestamps

---

## Migration Commands

```bash
# Generate migration
npm run db:generate

# Run migration
npm run db:migrate

# Open Drizzle Studio (GUI)
npx drizzle-kit studio
```

---

## Migrations

Kronologi migration Drizzle (`backend/src/db/migrations`). Ringkasan satu baris per migration:

| # | Ringkasan |
|---|-----------|
| 0000 | Initial schema (9 enum + 40 tabel base) |
| 0001 | Admin subsystem (admin_users, admin_sessions, api_request_logs, payment_history, system_settings, admin_audit_logs) |
| 0002 | Form workflow (form_workflow_steps) + kolom form/task (tasks.task_type, related_form_id, related_form_instance_id) |
| 0003 | `form_instances.start_date` |
| 0004 | departments + kolom user (phone/position/department_id) + `user_sessions.last_activity_at` |
| 0005 | departments variant + document_signatures |
| 0006 | ai_quotas / custom_roles / role_permissions / user_role_assignments / download_watermarks + kolom `documents.ai_access_*` (dua file 0006: fresh_forgotten_one + role_management hand-written) |
| 0007 | Kolom blockchain di documents (blockchain_anchored, blockchain_anchor_id, auto_anchor_on_edit) |
| 0008 | `users.google_id` |
| 0009 | `organizations.company_code` |
| 0010 | company_profiles |
| 0011 | OnlyOffice edit-lock (documents.edit_lock_*) + document_comments + document_presence |
| 0012 | ai_projects / ai_project_sources / ai_project_chats / ai_project_notes |
| 0013 | Collapse enum `user_role` → owner / admin / user |
| 0014 | Kolom OSINT tracking (documents.tracking_enabled, tracking_code) |
| 0015 | `documents.qr_on_download` |
| 0016 | Audit hash chain (kolom di audit_logs + audit_chain_head + audit_chain_anchors) |
| 0017 | Feature flag rename tracking → osint (data migration) |
| 0018 | PQC hybrid wrap (kolom document_versions.key_wrap_version/pqc_keypair_id/pqc_envelope + pqc_keypairs) |
| 0019 | ai_source_chunks + kolom ai_project_sources (content_key, chunk_count, content_version_id) |
| 0020 | Drop NOT NULL pada kolom encryption document_versions (mengaktifkan crypto-shred) |
| 0021 | ai_project_outputs + `ai_projects.content_key` |
| 0022 | Tier-3 provenance/sharing (documents.ai_redaction_mode + ai_projects.share_link_* + ai_project_members + ai_provenance) |

---

## Next Steps

1. **Seed Data**: Buat seed file untuk data awal (admin user, system templates)
2. **API Endpoints**: Implementasi CRUD untuk setiap entity
3. **Background Jobs**: Cron jobs untuk trash cleanup, archiving, leak scanning
4. **AWS Integration**: Setup S3, KMS, Glacier
5. **Blockchain**: Setup smart contract untuk anchoring
