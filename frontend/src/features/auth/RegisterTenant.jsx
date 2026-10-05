// Hidden tenant-provisioning page (/kicawkicaw), super-admin only, password-gated.
// Doesn't auto-login (raw api call, not authService.register) so the operator can register
// multiple tenants in a row without losing their place.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import api from "../../services/api";
import { useLang } from "@/app/providers/LanguageProvider";

const GATE_PASSWORD = import.meta.env.VITE_TENANT_GATE || "IndonesiaRaya";

const fade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

function LineField({ label, value, onChange, type = "text", placeholder, autoFocus }) {
  return (
    <div className="group">
      <label className="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-[0.15em] uppercase">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-transparent border-0 border-b border-slate-700/70 py-2.5 text-[17px] text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-400 transition-colors duration-300"
      />
    </div>
  );
}

export default function RegisterTenant() {
  const { t } = useLang();
  const [unlocked, setUnlocked] = useState(false);
  const [gateInput, setGateInput] = useState("");
  const [gateError, setGateError] = useState(false);

  const [form, setForm] = useState({ companyName: "", firstName: "", lastName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const tryUnlock = (e) => {
    e.preventDefault();
    if (gateInput === GATE_PASSWORD) { setUnlocked(true); setGateError(false); }
    else setGateError(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.companyName.trim() || !form.email.trim() || form.password.length < 8) {
      setError(t("auth.register.errorIncomplete"));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        companyName: form.companyName.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      if (res.data?.success) {
        setResult({ companyName: form.companyName.trim(), companyCode: res.data.data?.companyCode || null, email: form.email.trim() });
        setForm({ companyName: "", firstName: "", lastName: "", email: "", password: "" });
      } else setError(res.data?.message || t("auth.register.errorRegisterFailed"));
    } catch (err) {
      setError(err.response?.data?.message || t("auth.register.errorRegisterFailed"));
    } finally { setLoading(false); }
  };

  const copyCode = async () => {
    if (!result?.companyCode) return;
    try { await navigator.clipboard.writeText(result.companyCode); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-white flex flex-col">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">

          <motion.div custom={0} variants={fade} initial="hidden" animate="visible" className="mb-12">
            <div className="flex items-center gap-2.5 mb-10">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span className="text-xs font-medium tracking-[0.25em] text-slate-400 uppercase">{t("auth.register.brandLabel")}</span>
            </div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
              {result ? t("auth.register.heading.created") : unlocked ? t("auth.register.heading.register") : t("auth.register.heading.restricted")}
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              {result ? t("auth.register.subtitle.created") : unlocked ? t("auth.register.subtitle.register") : t("auth.register.subtitle.restricted")}
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {!unlocked && (
              <motion.form key="gate" custom={1} variants={fade} initial="hidden" animate="visible" exit={{ opacity: 0 }} onSubmit={tryUnlock} className="space-y-8">
                <LineField label={t("auth.register.fields.password")} type="password" autoFocus placeholder="••••••••" value={gateInput}
                  onChange={(e) => { setGateInput(e.target.value); setGateError(false); }} />
                {gateError && <p className="text-xs text-red-400 -mt-5">{t("auth.register.passwordWrong")}</p>}
                <button type="submit" className="group inline-flex items-center gap-2 text-sm font-medium text-indigo-300 hover:text-indigo-200 transition-colors">
                  {t("auth.register.unlock")}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </motion.form>
            )}

            {unlocked && result && (
              <motion.div key="done" custom={1} variants={fade} initial="hidden" animate="visible" exit={{ opacity: 0 }} className="space-y-8">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{t("auth.register.company")}</p>
                  <p className="text-lg">{result.companyName}</p>
                  <p className="text-sm text-slate-500">{result.email}</p>
                </div>

                {result.companyCode && (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{t("auth.register.companyCode")}</p>
                    <div className="flex items-center justify-between border-b border-slate-700/70 pb-2.5">
                      <code className="text-2xl font-mono font-semibold tracking-[0.3em] text-indigo-300">{result.companyCode}</code>
                      <button onClick={copyCode} className="text-xs text-slate-400 hover:text-white transition-colors">{copied ? t("auth.register.copied") : t("auth.register.copy")}</button>
                    </div>
                    <p className="text-xs text-slate-600">{t("auth.register.shareWithTeam")}</p>
                  </div>
                )}

                <button onClick={() => setResult(null)} className="group inline-flex items-center gap-2 text-sm font-medium text-indigo-300 hover:text-indigo-200 transition-colors">
                  {t("auth.register.registerAnother")}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </motion.div>
            )}

            {unlocked && !result && (
              <motion.form key="form" initial="hidden" animate="visible" exit={{ opacity: 0 }} className="space-y-7"
                variants={{ visible: { transition: { staggerChildren: 0.05 } } }} onSubmit={submit}>
                <motion.div variants={fade}><LineField label={t("auth.register.fields.companyName")} placeholder={t("auth.register.placeholders.companyName")} value={form.companyName} onChange={onChange("companyName")} autoFocus /></motion.div>
                <div className="grid grid-cols-2 gap-5">
                  <motion.div variants={fade}><LineField label={t("auth.register.fields.firstName")} placeholder={t("auth.register.placeholders.firstName")} value={form.firstName} onChange={onChange("firstName")} /></motion.div>
                  <motion.div variants={fade}><LineField label={t("auth.register.fields.lastName")} placeholder={t("auth.register.placeholders.lastName")} value={form.lastName} onChange={onChange("lastName")} /></motion.div>
                </div>
                <motion.div variants={fade}><LineField label={t("auth.register.fields.adminEmail")} type="email" placeholder={t("auth.register.placeholders.adminEmail")} value={form.email} onChange={onChange("email")} /></motion.div>
                <motion.div variants={fade}><LineField label={t("auth.register.fields.password")} type="password" placeholder={t("auth.register.placeholders.passwordMin")} value={form.password} onChange={onChange("password")} /></motion.div>

                {error && <motion.p variants={fade} className="text-sm text-red-400">{error}</motion.p>}

                <motion.button variants={fade} type="submit" disabled={loading}
                  className="group w-full mt-2 flex items-center justify-between border-b border-indigo-400/60 hover:border-indigo-300 py-3 text-left transition-colors disabled:opacity-50">
                  <span className="text-base font-medium text-white">{loading ? t("auth.register.processing") : t("auth.register.submit")}</span>
                  {loading ? (
                    <svg className="w-4 h-4 animate-spin text-indigo-300" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <ArrowRight className="w-4 h-4 text-indigo-300 transition-transform group-hover:translate-x-1" strokeWidth={1.8} aria-hidden="true" />
                  )}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
