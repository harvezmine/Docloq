// Redacts email + phone before text leaves for OpenAI. Scope is deliberately ONLY
// these structured identifiers (spec §0) — consent grants remain the primary control.

// Quantifiers are RFC-5321-bounded on purpose: unbounded `+` is O(n^2) on pathological
// input (ReDoS). Bounds keep matching O(n) — see tests/unit/pii-redaction perf case.
const EMAIL_RE = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-zA-Z0-9-]{1,63}(?:\.[a-zA-Z0-9-]{1,63})+/g;

// Indonesian mobile: +62 / 62 / 0 prefix, then 8xx and grouped digits.
const PHONE_ID_RE = /(?:\+62|62|0)8[0-9]{2}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}\b/g;

// Generic international: leading + and country code, then grouped digits.
const PHONE_INTL_RE = /\+[1-9][0-9]{0,2}[-.\s]?\(?[0-9]{1,4}\)?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}\b/g;

// NPWP (formatted, or 15 digits with optional separators) and NIK (16 digits with optional
// separators) — KTP cards and OCR routinely group the digits as "3175 0312 3456 7890".
const NPWP_RE = /\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b|\b\d{2}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d[\s.-]?\d{3}[\s.-]?\d{3}\b|\b\d{15}\b/g;
const NIK_RE = /\b\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b|\b\d{16}\b/g;

const EMPTY_COUNTS = { email: 0, phone: 0, nik: 0, npwp: 0 };

// Order matters: email first (so @domain digits aren't matched as phones), then ID mobile
// before generic intl, then NPWP (15 digits) before NIK (16) so neither eats the other.
// Idempotent — placeholders contain no `@` or digits, so no re-match.
export const redactPII = (text) => {
  if (!text || typeof text !== 'string') {
    return { redactedText: text ?? '', counts: { ...EMPTY_COUNTS } };
  }

  let email = 0;
  let phone = 0;
  let nik = 0;
  let npwp = 0;

  let out = text.replace(EMAIL_RE, () => { email += 1; return '[EMAIL]'; });
  out = out.replace(PHONE_ID_RE, () => { phone += 1; return '[PHONE]'; });
  out = out.replace(PHONE_INTL_RE, () => { phone += 1; return '[PHONE]'; });
  out = out.replace(NPWP_RE, () => { npwp += 1; return '[NPWP]'; });
  out = out.replace(NIK_RE, () => { nik += 1; return '[NIK]'; });

  return { redactedText: out, counts: { email, phone, nik, npwp } };
};

// PII_REDACTION_ENABLED="false" passes text through untouched (rollback without
// redeploy). Default is ON.
export const redactForOutbound = (text) => {
  if (process.env.PII_REDACTION_ENABLED === 'false') {
    return { redactedText: text ?? '', counts: { ...EMPTY_COUNTS } };
  }
  return redactPII(text);
};
