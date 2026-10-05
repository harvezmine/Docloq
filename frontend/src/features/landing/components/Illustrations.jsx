// Line-art spot illustrations for the use-case stories. Same fine-line language as the
// hero's guilloche ribbons: thin strokes in cobalt on navy, no gradients, no motion.

const INK = '#0b1b38';
const INK_2 = '#10264a';
const LINE = '#92c1fd';
const LINE_DIM = '#33507d';
const ACCENT = '#3d84db';
const BAR = '#284470';
const RED = '#f87171';
const AMBER = '#fbbf24';
const GREEN = '#34d399';

const svgProps = {
  viewBox: '0 0 480 300',
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  className: 'h-auto w-full',
};

/* Fine concentric rings behind each subject, a quiet nod to security print. */
function Backdrop({ cx = 240, cy = 150, radii = [54, 76, 98, 120, 142] }) {
  return (
    <g stroke={ACCENT} strokeWidth="1">
      {radii.map((r, i) => (
        <circle key={r} cx={cx} cy={cy} r={r} opacity={0.2 - i * 0.03} />
      ))}
    </g>
  );
}

/* A document sheet with a folded corner and placeholder text lines. */
function Sheet({ x, y, w = 118, h = 150, rotate = 0, opacity = 1, lines = [0.78, 0.92, 0.66, 0.86, 0.54, 0.8], children }) {
  const fold = 22;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${w / 2} ${h / 2})`} opacity={opacity}>
      <path
        d={`M10 0 H${w - fold} L${w} ${fold} V${h - 10} Q${w} ${h} ${w - 10} ${h} H10 Q0 ${h} 0 ${h - 10} V10 Q0 0 10 0 Z`}
        fill={INK}
        stroke={LINE_DIM}
        strokeWidth="1.5"
      />
      <path d={`M${w - fold} 0 V${fold - 6} Q${w - fold} ${fold} ${w - fold + 6} ${fold} H${w}`} stroke={LINE_DIM} strokeWidth="1.5" />
      <rect x="16" y="22" width={w * 0.42} height="7" rx="3.5" fill={LINE} opacity="0.55" />
      {lines.map((l, i) => (
        <rect key={i} x="16" y={44 + i * 15} width={(w - 32) * l} height="5" rx="2.5" fill={BAR} />
      ))}
      {children}
    </g>
  );
}

function Magnifier({ x, y, r = 16, stroke = LINE }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={stroke} strokeWidth="2">
      <circle r={r} fill={INK} />
      <path d={`M${r * 0.72} ${r * 0.72} L${r * 1.45} ${r * 1.45}`} strokeWidth="3" />
    </g>
  );
}

/* 1. A copy leaves the building, but its thread leads back to the account it came from. */
export function TracedCopy() {
  return (
    <svg {...svgProps}>
      <Backdrop cx={252} cy={146} />

      {/* the account the copy came from */}
      <g transform="translate(58 82)">
        <rect x="38" y="-9" width="28" height="12" rx="5" fill={INK_2} stroke={LINE_DIM} strokeWidth="1.5" />
        <rect width="104" height="132" rx="14" fill={INK} stroke={LINE} strokeWidth="1.5" />
        <circle cx="52" cy="46" r="21" fill={INK_2} stroke={LINE} strokeWidth="1.5" />
        <text x="52" y="51" textAnchor="middle" fontSize="14" fontWeight="600" fill="#dcedff" stroke="none">RP</text>
        <rect x="22" y="82" width="60" height="7" rx="3.5" fill={LINE} opacity="0.5" />
        <rect x="31" y="97" width="42" height="6" rx="3" fill={BAR} />
      </g>

      {/* copies spreading out */}
      <Sheet x={326} y={64} rotate={10} opacity={0.3} />
      <Sheet x={312} y={70} rotate={5} opacity={0.55} />
      <Sheet x={296} y={76}>
        {[52, 82, 112].map((cy, i) => (
          <rect key={cy} x={[63, 39, 85][i]} y={cy - 7} width="3" height="14" rx="1.5" fill={LINE} stroke="none" />
        ))}
      </Sheet>

      {/* the thread back to its source */}
      <path d="M296 196 C 262 252, 206 250, 164 200" stroke={ACCENT} strokeWidth="2" strokeDasharray="2 7" />
      <Magnifier x={226} y={232} r={15} />
    </svg>
  );
}

/* 2. Two versions side by side; one digit changed and flagged. */
export function ChangedValue({ before, after }) {
  return (
    <svg {...svgProps}>
      <Backdrop cx={250} cy={150} />

      <g>
        <rect x="108" y="40" width="34" height="18" rx="6" fill={INK_2} stroke={LINE_DIM} strokeWidth="1.5" />
        <text x="125" y="53" textAnchor="middle" fontSize="11" fontWeight="600" fill="#94a3b8" stroke="none">v2</text>
        <Sheet x={96} y={62} w={150} h={176} lines={[0.82, 0.9, 0.6, 0.88, 0.74, 0.5, 0.84, 0.7]}>
          <rect x="12" y="134" width="126" height="24" rx="6" fill={INK_2} stroke={LINE_DIM} strokeWidth="1" />
          <text x="22" y="150" fontSize="12" fontWeight="600" fill="#cbd5e1" stroke="none">{before}</text>
        </Sheet>
      </g>

      <g>
        <rect x="262" y="58" width="34" height="18" rx="6" fill={INK_2} stroke={AMBER} strokeWidth="1.5" />
        <text x="279" y="71" textAnchor="middle" fontSize="11" fontWeight="600" fill={AMBER} stroke="none">v3</text>
        <Sheet x={250} y={80} w={150} h={176} lines={[0.82, 0.9, 0.6, 0.88, 0.74, 0.5, 0.84, 0.7]}>
          <rect x="12" y="134" width="126" height="24" rx="6" fill="#2a2108" stroke={AMBER} strokeWidth="1.5" />
          <text x="22" y="150" fontSize="12" fontWeight="600" fill="#fde68a" stroke="none">{after}</text>
        </Sheet>
      </g>

      {/* the difference, called out */}
      <path d="M246 226 H262" stroke={AMBER} strokeWidth="2" strokeDasharray="2 5" />
      <Magnifier x={420} y={196} r={18} stroke={AMBER} />
      <text x="420" y="201" textAnchor="middle" fontSize="15" fontWeight="700" fill={AMBER} stroke="none">≠</text>
    </svg>
  );
}

/* 3. A payslip shows up in a chat, but only as a read-only view stamped with a name. */
export function ReadOnlyShare({ stamp }) {
  return (
    <svg {...svgProps}>
      <Backdrop cx={236} cy={150} />

      {/* the original stays put, locked */}
      <Sheet x={70} y={78} w={112} h={142} />
      <g transform="translate(160 194)">
        <circle r="17" fill={INK_2} stroke={LINE} strokeWidth="1.5" />
        <rect x="-7" y="-2" width="14" height="11" rx="2.5" stroke={LINE} strokeWidth="1.5" />
        <path d="M-4.5 -2 V-6 a4.5 4.5 0 0 1 9 0 V-2" stroke={LINE} strokeWidth="1.5" />
      </g>

      {/* only a view travels */}
      <path d="M194 150 H268" stroke={ACCENT} strokeWidth="2" strokeDasharray="2 7" />
      <g transform="translate(231 150)">
        <circle r="14" fill={INK} stroke={ACCENT} strokeWidth="1.5" />
        <path d="M-7 0 Q0 -7 7 0 Q0 7 -7 0 Z" stroke={LINE} strokeWidth="1.5" />
        <circle r="2" fill={LINE} stroke="none" />
      </g>

      {/* the phone and the group chat */}
      <g transform="translate(276 38)">
        <rect width="140" height="228" rx="22" fill={INK} stroke={LINE} strokeWidth="1.5" />
        <rect x="52" y="10" width="36" height="6" rx="3" fill={LINE_DIM} />
        <rect x="14" y="30" width="78" height="22" rx="10" fill={INK_2} />
        <rect x="48" y="60" width="78" height="22" rx="10" fill="#1559a4" opacity="0.7" />
        <g transform="translate(14 92)">
          <rect width="96" height="118" rx="10" fill={INK_2} stroke={LINE_DIM} strokeWidth="1.2" />
          <rect x="12" y="14" width="44" height="6" rx="3" fill={LINE} opacity="0.5" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="12" y={30 + i * 12} width={[60, 72, 48, 66, 54][i]} height="4" rx="2" fill={BAR} />
          ))}
          <g transform="rotate(-28 48 64)" opacity="0.75">
            {[44, 64, 84].map((y) => (
              <text key={y} x="-6" y={y} fontSize="8" fontWeight="700" letterSpacing="1.5" fill={LINE} stroke="none">{stamp}</text>
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
}

/* 4. An unbroken activity log, sealed, ready for the auditor. */
export function IntactLog() {
  const rows = [0.72, 0.58, 0.8, 0.5, 0.66];
  return (
    <svg {...svgProps}>
      <Backdrop cx={232} cy={150} />

      <g transform="translate(128 40)">
        <rect x="58" y="-8" width="64" height="20" rx="7" fill={INK_2} stroke={LINE} strokeWidth="1.5" />
        <rect width="180" height="226" rx="16" fill={INK} stroke={LINE} strokeWidth="1.5" />
        <path d="M34 42 V194" stroke={LINE_DIM} strokeWidth="1.5" />
        {rows.map((w, i) => {
          const y = 42 + i * 38;
          const active = i === 2;
          return (
            <g key={i}>
              <circle cx="34" cy={y} r="6" fill={active ? ACCENT : INK_2} stroke={active ? LINE : LINE_DIM} strokeWidth="1.5" />
              <rect x="52" y={y - 9} width={110 * w} height="6" rx="3" fill={active ? LINE : BAR} opacity={active ? 0.7 : 1} />
              <rect x="52" y={y + 3} width={70 * w} height="5" rx="2.5" fill={BAR} opacity="0.6" />
            </g>
          );
        })}
      </g>

      {/* the seal */}
      <g transform="translate(330 196)">
        {[40, 33, 26].map((r, i) => (
          <circle key={r} r={r} fill={i === 2 ? INK_2 : 'none'} stroke={GREEN} strokeWidth={i === 0 ? 2 : 1} opacity={i === 1 ? 0.6 : 1} />
        ))}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return <line key={i} x1={Math.cos(a) * 34.5} y1={Math.sin(a) * 34.5} x2={Math.cos(a) * 38.5} y2={Math.sin(a) * 38.5} stroke={GREEN} strokeWidth="1" opacity="0.7" />;
        })}
        <path d="M-10 0 L-3 7 L11 -8" stroke={GREEN} strokeWidth="3" />
      </g>

      <Magnifier x={96} y={86} r={18} />
    </svg>
  );
}

/* ---------- How-it-works stages (smaller, same language) ---------- */

const stageProps = { ...svgProps, viewBox: '0 0 240 170' };
const STAGE_RINGS = [44, 58, 72, 84];

/* Store: a document slides into a vault. */
export function StoreStage() {
  return (
    <svg {...stageProps}>
      <Backdrop cx={120} cy={92} radii={STAGE_RINGS} />
      <g transform="translate(70 52)">
        <rect width="100" height="100" rx="18" fill={INK} stroke={LINE} strokeWidth="1.5" />
        <circle cx="50" cy="52" r="30" fill={INK_2} stroke={LINE_DIM} strokeWidth="1.5" />
        <circle cx="50" cy="52" r="20" stroke={LINE} strokeWidth="1.5" />
        {[0, 60, 120].map((a) => (
          <line key={a} x1="50" y1="52" x2={50 + Math.cos((a * Math.PI) / 180) * 20} y2={52 + Math.sin((a * Math.PI) / 180) * 20} stroke={LINE} strokeWidth="1.5" />
        ))}
        <rect x="30" y="-6" width="40" height="8" rx="3" fill={INK_2} stroke={LINE_DIM} strokeWidth="1.2" />
      </g>
      <g transform="translate(96 8)">
        <rect width="48" height="54" rx="6" fill={INK} stroke={LINE_DIM} strokeWidth="1.5" />
        {[0, 1, 2].map((i) => <rect key={i} x="9" y={12 + i * 11} width={[28, 22, 26][i]} height="4" rx="2" fill={BAR} />)}
      </g>
      <path d="M120 66 V76" stroke={ACCENT} strokeWidth="2" />
      <g transform="translate(176 140)">
        <circle r="13" fill={INK_2} stroke={GREEN} strokeWidth="1.5" />
        <path d="M-5 0 L-1.5 3.5 L5.5 -4" stroke={GREEN} strokeWidth="2.2" />
      </g>
    </svg>
  );
}

/* Set access: a folder and three people, each switched on or off. */
export function AccessStage() {
  const people = [true, true, false];
  return (
    <svg {...stageProps}>
      <Backdrop cx={120} cy={88} radii={STAGE_RINGS} />
      <g transform="translate(46 28)">
        <path d="M0 14 Q0 4 10 4 H48 L58 14 H138 Q148 14 148 24 V112 Q148 122 138 122 H10 Q0 122 0 112 Z" fill={INK} stroke={LINE} strokeWidth="1.5" />
        {people.map((on, i) => {
          const y = 40 + i * 26;
          return (
            <g key={i}>
              <circle cx="24" cy={y} r="8" fill={INK_2} stroke={on ? LINE : LINE_DIM} strokeWidth="1.5" />
              <rect x="40" y={y - 3} width={[52, 44, 48][i]} height="6" rx="3" fill={on ? BAR : '#1c2c45'} />
              <rect x="106" y={y - 7} width="26" height="14" rx="7" fill={on ? ACCENT : '#1c2c45'} />
              <circle cx={on ? 125 : 113} cy={y} r="5" fill={on ? '#eef7ff' : '#4b5d78'} stroke="none" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* Monitor: a radar sweep catches one odd event. */
export function WatchStage() {
  return (
    <svg {...stageProps}>
      <g transform="translate(120 90)">
        {[22, 44, 66].map((r) => <circle key={r} r={r} stroke={LINE_DIM} strokeWidth="1.2" />)}
        <path d="M-70 0 H70 M0 -70 V70" stroke={LINE_DIM} strokeWidth="1" opacity="0.6" />
        <path d="M0 0 L58 -34 A66 66 0 0 1 66 0 Z" fill={ACCENT} opacity="0.22" stroke="none" />
        <path d="M0 0 L58 -34" stroke={LINE} strokeWidth="1.5" />
        {[[-30, -20], [-18, 34], [26, 40], [-48, 12]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3" fill={LINE} stroke="none" opacity="0.7" />)}
        <circle cx="40" cy="-14" r="5" fill={RED} stroke="none" />
        <circle cx="40" cy="-14" r="11" stroke={RED} strokeWidth="1.2" opacity="0.6" />
      </g>
      <g transform="translate(192 34)">
        <circle r="15" fill={INK_2} stroke={RED} strokeWidth="1.5" />
        <path d="M-6 3 V-1 a6 6 0 0 1 12 0 V3 L8 5 H-8 Z" stroke={RED} strokeWidth="1.5" />
        <path d="M-2 8 a2 2 0 0 0 4 0" stroke={RED} strokeWidth="1.5" />
      </g>
    </svg>
  );
}

/* ---------- AI section: the contract DoKi is answering from ---------- */

/* A contract page with three passages marked 1-3, matching DoKi's numbered answer. */
export function ContractPage() {
  const block = (y, rows, mark) => (
    <g key={y}>
      {mark && <rect x="30" y={y - 8} width="300" height={rows * 16 + 8} rx="6" fill={ACCENT} opacity="0.16" stroke="none" />}
      {Array.from({ length: rows }, (_, i) => (
        <rect key={i} x="44" y={y + i * 16} width={i === rows - 1 ? 170 : 272} height="6" rx="3" fill={mark ? LINE : BAR} opacity={mark ? 0.55 : 1} />
      ))}
      {mark && (
        <g transform={`translate(18 ${y + (rows * 16) / 2 - 6})`}>
          <circle r="11" fill="#1559a4" stroke="none" />
          <text y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff" stroke="none">{mark}</text>
        </g>
      )}
    </g>
  );
  return (
    <svg {...svgProps} viewBox="0 0 360 440">
      <rect x="1" y="1" width="358" height="438" rx="18" fill={INK} stroke={LINE_DIM} strokeWidth="1.5" />
      <rect x="44" y="36" width="140" height="10" rx="5" fill={LINE} opacity="0.6" />
      <rect x="44" y="56" width="90" height="6" rx="3" fill={BAR} />
      {block(92, 3)}
      {block(152, 3, '1')}
      {block(220, 2, '2')}
      {block(272, 3)}
      {block(332, 3, '3')}
      <rect x="44" y="404" width="60" height="6" rx="3" fill={BAR} />
      <rect x="300" y="404" width="30" height="6" rx="3" fill={BAR} />
    </svg>
  );
}
