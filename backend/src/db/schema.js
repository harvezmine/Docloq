import {
  pgTable, 
  serial, 
  text, 
  timestamp, 
  boolean, 
  uuid, 
  integer, 
  jsonb, 
  varchar,
  bigint,
  index,
  uniqueIndex,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'user']);
export const permissionTypeEnum = pgEnum('permission_type', ['read', 'read_edit', 'full_access']);
export const documentStatusEnum = pgEnum('document_status', ['active', 'archived', 'revoked', 'expired', 'deleted']);
export const verificationStatusEnum = pgEnum('verification_status', ['pending', 'verified', 'failed', 'revoked', 'expired']);
export const taskStatusEnum = pgEnum('task_status', ['pending', 'in_progress', 'completed', 'cancelled']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);
export const auditActionEnum = pgEnum('audit_action', ['create', 'read', 'update', 'delete', 'download', 'share', 'verify', 'restore', 'archive']);
export const shareTypeEnum = pgEnum('share_type', ['view_only', 'can_edit']);
export const archiveStatusEnum = pgEnum('archive_status', ['active', 'glacier', 'deep_archive', 'deleted']);
export const formInstanceStatusEnum = pgEnum('form_instance_status', ['draft', 'active', 'completed', 'cancelled']);
export const workflowActionEnum = pgEnum('workflow_action', ['fill', 'review', 'approve', 'sign']);
export const workflowStepStatusEnum = pgEnum('workflow_step_status', ['pending', 'in_progress', 'completed', 'skipped']);

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  
  subscriptionTier: text('subscription_tier').default('basic'), // basic, professional, enterprise
  hasBlockchainFeature: boolean('has_blockchain_feature').default(false),
  
  awsRegion: text('aws_region').default('ap-southeast-3'), // Jakarta — UU PDP compliance
  s3Bucket: text('s3_bucket'),
  kmsKeyArn: text('kms_key_arn'), // Reference ke AWS KMS, bukan key-nya sendiri
  
  dataRetentionDays: integer('data_retention_days').default(2555), // ~7 tahun default
  archiveAfterDays: integer('archive_after_days').default(365), // Pindah ke deep archive setelah 1 tahun
  gdprCompliant: boolean('gdpr_compliant').default(true),
  pdpCompliant: boolean('pdp_compliant').default(true), // UU PDP Indonesia
  
  settings: jsonb('settings').default({}),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  companyCode: varchar('company_code', { length: 8 }).notNull().unique(),
}, (table) => ({
  slugIdx: uniqueIndex('org_slug_idx').on(table.slug),
  companyCodeIdx: uniqueIndex('org_company_code_idx').on(table.companyCode),
}));

// Company Profiles (tenant branding/identity — separate from organizations)
export const companyProfiles = pgTable('company_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull().unique(),

  displayName: text('display_name'),
  description: text('description'),
  industry: varchar('industry', { length: 100 }),
  foundedYear: integer('founded_year'),
  employeeCount: varchar('employee_count', { length: 20 }),

  contactEmail: text('contact_email'),
  phone: varchar('phone', { length: 20 }),
  website: text('website'),

  address: text('address'),
  city: varchar('city', { length: 100 }),
  province: varchar('province', { length: 100 }),
  postalCode: varchar('postal_code', { length: 10 }),
  country: varchar('country', { length: 100 }).default('Indonesia'),

  logoUrl: text('logo_url'),
  coverUrl: text('cover_url'),
  primaryColor: varchar('primary_color', { length: 7 }),
  taxId: varchar('tax_id', { length: 50 }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('cp_org_idx').on(table.organizationId),
}));

// AI Quotas (per-organization usage limits)
export const aiQuotas = pgTable('ai_quotas', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),

  monthlyAnalysisLimit: integer('monthly_analysis_limit').default(100),
  monthlyPagesLimit: integer('monthly_pages_limit').default(500),

  // Current usage (reset monthly)
  analysisUsedThisMonth: integer('analysis_used_this_month').default(0),
  pagesUsedThisMonth: integer('pages_used_this_month').default(0),

  currentPeriodStart: timestamp('current_period_start').defaultNow(),
  currentPeriodEnd: timestamp('current_period_end'),

  totalAnalysesAllTime: integer('total_analyses_all_time').default(0),
  totalPagesAllTime: integer('total_pages_all_time').default(0),
  totalTokensAllTime: integer('total_tokens_all_time').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: uniqueIndex('ai_quota_org_idx').on(table.organizationId),
}));

export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  
  name: text('name').notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }),
  
  createdBy: uuid('created_by'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('dept_org_idx').on(table.organizationId),
  orgNameIdx: uniqueIndex('dept_org_name_idx').on(table.organizationId, table.name),
}));


export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),

  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  googleId: text('google_id').unique(),
  
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  position: text('position'),
  
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
  
  role: userRoleEnum('role').default('user'),
  isActive: boolean('is_active').default(true),
  isEmailVerified: boolean('is_email_verified').default(false),
  
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorSecret: text('two_factor_secret'),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip'),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('user_email_idx').on(table.email),
  orgIdx: index('user_org_idx').on(table.organizationId),
}));


export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  token: text('token').notNull().unique(),
  refreshToken: text('refresh_token'),
  
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  
  lastActivityAt: timestamp('last_activity_at').defaultNow(), // Idle timeout tracking
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex('session_token_idx').on(table.token),
  userIdx: index('session_user_idx').on(table.userId),
}));


export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});


export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Teams & Role-Based Access Control
export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  
  name: text('name').notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }), // Hex color untuk UI
  
  createdBy: uuid('created_by').references(() => users.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('team_org_idx').on(table.organizationId),
}));


export const teamMembers = pgTable('team_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  isTeamLead: boolean('is_team_lead').default(false),
  
  addedBy: uuid('added_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  teamUserIdx: uniqueIndex('team_user_unique_idx').on(table.teamId, table.userId),
}));

// FOLDERS & HIERARCHY
export const folders = pgTable('folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  
  name: text('name').notNull(),
  parentId: uuid('parent_id'), // Self-reference untuk hierarchy
  path: text('path').notNull(), // Materialized path: /root/subfolder1/subfolder2
  depth: integer('depth').default(0),
  
  // Ordering untuk drag & drop
  sortOrder: integer('sort_order').default(0),
  
  // Metadata
  color: varchar('color', { length: 7 }),
  icon: text('icon'),
  description: text('description'),
  
  createdBy: uuid('created_by').references(() => users.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('folder_org_idx').on(table.organizationId),
  parentIdx: index('folder_parent_idx').on(table.parentId),
  pathIdx: index('folder_path_idx').on(table.path),
}));


export const folderTags = pgTable('folder_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'cascade' }).notNull(),
  
  tag: text('tag').notNull(), // confidential, finance, legal, hr, custom, etc.
  color: varchar('color', { length: 7 }),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  folderTagIdx: uniqueIndex('folder_tag_unique_idx').on(table.folderId, table.tag),
}));

// PERMISSIONS (Folder & File Level)
export const folderPermissions = pgTable('folder_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'cascade' }).notNull(),
  
  // Permission bisa untuk team atau individual user
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  
  permissionType: permissionTypeEnum('permission_type').notNull(),
  
  // Inherit ke subfolder?
  inheritToSubfolders: boolean('inherit_to_subfolders').default(true),
  
  grantedBy: uuid('granted_by').references(() => users.id),
  expiresAt: timestamp('expires_at'), // Optional: temporary permission
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  folderIdx: index('folder_perm_folder_idx').on(table.folderId),
  teamIdx: index('folder_perm_team_idx').on(table.teamId),
  userIdx: index('folder_perm_user_idx').on(table.userId),
}));

