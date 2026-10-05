// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Verify Turnstile token; throws on failure.
export async function verifyTurnstile(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TURNSTILE_SECRET_KEY tidak terkonfigurasi');
    }
    console.warn('[Turnstile] disabled (no secret key set) — bypassing in dev');
    return { success: true, bypassed: true };
  }
  if (!token) throw new Error('Captcha token kosong');

  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set('remoteip', remoteIp);

  let resp;
  try {
    resp = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch (err) {
    throw new Error(`Turnstile verify gagal: ${err.message}`);
  }

  const data = await resp.json();
  if (!data.success) {
    const codes = (data['error-codes'] || []).join(',') || 'unknown';
    throw new Error(`Turnstile reject: ${codes}`);
  }

  return data;
}
