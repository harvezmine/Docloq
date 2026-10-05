// Pure data math for the OSINT Tracker visualizations.
// No React, no framer-motion, importable by `node --test` and by SVG components.

/** Tally leak reports by matchType; unknown/missing types fall into `other`. */
export function countByMatchType(leaks = []) {
  const out = { visible_code: 0, watermark: 0, honeytoken: 0, other: 0, total: 0 };
  for (const l of leaks) {
    const t = l?.matchType;
    if (t === "visible_code" || t === "watermark" || t === "honeytoken") out[t] += 1;
    else out.other += 1;
    out.total += 1;
  }
  return out;
}

/** Number of distinct downloaders traced across the given leaks. */
export function distinctTracedCount(leaks = []) {
  const s = new Set();
  for (const l of leaks) {
    if (l?.tracedUserEmail) s.add(l.tracedUserEmail);
  }
  return s.size;
}

/**
 * Traceability pipeline metrics. NOT a strict subset funnel (downloads can exceed
 * docs), so bar widths are scaled relative to the largest stage value.
 * @returns {{ stages: {key,label,value,pct}[], max: number }}
 */
export function buildFunnel(stats = {}, leaks = []) {
  const values = {
    tracked: stats?.trackedDocsCount || 0,
    downloads: stats?.downloadWatermarkCount || 0,
    leaks: Array.isArray(leaks) ? leaks.length : 0,
    traced: distinctTracedCount(leaks),
  };
  const max = Math.max(values.tracked, values.downloads, values.leaks, values.traced, 0);
  const labels = {
    tracked: "Tracked docs",
    downloads: "Watermarked downloads",
    leaks: "Leaks found",
    traced: "Users traced",
  };
  const stages = ["tracked", "downloads", "leaks", "traced"].map((key) => ({
    key,
    label: labels[key],
    value: values[key],
    pct: max > 0 ? (values[key] / max) * 100 : 0,
  }));
  return { stages, max };
}

/**
 * Bucket items into per-day counts over the last `days` days (oldest first,
 * newest last). `now` is injectable for deterministic tests.
 */
export function dailyCounts(items = [], dateField = "createdAt", days = 30, now = Date.now()) {
  const buckets = new Array(days).fill(0);
  const dayMs = 86400000;
  for (const it of items) {
    const raw = it?.[dateField];
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    const ageDays = Math.floor((now - t) / dayMs);
    if (ageDays < 0 || ageDays >= days) continue;
    buckets[days - 1 - ageDays] += 1;
  }
  return buckets;
}