// DOCUMENTS & VERSIONING
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  
  // Basic Info
  filename: text('filename').notNull(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(), // Dalam bytes
  
  // Current Version Reference
  currentVersionId: uuid('current_version_id'), // Reference ke document_versions
  versionCount: integer('version_count').default(1),
  
  // Status
  status: documentStatusEnum('status').default('active'),
  
  // Ownership & Access
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  isPublic: boolean('is_public').default(false),
  
  // Document DNA (untuk duplicate detection)
  contentHash: text('content_hash'), // SHA-256 dari normalized content
  ssdeepHash: text('ssdeep_hash'), // Fuzzy hash
  simHash: text('sim_hash'), // SimHash untuk similarity
  
  // Expiration
  expiresAt: timestamp('expires_at'),

  // AI Analysis Access Control
  // 'censored' | 'full', chosen by the user at grant time. Applied at INGEST, before
  // embedding — embeddings go to OpenAI, so redacting only the prompt would be a lie.
  aiRedactionMode: text('ai_redaction_mode'),
  aiAccessGranted: boolean('ai_access_granted').default(false),
  aiAccessGrantedAt: timestamp('ai_access_granted_at'),
  aiAccessGrantedBy: uuid('ai_access_granted_by').references(() => users.id),

  // Blockchain Anchoring
  blockchainAnchored: boolean('blockchain_anchored').default(false),
  blockchainAnchorId: uuid('blockchain_anchor_id'),
  autoAnchorOnEdit: boolean('auto_anchor_on_edit').default(false),

  // OSINT Document Tracking
  trackingEnabled: boolean('tracking_enabled').default(false),
  trackingCode: text('tracking_code'), // stable per-doc discovery code (docCode), null until enabled

  // QR on download — embed the verification QR onto downloaded copies (PDF/DOCX)
  qrOnDownload: boolean('qr_on_download').default(false),

  // Soft delete
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by').references(() => users.id),

  // OnlyOffice edit lock (2-hour absolute, single editor at a time)
  editLockedBy: uuid('edit_locked_by').references(() => users.id, { onDelete: 'set null' }),
  editLockAcquiredAt: timestamp('edit_lock_acquired_at'),
  editLockExpiresAt: timestamp('edit_lock_expires_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('doc_org_idx').on(table.organizationId),
  folderIdx: index('doc_folder_idx').on(table.folderId),
  ownerIdx: index('doc_owner_idx').on(table.ownerId),
  hashIdx: index('doc_hash_idx').on(table.contentHash),
  statusIdx: index('doc_status_idx').on(table.status),
  lockExpiresIdx: index('doc_lock_expires_idx').on(table.editLockExpiresAt),
}));


export const documentVersions = pgTable('document_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  
  versionNumber: integer('version_number').notNull(),
  
  // Storage Info (AWS S3)
  s3Key: text('s3_key').notNull(), // Path di S3
  s3Bucket: text('s3_bucket').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  
  // Encryption (AES-256). Nullable because nulling these IS the crypto-shred primitive
  // (GDPR Art. 17) — a destroyed key is legitimately absent. Readers fail closed on NULL:
  // unwrapVersionKey() throws, decryptDocument() guards. Populated for every live version.
  encryptionKeyId: text('encryption_key_id'), // wrapped DEK (v1) / 'pqc_v2_hybrid' sentinel (v2)
  encryptionIv: text('encryption_iv'), // IV untuk dekripsi
  encryptionSalt: text('encryption_salt'), // Salt untuk key derivation

  // Post-quantum hybrid key-wrap (Feature 2). v1_vault = existing envelope (DEK in
  // encryptionKeyId); v2_hybrid_pqc = DEK wrapped by X25519+ML-KEM-768 (envelope in
  // pqcEnvelope, keypair in pqcKeypairId; encryptionKeyId holds a sentinel).
  keyWrapVersion: text('key_wrap_version').notNull().default('v1_vault'),
  pqcKeypairId: uuid('pqc_keypair_id'),
  pqcEnvelope: jsonb('pqc_envelope'), // { mlkemCiphertext, x25519EphemeralPublic, wrapSalt, wrappedDek, wrapIv, wrapTag }
  
  // Hashing
  sha256Hash: text('sha256_hash').notNull(), // Hash sebelum enkripsi
  bodyHash: text('body_hash'), // Hash dari body content saja (tanpa metadata)
  
  // Archive Status (untuk GDPR compliance)
  archiveStatus: archiveStatusEnum('archive_status').default('active'),
  archivedAt: timestamp('archived_at'),
  archiveJobId: text('archive_job_id'), // Reference ke AWS Glacier job
  
  // Tracking
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  changeNote: text('change_note'), // Catatan perubahan
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  docVersionIdx: uniqueIndex('doc_version_unique_idx').on(table.documentId, table.versionNumber),
  s3KeyIdx: index('doc_version_s3_idx').on(table.s3Key),
  archiveIdx: index('doc_version_archive_idx').on(table.archiveStatus),
}));

// Per-org hybrid post-quantum keypair (Feature 2). Public keys stored openly; private
// keys wrapped (Vault/master key) at rest. One active keypair per org is enough for the
// PoC; documentVersions.pqcKeypairId points at the keypair used to wrap each DEK.
export const pqcKeypairs = pgTable('pqc_keypairs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  kemPublicKey: text('kem_public_key').notNull(),            // ML-KEM-768 public (NOT secret)
  kemPrivateKeyWrapped: text('kem_private_key_wrapped').notNull(),  // ML-KEM-768 private, wrapped
  x25519Public: text('x25519_public').notNull(),            // X25519 public (NOT secret)
  x25519PrivateWrapped: text('x25519_private_wrapped').notNull(),   // X25519 private, wrapped
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgActiveIdx: index('pqc_keypair_org_idx').on(table.organizationId, table.isActive),
}));


// Document-level comments (threaded, with @mention support)
export const documentComments = pgTable('document_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  authorId: uuid('author_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  mentions: jsonb('mentions').default([]), // array of userId
  parentCommentId: uuid('parent_comment_id'), // self-ref, see relations below
  editedAt: timestamp('edited_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  docIdx: index('doc_comment_doc_idx').on(table.documentId),
  parentIdx: index('doc_comment_parent_idx').on(table.parentCommentId),
}));

// Ephemeral presence (who is viewing/editing a document right now)
export const documentPresence = pgTable('document_presence', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mode: text('mode').notNull(), // 'view' | 'edit'
  lastHeartbeatAt: timestamp('last_heartbeat_at').defaultNow().notNull(),
}, (table) => ({
  docUserUnique: uniqueIndex('doc_presence_unique_idx').on(table.documentId, table.userId),
  heartbeatIdx: index('doc_presence_heartbeat_idx').on(table.documentId, table.lastHeartbeatAt),
}));


// File-level permissions (override folder permissions)
export const documentPermissions = pgTable('document_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  
  permissionType: permissionTypeEnum('permission_type').notNull(),
  
  grantedBy: uuid('granted_by').references(() => users.id),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  docIdx: index('doc_perm_doc_idx').on(table.documentId),
}));

