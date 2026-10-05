
import { useReducedMotion } from "./crt-hooks.js";
import { useLang } from "@/app/providers/LanguageProvider";

const TONE = {
  accent: "var(--crt-accent)",
  ok: "var(--crt-accent)",
  warn: "var(--crt-warn)",
  crit: "var(--crt-crit)",
  dim: "var(--crt-fg-dim)",
  faint: "var(--crt-fg-faint)",
};
const toneVar = (t) => TONE[t] || TONE.accent;

const clampPct = (n) => Math.max(0, Math.min(100, n || 0));
const shortH = (s, head = 6, tail = 4) =>
  !s ? "-" : s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

export function TerminalStat({ icon, label, value, sub, tone = "accent" }) {
  return (
    <div className="crt-tile">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[color:var(--crt-fg-faint)] text-[10px] uppercase tracking-[0.15em] font-mono">
          {label}
        </span>
        {icon && <span style={{ color: toneVar(tone) }} className="[&_svg]:w-4 [&_svg]:h-4">{icon}</span>}
      </div>
      <div className="font-mono text-2xl leading-none tabular-nums" style={{ color: toneVar(tone) }}>
        {value}
      </div>
      {sub && <p className="mt-1.5 text-[11px] font-mono text-[color:var(--crt-fg-dim)]">{sub}</p>}
    </div>
  );
}

export function GlowMeter({ label, value, max = 100, display, tone = "accent", ticks = 4 }) {
  const pct = clampPct(max ? (value / max) * 100 : 0);
  const fillTone = tone === "warn" ? "is-warn" : tone === "crit" ? "is-crit" : "";
  return (
    <div className="font-mono">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-[color:var(--crt-fg-dim)]">{label}</span>
        <span className="text-sm tabular-nums" style={{ color: toneVar(tone) }}>
          {display ?? `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="crt-meter-track">
        <div className={`crt-meter-fill ${fillTone}`} style={{ width: `${pct}%`, transition: "width 0.6s ease-out" }} />
        {Array.from({ length: ticks - 1 }, (_, i) => (
          <span
            key={i}
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${((i + 1) / ticks) * 100}%`, background: "var(--crt-bg)", opacity: 0.6 }}
          />
        ))}
      </div>
    </div>
  );
}

