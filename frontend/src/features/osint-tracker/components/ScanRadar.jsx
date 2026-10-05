import { motion, useReducedMotion } from "framer-motion";

// Decorative "actively monitoring" radar. Rotates ONLY when scanning is active AND
// reduced-motion is off, so the visual never lies about system state.
const PINGS = [
  { cx: 70, cy: 34, color: "#f87171" },
  { cx: 32, cy: 68, color: "#fbbf24" },
  { cx: 64, cy: 72, color: "#f87171" },
];

export default function ScanRadar({ active = false, pingCount = 0 }) {
  const reduce = useReducedMotion();
  const spinning = active && !reduce;
  const pings = PINGS.slice(0, Math.min(pingCount, PINGS.length));

  return (
    <svg width="64" height="64" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
      <circle cx="50" cy="50" r="42" fill="none" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
      <circle cx="50" cy="50" r="26" fill="none" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
      <circle cx="50" cy="50" r="2" className="fill-emerald-500" />
      <motion.g
        style={{ transformOrigin: "50px 50px" }}
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={spinning ? { duration: 3, repeat: Infinity, ease: "linear" } : { duration: 0 }}
      >
        <path d="M50,50 L50,8 A42,42 0 0,1 86,64 Z" fill="#10b981" fillOpacity="0.18" />
        <line x1="50" y1="50" x2="50" y2="8" stroke="#34d399" strokeWidth="1.5" />
      </motion.g>
      {pings.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r="2.5" fill={p.color} />
      ))}
    </svg>
  );
}
