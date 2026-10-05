// SSRF guard: DNS-resolves every host (canonicalizing alternate IP encodings), classifies
// resulting IPs against private/reserved CIDRs, and re-validates on every redirect hop.

import dns from 'dns/promises';
import net from 'net';
import { URL } from 'url';

const ipv4ToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc * 256) + Number(oct), 0) >>> 0;
const inV4 = (ip, cidr, bits) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(cidr) & mask);
};

// Private / loopback / link-local / reserved IPv4 ranges that must never be fetched.
const V4_BLOCKED = [
  ['0.0.0.0', 8],      // "this" network
  ['10.0.0.0', 8],     // private
  ['100.64.0.0', 10],  // CGNAT
  ['127.0.0.0', 8],    // loopback
  ['169.254.0.0', 16], // link-local incl. 169.254.169.254 cloud metadata
  ['172.16.0.0', 12],  // private
  ['192.0.0.0', 24],   // IETF protocol assignments
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15],  // benchmarking
  ['224.0.0.0', 4],    // multicast
  ['240.0.0.0', 4],    // reserved
];

const classifyV4 = (ip) => {
  for (const [cidr, bits] of V4_BLOCKED) {
    if (inV4(ip, cidr, bits)) return { private: true, reason: `IPv4 ${ip} in ${cidr}/${bits}` };
  }
  return { private: false };
};

// IPv4-mapped tail → dotted-decimal; accepts dotted or the hex form the WHATWG URL parser emits ("7f00:1").
const mappedTailToV4 = (tail) => {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(tail)) return tail;
  const groups = tail.split(':').filter((g) => g !== '');
  if (groups.length === 2) {
    const hi = parseInt(groups[0], 16);
    const lo = parseInt(groups[1], 16);
    if (Number.isFinite(hi) && Number.isFinite(lo)) {
      return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.');
    }
  }
  return null;
};

const classifyV6 = (ip) => {
  const lower = ip.toLowerCase();
  // IPv4-mapped / -compatible (::ffff:127.0.0.1, ::ffff:7f00:1, ::127.0.0.1) → classify the embedded v4.
  if (lower.startsWith('::ffff:') || /^::\d/.test(lower)) {
    const tail = lower.replace(/^::(ffff:)?/, '');
    const v4 = mappedTailToV4(tail);
    if (v4) return classifyV4(v4);
  }
  // NAT64 well-known prefix can embed an internal v4 (64:ff9b::a.b.c.d or hex tail).
  if (lower.startsWith('64:ff9b:')) {
    const v4 = mappedTailToV4(lower.split('::').pop() || lower.split(':').slice(-2).join(':'));
    if (v4) return classifyV4(v4);
  }
  if (lower === '::1' || lower === '::') return { private: true, reason: 'IPv6 loopback/unspecified' };
  if (lower.startsWith('fe80:') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return { private: true, reason: 'IPv6 link-local fe80::/10' };
  }
  // Unique-local fc00::/7 → first byte 0xfc or 0xfd.
  if (/^f[cd]/.test(lower)) return { private: true, reason: 'IPv6 ULA fc00::/7' };
  return { private: false };
};

export const classifyIp = (ip) => {
  const fam = net.isIP(ip);
  if (fam === 4) return classifyV4(ip);
  if (fam === 6) return classifyV6(ip);
  return { private: true, reason: `not a valid IP: ${ip}` }; // unknown → treat as unsafe
};

// Hostnames that are private by name regardless of resolution.
export const isBlockedHostname = (hostname) => {
  if (!hostname) return true;
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost') return true;
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  // Cloud metadata convenience names.
  if (h === 'metadata.google.internal' || h === 'metadata') return true;
  return false;
};

// Safe to fetch = http/https only, hostname not blocked by name, EVERY resolved
// address public. Throws SSRF_BLOCKED otherwise.
export const assertUrlPublic = async (rawUrl) => {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('SSRF_BLOCKED: URL tidak valid');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('SSRF_BLOCKED: hanya http/https yang diizinkan');
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error('SSRF_BLOCKED: host privat/lokal tidak diizinkan');
  }

  const host = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  // Literal IP → classify directly (also catches alternate encodings once canonicalized).
  if (net.isIP(host)) {
    const verdict = classifyIp(host);
    if (verdict.private) throw new Error(`SSRF_BLOCKED: ${verdict.reason}`);
    return { url, addresses: [host] };
  }

  // DNS name → resolve ALL records; getaddrinfo canonicalizes octal/hex/decimal forms.
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true, verbatim: true });
  } catch (err) {
    throw new Error(`SSRF_BLOCKED: DNS resolution gagal (${err.code || err.message})`);
  }
  if (!addrs.length) throw new Error('SSRF_BLOCKED: host tidak punya alamat');
  for (const { address } of addrs) {
    const verdict = classifyIp(address);
    if (verdict.private) throw new Error(`SSRF_BLOCKED: ${verdict.reason} (via ${host})`);
  }
  return { url, addresses: addrs.map((a) => a.address) };
};

// SSRF-safe fetch: validates the target AND re-validates every redirect hop
// (checking only the first URL lets a 302→internal slip through).
export const safeFetch = async (rawUrl, fetchOpts = {}, maxRedirects = 5) => {
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertUrlPublic(current); // throws on private/invalid

    const res = await fetch(current, { ...fetchOpts, redirect: 'manual' });

    // 3xx with a Location → re-validate the next hop instead of blindly following.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      current = new URL(location, current).href;
      try { res.body?.cancel?.(); } catch { /* ignore */ }
      continue;
    }
    return res;
  }
  throw new Error('SSRF_BLOCKED: terlalu banyak redirect');
};

export default { classifyIp, isBlockedHostname, assertUrlPublic, safeFetch };