// WATERMARKS & HONEYTOKENS (Anti-leak tracking)
export const documentWatermarks = pgTable('document_watermarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  versionId: uuid('version_id').references(() => documentVersions.id, { onDelete: 'cascade' }).notNull(),
  
  // Watermark type: steganography (invisible image watermark)
  watermarkType: text('watermark_type').default('lsb_steganography'),
  
  // Encrypted payload info (tidak simpan payload asli di DB)
  payloadHash: text('payload_hash').notNull(), // Hash dari payload untuk validasi
  embeddingPositions: jsonb('embedding_positions'), // Posisi embedding di image
  redundancyLevel: integer('redundancy_level').default(3), // 3-5x redundancy
  
  // Target images
  imageCount: integer('image_count').default(0),
  imageDetails: jsonb('image_details'), // Info gambar yang di-watermark
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  docIdx: index('watermark_doc_idx').on(table.documentId),
}));


export const documentHoneytokens = pgTable('document_honeytokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  versionId: uuid('version_id').references(() => documentVersions.id, { onDelete: 'cascade' }).notNull(),
  
  // Multiple honeytoken methods
  zwcToken: text('zwc_token'), // Zero-Width Character encoded token
  zwcPositions: jsonb('zwc_positions'), // Posisi ZWC di dokumen
  
  homoglyphToken: text('homoglyph_token'), // Homoglyph substitution token
  homoglyphPositions: jsonb('homoglyph_positions'),
  
  whitespaceToken: text('whitespace_token'), // Whitespace encoding token
  whitespacePositions: jsonb('whitespace_positions'),
  
  // Combined payload hash untuk validasi
  combinedPayloadHash: text('combined_payload_hash').notNull(),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  docIdx: index('honeytoken_doc_idx').on(table.documentId),
}));

// DOWNLOAD WATERMARKS (Per-Download Leak Identification)
export const downloadWatermarks = pgTable('download_watermarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  versionId: uuid('version_id').references(() => documentVersions.id, { onDelete: 'cascade' }).notNull(),

  // Who downloaded
  downloadedBy: uuid('downloaded_by').references(() => users.id, { onDelete: 'set null' }),

  // Unique watermark identifier per download event
  watermarkId: text('watermark_id').notNull().unique(),

  // Watermark encoding details
  watermarkToken: text('watermark_token').notNull(),      // SHA-256(positions+payload)
  watermarkPositions: jsonb('watermark_positions'),        // Array of injection positions
  payloadHash: text('payload_hash').notNull(),             // SHA-256 of full payload
  payload: jsonb('payload').notNull(),                     // {w, d, u, t}

  // Format and method info
  documentFormat: text('document_format'),                 // pdf, docx, txt
  watermarkMethod: text('watermark_method').default('unicode_invisible'),

  // Visible OSINT canary code stamped on this download (null if none)
  visibleCode: text('visible_code'),

  // Download context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  docIdx: index('dl_watermark_doc_idx').on(table.documentId),
  userIdx: index('dl_watermark_user_idx').on(table.downloadedBy),
  wmIdIdx: uniqueIndex('dl_watermark_wm_id_idx').on(table.watermarkId),
  payloadHashIdx: index('dl_watermark_payload_hash_idx').on(table.payloadHash),
}));

// QR CODE (Document Verification)
export const documentQrCodes = pgTable('document_qr_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  // SET NULL (not cascade): QR row survives document purge to act as audit trail.
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
  versionId: uuid('version_id').references(() => documentVersions.id, { onDelete: 'set null' }),

  // QR Payload (signed)
  payloadHash: text('payload_hash').notNull(), // Hash dari payload
  signatureHash: text('signature_hash').notNull(), // HMAC-SHA256 signature

  // Verification URL
  verificationUrl: text('verification_url').notNull(),
  shortCode: varchar('short_code', { length: 20 }).notNull().unique(), // Short code untuk URL

  // QR Image
  qrImageS3Key: text('qr_image_s3_key'),

  // Blockchain proof (jika ada)
  hasBlockchainProof: boolean('has_blockchain_proof').default(false),

  scanCount: integer('scan_count').default(0),
  lastScannedAt: timestamp('last_scanned_at'),

  // Lifecycle status: active | superseded | revoked | purged
  status: text('status').default('active'),
  supersededByQrId: uuid('superseded_by_qr_id'), // self-ref to replacement QR (newer version)
  supersededAt: timestamp('superseded_at'),
  purgedAt: timestamp('purged_at'),

  // Snapshots taken at issue time — survive document deletion for audit display
  documentVersionNumber: integer('document_version_number'),
  contentHashSnapshot: text('content_hash_snapshot'), // documents.contentHash when QR issued
  docNameSnapshot: text('doc_name_snapshot'), // originalFilename when QR issued

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  docIdx: index('qr_doc_idx').on(table.documentId),
  shortCodeIdx: uniqueIndex('qr_short_code_idx').on(table.shortCode),
  statusIdx: index('qr_status_idx').on(table.status),
}));

// BLOCKCHAIN ANCHORING (Pseudonymized)
export const blockchainAnchors = pgTable('blockchain_anchors', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  versionId: uuid('version_id').references(() => documentVersions.id, { onDelete: 'cascade' }).notNull(),
  
  // Blockchain Info
  blockchainNetwork: text('blockchain_network').default('polygon'), // polygon, ethereum, etc.
  transactionHash: text('transaction_hash').notNull().unique(),
  blockNumber: bigint('block_number', { mode: 'number' }),
  blockTimestamp: timestamp('block_timestamp'),
  
  // Pseudonymized data yang di-anchor (TIDAK ada PII)
  anchoredHash: text('anchored_hash').notNull(), // Hash dari dokumen
  pseudonymizedOrgId: text('pseudonymized_org_id').notNull(), // Pseudonymized org identifier
  
  // Merkle proof (jika batch anchoring)
  merkleRoot: text('merkle_root'),
  merkleProof: jsonb('merkle_proof'),
  
  // Status
  status: text('status').default('pending'), // pending, confirmed, failed
  confirmations: integer('confirmations').default(0),
  
  // Gas info
  gasUsed: bigint('gas_used', { mode: 'number' }),
  gasCost: text('gas_cost'),
  
  createdAt: timestamp('created_at').defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
}, (table) => ({
  txHashIdx: uniqueIndex('bc_tx_hash_idx').on(table.transactionHash),
  docIdx: index('bc_doc_idx').on(table.documentId),
}));

// DOCUMENT SHARING
export const documentShares = pgTable('document_shares', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  
  shareType: shareTypeEnum('share_type').notNull(),
  shareToken: text('share_token').notNull().unique(),
  shareUrl: text('share_url').notNull(),
  
  // Share restrictions
  allowedEmails: jsonb('allowed_emails'), // Array of allowed emails (same company)
  requireAuth: boolean('require_auth').default(true),
  
  // Limits
  maxViews: integer('max_views'),
  viewCount: integer('view_count').default(0),
  
  // Expiration
  expiresAt: timestamp('expires_at'),
  
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex('share_token_idx').on(table.shareToken),
  docIdx: index('share_doc_idx').on(table.documentId),
}));


export const documentShareAccess = pgTable('document_share_access', {
  id: uuid('id').defaultRandom().primaryKey(),
  shareId: uuid('share_id').references(() => documentShares.id, { onDelete: 'cascade' }).notNull(),
  
  accessedBy: uuid('accessed_by').references(() => users.id),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  accessedAt: timestamp('accessed_at').defaultNow(),
});

