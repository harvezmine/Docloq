import { motion, useReducedMotion } from "framer-motion";
import { useLang } from "@/app/providers/LanguageProvider";
import { buildFunnel } from "../lib/osint-metrics";

// Volume stages share the brand hue (darker = earlier); leak stages switch to the
// warning/danger colors so the funnel reads as "calm until something leaks".
const BAR = {
  tracked: "bg-brand-600 dark:bg-brand-500",
  downloads: "bg-brand-300 dark:bg-brand-700",
  leaks: "bg-amber-500",
  traced: "bg-red-500",
};

export default function TrackingFunnel({ stats, leaks }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const { stages, max } = buildFunnel(stats || {}, leaks || []);
  const allZero = max === 0;
  const summary = stages.map((s) => `${s.value} ${s.label}`).join(", ");

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("osint.funnel.title")}</h3>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{t("osint.funnel.relativeVolume")}</span>
      </div>

      {allZero ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
          {t("osint.funnel.empty")}
        </p>
      ) : (
        <div className="space-y-2.5" role="img" aria-label={`${t("osint.funnel.ariaLabel")}: ${summary}`}>
          {stages.map((s, i) => (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-600 dark:text-slate-300">{s.label}</span>
                <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">{s.value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" title={`${s.label}: ${s.value}`}>
                <motion.div
                  className={`h-full rounded-full ${BAR[s.key]}`}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${Math.max(s.pct, s.value > 0 ? 6 : 0)}%` }}
                  transition={reduce ? { duration: 0 } : { duration: 0.5, delay: i * 0.06, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
