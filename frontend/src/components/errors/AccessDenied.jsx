import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useLang } from "@/app/providers/LanguageProvider";

export default function AccessDenied() {
  const { t } = useLang();
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto px-4">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>

          <h1 className="text-6xl font-bold text-slate-200 dark:text-slate-800 mb-2">403</h1>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("errors.accessDenied.title")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            {t("errors.accessDenied.description")}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            {t("errors.accessDenied.contactIntro")}{" "}
            <span className="font-semibold text-brand-500">{t("errors.accessDenied.companyAdmin")}</span>{" "}
            {t("errors.accessDenied.contactOutro")}
          </p>

          {/* Contact admin hint */}
          <div className="p-4 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 mb-6">
            <div className="flex items-center justify-center gap-2 text-brand-600 dark:text-brand-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold">{t("errors.accessDenied.needAccess")}</span>
            </div>
            <p className="text-xs text-brand-600/80 dark:text-brand-400/80">
              {t("errors.accessDenied.needAccessHint")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/dashboard"
              className="px-6 py-3 rounded-xl bg-accent hover:brightness-110 text-white font-semibold text-sm transition-all"
            >
              {t("errors.accessDenied.backToDashboard")}
            </Link>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              {t("errors.accessDenied.previousPage")}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
