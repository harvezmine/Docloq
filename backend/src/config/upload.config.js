import 'dotenv/config';
import path from 'path';

const MB = 1024 * 1024;

export const uploadConfig = {
  maxFileSize: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50) * MB,

  // Single source of truth for multer, the upload pipeline validator, and AI source ingestion (see mimeToCategory)
  allowedMimeTypes: [
    // PDF
    'application/pdf',
    // Word
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.oasis.opendocument.text', // .odt
    'application/rtf', // .rtf
    'text/rtf', // .rtf (alt)
    // Excel / spreadsheets
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.oasis.opendocument.spreadsheet', // .ods
    // PowerPoint / presentations
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.oasis.opendocument.presentation', // .odp
    // Images
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/tiff',
    'image/bmp',
    // Plain text
    'text/plain',
    'text/csv',
    'text/markdown',
  ],

  // Categories drive extractText() routing: pdf | office | spreadsheet | presentation | image | text
  mimeToCategory: {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'office',
    'application/msword': 'office',
    'application/vnd.oasis.opendocument.text': 'office',
    'application/rtf': 'office',
    'text/rtf': 'office',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
    'application/vnd.ms-excel': 'spreadsheet',
    'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
    'application/vnd.ms-powerpoint': 'presentation',
    'application/vnd.oasis.opendocument.presentation': 'presentation',
    'image/png': 'image',
    'image/jpeg': 'image',
    'image/webp': 'image',
    'image/tiff': 'image',
    'image/bmp': 'image',
    'text/plain': 'text',
    'text/csv': 'text',
    'text/markdown': 'text',
  },

  // Defense-in-depth: rejected by extension AND MIME, on top of magic-byte verification and malware scanning
  blockedExtensions: [
    'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'msp', 'dll', 'sys', 'drv',
    'sh', 'bash', 'zsh', 'ps1', 'psm1', 'vbs', 'vbe', 'wsf', 'wsh', 'hta',
    'js', 'mjs', 'cjs', 'jse', 'jar', 'apk', 'app', 'deb', 'rpm', 'dmg',
    'pkg', 'run', 'bin', 'gadget', 'cpl', 'lnk', 'reg', 'pif',
  ],
  blockedMimeTypes: [
    'application/x-msdownload', // exe/dll
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-dosexec',
    'application/x-sh',
    'application/x-shellscript',
    'application/x-bat',
    'application/x-msi',
    'application/vnd.microsoft.portable-executable',
    'application/x-elf',
    'application/java-archive',
    'application/x-apple-diskimage',
  ],

  storagePath: process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'storage'),
  tempDir: path.join(process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'storage'), 'temp'),
  documentsDir: path.join(process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'storage'), 'documents'),
  qrCodesDir: path.join(process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'storage'), 'qr-codes'),
  thumbnailsDir: path.join(process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'storage'), 'thumbnails'),

  storageProvider: process.env.STORAGE_PROVIDER || 'local', // local | minio | r2

  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'auto',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    documentsBucket: process.env.S3_DOCUMENTS_BUCKET || 'docloq-documents',
    archiveBucket: process.env.S3_ARCHIVE_BUCKET || 'docloq-archive',
    qrBucket: process.env.S3_QR_BUCKET || 'docloq-qrcodes',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false', // true for MinIO
  },

  keyProvider: process.env.KEY_PROVIDER || 'local', // local | vault

  vault: {
    addr: process.env.VAULT_ADDR || 'http://localhost:8200',
    token: process.env.VAULT_TOKEN || '',
    transitKey: process.env.VAULT_TRANSIT_KEY || 'docloq-master',
  },

  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: process.env.QDRANT_COLLECTION || 'docloq_documents',
    // Chunk vectors live in their own collection so whole-document points (used by
    // findSimilarDocuments via the recommend API) stay uncontaminated.
    chunkCollection: process.env.QDRANT_CHUNK_COLLECTION || 'docloq_chunks',
    vectorSize: 1536, // OpenAI text-embedding-3-small dimension
  },

  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32, // 256 bits
    ivLength: 16, // 128 bits for GCM
    saltLength: 32,
    authTagLength: 16,
    masterKey: process.env.ENCRYPTION_MASTER_KEY || null, // 64-char hex string → 32 bytes
  },

  honeytoken: {
    zwcChars: ['\u200B', '\u200C', '\u200D', '\uFEFF'],
    zwcPositionCount: 8,
    // Homoglyph substitution mapping (Latin → Cyrillic look-alikes)
    homoglyphMap: {
      'a': '\u0430', // Cyrillic а
      'e': '\u0435', // Cyrillic е
      'o': '\u043E', // Cyrillic о
      'p': '\u0440', // Cyrillic р
      'c': '\u0441', // Cyrillic с
      'x': '\u0445', // Cyrillic х
      'y': '\u0443', // Cyrillic у
      'i': '\u0456', // Cyrillic і (Ukrainian)
      's': '\u0455', // Cyrillic ѕ (Macedonian)
      'h': '\u04BB', // Cyrillic һ
    },
    homoglyphPositionCount: 15,
    whitespaceLineCount: 20,
  },

  qrCode: {
    signingSecret: process.env.QR_SIGNING_SECRET || 'default-qr-secret-change-me',
    verificationBaseUrl: process.env.QR_VERIFICATION_BASE_URL || 'http://localhost:5173/verify',
    shortCodeLength: 8,
    width: 300,
    errorCorrectionLevel: 'H', // L, M, Q, H (highest)
  },

  scanner: {
    enabled: process.env.SCANNER_ENABLED === 'true',
    clamavHost: process.env.CLAMAV_HOST || 'localhost',
    clamavPort: parseInt(process.env.CLAMAV_PORT, 10) || 3310,
  },

  tempUpload: {
    expirationMinutes: 30, // auto-deletes temp files after 30 min
  },

  downloadWatermark: {
    enabled: process.env.DOWNLOAD_WATERMARK_ENABLED !== 'false',
    // Invisible chars, chosen not to overlap with honeytoken's ZWC chars above
    chars: ['\u2060', '\u2061', '\u2062', '\u2063'], // Word Joiner, Function Application, Invisible Times, Invisible Separator
    positionCount: 12,
    supportedCategories: ['pdf', 'office', 'text'],
  },

  // Visible canary code (as opposed to the invisible watermark above)
  tracking: {
    enabled: process.env.OSINT_TRACKING_ENABLED !== 'false', // default on
    codePrefix: 'DLQ',
    stampSizePt: 4, // tiny but real selectable text
    stampOpacity: 0.6,
    visibleCategories: ['text', 'pdf', 'office'], // office = OOXML .docx only
  },

  blockchain: {
    enabled: process.env.BLOCKCHAIN_ENABLED === 'true', // default OFF until wallet configured
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    chainId: parseInt(process.env.POLYGON_CHAIN_ID, 10) || 137, // 137 = Polygon Mainnet, 80002 = Amoy Testnet
    privateKey: process.env.POLYGON_PRIVATE_KEY || '',
    contractAddress: process.env.POLYGON_CONTRACT_ADDRESS || '',
    confirmations: parseInt(process.env.BLOCKCHAIN_CONFIRMATIONS, 10) || 2,
    gasLimitSingle: 160000, // cold SSTORE (~104k) + headroom
    gasLimitBatch: 200000,
  },
};

// Rejects by both filename extension and declared MIME type
export function isBlockedFile(filename, mimeType = '') {
  const ext = path.extname(filename || '').replace(/^\./, '').toLowerCase();
  if (ext && uploadConfig.blockedExtensions.includes(ext)) return true;
  if (mimeType && uploadConfig.blockedMimeTypes.includes(mimeType.toLowerCase())) return true;
  return false;
}

export function isAllowedUpload(mimeType, filename = '') {
  if (isBlockedFile(filename, mimeType)) return false;
  return uploadConfig.allowedMimeTypes.includes(mimeType);
}

export default uploadConfig;
