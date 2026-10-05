import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLang } from "@/app/providers/LanguageProvider";
import { countByMatchType } from "../lib/osint-metrics";

const SEGMENTS = [
  { key: "visible_code", label: "visible-code", color: "#10b981" },
  { key: "watermark", label: "watermark", color: "#6366f1" },
  { key: "honeytoken", label: "honeytoken", color: "#f59e0b" },
  { key: "other", label: "other", color: "#64748b" },
];

const R = 15.915;

export default function DetectionDonut({ leaks }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(null);
  const counts = countByMatchType(leaks || []);
  const total = counts.total;

  let cursor = 0;
  const arcs = SEGMENTS.map((s) => {
    const val = counts[s.key] || 0;
    const pct = total > 0 ? (val / total) * 100 : 0;
    const arc = { ...s, val, pct, offset: 25 - cursor };
    cursor += pct;
    return arc;
  });

  const summary = `${t("osint.donut.summaryLabel")}: ${counts.visible_code} visible-code, ${counts.watermark} watermark, ${counts.honeytoken} honeytoken`;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9 9 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
        {t("osint.donut.title")}
      </h3>

      <div className="flex items-center gap-5">
        <svg width="96" height="96" viewBox="0 0 42 42" role="img" aria-label={summary}>
          <circle cx="21" cy="21" r={R} fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="5" />
          {total === 0 ? (
            <circle cx="21" cy="21" r={R} fill="none" stroke="#64748b" strokeOpacity="0.4" strokeWidth="5" />
          ) : (
            arcs
              .filter((a) => a.val > 0)
              .map((a) => (
                <motion.circle
                  key={a.key}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="5"
                  strokeDashoffset={a.offset}
                  strokeOpacity={active && active !== a.key ? 0.25 : 1}
                  initial={reduce ? false : { strokeDasharray: "0 100" }}
                  animate={{ strokeDasharray: `${a.pct} ${100 - a.pct}` }}
                  transition={reduce ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
                />
              ))
          )}
          <text
            x="21"
            y="21"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-slate-900 dark:fill-white"
            fontSize="7"
            fontWeight="700"
          >
            {total}
          </text>
        </svg>

        <ul className="flex-1 space-y-1.5">
          {total === 0 ? (
            <li className="text-xs text-slate-500 dark:text-slate-400">{t("osint.donut.noDetections")}</li>
          ) : (
            arcs.map((a) => (
              <li key={a.key}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(a.key)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(a.key)}
                  onBlur={() => setActive(null)}
                  className="w-full flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: a.color }} />
                    {a.label}
                  </span>
                  <span className="tabular-nums font-medium">{a.val}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