// DOCUMENT VERIFICATION
export const verificationRequests = pgTable('verification_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Input method
  // Active values: qr_scan, upload_softcopy, manual_hash.
  // 'upload_hardcopy' is LEGACY — hardcopy verification (photo-of-paper SimHash)
  // was removed in the 2026-06-28 verification redesign. Kept in the value list
  // only for historical rows; no code writes it anymore.
  inputMethod: text('input_method').notNull(),
  
  // Input data
  inputHash: text('input_hash'),
  inputQrCode: text('input_qr_code'),
  uploadedFileS3Key: text('uploaded_file_s3_key'),
  
  // Result
  status: verificationStatusEnum('status').default('pending'),
  // SET NULL (not cascade/restrict): verification request is an audit record that must
  // survive permanent deletion of the document/version it referenced.
  matchedDocumentId: uuid('matched_document_id').references(() => documents.id, { onDelete: 'set null' }),
  matchedVersionId: uuid('matched_version_id').references(() => documentVersions.id, { onDelete: 'set null' }),
  
  // Fuzzy comparison results.
  // LEGACY: isHardcopyScan always false now — hardcopy (photo-of-paper) verification
  // was removed (2026-06-28 redesign). Column retained to preserve historical rows.
  isHardcopyScan: boolean('is_hardcopy_scan').default(false),
  // PLACEHOLDER: ssdeep has no native build in the Alpine runtime — always NULL.
  // SimHash (simHashDistance) is the active fuzzy algorithm.
  ssdeepSimilarity: integer('ssdeep_similarity'), // % — unused placeholder, always null
  simHashDistance: integer('sim_hash_distance'), // Hamming distance (active fuzzy metric)
  
  // Chunk analysis (untuk medium similarity)
  chunkAnalysis: jsonb('chunk_analysis'),
  differingChunks: jsonb('differing_chunks'),
  
  // Blockchain verification
  blockchainVerified: boolean('blockchain_verified'),
  blockchainAnchorId: uuid('blockchain_anchor_id').references(() => blockchainAnchors.id, { onDelete: 'set null' }),
  
  // Requester info
  requestedBy: uuid('requested_by').references(() => users.id),
  ipAddress: text('ip_address'),
  
  // Result message
  resultMessage: text('result_message'),
  resultDetails: jsonb('result_details'),
  
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusIdx: index('verify_status_idx').on(table.status),
}));

// TRASH (Soft Delete dengan 30 hari retention)
export const trashItems = pgTable('trash_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  
  // Reference to deleted item
  itemType: text('item_type').notNull(), // document, folder
  itemId: uuid('item_id').notNull(),
  
  // Original location untuk restore
  originalFolderId: uuid('original_folder_id'),
  originalPath: text('original_path'),
  
  // Metadata snapshot
  itemMetadata: jsonb('item_metadata').notNull(),
  
  // Auto-delete date (30 hari dari deleted_at)
  autoDeleteAt: timestamp('auto_delete_at').notNull(),
  
  deletedBy: uuid('deleted_by').references(() => users.id).notNull(),
  deletedAt: timestamp('deleted_at').defaultNow(),
}, (table) => ({
  orgIdx: index('trash_org_idx').on(table.organizationId),
  autoDeleteIdx: index('trash_auto_delete_idx').on(table.autoDeleteAt),
}));

// CRYPTO SHREDDING (GDPR Art 17 Compliance)
export const cryptoShredding = pgTable('crypto_shredding', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  
  // Target
  targetType: text('target_type').notNull(), // user, document, organization
  targetId: uuid('target_id').notNull(),
  
  // Keys yang dihapus
  kmsKeyIds: jsonb('kms_key_ids').notNull(), // Array of KMS key IDs yang dihapus
  
  // Status
  status: text('status').default('pending'), // pending, completed, failed
  
  // Audit info
  reason: text('reason').notNull(), // gdpr_request, user_request, etc.
  requestedBy: uuid('requested_by').references(() => users.id),
  
  // Affected items count
  affectedDocuments: integer('affected_documents').default(0),
  affectedVersions: integer('affected_versions').default(0),
  
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  statusIdx: index('shred_status_idx').on(table.status),
}));

// TEMPLATES
export const templates = pgTable('templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'), // contract, invoice, letter, report, etc.
  
  // Template file
  s3Key: text('s3_key'),
  mimeType: text('mime_type'),
  thumbnailUrl: text('thumbnail_url'),
  
  // Template type
  isSystemTemplate: boolean('is_system_template').default(false),
  isPublic: boolean('is_public').default(false),
  
  // Usage tracking
  usageCount: integer('usage_count').default(0),
  
  createdBy: uuid('created_by').references(() => users.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('template_org_idx').on(table.organizationId),
  categoryIdx: index('template_category_idx').on(table.category),
}));

// FORMS
export const forms = pgTable('forms', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  
  title: text('title').notNull(),
  description: text('description'),
  icon: text('icon').default('document'), // document, user, calendar, receipt, star, clipboard
  category: text('category'), // hr, finance, legal, operations, general
  
  // Form schema (JSON Schema format)
  schema: jsonb('schema').notNull(),
  uiSchema: jsonb('ui_schema'), // UI customization
  
  // Settings
  isPublic: boolean('is_public').default(false),
  requireAuth: boolean('require_auth').default(true),
  allowAnonymous: boolean('allow_anonymous').default(false),
  
  // Limits
  maxSubmissions: integer('max_submissions'),
  submissionCount: integer('submission_count').default(0),
  
  // Usage tracking
  usageCount: integer('usage_count').default(0),
  
  // Linked template (optional - generate document from form)
  linkedTemplateId: uuid('linked_template_id').references(() => templates.id),
  
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('form_org_idx').on(table.organizationId),
  categoryIdx: index('form_category_idx').on(table.category),
}));


export const formSubmissions = pgTable('form_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  formId: uuid('form_id').references(() => forms.id, { onDelete: 'cascade' }).notNull(),
  
  // Submission data (encrypted)
  encryptedData: text('encrypted_data').notNull(),
  dataHash: text('data_hash').notNull(),
  
  // Generated document (if linked template)
  generatedDocumentId: uuid('generated_document_id').references(() => documents.id),
  
  // Submitter info
  submittedBy: uuid('submitted_by').references(() => users.id),
  submitterEmail: text('submitter_email'),
  ipAddress: text('ip_address'),
  
  status: text('status').default('submitted'), // submitted, processed, rejected
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  formIdx: index('submission_form_idx').on(table.formId),
}));

// FORM INSTANCES (created from form templates with workflow)
export const formInstances = pgTable('form_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  formId: uuid('form_id').references(() => forms.id, { onDelete: 'cascade' }).notNull(),
  
  name: text('name').notNull(),
  status: formInstanceStatusEnum('status').default('draft'),
  
  // Dates
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  
  // Generated document (when workflow completes)
  generatedDocumentId: uuid('generated_document_id').references(() => documents.id),
  
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('form_instance_org_idx').on(table.organizationId),
  formIdx: index('form_instance_form_idx').on(table.formId),
  statusIdx: index('form_instance_status_idx').on(table.status),
}));

// FORM WORKFLOW STEPS (ordered steps for form instances)
export const formWorkflowSteps = pgTable('form_workflow_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  formInstanceId: uuid('form_instance_id').references(() => formInstances.id, { onDelete: 'cascade' }).notNull(),
  
  stepOrder: integer('step_order').notNull(),
  action: workflowActionEnum('action').notNull(),
  
  // Assignment
  assignedTo: uuid('assigned_to').references(() => users.id).notNull(),
  
  // Status
  status: workflowStepStatusEnum('status').default('pending'),
  completedAt: timestamp('completed_at'),
  notes: text('notes'),
  
  // Auto-linked task
  taskId: uuid('task_id').references(() => tasks.id),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  instanceIdx: index('workflow_step_instance_idx').on(table.formInstanceId),
  assigneeIdx: index('workflow_step_assignee_idx').on(table.assignedTo),
}));

