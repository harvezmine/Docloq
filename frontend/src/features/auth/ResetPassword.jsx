import { useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import authService from "../../services/auth.service";
import { useLang } from "@/app/providers/LanguageProvider";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export default function ResetPassword() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) return setError(t("auth.reset.tooShort"));
    if (password !== confirm) return setError(t("auth.reset.mismatch"));

    setIsLoading(true);
    const res = await authService.resetPassword(token, password);
    setIsLoading(false);

    if (res?.success) {
      setDone(true);
      setTimeout(() => navigate("/login"), 3500);
    } else {
      setError(res?.message || t("auth.reset.missingToken"));
    }
  }, [password, confirm, token, navigate, t]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative">
          <div className="relative bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl shadow-black/50 overflow-hidden">

            <div className="relative p-8 lg:p-10">
              <motion.div variants={itemVariants} className="text-center mb-8">
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="relative w-full h-full rounded-2xl bg-slate-800 border border-slate-700/50 flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">
                  {done ? t("auth.reset.successTitle") : t("auth.reset.title")}
                </h1>
                <p className="text-slate-400 text-sm">
                  {done ? t("auth.reset.successBody") : t("auth.reset.subtitle")}
                </p>
              </motion.div>

              {done ? (
                <motion.div variants={itemVariants}>
                  <Link
                    to="/login"
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl transition-all duration-200"
                  >
                    {t("auth.reset.goToLogin")}
                  </Link>
                </motion.div>
              ) : !token ? (
                <motion.div variants={itemVariants}>
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-sm text-center">{t("auth.reset.missingToken")}</p>
                  </div>
                  <Link
                    to="/forgot-password"
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-white font-medium rounded-xl transition-all duration-200"
                  >
                    {t("auth.reset.requestNew")}
                  </Link>
                </motion.div>
              ) : (
                <motion.form variants={itemVariants} onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <p className="text-red-400 text-sm text-center">{error}</p>
                    </div>
                  )}

                  <div className="group">
                    <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                      {t("auth.reset.newPassword")}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(null); }}
                        className="w-full pl-12 pr-12 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:border-brand-500/50 focus:ring-brand-500/20 transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="group">
                    <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                      {t("auth.reset.confirmPassword")}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirm}
                        onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:border-brand-500/50 focus:ring-brand-500/20 transition-all duration-200"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="relative w-full py-3.5 px-6 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl transition-all duration-200 overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <span className="relative flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          {t("auth.reset.submitting")}
                        </>
                      ) : (
                        t("auth.reset.submit")
                      )}
                    </span>
                  </button>

                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-brand-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    {t("auth.reset.backToLogin")}
                  </Link>
                </motion.form>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.05); } }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
        .animation-delay-1000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}
