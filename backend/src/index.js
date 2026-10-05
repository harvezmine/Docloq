import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import path from 'path';
import 'dotenv/config';

import routes from './routes/index.js';
import { connectMongo } from './services/ai-cache.service.js';
import { initBlockchain } from './services/blockchain.service.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy when behind Cloudflare / reverse proxy (needed for correct req.ip in rate limiter)
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // No Origin header = server-to-server/curl; allow only outside production.
    if (!origin) {
      return callback(null, process.env.NODE_ENV !== 'production');
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Gate'],
  // Expose so the browser can read the server-set download filename on cross-origin responses.
  exposedHeaders: ['Content-Disposition'],
};

// Frontend and API are on different subdomains, so embedded <img> (PNGs/QR codes) are
// cross-origin; relax Helmet's CORP so they aren't blocked (still gated by auth/share tokens).
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Redis-backed rate limiter, falls back to in-memory if Redis is unreachable.
let rateLimiterStore;
try {
  const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });
  redisClient.on('error', (err) => {
    // Swallow — rate limiter will degrade gracefully via insuranceLimiter
    if (err.code !== 'ECONNREFUSED') console.warn('[Redis]', err.message);
  });
  rateLimiterStore = redisClient;
  console.log('[DocLoq] Rate limiter backed by Redis');
} catch (err) {
  console.warn('[DocLoq] Redis unavailable, rate limiter falling back to in-memory:', err.message);
}

const insuranceLimiter = new RateLimiterMemory({ points: 500, duration: 900 });

const globalLimiter = rateLimiterStore
  ? new RateLimiterRedis({ storeClient: rateLimiterStore, keyPrefix: 'rl_global', points: 500, duration: 15 * 60, insuranceLimiter })
  : new RateLimiterMemory({ keyPrefix: 'rl_global', points: 500, duration: 15 * 60 });

const authLimiter = rateLimiterStore
  ? new RateLimiterRedis({ storeClient: rateLimiterStore, keyPrefix: 'rl_auth', points: 15, duration: 15 * 60, insuranceLimiter })
  : new RateLimiterMemory({ keyPrefix: 'rl_auth', points: 15, duration: 15 * 60 });

const limiterMiddleware = (limiter, message) => (req, res, next) => {
  limiter.consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ success: false, message }));
};

// Global rate limiting — read-mostly endpoints + collab high-freq di-skip
const SKIP_RATE_LIMIT = [
  /^\/api\/documents\/[^/]+\/presence/,
  /^\/api\/documents\/[^/]+\/edit-lock\/release/,
  /^\/api\/documents\/[^/]+\/breadcrumb/,
  /^\/api\/documents\/[^/]+\/comments/,
  /^\/api\/documents\/[^/]+\/mentionable-users/,
  /^\/api\/documents\/[^/]+\/file/,
  /^\/api\/documents\/[^/]+\/callback/,
  /^\/api\/documents\/[^/]+\/onlyoffice-config/,
  /^\/api\/documents\/[^/]+\/force-save/,
  /^\/api\/notifications/,
  /^\/api\/dashboard/,
  /^\/api\/auth\/heartbeat/,
  /^\/api\/auth\/me$/,
  /^\/api\/roles\/my-permissions/,
];
app.use((req, res, next) => {
  if (SKIP_RATE_LIMIT.some((re) => re.test(req.path))) return next();
  return limiterMiddleware(globalLimiter, 'Too many requests, please try again later')(req, res, next);
});

// Strict auth rate limiting — 15 req/15min, excludes Google OAuth routes and polling (/me, /heartbeat)
app.use('/api/auth', (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  if (req.path.startsWith('/google') || req.path === '/me' || req.path === '/heartbeat') return next();
  return limiterMiddleware(authLimiter, 'Too many authentication attempts, please try again later')(req, res, next);
});

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

app.use('/api', routes);

// /uploads static serving removed (SEC-B-011); legacy files fall back through
// the serveDocument controller instead.