// TASKS
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  
  title: text('title').notNull(),
  description: text('description'),
  
  // Task type
  taskType: text('task_type').default('general'), // general, fill, review, approve, sign
  
  // Assignment
  assignedTo: uuid('assigned_to').references(() => users.id),
  assignedTeam: uuid('assigned_team').references(() => teams.id),
  
  // Related entities
  relatedDocumentId: uuid('related_document_id').references(() => documents.id),
  relatedFolderId: uuid('related_folder_id').references(() => folders.id),
  relatedFormId: uuid('related_form_id'),
  relatedFormInstanceId: uuid('related_form_instance_id'),
  
  // Status & Priority
  status: taskStatusEnum('status').default('pending'),
  priority: taskPriorityEnum('priority').default('medium'),
  
  // Dates
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  
  // Checklist
  checklist: jsonb('checklist'), // Array of checklist items
  
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('task_org_idx').on(table.organizationId),
  assigneeIdx: index('task_assignee_idx').on(table.assignedTo),
  statusIdx: index('task_status_idx').on(table.status),
}));


export const taskComments = pgTable('task_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  
  content: text('content').notNull(),
  
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// DOCUMENT SIGNATURES (DocuSeal Integration)
export const documentSignatures = pgTable('document_signatures', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),

  // Relasi ke entities DocLoq
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  formInstanceId: uuid('form_instance_id'),

  // DocuSeal IDs
  docusealSubmissionId: integer('docuseal_submission_id'),
  docusealTemplateId: integer('docuseal_template_id'),
  docusealSubmitterId: integer('docuseal_submitter_id'),
  docusealSlug: varchar('docuseal_slug', { length: 100 }),

  // Signer Info
  signerUserId: uuid('signer_user_id').references(() => users.id),
  signerEmail: text('signer_email').notNull(),
  signerName: text('signer_name'),
  signerRole: text('signer_role').default('First Party'),

  // Status: pending, sent, opened, completed, declined, expired
  status: text('status').default('pending'),

  // DocuSeal Timestamps
  sentAt: timestamp('sent_at'),
  openedAt: timestamp('opened_at'),
  completedAt: timestamp('completed_at'),
  declinedAt: timestamp('declined_at'),
  declineReason: text('decline_reason'),

  // Signed Document
  signedDocumentUrl: text('signed_document_url'),
  signedDocumentPath: text('signed_document_path'),
  auditLogUrl: text('audit_log_url'),

  // Embed
  embedSrc: text('embed_src'),

  metadata: jsonb('metadata').default({}),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('doc_sig_org_idx').on(table.organizationId),
  taskIdx: index('doc_sig_task_idx').on(table.taskId),
  docIdx: index('doc_sig_doc_idx').on(table.documentId),
  statusIdx: index('doc_sig_status_idx').on(table.status),
}));

// AI CHATBOT
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  
  title: text('title'),
  
  // Context documents
  contextDocumentIds: jsonb('context_document_ids'), // Array of document IDs
  
  messageCount: integer('message_count').default(0),
  
  isActive: boolean('is_active').default(true),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdx: index('chat_user_idx').on(table.userId),
}));


export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }).notNull(),
  
  role: text('role').notNull(), // user, assistant, system
  content: text('content').notNull(),
  
  // Metadata
  metadata: jsonb('metadata'), // Tokens used, model, etc.
  
  // Document analysis result
  analyzedDocuments: jsonb('analyzed_documents'), // Documents yang dianalisis
  
  // Embedding reference (stored in Qdrant)
  qdrantPointId: text('qdrant_point_id'),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  sessionIdx: index('message_session_idx').on(table.sessionId),
}));


export const chatCache = pgTable('chat_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  queryHash: text('query_hash').notNull().unique(), // Hash dari query untuk caching
  query: text('query').notNull(),
  response: text('response').notNull(),
  
  // Context
  organizationId: uuid('organization_id').references(() => organizations.id),
  documentIds: jsonb('document_ids'),
  
  hitCount: integer('hit_count').default(0),
  lastHitAt: timestamp('last_hit_at'),
  
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  hashIdx: uniqueIndex('cache_hash_idx').on(table.queryHash),
}));

// OSINT / LEAK CHECKER
export const leakScans = pgTable('leak_scans', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  documentId: uuid('document_id').references(() => documents.id),
  
  scanType: text('scan_type').notNull(), // manual, scheduled, honeytoken_triggered
  
  // Search parameters
  searchQueries: jsonb('search_queries'), // Keywords, hashes searched
  sourcesSearched: jsonb('sources_searched'), // paste sites, forums, etc.
  
  // Results
  leaksFound: integer('leaks_found').default(0),
  status: text('status').default('pending'), // pending, running, completed, failed
  
  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgIdx: index('leak_scan_org_idx').on(table.organizationId),
}));


export const leakReports = pgTable('leak_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  scanId: uuid('scan_id').references(() => leakScans.id, { onDelete: 'cascade' }).notNull(),
  documentId: uuid('document_id').references(() => documents.id),
  
  // Leak source info
  sourceUrl: text('source_url'),
  sourceName: text('source_name'),
  sourceType: text('source_type'), // paste_site, forum, dark_web, public_web
  
  // Match info
  matchType: text('match_type'), // exact, partial, honeytoken
  matchConfidence: integer('match_confidence'), // Persentase
  
  // Honeytoken trace (jika ada)
  honeytokenId: uuid('honeytoken_id').references(() => documentHoneytokens.id),
  watermarkId: uuid('watermark_id').references(() => documentWatermarks.id),
  tracedToUserId: uuid('traced_to_user_id').references(() => users.id), // Leaker
  
  // Evidence
  evidenceSnapshot: text('evidence_snapshot'), // Screenshot/content snapshot
  evidenceS3Key: text('evidence_s3_key'),
  
  // Discovery time
  discoveredAt: timestamp('discovered_at').defaultNow(),
  
  // Response
  isAcknowledged: boolean('is_acknowledged').default(false),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  scanIdx: index('leak_report_scan_idx').on(table.scanId),
  docIdx: index('leak_report_doc_idx').on(table.documentId),
}));


export const honeytokenTriggers = pgTable('honeytoken_triggers', {
  id: uuid('id').defaultRandom().primaryKey(),
  honeytokenId: uuid('honeytoken_id').references(() => documentHoneytokens.id).notNull(),
  documentId: uuid('document_id').references(() => documents.id).notNull(),
  
  // Trigger info
  triggerSource: text('trigger_source'), // URL dimana ditemukan
  triggerIp: text('trigger_ip'),
  triggerUserAgent: text('trigger_user_agent'),
  
  // Decoded payload
  decodedPayload: jsonb('decoded_payload'),
  
  // Investigation
  investigationStatus: text('investigation_status').default('new'), // new, investigating, confirmed, false_positive
  investigationNotes: text('investigation_notes'),
  
  triggeredAt: timestamp('triggered_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  honeytokenIdx: index('trigger_honeytoken_idx').on(table.honeytokenId),
}));

