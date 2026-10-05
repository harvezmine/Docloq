// Accent palette definitions + the DOM helper that applies them.
// Kept out of PreferencesProvider.jsx so that file only exports components/hooks
// (react-refresh requirement).
//
// Every value below is contrast-audited (WCAG AA, 4.5:1):
//   - `from`/`to`  : gradient stops, dark enough that WHITE text/icons on top of
//                    them always pass AA. This is why the lighter hues (amber,
//                    lime, teal…) use 700-level stops rather than 500/600.
//   - `textLight`  : accent text color on light panels  (>=4.5:1 on slate-50)
//   - `textDark`   : accent text color on dark panels   (>=4.5:1 on slate-900)
//     A single accent color cannot be legible on both, so the two are separate
//     tokens and `.dark` swaps between them.
//   - `solid`      : mid-tone used only for non-text fills (tints, swatch dots).
//   - `ring`/`glow`: focus ring + soft shadow rgba.

export const ACCENT_PRESETS = [
  // Default: deep blue → violet. Deliberately muted (700-level), not bright.
  { id: "signature", name: { id: "Biru–Ungu (Bawaan)", en: "Blue–Violet (Default)" }, from: "#1d4ed8", to: "#6d28d9", solid: "#4f46e5", textLight: "#3730a3", textDark: "#a5b4fc", ring: "rgba(79,70,229,0.4)",   glow: "rgba(79,70,229,0.25)" },
  { id: "indigo",    name: { id: "Indigo", en: "Indigo" },        from: "#4f46e5", to: "#7c3aed", solid: "#6366f1", textLight: "#4338ca", textDark: "#a5b4fc", ring: "rgba(99,102,241,0.4)",  glow: "rgba(99,102,241,0.25)" },
  { id: "violet",    name: { id: "Ungu", en: "Violet" },          from: "#7c3aed", to: "#a21caf", solid: "#8b5cf6", textLight: "#6d28d9", textDark: "#c4b5fd", ring: "rgba(139,92,246,0.4)",  glow: "rgba(139,92,246,0.25)" },
  { id: "blue",      name: { id: "Biru", en: "Blue" },            from: "#2563eb", to: "#4f46e5", solid: "#3b82f6", textLight: "#1d4ed8", textDark: "#93c5fd", ring: "rgba(59,130,246,0.4)",  glow: "rgba(59,130,246,0.25)" },
  { id: "sky",       name: { id: "Langit", en: "Sky" },           from: "#0369a1", to: "#1d4ed8", solid: "#0ea5e9", textLight: "#0369a1", textDark: "#7dd3fc", ring: "rgba(14,165,233,0.4)",  glow: "rgba(14,165,233,0.25)" },
  { id: "cyan",      name: { id: "Sian", en: "Cyan" },            from: "#0e7490", to: "#1d4ed8", solid: "#06b6d4", textLight: "#155e75", textDark: "#67e8f9", ring: "rgba(6,182,212,0.4)",   glow: "rgba(6,182,212,0.25)" },
  { id: "teal",      name: { id: "Toska", en: "Teal" },           from: "#0f766e", to: "#0e7490", solid: "#14b8a6", textLight: "#115e59", textDark: "#5eead4", ring: "rgba(20,184,166,0.4)",  glow: "rgba(20,184,166,0.25)" },
  { id: "emerald",   name: { id: "Zamrud", en: "Emerald" },       from: "#047857", to: "#0f766e", solid: "#10b981", textLight: "#047857", textDark: "#6ee7b7", ring: "rgba(16,185,129,0.4)",  glow: "rgba(16,185,129,0.25)" },
  { id: "lime",      name: { id: "Hijau Limau", en: "Lime" },     from: "#4d7c0f", to: "#047857", solid: "#84cc16", textLight: "#3f6212", textDark: "#bef264", ring: "rgba(132,204,22,0.4)",  glow: "rgba(132,204,22,0.25)" },
  { id: "amber",     name: { id: "Kuning", en: "Amber" },         from: "#b45309", to: "#c2410c", solid: "#f59e0b", textLight: "#b45309", textDark: "#fcd34d", ring: "rgba(245,158,11,0.4)",  glow: "rgba(245,158,11,0.25)" },
  { id: "orange",    name: { id: "Oranye", en: "Orange" },        from: "#c2410c", to: "#b91c1c", solid: "#f97316", textLight: "#c2410c", textDark: "#fdba74", ring: "rgba(249,115,22,0.4)",  glow: "rgba(249,115,22,0.25)" },
  { id: "rose",      name: { id: "Mawar", en: "Rose" },           from: "#be123c", to: "#be185d", solid: "#f43f5e", textLight: "#be123c", textDark: "#fda4af", ring: "rgba(244,63,94,0.4)",   glow: "rgba(244,63,94,0.25)" },
  { id: "fuchsia",   name: { id: "Fuchsia", en: "Fuchsia" },      from: "#a21caf", to: "#be185d", solid: "#d946ef", textLight: "#a21caf", textDark: "#f0abfc", ring: "rgba(217,70,239,0.4)",  glow: "rgba(217,70,239,0.25)" },
  { id: "slate",     name: { id: "Batu", en: "Slate" },           from: "#475569", to: "#1e293b", solid: "#64748b", textLight: "#334155", textDark: "#cbd5e1", ring: "rgba(100,116,139,0.4)", glow: "rgba(100,116,139,0.25)" },
  { id: "graphite",  name: { id: "Grafit", en: "Graphite" },      from: "#334155", to: "#0f172a", solid: "#475569", textLight: "#1e293b", textDark: "#cbd5e1", ring: "rgba(71,85,105,0.4)",   glow: "rgba(71,85,105,0.25)" },
];

export const DEFAULT_ACCENT_ID = "signature";

// Unknown/removed ids fall back to the default preset, so a stale localStorage
// value can never leave the UI unstyled.
export const getPreset = (id) =>
  ACCENT_PRESETS.find((p) => p.id === id) || ACCENT_PRESETS[0];

/** Write the accent vars onto a DOM node (the authenticated shell root, never :root). */
export function applyAccentVars(el, preset) {
  if (!el) return;
  el.style.setProperty("--accent-from", preset.from);
  el.style.setProperty("--accent-to", preset.to);
  el.style.setProperty("--accent-solid", preset.solid);
  el.style.setProperty("--accent-text-light", preset.textLight);
  el.style.setProperty("--accent-text-dark", preset.textDark);
  el.style.setProperty("--accent-ring", preset.ring);
  el.style.setProperty("--accent-glow", preset.glow);
}