app.get('/', (req, res) => {
  res.json({ 
    project: 'DocLoq Backend', 
    status: 'Secure & Running', 
    timestamp: new Date(),
    version: '1.0.0',
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
});

// Listen on 0.0.0.0 so Docker containers can reach it via host.docker.internal.
connectMongo().catch(err => console.warn('[DocLoq] MongoDB cache init skipped:', err.message));

try { initBlockchain(); } catch (err) { console.warn('[DocLoq] Blockchain init skipped:', err.message); }

const server = await app.listen(PORT, '0.0.0.0');
console.log(`[DocLoq] Server running on http://0.0.0.0:${PORT}`);

// Mounts a guarded WS upgrade handler for the admin web-SSH console, only when enabled.
try {
  const { attachSshConsole } = await import('./ws/ssh-console.ws.js');
  attachSshConsole(server);
} catch (err) { console.warn('[DocLoq] SSH console mount skipped:', err.message); }
console.log(`[DocLoq] Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`[DocLoq] Captcha: Cloudflare Turnstile (${process.env.TURNSTILE_SECRET_KEY ? 'configured' : 'not configured'})`);

// OSINT auto-scan cron, opt-in via OSINT_AUTOSCAN_ENABLED. Searches Google CSE for each
// tracked document's visible canary code — see osint-discovery.service.js.
if (process.env.OSINT_AUTOSCAN_ENABLED === 'true') {
  try {
    const { db } = await import('./db/index.js');
    const { organizations } = await import('./db/schema.js');
    const { runDiscoveryScan } = await import('./services/osint-discovery.service.js');
    const tick = async () => {
      try {
        const orgs = await db.select({ id: organizations.id }).from(organizations);
        for (const o of orgs) {
          try { await runDiscoveryScan(o.id, { onLog: (m) => console.log('[OsintCron]', o.id, m) }); }
          catch (err) { console.error('[OsintCron] org', o.id, 'failed:', err.message); }
        }
      } catch (err) {
        console.error('[OsintCron] tick error:', err.message);
      }
    };
    setTimeout(tick, 5 * 60 * 1000);
    setInterval(tick, 24 * 60 * 60 * 1000);
    console.log('[OsintCron] scheduled — first run in 5 min, then every 24h');
  } catch (err) {
    console.warn('[OsintCron] init failed:', err.message);
  }
} else {
  console.log('[OsintCron] disabled (set OSINT_AUTOSCAN_ENABLED=true to enable)');
}

// Tamper-evident audit log: periodically anchors a Merkle root of each org's new audit
// entries to Polygon. One tick anchors orgs past the entry threshold, the other flushes leftovers.
if (process.env.AUDIT_ANCHOR_ENABLED === 'true') {
  try {
    const { runAuditAnchoring } = await import('./services/audit-anchor.service.js');
    const checkMin = Math.max(1, parseInt(process.env.AUDIT_ANCHOR_CHECK_MINUTES || '30', 10));
    const intervalHours = Math.max(1, parseInt(process.env.AUDIT_ANCHOR_INTERVAL_HOURS || '6', 10));
    const log = (m) => console.log('[AuditAnchor]', m);
    const flushEveryMs = intervalHours * 60 * 60 * 1000;
    let lastFlush = Date.now();
    let running = false;
    // overlapping ticks starve flush
    setInterval(() => {
      if (running) return;
      running = true;
      const force = Date.now() - lastFlush >= flushEveryMs;
      runAuditAnchoring({ force, onLog: log })
        .then(() => { if (force) lastFlush = Date.now(); })
        .catch((e) => console.error('[AuditAnchor] tick:', e.message))
        .finally(() => { running = false; });
    }, checkMin * 60 * 1000);
    console.log(`[AuditAnchor] scheduled — threshold ${process.env.AUDIT_ANCHOR_EVERY_N || 256} entries / flush every ${intervalHours}h (check every ${checkMin}m)`);
  } catch (err) {
    console.warn('[AuditAnchor] init failed:', err.message);
  }
} else {
  console.log('[AuditAnchor] disabled (set AUDIT_ANCHOR_ENABLED=true to enable; also needs BLOCKCHAIN_ENABLED)');
}

export default app;