// Pure TOTP helper (no DB) so it stays unit-testable. Uses otplib v13's verifySync
// and checks .valid — the async verify returns a Promise (always truthy), which once accepted every code.

import { verifySync } from 'otplib';

export const TOTP_CONFIG = {
  digits: 6,
  period: 30,
  // window 1 = accept the current code plus one step before/after (±30s clock skew)
  window: 1,
};

// Returns a real boolean — never a Promise.
export const verifyTotpToken = (code, secret) => {
  if (!code || !secret) return false;
  try {
    const result = verifySync({
      token: String(code),
      secret,
      digits: TOTP_CONFIG.digits,
      period: TOTP_CONFIG.period,
      window: TOTP_CONFIG.window,
    });
    return result?.valid === true;
  } catch {
    // Malformed token/secret (wrong length, non-digits) → treat as invalid.
    return false;
  }
};

export default { TOTP_CONFIG, verifyTotpToken };
