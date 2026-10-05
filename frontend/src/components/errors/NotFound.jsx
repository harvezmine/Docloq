import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useLang } from "@/app/providers/LanguageProvider";

export default function NotFound() {
  const { t } = useLang();
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto px-4">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-6xl font-bold text-slate-200 dark:text-slate-800 mb-2">404</h1>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("errors.notFound.title")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            {t("errors.notFound.description")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/dashboard"
              className="px-6 py-3 rounded-xl bg-accent hover:brightness-110 text-white font-semibold text-sm transition-all"
            >
              {t("errors.notFound.backToDashboard")}
            </Link>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              {t("errors.notFound.previousPage")}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
