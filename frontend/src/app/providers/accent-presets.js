// Accent palette definitions + the DOM helper that applies them.
// Kept out of PreferencesProvider.jsx so that file only exports components/hooks
// (react-refresh requirement).
//
// Each preset is ONE solid hue expressed as an 11-step ramp (50..950). The app's
// `brand-*` Tailwind colors read these as --brand-* vars, so every brand-colored
// surface (buttons, active nav, links, tints) follows the user's choice. No
// gradients: a single hue per preset is what keeps the UI calm.
//
// Ramps are generated in OKLCH (fixed lightness per step, chroma peaking at 500/600,
// tapering toward both ends) and stored as hex so canvas/Chart.js can use them too.
// Contrast-audited (WCAG AA): white on 600 >= 4.5:1, 700 on slate-50 >= 6:1,
// 300 on slate-900 >= 9:1.
//
// The cobalt ramp is mirrored in main.css (:root --brand-*) for public pages that
// sit outside the authenticated shell; keep the two in sync.

export const ACCENT_PRESETS = [
  { id: "cobalt",   name: { id: "Kobalt (Bawaan)", en: "Cobalt (Default)" },
    ramp: { 50: "#eef7ff", 100: "#dcedff", 200: "#bcdaff", 300: "#92c1fd", 400: "#64a2f0", 500: "#3d84db", 600: "#226bc0", 700: "#1559a4", 800: "#0f4683", 900: "#0b3462", 950: "#042042" } },
  { id: "teal",     name: { id: "Toska", en: "Teal" },
    ramp: { 50: "#edf9f8", 100: "#d9f1f0", 200: "#b7e1e0", 300: "#87cccb", 400: "#4fb2b2", 500: "#009697", 600: "#007e7f", 700: "#00696a", 800: "#005354", 900: "#003e3e", 950: "#002828" } },
  { id: "emerald",  name: { id: "Zamrud", en: "Emerald" },
    ramp: { 50: "#eef9f2", 100: "#dbf2e3", 200: "#bae3ca", 300: "#8ecfa9", 400: "#5ab584", 500: "#269a64", 600: "#00814e", 700: "#006d3e", 800: "#005630", 900: "#004023", 950: "#002914" } },
  { id: "amber",    name: { id: "Kuning", en: "Amber" },
    ramp: { 50: "#fef4eb", 100: "#fce7d6", 200: "#f4d0b2", 300: "#e8b182", 400: "#d48e4c", 500: "#bb6d12", 600: "#a15600", 700: "#894500", 800: "#6d3600", 900: "#512800", 950: "#351700" } },
  { id: "rose",     name: { id: "Mawar", en: "Rose" },
    ramp: { 50: "#fff1f2", 100: "#ffe1e4", 200: "#ffc5cb", 300: "#fba0ab", 400: "#eb7688", 500: "#d25068", 600: "#b63552", 700: "#9b2742", 800: "#7c1d33", 900: "#5d1626", 950: "#3e0a16" } },
  { id: "violet",   name: { id: "Ungu", en: "Violet" },
    ramp: { 50: "#f6f4ff", 100: "#ece7ff", 200: "#d8d0ff", 300: "#c0b1fc", 400: "#a48def", 500: "#896cd9", 600: "#7254be", 700: "#5f44a3", 800: "#4b3582", 900: "#372761", 950: "#231741" } },
  { id: "graphite", name: { id: "Grafit", en: "Graphite" },
    ramp: { 50: "#f4f6f8", 100: "#e8ebef", 200: "#d3d8de", 300: "#b7bec8", 400: "#97a1ae", 500: "#798492", 600: "#626d7a", 700: "#515a66", 800: "#3f4751", 900: "#2f353c", 950: "#1d2126" } },
];

export const DEFAULT_ACCENT_ID = "cobalt";

// Category swatches (folders, departments): the 600 step of every preset, so colors
// people pick for categories share the same lightness and calm chroma as the accent.
export const SWATCH_COLORS = ACCENT_PRESETS.map((p) => p.ramp[600]);
export const DEFAULT_SWATCH = SWATCH_COLORS[0];

// The old indigo default is stored on existing folders/departments; render it as the
// new default so legacy records don't keep the retired purple.
const LEGACY_DEFAULT_SWATCH = "#6366f1";
export const swatch = (color) =>
  !color || color.toLowerCase() === LEGACY_DEFAULT_SWATCH ? DEFAULT_SWATCH : color;

// Unknown/removed ids (including the retired gradient presets like "signature")
// fall back to the default, so a stale localStorage value never leaves the UI unstyled.
export const getPreset = (id) =>
  ACCENT_PRESETS.find((p) => p.id === id) || ACCENT_PRESETS[0];

/** Write the brand ramp onto a DOM node (the authenticated shell root, never :root). */
export function applyAccentVars(el, preset) {
  if (!el) return;
  for (const [step, hex] of Object.entries(preset.ramp)) {
    el.style.setProperty(`--brand-${step}`, hex);
  }
}