// TEMPORARY UPLOAD (Malware Scan)
export const temporaryUploads = pgTable('temporary_uploads', {
  id: uuid('id').defaultRandom().primaryKey(),
  uploadSessionId: text('upload_session_id').notNull().unique(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  
  // File info
  originalFilename: text('original_filename').notNull(),
  tempFilePath: text('temp_file_path').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: text('mime_type'),
  
  // Processing status
  status: text('status').default('uploaded'), // uploaded, scanning, processing, completed, failed, rejected
  
  // Malware scan
  malwareScanStatus: text('malware_scan_status'), // pending, clean, infected
  malwareScanResult: jsonb('malware_scan_result'),
  
  // Processing progress
  processingStage: text('processing_stage'), // extraction, normalization, hashing, watermarking, honeytoken, qr, encryption
  processingProgress: integer('processing_progress').default(0), // Persentase
  
  // Result
  resultDocumentId: uuid('result_document_id').references(() => documents.id),
  errorMessage: text('error_message'),
  
  // Temp file akan di-overwrite dengan 0 setelah selesai
  isSecureDeleted: boolean('is_secure_deleted').default(false),
  
  expiresAt: timestamp('expires_at').notNull(), // Auto-delete jika tidak selesai
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  sessionIdx: uniqueIndex('temp_upload_session_idx').on(table.uploadSessionId),
  statusIdx: index('temp_upload_status_idx').on(table.status),
}));

// AUDIT LOGS & SECURITY
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  userId: uuid('user_id').references(() => users.id),
  
  // Action
  action: auditActionEnum('action').notNull(),
  resourceType: text('resource_type').notNull(), // document, folder, user, team, etc.
  resourceId: uuid('resource_id'),
  
  // Details
  details: jsonb('details'),
  previousState: jsonb('previous_state'),
  newState: jsonb('new_state'),
  
  // Request info
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at').defaultNow(),

  // Tamper-evident hash chain (Feature 1). NULL for pre-cutover rows; the verifier
  // starts the chain at the first row with a non-null sequenceNumber.
  //   entryHash = SHA-256( canonicalSerialization(entry) + prevHash )   — see audit.service.js
  sequenceNumber: bigint('sequence_number', { mode: 'number' }), // monotonic per organizationId, from 1
  prevHash: text('prev_hash'),                                   // entryHash of previous entry in this org's chain
  entryHash: text('entry_hash'),                                 // this entry's hash
}, (table) => ({
  orgIdx: index('audit_org_idx').on(table.organizationId),
  userIdx: index('audit_user_idx').on(table.userId),
  actionIdx: index('audit_action_idx').on(table.action),
  createdAtIdx: index('audit_created_idx').on(table.createdAt),
  orgSeqUq: uniqueIndex('audit_org_seq_uq').on(table.organizationId, table.sequenceNumber),
}));

// Per-org chain head — fast append target + the row locked (SELECT ... FOR UPDATE)
// to serialize concurrent appends within an organization. See appendAuditEntry().
export const auditChainHead = pgTable('audit_chain_head', {
  organizationId: uuid('organization_id').primaryKey().references(() => organizations.id),
  lastSeq: bigint('last_seq', { mode: 'number' }).notNull().default(0),
  lastHash: text('last_hash').notNull().default('0000000000000000000000000000000000000000000000000000000000000000'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// One row per Merkle root anchored on-chain (covers audit entries fromSeq..toSeq).
// Lets verify-anchors detect a full-history rewrite that hash-chaining alone cannot.
export const auditChainAnchors = pgTable('audit_chain_anchors', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  fromSeq: bigint('from_seq', { mode: 'number' }).notNull(),
  toSeq: bigint('to_seq', { mode: 'number' }).notNull(),
  entryCount: integer('entry_count').notNull(),
  rootHash: text('root_hash').notNull(),
  blockchainTxHash: text('blockchain_tx_hash'),
  blockNumber: bigint('block_number', { mode: 'number' }),
  status: text('status').default('pending'), // pending, confirmed, failed
  anchoredAt: timestamp('anchored_at').defaultNow(),
}, (table) => ({
  orgToSeqIdx: index('audit_anchor_org_idx').on(table.organizationId, table.toSeq),
}));


export const securityEvents = pgTable('security_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  userId: uuid('user_id').references(() => users.id),
  
  eventType: text('event_type').notNull(), // malware_detected, unauthorized_access, brute_force, honeytoken_triggered, etc.
  severity: text('severity').notNull(), // low, medium, high, critical
  
  description: text('description').notNull(),
  details: jsonb('details'),
  
  // Related entities
  relatedDocumentId: uuid('related_document_id').references(() => documents.id),
  
  // Response
  isResolved: boolean('is_resolved').default(false),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  resolution: text('resolution'),
  
  ipAddress: text('ip_address'),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  severityIdx: index('security_severity_idx').on(table.severity),
  eventTypeIdx: index('security_event_type_idx').on(table.eventType),
}));

// ARCHIVE JOBS (AWS Glacier/Deep Archive)
export const archiveJobs = pgTable('archive_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  
  jobType: text('job_type').notNull(), // archive, restore, delete
  
  // Target
  versionIds: jsonb('version_ids').notNull(), // Array of version IDs
  
  // AWS Job Info
  awsJobId: text('aws_job_id'),
  glacierVaultArn: text('glacier_vault_arn'),
  
  // Status
  status: text('status').default('pending'), // pending, processing, completed, failed
  
  // Progress
  totalItems: integer('total_items').default(0),
  processedItems: integer('processed_items').default(0),
  
  errorMessage: text('error_message'),
  
  scheduledAt: timestamp('scheduled_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  statusIdx: index('archive_job_status_idx').on(table.status),
}));

// NOTIFICATIONS
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  type: text('type').notNull(), // task_assigned, document_shared, security_alert, etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  
  // Related entity
  relatedType: text('related_type'), // document, task, etc.
  relatedId: uuid('related_id'),
  
  // Status
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdx: index('notif_user_idx').on(table.userId),
  isReadIdx: index('notif_read_idx').on(table.isRead),
}));

// CONTACT/SUPPORT
export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  organizationId: uuid('organization_id').references(() => organizations.id),
  
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  category: text('category'), // technical, billing, security, feature_request
  
  status: text('status').default('open'), // open, in_progress, resolved, closed
  priority: text('priority').default('medium'),
  
  assignedTo: text('assigned_to'), // Support staff email
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
});


export const supportMessages = pgTable('support_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').references(() => supportTickets.id, { onDelete: 'cascade' }).notNull(),
  
  senderType: text('sender_type').notNull(), // user, support
  senderId: uuid('sender_id'),
  
  message: text('message').notNull(),
  attachments: jsonb('attachments'), // Array of S3 keys
  
  createdAt: timestamp('created_at').defaultNow(),
});

// RELATIONS (Drizzle ORM Relations)
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  teams: many(teams),
  folders: many(folders),
  documents: many(documents),
}));


export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  sessions: many(userSessions),
  teamMemberships: many(teamMembers),
  ownedDocuments: many(documents),
  tasks: many(tasks),
  chatSessions: many(chatSessions),
  notifications: many(notifications),
}));


export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
  folderPermissions: many(folderPermissions),
  documentPermissions: many(documentPermissions),
}));


export const foldersRelations = relations(folders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [folders.organizationId],
    references: [organizations.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
  }),
  children: many(folders),
  documents: many(documents),
  tags: many(folderTags),
  permissions: many(folderPermissions),
}));


export const documentsRelations = relations(documents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [documents.organizationId],
    references: [organizations.id],
  }),
  folder: one(folders, {
    fields: [documents.folderId],
    references: [folders.id],
  }),
  owner: one(users, {
    fields: [documents.ownerId],
    references: [users.id],
  }),
  versions: many(documentVersions),
  watermarks: many(documentWatermarks),
  honeytokens: many(documentHoneytokens),
  qrCodes: many(documentQrCodes),
  blockchainAnchors: many(blockchainAnchors),
  shares: many(documentShares),
  permissions: many(documentPermissions),
}));


