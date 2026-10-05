import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Turnstile } from "@marsidev/react-turnstile";
import authService from "../../services/auth.service";
import { useLang } from "@/app/providers/LanguageProvider";

// Cloudflare Turnstile - test key always-pass for dev. Override via VITE_TURNSTILE_SITE_KEY.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export default function ForgotPassword() {
  const { t } = useLang();

  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const turnstileRef = useRef(null);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);

    if (!email) return setError(t("auth.forgot.emailRequired"));
    if (!/\S+@\S+\.\S+/.test(email)) return setError(t("auth.forgot.emailInvalid"));

    setIsLoading(true);
    // Response is intentionally generic, treat as success regardless of email existence
    await authService.forgotPassword(email, captchaToken);
    setIsLoading(false);
    setSent(true);
  }, [email, captchaToken, t]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-slate-600/20 rounded-full blur-[120px] animate-pulse-slow animation-delay-1000" />

      <div className="w-full max-w-md relative z-10">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative">
          <div className="relative bg-slate-900/80 backdrop-blur-2xl rounded-3xl border border-slate-800/50 shadow-2xl shadow-black/50 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-800/20 to-transparent pointer-events-none" />

            <div className="relative p-8 lg:p-10">
              <motion.div variants={itemVariants} className="text-center mb-8">
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl" />
                  <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">
                  {sent ? t("auth.forgot.sentTitle") : t("auth.forgot.title")}
                </h1>
                <p className="text-slate-400 text-sm">
                  {sent ? t("auth.forgot.sentBody") : t("auth.forgot.subtitle")}
                </p>
              </motion.div>

              {sent ? (
                <motion.div variants={itemVariants}>
                  <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                    <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-emerald-300">{email}</p>
                  </div>
                  <Link
                    to="/login"
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-white font-medium rounded-xl transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    {t("auth.forgot.backToLogin")}
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
                      {t("auth.forgot.emailLabel")}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(null); }}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:border-indigo-500/50 focus:ring-indigo-500/20 transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={setCaptchaToken}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => setCaptchaToken(null)}
                      options={{ theme: "dark", size: "flexible" }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !captchaToken}
                    className="relative w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all duration-200 overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <span className="relative flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          {t("auth.forgot.sending")}
                        </>
                      ) : (
                        t("auth.forgot.submit")
                      )}
                    </span>
                  </button>

                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    {t("auth.forgot.backToLogin")}
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
