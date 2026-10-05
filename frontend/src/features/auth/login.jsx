import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Turnstile } from "@marsidev/react-turnstile";
import useAuthStore from "../../app/store/auth.store";
import authService from "../../services/auth.service";
import { useLang } from "@/app/providers/LanguageProvider";

const GOOGLE_ERROR_KEYS = {
  unregistered_email: "auth.googleError.unregistered_email",
  account_disabled: "auth.googleError.account_disabled",
  account_conflict: "auth.googleError.account_conflict",
  server_error: "auth.googleError.server_error",
  captcha_failed: "auth.googleError.captcha_failed",
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Cloudflare Turnstile - test key always-pass for dev. Override via VITE_TURNSTILE_SITE_KEY.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

// Dev bypass key sequence: Ctrl+Shift+D (only in development)
const DEV_BYPASS_ENABLED = import.meta.env.DEV;

// Static animation variants - defined outside component to prevent recreation
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function Login() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { isAuthenticated, pending2FA, isLoading: authLoading, error: authError, clearError } = useAuthStore();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [formErrors, setFormErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleError, setGoogleError] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const turnstileRef = useRef(null);

  // Redirect if already authenticated (but not if pending 2FA)
  useEffect(() => {
    if (isAuthenticated && !pending2FA) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, pending2FA, navigate]);

  // Read ?error= from Google OAuth redirect, then strip it from URL
  useEffect(() => {
    const errorCode = searchParams.get("error");
    if (errorCode) {
      setGoogleError(t(GOOGLE_ERROR_KEYS[errorCode] || GOOGLE_ERROR_KEYS.server_error));
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (!DEV_BYPASS_ENABLED) return;

    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const result = authService.devBypassLogin();
        if (result.success) {
          console.log('%c[DEV] bypass login activated', 'color: #10b981; font-weight: bold;');
          navigate("/dashboard");
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const validateForm = useCallback(() => {
    const errors = {};

    if (!formData.email) {
      errors.email = t("auth.validation.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = t("auth.validation.emailInvalid");
    }

    if (!formData.password) {
      errors.password = t("auth.validation.passwordRequired");
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData.email, formData.password]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!captchaToken) {
      setFormErrors((prev) => ({ ...prev, captcha: t("auth.captcha.completeFirst") }));
      return;
    }

    setIsLoading(true);

    const result = await authService.login(
      formData.email,
      formData.password,
      captchaToken,
      rememberMe
    );

    setIsLoading(false);

    if (result.success) {
      if (result.requires2FA) {
        navigate("/verify-otp", {
          state: {
            userId: result.userId,
            email: result.email || formData.email,
            rememberMe,
            twoFactorToken: result.twoFactorToken, // pending 2FA ticket
          }
        });
      } else {
        navigate("/dashboard");
      }
    } else {
      // Reset captcha after failed login so user gets fresh token
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  }, [validateForm, formData.email, formData.password, captchaToken, rememberMe, navigate]);

  const handleEmailChange = useCallback((e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, email: value }));
    setFormErrors(prev => ({ ...prev, email: null }));
  }, []);

  const handlePasswordChange = useCallback((e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, password: value }));
    setFormErrors(prev => ({ ...prev, password: null }));
  }, []);

  const toggleShowPassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const handleRememberMeChange = useCallback((e) => {
    setRememberMe(e.target.checked);
  }, []);

  const isSubmitDisabled = isLoading || authLoading || !captchaToken;
  const isGoogleDisabled = googleLoading || !captchaToken;

  const handleDevBypassUserLogin = useCallback(() => {
    if (!DEV_BYPASS_ENABLED) return;
    const result = authService.devBypassLogin();
    if (result?.success) {
      console.log('%c[DEV] bypass user login activated', 'color: #10b981; font-weight: bold;');
      navigate("/dashboard");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-slate-600/20 rounded-full blur-[120px] animate-pulse-slow animation-delay-1000" />

      <div className="w-full max-w-md relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative"
        >
          <div className="relative bg-slate-900/80 backdrop-blur-2xl rounded-3xl border border-slate-800/50 shadow-2xl shadow-black/50 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

            <div className="absolute inset-0 bg-gradient-to-b from-slate-800/20 to-transparent pointer-events-none" />

            <div className="relative p-8 lg:p-10">
              <motion.div variants={itemVariants} className="text-center mb-10">
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl" />
                  <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>

                <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">
                  {t("auth.login.welcomeBack")}
                </h1>
                <p className="text-slate-400 text-sm">
                  {t("auth.login.subtitle")}
                </p>
              </motion.div>

              {(authError || googleError) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
                >
                  <p className="text-red-400 text-sm text-center">{googleError || authError}</p>
                </motion.div>
              )}

              <motion.form variants={itemVariants} onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-4">

                  {DEV_BYPASS_ENABLED && (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">{t("auth.dev.tools")}</p>
                          <p className="text-sm text-slate-300 mt-1">
                            {t("auth.dev.loginAsPrefix")} <span className="font-semibold text-white">{t("auth.dev.devUser")}</span> {t("auth.dev.withoutBackend")}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {t("auth.dev.shortcutAvailable")} <span className="font-mono">Ctrl+Shift+D</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDevBypassUserLogin}
                          className="shrink-0 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 text-xs font-semibold transition-colors"
                        >
                          {t("auth.dev.devLogin")}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="group">
                    <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                      {t("common.email")}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        placeholder="you@company.com"
                        value={formData.email}
                        onChange={handleEmailChange}
                        className={`w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${
                          formErrors.email
                            ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20'
                            : 'border-slate-700/50 focus:border-indigo-500/50 focus:ring-indigo-500/20'
                        }`}
                      />
                    </div>
                    {formErrors.email && (
                      <p className="mt-1 text-xs text-red-400">{formErrors.email}</p>
                    )}
                  </div>

                  <div className="group">
                    <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                      {t("common.password")}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handlePasswordChange}
                        className={`w-full pl-12 pr-12 py-3.5 bg-slate-800/50 border rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${
                          formErrors.password
                            ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20'
                            : 'border-slate-700/50 focus:border-indigo-500/50 focus:ring-indigo-500/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={toggleShowPassword}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {formErrors.password && (
                      <p className="mt-1 text-xs text-red-400">{formErrors.password}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={handleRememberMeChange}
                        className="peer sr-only"
                      />
                      <div className="w-5 h-5 rounded-md border border-slate-600 bg-slate-800/50 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all duration-200 flex items-center justify-center">
                      </div>
                      <svg className="w-3 h-3 text-white absolute left-1 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                      {t("auth.login.rememberMe")}
                    </span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    {t("auth.login.forgotPassword")}
                  </Link>
                </div>

                <div className="flex justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={TURNSTILE_SITE_KEY}
                    onSuccess={(token) => {
                      setCaptchaToken(token);
                      setFormErrors((prev) => ({ ...prev, captcha: null }));
                    }}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => {
                      setCaptchaToken(null);
                      setFormErrors((prev) => ({ ...prev, captcha: t("auth.captcha.loadFailed") }));
                    }}
                    options={{ theme: "dark", size: "flexible" }}
                  />
                </div>

                {formErrors.captcha && (
                  <p className="text-xs text-red-400 text-center">{formErrors.captcha}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className="relative w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all duration-200 overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                  <span className="relative flex items-center justify-center gap-2">
                    {isSubmitDisabled ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t("auth.login.signingIn")}
                      </>
                    ) : (
                      <>
                        {t("auth.login.signIn")}
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </motion.form>

              <motion.div variants={itemVariants} className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-slate-900/80 text-xs text-slate-500 uppercase tracking-wider">
                    {t("auth.login.orContinueWith")}
                  </span>
                </div>
              </motion.div>

              <motion.button
                variants={itemVariants}
                type="button"
                disabled={isGoogleDisabled}
                onClick={() => {
                  if (!captchaToken) {
                    setGoogleError(t("auth.captcha.completeFirst"));
                    return;
                  }
                  setGoogleError(null);
                  setGoogleLoading(true);
                  window.location.href = `${API_URL}/auth/google?captcha=${encodeURIComponent(captchaToken)}`;
                }}
                title={!captchaToken ? t("auth.login.googleCaptchaTitle") : ""}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600/50 text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {googleLoading ? t("auth.login.redirecting") : t("auth.login.signInWithGoogle")}
              </motion.button>

              <motion.p variants={itemVariants} className="text-center mt-8 text-slate-400 text-sm">
                {t("auth.login.needAccount")}{" "}
                <Link
                  to="/contact"
                  className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  {t("auth.login.contactUs")}
                </Link>
              </motion.p>
            </div>
          </div>

          <motion.p
            variants={itemVariants}
            className="text-center mt-8 text-xs text-slate-600"
          >
            {t("auth.login.copyright")}
          </motion.p>

          {import.meta.env.DEV && (
            <motion.div
              variants={itemVariants}
              className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl"
            >
              <p className="text-amber-400 text-xs text-center">
                <strong>{t("auth.login.devModeLabel")}</strong> admin@docloq.site / Admin123!
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.05); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }
        .animation-delay-1000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
