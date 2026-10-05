import { motion, useReducedMotion } from "framer-motion";

// Mini trend line. Renders nothing unless there is a real >=2-point series, so no
// stat card ever shows a fabricated trend.
export default function StatSparkline({ series, color = "#818cf8" }) {
  const reduce = useReducedMotion();
  if (!Array.isArray(series) || series.length < 2) return null;

  const W = 60;
  const H = 14;
  const max = Math.max(...series, 1);
  const points = series.map((v, i) => {
    const x = (i / (series.length - 1)) * W;
    const y = H - (v / max) * (H - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M${points.join(" L")}`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="mt-1.5">
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.7, ease: "easeOut" }}
      />
    </svg>
  );
}
