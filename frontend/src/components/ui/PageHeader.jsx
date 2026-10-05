import { motion, useReducedMotion } from "framer-motion";
import { useLang } from "@/app/providers/LanguageProvider";

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  accent, // optional Tailwind gradient stops; omit to follow the user's accent preference
  onBack,
  className = "",
  children,
}) {
  const reduce = useReducedMotion();
  const { t } = useLang();
  // No explicit accent → the themeable accent gradient (indigo by default).
  const accentBg = accent ? `bg-linear-to-r ${accent}` : "bg-accent-gradient";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className={`mb-7 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
        <div className="flex items-start gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="mt-1 p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label={t("common.back")}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <div className="flex items-center gap-2 mb-2">
                <span className={`h-px w-5 rounded-full ${accentBg}`} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">{eyebrow}</span>
              </div>
            )}
            <h1 className="text-[26px] sm:text-[32px] leading-[1.05] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">{title}</h1>
            <div className={`mt-3 h-[3px] w-10 rounded-full ${accentBg}`} />
            {subtitle && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap shrink-0 sm:pt-1">{actions}</div>}
      </div>
      {children}
    </motion.div>
  );
}