export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
  createdBy: one(users, {
    fields: [documentVersions.createdBy],
    references: [users.id],
  }),
}));


export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));


export const tasksRelations = relations(tasks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tasks.organizationId],
    references: [organizations.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [tasks.relatedDocumentId],
    references: [documents.id],
  }),
  comments: many(taskComments),
}));

export const formsRelations = relations(forms, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [forms.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [forms.createdBy],
    references: [users.id],
  }),
  linkedTemplate: one(templates, {
    fields: [forms.linkedTemplateId],
    references: [templates.id],
  }),
  instances: many(formInstances),
  submissions: many(formSubmissions),
}));

export const formInstancesRelations = relations(formInstances, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [formInstances.organizationId],
    references: [organizations.id],
  }),
  form: one(forms, {
    fields: [formInstances.formId],
    references: [forms.id],
  }),
  creator: one(users, {
    fields: [formInstances.createdBy],
    references: [users.id],
  }),
  workflowSteps: many(formWorkflowSteps),
}));

export const formWorkflowStepsRelations = relations(formWorkflowSteps, ({ one }) => ({
  formInstance: one(formInstances, {
    fields: [formWorkflowSteps.formInstanceId],
    references: [formInstances.id],
  }),
  assignee: one(users, {
    fields: [formWorkflowSteps.assignedTo],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [formWorkflowSteps.taskId],
    references: [tasks.id],
  }),
}));


// =======================================
// CUSTOM ROLES & PERMISSION MANAGEMENT
// =======================================

// Custom Roles (organization-level role management for document access)
export const customRoles = pgTable('custom_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  
  name: text('name').notNull(),
  description: text('description'),
  color: varchar('color', { length: 20 }).default('indigo'),
  
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('custom_role_org_idx').on(table.organizationId),
  orgNameIdx: uniqueIndex('custom_role_org_name_idx').on(table.organizationId, table.name),
}));

// Role Permissions: what folders/documents a role can access
export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  roleId: uuid('role_id').references(() => customRoles.id, { onDelete: 'cascade' }).notNull(),
  
  resourceType: text('resource_type').notNull(), // 'folder' or 'document'
  resourceId: uuid('resource_id').notNull(),
  permissionLevel: text('permission_level').notNull().default('none'), // 'none', 'viewer', 'editor', 'admin'
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  roleIdx: index('role_perm_role_idx').on(table.roleId),
  resourceIdx: index('role_perm_resource_idx').on(table.resourceType, table.resourceId),
  uniqueIdx: uniqueIndex('role_perm_unique_idx').on(table.roleId, table.resourceType, table.resourceId),
}));

// User-Role Assignments: which users are assigned to which custom roles
export const userRoleAssignments = pgTable('user_role_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => customRoles.id, { onDelete: 'cascade' }).notNull(),
  
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at').defaultNow(),
}, (table) => ({
  uniqueIdx: uniqueIndex('user_role_assign_unique_idx').on(table.userId, table.roleId),
  userIdx: index('user_role_assign_user_idx').on(table.userId),
  roleIdx: index('user_role_assign_role_idx').on(table.roleId),
}));

// Custom Roles Relations
export const customRolesRelations = relations(customRoles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [customRoles.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [customRoles.createdBy],
    references: [users.id],
  }),
  permissions: many(rolePermissions),
  assignments: many(userRoleAssignments),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(customRoles, {
    fields: [rolePermissions.roleId],
    references: [customRoles.id],
  }),
}));

export const userRoleAssignmentsRelations = relations(userRoleAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userRoleAssignments.userId],
    references: [users.id],
  }),
  role: one(customRoles, {
    fields: [userRoleAssignments.roleId],
    references: [customRoles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoleAssignments.assignedBy],
    references: [users.id],
  }),
}));

// =======================================
// ADMIN DOCLOQ TABLES
// =======================================

export const adminRoleEnum = pgEnum('admin_role', ['super_admin', 'admin', 'support']);

// Admin Users (separate from regular users)
export const adminUsers = pgTable('admin_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatarUrl: text('avatar_url'),
  
  role: adminRoleEnum('role').default('admin'),
  isActive: boolean('is_active').default(true),
  
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip'),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('admin_user_email_idx').on(table.email),
}));


// Admin Sessions
export const adminSessions = pgTable('admin_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  
  token: text('token').notNull().unique(),
  refreshToken: text('refresh_token'),
  
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex('admin_session_token_idx').on(table.token),
  adminIdx: index('admin_session_admin_idx').on(table.adminId),
}));


// API Request Logs (for tracking)
export const apiRequestLogs = pgTable('api_request_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  statusCode: integer('status_code'),
  
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  requestDuration: integer('request_duration'), // in milliseconds
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  endpointIdx: index('api_request_endpoint_idx').on(table.endpoint),
  userIdx: index('api_request_user_idx').on(table.userId),
  createdAtIdx: index('api_request_created_at_idx').on(table.createdAt),
}));


// Payment History (for admin dashboard)
export const paymentHistory = pgTable('payment_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  amount: integer('amount').notNull(), // in cents/smallest currency unit
  currency: varchar('currency', { length: 3 }).default('IDR'),
  
  paymentMethod: text('payment_method'), // credit_card, bank_transfer, etc.
  paymentProvider: text('payment_provider'), // stripe, midtrans, etc.
  transactionId: text('transaction_id'),
  
  status: text('status').default('pending'), // pending, completed, failed, refunded
  
  description: text('description'),
  metadata: jsonb('metadata').default({}),
  
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('payment_org_idx').on(table.organizationId),
  statusIdx: index('payment_status_idx').on(table.status),
  createdAtIdx: index('payment_created_at_idx').on(table.createdAt),
}));


// System Settings (for admin config)
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  key: text('key').notNull().unique(),
  value: jsonb('value'),
  description: text('description'),
  
  updatedBy: uuid('updated_by').references(() => adminUsers.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});


// Admin Audit Log
export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  adminId: uuid('admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  
  action: text('action').notNull(), // user_created, user_suspended, settings_changed, etc.
  targetType: text('target_type'), // user, organization, document, setting, etc.
  targetId: uuid('target_id'),
  
  details: jsonb('details').default({}),
  ipAddress: text('ip_address'),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  adminIdx: index('admin_audit_admin_idx').on(table.adminId),
  actionIdx: index('admin_audit_action_idx').on(table.action),
  createdAtIdx: index('admin_audit_created_at_idx').on(table.createdAt),
}));


// Admin Relations
export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
  auditLogs: many(adminAuditLogs),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  admin: one(adminUsers, {
    fields: [adminSessions.adminId],
    references: [adminUsers.id],
  }),
}));

export const paymentHistoryRelations = relations(paymentHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [paymentHistory.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [paymentHistory.userId],
    references: [users.id],
  }),
}));


// ============================================================
// AI PROJECTS (NotebookLM-style workspace)
// ============================================================