export function SegmentBar({ segments = [], hint }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  return (
    <div className="font-mono">
      <div className="flex h-4 border border-[color:var(--crt-border)] overflow-hidden bg-[color:var(--crt-panel-2)]">
        {segments.map((s, i) => {
          const pct = ((s.value || 0) / total) * 100;
          if (!s.value) return null;
          return (
            <div
              key={i}
              title={`${s.label}: ${s.value}`}
              style={{
                width: `${Math.max(pct, 2)}%`,
                background: toneVar(s.tone),
                boxShadow: `inset 0 0 12px -4px ${toneVar(s.tone)}`,
                transition: "width 0.5s ease-out",
              }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        {segments.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--crt-fg-dim)]">
            <span className="w-2 h-2" style={{ background: toneVar(s.tone), boxShadow: `0 0 5px ${toneVar(s.tone)}` }} />
            {s.label}
            <span className="tabular-nums" style={{ color: toneVar(s.tone) }}>{s.value}</span>
            <span className="text-[color:var(--crt-fg-faint)]">({Math.round(((s.value || 0) / total) * 100)}%)</span>
          </span>
        ))}
      </div>
      {hint && <p className="mt-2 text-[10px] text-[color:var(--crt-fg-faint)]">{hint}</p>}
    </div>
  );
}

export function RadialGauge({ value = 0, max = 100, centre, label, tone = "accent", size = 128 }) {
  const pct = clampPct(max ? (value / max) * 100 : 0);
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const stroke = toneVar(tone);
  return (
    <div className="flex flex-col items-center font-mono">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--crt-border)" strokeWidth="8" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth="8"
            strokeLinecap="butt" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
            style={{ transition: "stroke-dashoffset 0.7s ease-out", filter: `drop-shadow(0 0 4px ${stroke})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg leading-none tabular-nums" style={{ color: stroke }}>{centre ?? `${Math.round(pct)}%`}</span>
        </div>
      </div>
      {label && <span className="mt-2 text-[11px] uppercase tracking-wider text-[color:var(--crt-fg-dim)] text-center">{label}</span>}
    </div>
  );
}

export function HashChainViz({ entries = [], max = 9, onSelect, selectedSeq }) {
  const { t } = useLang();
  const sorted = [...entries].sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));
  const shown = sorted.slice(-max);
  const hiddenBefore = sorted.length - shown.length;
  if (shown.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-stretch min-w-min font-mono">
        {hiddenBefore > 0 && (
          <div className="flex items-center pr-1 text-[color:var(--crt-fg-faint)] text-xs shrink-0">
            +{hiddenBefore}…
          </div>
        )}
        {shown.map((e, i) => {
          const isHead = i === shown.length - 1;
          const isSelected = selectedSeq != null && e.sequenceNumber === selectedSeq;
          const label = `${t("superadmin.viz.seq")} #${e.sequenceNumber}\n${e.action || ""}\n${t("superadmin.viz.prev")} ${e.prevHash || "-"}\n${t("superadmin.viz.hash")} ${e.entryHash || "-"}`;
          const body = (
            <>
              <span className="text-[10px] leading-none">#{e.sequenceNumber}</span>
              <span className="text-[11px] leading-tight mt-0.5">{shortH(e.entryHash, 4, 4)}</span>
            </>
          );
          return (
            <div key={e.sequenceNumber ?? i} className="flex items-center shrink-0">
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(e)}
                  title={label}
                  aria-label={`${t("superadmin.viz.seq")} #${e.sequenceNumber}`}
                  aria-pressed={isSelected}
                  className={`crt-node ${isHead ? "is-head crt-pulse" : ""} cursor-pointer transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
                  style={isSelected ? { outline: "2px solid var(--crt-accent)", outlineOffset: "2px" } : undefined}
                >
                  {body}
                </button>
              ) : (
                <div className={`crt-node ${isHead ? "is-head crt-pulse" : ""}`} title={label}>
                  {body}
                </div>
              )}
              {!isHead && <ChainLink />}
              {isHead && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-[color:var(--crt-accent)] shrink-0">{t("superadmin.viz.head")}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChainLink() {
  const reduced = useReducedMotion();
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" className="shrink-0" aria-hidden="true">
      <line
        x1="0" y1="8" x2="20" y2="8"
        stroke="var(--crt-accent-dim)" strokeWidth="1.5" strokeDasharray="4 3"
        className={reduced ? "" : "crt-flow"}
      />
      <path d="M18 4 L24 8 L18 12" fill="none" stroke="var(--crt-accent)" strokeWidth="1.5" />
    </svg>
  );
}

// keep proof path visible
const windowLeaves = (total, max, focus) => {
  if (total <= max) return { start: 0, size: total };
  if (focus == null) return { start: 0, size: max };
  const start = Math.max(0, Math.min(total - max, focus - Math.floor(max / 2)));
  return { start, size: max };
};

export function MerkleTree({
  leafCount = 0,
  root,
  caption,
  leafHashes = null,
  proofIndex = null,
  brokenIndexes = null,
  onLeafClick,
}) {
  const { t } = useLang();
  const MAX = 8;
  const total = Math.max(1, leafCount || 0);
  const win = windowLeaves(total, MAX, proofIndex);
  const leaves = win.size;
  const truncated = total > leaves;

  const broken = new Set(brokenIndexes || []);
  const leafAt = (i) => win.start + i;
  const hashAt = (i) => leafHashes?.[leafAt(i)] || null;

  // ancestors of proof leaf
  const focusLocal = proofIndex == null ? null : proofIndex - win.start;
  const onPath = (level, idx) =>
    focusLocal != null && focusLocal >= 0 && focusLocal < leaves && Math.floor(focusLocal / 2 ** level) === idx;

  const sizes = [leaves];
  while (sizes[sizes.length - 1] > 1) sizes.push(Math.ceil(sizes[sizes.length - 1] / 2));

  const W = 300;
  const rowH = 42;
  const H = sizes.length * rowH;
  const pos = sizes.map((size, li) => {
    const y = H - 16 - li * rowH;
    return Array.from({ length: size }, (_, i) => ({
      x: size === 1 ? W / 2 : (W * (i + 0.5)) / size,
      y,
    }));
  });
  const rootPt = pos[pos.length - 1][0];

  return (
    <div className="font-mono">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: H }} className="block">
        {pos.slice(1).map((row, li) =>
          row.map((parent, pi) => {
            const children = pos[li].slice(pi * 2, pi * 2 + 2);
            const lit = onPath(li + 1, pi);
            return children.map((ch, ci) => (
              <line
                key={`${li}-${pi}-${ci}`}
                x1={parent.x} y1={parent.y} x2={ch.x} y2={ch.y}
                stroke={lit && onPath(li, pi * 2 + ci) ? "var(--crt-accent)" : "var(--crt-border-bright)"}
                strokeWidth={lit && onPath(li, pi * 2 + ci) ? "2" : "1"}
              />
            ));
          })
        )}
        {pos.map((row, li) =>
          row.map((p, i) => {
            const isRoot = li === pos.length - 1;
            const isLeaf = li === 0;
            const isBroken = isLeaf && broken.has(leafAt(i));
            const lit = onPath(li, i);
            const s = isRoot ? 9 : isLeaf ? 6 : 5;
            const stroke = isBroken ? "var(--crt-crit)"
              : isRoot || lit ? "var(--crt-accent)"
              : isLeaf ? "var(--crt-accent-dim)" : "var(--crt-border-bright)";
            const hash = isLeaf ? hashAt(i) : null;
            return (
              <rect
                key={`${li}-${i}`}
                x={p.x - s} y={p.y - s} width={s * 2} height={s * 2}
                transform={isRoot ? `rotate(45 ${p.x} ${p.y})` : undefined}
                fill={isBroken ? "var(--crt-crit)" : isRoot ? "var(--crt-accent)" : lit ? "var(--crt-accent-dim)" : "var(--crt-panel-2)"}
                stroke={stroke}
                strokeWidth={lit || isBroken ? "1.5" : "1"}
                style={{
                  filter: isRoot ? "drop-shadow(0 0 5px var(--crt-accent))" : undefined,
                  cursor: isLeaf && onLeafClick ? "pointer" : undefined,
                }}
                onClick={isLeaf && onLeafClick ? () => onLeafClick(leafAt(i)) : undefined}
              >
                {hash && <title>{`#${leafAt(i)} ${hash}`}</title>}
              </rect>
            );
          })
        )}
        <text x={rootPt.x} y={rootPt.y - 14} textAnchor="middle" fontSize="8" fill="var(--crt-accent)">{t("superadmin.viz.root")}</text>
      </svg>
      <div className="flex items-center justify-between mt-1 text-[11px]">
        <span className="text-[color:var(--crt-fg-dim)]">
          {formatN(total)} {t("superadmin.viz.leaf")}{total === 1 ? "" : t("superadmin.viz.pluralSuffix")}{truncated ? ` · #${win.start}–${win.start + leaves - 1} ${t("superadmin.viz.shown")}` : ""}
        </span>
        {root && <code className="text-[color:var(--crt-accent)]">{shortH(root, 6, 6)}</code>}
      </div>
      {caption && <p className="mt-1 text-[10px] text-[color:var(--crt-fg-faint)]">{caption}</p>}
    </div>
  );
}

export function BlockStrip({ items = [], label }) {
  const { t } = useLang();
  return (
    <div className="font-mono">
      {label && <p className="text-[11px] uppercase tracking-wider text-[color:var(--crt-fg-dim)] mb-2">{label}</p>}
      <div className="flex items-end gap-1 flex-wrap">
        {items.length === 0 && <span className="text-[color:var(--crt-fg-faint)] text-xs">{t("superadmin.viz.noBlocks")}</span>}
        {items.map((b, i) => (
          <span
            key={i}
            title={b.title}
            className={`inline-block ${i === items.length - 1 ? "crt-block-in" : ""}`}
            style={{
              width: 12,
              height: 20,
              background: toneVar(b.tone),
              boxShadow: `0 0 6px -1px ${toneVar(b.tone)}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function formatN(n) {
  return (Number(n) || 0).toLocaleString("id-ID");
}
