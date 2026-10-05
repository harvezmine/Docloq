export const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const beatLocal = (pr, [a, b]) => clamp01((pr - a) / (b - a));

export const subPhase = (t, a, b) => clamp01((t - a) / (b - a));

export const backOut = (v) => 1 + 2.70158 * ((v - 1) ** 3) + 1.70158 * ((v - 1) ** 2);

export const HERO_HEIGHT_VH = 1500;

export const SHEET_COUNT = 11;

export const PILE = [
  { x: -0.12, y: 0.06, rz: 0.05 },
  { x: 0.1, y: -0.04, rz: -0.04 },
  { x: -0.05, y: 0.1, rz: 0.08 },
  { x: 0.14, y: 0.02, rz: -0.07 },
  { x: -0.1, y: -0.08, rz: 0.03 },
  { x: 0.04, y: 0.05, rz: -0.02 },
  { x: 0, y: 0, rz: 0.04 },
  { x: -0.16, y: -0.02, rz: 0.06 },
  { x: 0.17, y: 0.09, rz: -0.05 },
  { x: -0.03, y: -0.12, rz: -0.03 },
  { x: 0.08, y: 0.13, rz: 0.07 },
];

export const SCATTER = [
  { x: -4.5, y: 1.6, z: -2.4, rx: 0.16, ry: -0.18, rz: 0.3 },
  { x: 4.3, y: 1.9, z: -1.8, rx: -0.12, ry: 0.16, rz: -0.32 },
  { x: -3.4, y: -1.8, z: -1.2, rx: 0.14, ry: 0.12, rz: -0.22 },
  { x: 3.5, y: -1.7, z: -3.0, rx: -0.16, ry: -0.14, rz: 0.26 },
  { x: -1.6, y: 2.5, z: -3.6, rx: 0.1, ry: 0.18, rz: 0.14 },
  { x: 1.5, y: -2.6, z: -0.6, rx: -0.12, ry: -0.16, rz: -0.16 },
  { x: 0.2, y: 0.7, z: -4.2, rx: 0.1, ry: 0.08, rz: -0.08 },
  { x: -5.0, y: -0.4, z: -3.2, rx: 0.12, ry: 0.2, rz: 0.2 },
  { x: 5.0, y: 0.2, z: -2.6, rx: -0.14, ry: -0.1, rz: -0.24 },
  { x: -2.4, y: -2.7, z: -2.0, rx: 0.16, ry: -0.12, rz: 0.18 },
  { x: 2.6, y: 2.7, z: -1.4, rx: -0.1, ry: 0.14, rz: -0.2 },
];

export const ARCHIVE_SCALE = 0.52;
export const ARCHIVE = [
  { x: -2.7, y: 1.5 }, { x: -0.9, y: 1.5 }, { x: 0.9, y: 1.5 }, { x: 2.7, y: 1.5 },
  { x: -2.7, y: 0 }, { x: -0.9, y: 0 }, { x: 0.9, y: 0 }, { x: 2.7, y: 0 },
  { x: -1.8, y: -1.5 }, { x: 0, y: -1.5 }, { x: 1.8, y: -1.5 },
];
export const ARCHIVE_Z = -0.55;

export const FOLDER = { x: 2.55, y: -0.5, z: 0.55, sheetScale: 0.3 };

export const PILLAR_BEATS = [
  {
    key: 'security',
    in: [0.660, 0.678],
    story: [0.688, 0.762],
    park: [0.775, 0.789],
    solo: { x: 2.35, y: 0.15, z: 0.4 },
    parked: { x: -3.9, y: 2.6, z: -1.9 },
    docTarget: { x: 2.35, y: 0.2, z: 0.8 },
  },
  {
    key: 'ai',
    in: [0.812, 0.828],
    story: [0.836, 0.878],
    park: [0.882, 0.894],
    solo: { x: -1.9, y: -0.55, z: 0.5 },
    parked: { x: 0, y: 2.4, z: -1.3 },
    docTarget: { x: -1.9, y: -0.45, z: 0.95 },
  },
  {
    key: 'audit',
    in: [0.910, 0.924],
    story: [0.930, 0.948],
    park: [0.950, 0.958],
    solo: { x: 1.9, y: 0.1, z: 0.5 },
    parked: { x: 2.7, y: 2.1, z: -1 },

    docTarget: { x: 2.6, y: -0.5, z: 0.9 },
  },
];

export const GATE_PROGRESS = 0.2;

export const RANGES = {
  materialize: [0.04, 0.11],
  spread: [0.22, 0.31],
  gather: [0.39, 0.50],

  condense: [0.55, 0.585, 0.615, 0.65],
  pillars: [0.66, 0.958],

  camZ: [0, 0.08, 0.16, 0.95, 1],
  camZValues: [19, 11.4, 10.2, 10.2, 12.6],
};

export const STAGES = [
  {
    key: 'problem',
    range: [0.19, 0.37],
    align: 'left',
    eyebrow: 'no. 01, the problem',
    title: ['Documents scatter.', 'Proof gets lost.'],
    sub: 'Files multiply across inboxes and drives, versions drift, untracked and unproven.',
  },
  {
    key: 'centralize',
    range: [0.40, 0.61],
    align: 'right',
    eyebrow: 'no. 02, one workspace',
    title: ['One system brings', 'them home.'],
    sub: 'Every file centralised, versioned and filed into one folder, however messy it arrived.',
  },
  {
    key: 'security',
    range: [0.665, 0.775],
    align: 'left',
    eyebrow: 'pillar 01, security',
    title: ['Sealed under', 'lock & key.'],
    sub: 'AES-256-GCM at rest and in transit, hardened with post-quantum ML-KEM key exchange.',
  },
  {
    key: 'ai',
    range: [0.815, 0.892],
    align: 'right',
    eyebrow: 'pillar 02, ai intelligence',
    title: ['An intelligence that', 'reads everything.'],
    sub: 'DoKi turns any document into reports, mindmaps and infographics in seconds.',
  },
  {
    key: 'audit',
    range: [0.910, 0.958],
    align: 'left',
    eyebrow: 'pillar 03, audit & compliance',
    title: ['Every action,', 'judged & proven.'],
    sub: 'An immutable on-chain audit trail, GDPR & UU PDP compliant, every file proven.',
  },
];