export const aiProjects = pgTable('ai_projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  customInstructions: text('custom_instructions'),
  // Project-level DEK for generated outputs. Outputs derive from MANY sources, so there is no
  // single document DEK to inherit — which means crypto-shred does NOT reach them and erasure
  // is explicit (see eraseOutputsForSource/Document). Minted lazily on first generation.
  contentKey: text('content_key'),
  // GDrive-style link. The bearer still needs a DocLoq account in the same org.
  shareLinkToken: text('share_link_token'),
  shareLinkEnabled: boolean('share_link_enabled').default(false),
  icon: text('icon').default('sparkles'),
  color: text('color').default('indigo'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('ai_proj_org_idx').on(table.organizationId),
  createdByIdx: index('ai_proj_created_by_idx').on(table.createdBy),
}));

export const aiProjectSources = pgTable('ai_project_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => aiProjects.id, { onDelete: 'cascade' }).notNull(),
  sourceType: text('source_type').notNull(), // 'document' | 'url' | 'youtube'
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
  sourceUrl: text('source_url'),
  title: text('title').notNull(),
  // Legacy plaintext cache. Superseded by ai_source_chunks; nulled by the backfill and
  // dropped in a follow-up migration once every deploy has backfilled.
  contentText: text('content_text'),
  contentHash: text('content_hash'),
  // Wrapped DEK for sources with no document of their own (url). Document sources reuse
  // the document version's DEK, so crypto-shred erases their chunks for free.
  contentKey: text('content_key'),
  // WHICH version's DEK the chunks were encrypted under. Every version gets a fresh DEK,
  // so resolving "latest" would fail GCM auth on every chunk the moment a document is
  // edited. Null for url sources (they use content_key) and for legacy rows.
  contentVersionId: uuid('content_version_id').references(() => documentVersions.id, { onDelete: 'set null' }),
  chunkCount: integer('chunk_count').default(0),
  qdrantPointId: text('qdrant_point_id'),
  status: text('status').default('active'), // 'active' | 'processing' | 'failed' | 'revoked'
  errorMessage: text('error_message'),
  addedBy: uuid('added_by').references(() => users.id).notNull(),
  addedAt: timestamp('added_at').defaultNow(),
}, (table) => ({
  projectIdx: index('ai_proj_src_project_idx').on(table.projectId),
  documentIdx: index('ai_proj_src_doc_idx').on(table.documentId),
}));

// Encrypted chunk store. cipher_text is AES-256-GCM under the document version's DEK (or the
// source's own content_key for url sources), with a FRESH IV per chunk — GCM IV reuse under
// one key breaks both confidentiality and authenticity, and all chunks of a document share
// that document's DEK.
// char_len is the plaintext length, so the context builder can budget without decrypting.
export const aiSourceChunks = pgTable('ai_source_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').references(() => aiProjectSources.id, { onDelete: 'cascade' }).notNull(),
  // Denormalized so erasure-by-document is one query with no join.
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  page: integer('page'),
  cipherText: text('cipher_text').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  charLen: integer('char_len').notNull(),
  qdrantPointId: uuid('qdrant_point_id'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  sourceIdx: index('ai_src_chunk_source_idx').on(table.sourceId, table.chunkIndex),
  docIdx: index('ai_src_chunk_doc_idx').on(table.documentId),
  sourceChunkUniq: uniqueIndex('ai_src_chunk_source_index_uniq').on(table.sourceId, table.chunkIndex),
}));

export const aiProjectChats = pgTable('ai_project_chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => aiProjects.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  citations: jsonb('citations').default([]),
  metadata: jsonb('metadata').default({}),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  projectIdx: index('ai_proj_chat_project_idx').on(table.projectId, table.createdAt),
  rateIdx: index('ai_proj_chat_rate_idx').on(table.projectId, table.role, table.createdAt),
}));

export const aiProjectNotes = pgTable('ai_project_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => aiProjects.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  sourceChatId: uuid('source_chat_id').references(() => aiProjectChats.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  projectIdx: index('ai_proj_note_project_idx').on(table.projectId),
}));

// Generated Studio outputs (summary / faq / timeline / datatable / mindmap / slides).
//
// cipher_text holds the ENTIRE payload — content AND citations — AES-256-GCM under the project
// DEK with a fresh IV. Citations embed `quote`, which is document text: a plain `citations
// jsonb` column would re-open exactly the plaintext hole Tier 0 closed, in a brand-new column.
// Outside the ciphertext lives only non-content metadata.
//
// Unlike ai_source_chunks these are keyed to the PROJECT, so crypto-shredding a document does
// NOT make them unreadable. Erasure is explicit application code.
export const aiProjectOutputs = pgTable('ai_project_outputs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => aiProjects.id, { onDelete: 'cascade' }).notNull(),
  kind: text('kind').notNull(), // 'summary'|'faq'|'timeline'|'datatable'|'mindmap'|'slides'
  title: text('title').notNull(),
  cipherText: text('cipher_text'), // null once erased — the row survives as a tombstone
  iv: text('iv'),
  authTag: text('auth_tag'),
  charLen: integer('char_len').default(0),
  // Image kinds (mindmap/infographic) store an encrypted PNG in R2 instead of a text payload.
  blobKey: text('blob_key'),
  blobIv: text('blob_iv'),
  blobAuthTag: text('blob_auth_tag'),
  blobMime: text('blob_mime'),
  // The user's pre-generate prompt from the customize popup. Not sensitive.
  instructions: text('instructions'),
  // Provenance: which sources actually fed this output. Drives erasure and the staleness flag.
  sourceIds: jsonb('source_ids').default([]),
  model: text('model'),
  promptTokens: integer('prompt_tokens').default(0),
  completionTokens: integer('completion_tokens').default(0),
  status: text('status').default('generating'), // 'generating'|'ready'|'failed'|'revoked'
  errorMessage: text('error_message'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  projectIdx: index('ai_proj_out_project_idx').on(table.projectId, table.createdAt),
  kindIdx: index('ai_proj_out_kind_idx').on(table.projectId, table.kind),
}));

// Members of a shared project. The creator is implicit (ai_projects.created_by), not a row here.
// Accepted members get full edit; only the creator may delete the project.
export const aiProjectMembers = pgTable('ai_project_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => aiProjects.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').default('pending'), // 'pending' | 'accepted' | 'declined'
  source: text('source').default('invite'), // 'invite' | 'link'
  invitedBy: uuid('invited_by').references(() => users.id),
  invitedAt: timestamp('invited_at').defaultNow(),
  respondedAt: timestamp('responded_at'),
}, (table) => ({
  projectIdx: index('ai_proj_member_project_idx').on(table.projectId),
  userIdx: index('ai_proj_member_user_idx').on(table.userId, table.status),
  uniq: uniqueIndex('ai_proj_member_uniq').on(table.projectId, table.userId),
}));

// Provenance receipt for one AI answer or output. Tamper-evidence lives in the audit chain;
// this table indexes a subject to its chain entry plus the fingerprints needed to re-verify.
// Stores hashes only — never source content.
export const aiProvenance = pgTable('ai_provenance', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid('project_id').references(() => aiProjects.id, { onDelete: 'cascade' }).notNull(),
  subjectType: text('subject_type').notNull(), // 'chat' | 'output'
  subjectId: uuid('subject_id').notNull(),
  answerHash: text('answer_hash').notNull(),
  promptHash: text('prompt_hash').notNull(),
  sourceFingerprints: jsonb('source_fingerprints').default([]),
  model: text('model'),
  redactionModes: jsonb('redaction_modes').default({}),
  auditLogId: uuid('audit_log_id'),
  entryHash: text('entry_hash').notNull(), // the receipt id shown to the user
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  subjectIdx: uniqueIndex('ai_prov_subject_idx').on(table.subjectType, table.subjectId),
  projectIdx: index('ai_prov_project_idx').on(table.projectId),
}));
