-- Consolidate per-tenant feature flag 'tracking' -> 'osint' (one OSINT switch that
-- gates the OSINT Tracker page, /api/osint, and the per-document tracking toggle).
-- Preserve any explicitly-set value; default-on tenants are unaffected (key absent).

-- 1. Copy existing 'tracking' value to 'osint'.
UPDATE "organizations"
SET "settings" = jsonb_set("settings", '{features,osint}', "settings" -> 'features' -> 'tracking')
WHERE "settings" -> 'features' ? 'tracking';

-- 2. Drop the legacy 'tracking' key.
UPDATE "organizations"
SET "settings" = "settings" #- '{features,tracking}'
WHERE "settings" -> 'features' ? 'tracking';
