// Shared, UI-free helpers for live-camera QR scanning (Verification page).

// DocLoq short code = 8 chars, base62 (see backend qrcode.service.js CHARSET + shortCodeLength=8).
const CODE_RE = /^[A-Za-z0-9]{8}$/;

/**
 * Extract a DocLoq verification short code from a decoded QR value.
 * Host is intentionally NOT pinned, the server is the final authority (unknown
 * code -> 404), so this only validates shape: http(s) + /verify path + 8-char code.
 */
export function parseShortCode(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null; // not a URL
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!/\/verify\/?$/.test(u.pathname)) return null;
  const code = u.searchParams.get('code');
  return code && CODE_RE.test(code) ? code : null;
}

/**
 * True for phones only (camera scan is phone-only). Requires touch-first pointer
 * (excludes touch laptops) AND a phone UA or viewport ≤500px (iPadOS reports a
 * desktop UA, so viewport size is what excludes tablets).
 */
export function isPhone() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const mm = window.matchMedia;
  const touchFirst = !!mm && mm('(pointer: coarse)').matches && mm('(hover: none)').matches;
  if (!touchFirst) return false;

  const ua = navigator.userAgent || '';
  const uaPhone =
    /iPhone|iPod/.test(ua) ||
    (/Android/.test(ua) && /Mobile/.test(ua)) ||
    navigator.userAgentData?.mobile === true;

  const w = window.screen?.width || 0;
  const h = window.screen?.height || 0;
  const minSide = Math.min(w, h);
  const phoneSized = minSide > 0 && minSide <= 500;

  return uaPhone || phoneSized;
}

/** Detect a likely in-app browser (WKWebView in WhatsApp/IG/FB/Line) that often blocks camera. */
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /(FBAN|FBAV|Instagram|Line|WhatsApp|Twitter|WeChat|MicroMessenger|GSA)\//i.test(ua)
    || /\bFB_IAB\b/.test(ua);
}
