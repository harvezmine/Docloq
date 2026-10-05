
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  HardDrive,
  Cpu,
  Activity,
  Gauge,
  AlertTriangle,
  Search,
  Plus,
  X,
  Power,
  RefreshCw,
  Eye,
  Lock,
  Loader2,
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Anchor,
  Link2,
  ExternalLink,
  Hash,
  Zap,
  Database,
  Wallet,
  Coins,
  Boxes,
  Info,
  Layers,
  GitBranch,
  Fingerprint,
  Network,
  Fuel,
  Clock,
  Server,
} from "lucide-react";
import { useLang } from "@/app/providers/LanguageProvider";
import CustomSelect from "@/components/ui/CustomSelect";
import superadminService, {
  getGate,
  setGate,
  clearGate,
  sshWsUrl,
} from "../../services/superadmin.service";
import { Pagination } from "../../components/ui/Skeleton";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/vt323/400.css";
import "@fontsource/press-start-2p/400.css";
import "./crt.css";
import { CrtScanlines, BootSequence, ThemeToggle, Typewriter, Cursor, TerminalPanel } from "./ui/terminal.jsx";
import { useCrtTheme } from "./ui/crt-hooks.js";
import {
  TerminalStat,
  GlowMeter,
  SegmentBar,
  RadialGauge,
  HashChainViz,
  MerkleTree,
  BlockStrip,
} from "./ui/viz.jsx";

const BOOT_SESSION_KEY = "docloq_crt_booted";

const GATE_PASSWORD = import.meta.env.VITE_TENANT_GATE || "IndonesiaRaya";

const formatBytes = (bytes) => {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

const formatNumber = (n) => (Number(n) || 0).toLocaleString("id-ID");

const formatDate = (s) => {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function StatCard({ title, value, subtitle, icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-5 group hover:border-cyan-500/20 transition-all duration-300"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all" />
      <div className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full bg-linear-to-r from-cyan-500/40 to-transparent transition-all duration-500" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 group-hover:border-cyan-500/20 transition-all">
            {icon}
          </div>
        </div>
        <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
        <p className="text-sm text-slate-400">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

function FeatureSwitch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50 ${
        checked ? "bg-cyan-600" : "bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ConfirmModal({ open, title, message, confirmLabel, danger, loading, onConfirm, onCancel }) {
  const { t } = useLang();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={loading ? undefined : onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl"
      >
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-slate-400 mt-2">{message}</p>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-medium text-white inline-flex items-center gap-2 transition-colors disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-500" : "bg-cyan-600 hover:bg-cyan-500"
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StateBlock({ icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 mb-4">{icon}</div>
      <p className="text-slate-300 font-medium">{title}</p>
      {message && <p className="text-sm text-slate-500 mt-1 max-w-md">{message}</p>}
      {action}
    </div>
  );
}

function Gate({ onUnlock, theme, onToggleTheme }) {
  const { t } = useLang();
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (input === GATE_PASSWORD) {
      setGate(input);
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col text-[color:var(--crt-fg)]">
      <div className="flex justify-end p-4">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md font-mono text-sm"
        >
          <h1 className="crt-pixel text-[color:var(--crt-accent)] crt-glow text-lg sm:text-xl mb-5">DOCLOQ</h1>
          <p className="text-[color:var(--crt-fg-dim)]">
            {t("superadmin.gate.subtitlePrefix")}<span className="text-[color:var(--crt-accent)]">/kicawkicaw</span>
          </p>
          <p className="text-[color:var(--crt-fg-faint)] mb-6">{t("superadmin.gate.restricted")}</p>

          <form onSubmit={submit} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[color:var(--crt-accent)]">{t("superadmin.gate.loginLabel")}</span>
              <span className="text-[color:var(--crt-fg-dim)]">root</span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="gate-pw" className="text-[color:var(--crt-accent)]">{t("common.password")}:</label>
              <input
                id="gate-pw"
                type="password"
                value={input}
                autoFocus
                onChange={(e) => { setInput(e.target.value); setError(false); }}
                className="flex-1 bg-transparent border-0 focus:outline-none text-[color:var(--crt-fg)]"
              />
              {input.length === 0 && <Cursor />}
            </div>
            {error && <p className="text-[color:var(--crt-crit)] pt-2">{t("superadmin.gate.accessDenied")}</p>}
            <div className="pt-6">
              <button
                type="submit"
                className="inline-flex items-center gap-2 border border-[color:var(--crt-border)] px-4 py-1.5 text-[color:var(--crt-accent)] hover:bg-[color:var(--crt-accent-soft)] hover:border-[color:var(--crt-accent-dim)] transition-colors"
              >
                &gt; {t("superadmin.gate.authenticate")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

function CreateTenantModal({ open, onClose, onCreated }) {
  const { t } = useLang();
  const [form, setForm] = useState({ companyName: "", firstName: "", lastName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const reset = () => {
    setForm({ companyName: "", firstName: "", lastName: "", email: "", password: "" });
    setError(null);
    setResult(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.companyName.trim() || !form.email.trim() || form.password.length < 8) {
      setError(t("superadmin.createTenant.errorIncomplete"));
      return;
    }
    setLoading(true);
    try {
      const data = await superadminService.createTenant({
        companyName: form.companyName.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setResult({ companyName: form.companyName.trim(), email: form.email.trim(), companyCode: data?.companyCode || null });
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.createTenant.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!result?.companyCode) return;
    try {
      await navigator.clipboard.writeText(result.companyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={loading ? undefined : close} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {result ? t("superadmin.createTenant.createdTitle") : t("superadmin.createTenant.newTitle")}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {result ? t("superadmin.createTenant.createdSubtitle") : t("superadmin.createTenant.newSubtitle")}
            </p>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{t("superadmin.createTenant.companyLabel")}</p>
              <p className="text-base text-white">{result.companyName}</p>
              <p className="text-sm text-slate-500">{result.email}</p>
            </div>
            {result.companyCode && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{t("superadmin.createTenant.companyCodeLabel")}</p>
                <div className="flex items-center justify-between border-b border-slate-700/70 pb-2.5">
                  <code className="text-2xl font-mono font-semibold tracking-[0.3em] text-cyan-300">{result.companyCode}</code>
                  <button onClick={copyCode} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t("common.copied") : t("common.copy")}
                  </button>
                </div>
                <p className="text-xs text-slate-600">{t("superadmin.createTenant.shareHint")}</p>
              </div>
            )}
            <div className="flex justify-between gap-2 pt-2">
              <button onClick={reset} className="text-sm font-medium text-cyan-300 hover:text-cyan-200 transition-colors">
                {t("superadmin.createTenant.registerAgain")}
              </button>
              <button onClick={close} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 transition-colors">
                {t("common.done")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label={t("superadmin.createTenant.companyNameField")} placeholder={t("superadmin.createTenant.companyNamePlaceholder")} value={form.companyName} onChange={onChange("companyName")} autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("superadmin.createTenant.firstNameField")} placeholder={t("superadmin.createTenant.firstNamePlaceholder")} value={form.firstName} onChange={onChange("firstName")} />
              <Field label={t("superadmin.createTenant.lastNameField")} placeholder={t("superadmin.createTenant.lastNamePlaceholder")} value={form.lastName} onChange={onChange("lastName")} />
            </div>
            <Field label={t("superadmin.createTenant.adminEmailField")} type="email" placeholder={t("superadmin.createTenant.adminEmailPlaceholder")} value={form.email} onChange={onChange("email")} />
            <Field label={t("common.password")} type="password" placeholder={t("superadmin.createTenant.passwordPlaceholder")} value={form.password} onChange={onChange("password")} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? t("common.processing") : t("superadmin.createTenant.submitLabel")}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, autoFocus }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-[0.15em] uppercase">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
      />
    </div>
  );
}

function TenantDrawer({ tenantId, onClose, onFeatureChange, onStatusToggle }) {
  const { t } = useLang();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingFeature, setSavingFeature] = useState(null);

  const FEATURE_LABELS = {
    blockchain: t("superadmin.feature.blockchain"),
    verification: t("superadmin.feature.verification"),
    qr: t("superadmin.feature.qr"),
    aiAnalysis: t("superadmin.feature.aiAnalysis"),
    doki: t("superadmin.feature.doki"),
    osint: t("superadmin.feature.osint"),
  };

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await superadminService.getTenant(tenantId);
      setTenant(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.tenantDrawer.loadError"));
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFeature = async (key) => {
    if (!tenant) return;
    const next = !tenant.features?.[key];
    setSavingFeature(key);
    setTenant((prev) => ({ ...prev, features: { ...prev.features, [key]: next } }));
    try {
      await superadminService.setTenantFeatures(tenant.id, { [key]: next });
      onFeatureChange?.(tenant.id, { ...tenant.features, [key]: next });
    } catch (err) {
      setTenant((prev) => ({ ...prev, features: { ...prev.features, [key]: !next } }));
      setError(err.response?.data?.message || err.message || t("superadmin.tenantDrawer.featureUpdateError"));
    } finally {
      setSavingFeature(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto"
      >
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold text-white">{t("superadmin.tenantDrawer.title")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <StateBlock icon={<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />} title={t("superadmin.tenantDrawer.loadingDetail")} />
          ) : error ? (
            <StateBlock
              icon={<AlertTriangle className="w-6 h-6 text-red-400" />}
              title={t("superadmin.state.failedToLoad")}
              message={error}
              action={
                <button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">
                  {t("common.retry")}
                </button>
              }
            />
          ) : tenant ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-cyan-400">{tenant.name?.[0]?.toUpperCase() || "T"}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white truncate">{tenant.name}</p>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full mt-1 ${
                      tenant.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${tenant.isActive ? "bg-emerald-400" : "bg-red-400"}`} />
                    {tenant.isActive ? t("superadmin.status.active") : t("superadmin.status.disabled")}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">{t("superadmin.tenantDrawer.ownerLabel")}</p>
                <p className="text-sm text-slate-300">{tenant.ownerEmail || "-"}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailStat label={t("superadmin.field.users")} value={formatNumber(tenant.userCount)} icon={<Users className="w-4 h-4 text-cyan-400" />} />
                <DetailStat label={t("superadmin.field.documents")} value={formatNumber(tenant.docCount)} icon={<FileText className="w-4 h-4 text-emerald-400" />} />
                <DetailStat label={t("superadmin.field.storage")} value={formatBytes(tenant.storageBytes)} icon={<HardDrive className="w-4 h-4 text-amber-400" />} />
                <DetailStat label={t("superadmin.tenantDrawer.aiTokenStat")} value={formatNumber(tenant.aiTokens)} icon={<Cpu className="w-4 h-4 text-violet-400" />} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailStat label={t("superadmin.tenantDrawer.newThisMonthStat")} value={formatNumber(tenant.newThisMonth)} icon={<Activity className="w-4 h-4 text-teal-400" />} />
                <DetailStat label={t("superadmin.tenantDrawer.createdStat")} value={formatDate(tenant.createdAt)} icon={<Building2 className="w-4 h-4 text-slate-400" />} />
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-3">{t("superadmin.tenantDrawer.featuresLabel")}</p>
                <div className="space-y-2">
                  {Object.keys(FEATURE_LABELS).map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-200">{FEATURE_LABELS[key]}</span>
                        {savingFeature === key && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
                      </div>
                      <FeatureSwitch
                        checked={!!tenant.features?.[key]}
                        disabled={savingFeature === key}
                        onChange={() => toggleFeature(key)}
                        label={FEATURE_LABELS[key]}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onStatusToggle?.(tenant)}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  tenant.isActive
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                {tenant.isActive ? <Power className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                {tenant.isActive ? t("superadmin.tenantDrawer.deactivateTenant") : t("superadmin.tenantDrawer.reactivateTenant")}
              </button>
            </div>
          ) : null}
        </div>
      </motion.aside>
    </div>
  );
}

function DetailStat({ label, value, icon }) {
  return (
    <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function OverviewTab() {
  const { t } = useLang();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superadminService.getStats();
      setStats(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.overview.loadStatsErrorFallback"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <StateBlock icon={<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />} title={t("superadmin.overview.loadingStats")} />;
  }
  if (error) {
    return (
      <StateBlock
        icon={<AlertTriangle className="w-6 h-6 text-red-400" />}
        title={t("superadmin.overview.failedToLoadStatsTitle")}
        message={error}
        action={
          <button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">
            {t("common.retry")}
          </button>
        }
      />
    );
  }
  if (!stats) {
    return <StateBlock icon={<LayoutDashboard className="w-6 h-6 text-slate-500" />} title={t("superadmin.overview.noDataTitle")} />;
  }

  const c = stats.counts || {};
  const r = stats.requests || {};
  const h = stats.health || {};

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title={t("superadmin.overview.totalUsers")}
          value={formatNumber(c.users)}
          subtitle={`+${formatNumber(c.newToday)} ${t("superadmin.overview.newTodaySuffix")}`}
          delay={0.05}
          icon={<Users className="w-5 h-5 text-cyan-400" />}
        />
        <StatCard
          title={t("superadmin.overview.totalTenants")}
          value={formatNumber(c.tenants)}
          subtitle={`+${formatNumber(c.newWeek)} ${t("superadmin.overview.newWeekSuffix")}`}
          delay={0.1}
          icon={<Building2 className="w-5 h-5 text-purple-400" />}
        />
        <StatCard
          title={t("superadmin.overview.totalDocuments")}
          value={formatNumber(c.documents)}
          subtitle={`+${formatNumber(c.newMonth)} ${t("superadmin.overview.newMonthSuffix")}`}
          delay={0.15}
          icon={<FileText className="w-5 h-5 text-emerald-400" />}
        />
        <StatCard
          title={t("superadmin.overview.totalStorage")}
          value={formatBytes(stats.storageBytes)}
          subtitle={t("superadmin.overview.allTenantsSubtitle")}
          delay={0.2}
          icon={<HardDrive className="w-5 h-5 text-amber-400" />}
        />
        <StatCard
          title={t("superadmin.overview.totalAiTokens")}
          value={formatNumber(stats.aiTokens)}
          subtitle={t("superadmin.overview.cumulativeUsageSubtitle")}
          delay={0.25}
          icon={<Cpu className="w-5 h-5 text-violet-400" />}
        />
        <StatCard
          title={t("superadmin.overview.newThisMonthTitle")}
          value={formatNumber(c.newMonth)}
          subtitle={`${formatNumber(c.newWeek)} ${t("superadmin.overview.weekUnit")} • ${formatNumber(c.newToday)} ${t("superadmin.overview.dayUnit")}`}
          delay={0.3}
          icon={<Activity className="w-5 h-5 text-teal-400" />}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          {t("superadmin.overview.performanceHeading")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PerfCard label={t("superadmin.overview.requestVolume")} value={formatNumber(r.volume24h)} unit="req" icon={<Activity className="w-5 h-5 text-cyan-400" />} />
          <PerfCard label={t("superadmin.overview.avgLatency")} value={formatNumber(r.avgLatencyMs)} unit="ms" icon={<Gauge className="w-5 h-5 text-amber-400" />} />
          <PerfCard
            label={t("superadmin.overview.errorRate")}
            value={`${Number(r.errorRatePct ?? 0).toFixed(2)}`}
            unit="%"
            danger={Number(r.errorRatePct ?? 0) > 1}
            icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {t("superadmin.overview.serviceHealthHeading")}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: "db", label: t("superadmin.overview.serviceDatabase") },
            { key: "redis", label: "Redis" },
            { key: "onlyoffice", label: "OnlyOffice" },
            { key: "vault", label: "Vault" },
          ].map(({ key, label }) => {
            const ok = !!h[key];
            return (
              <div
                key={key}
                className={`flex items-center justify-between p-4 rounded-2xl border ${
                  ok ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    {ok && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
                  </span>
                  <span className="text-sm font-medium text-slate-200">{label}</span>
                </div>
                <span className={`text-xs font-semibold ${ok ? "text-emerald-400" : "text-red-400"}`}>
                  {ok ? t("superadmin.overview.svcUp") : t("superadmin.overview.svcDown")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PerfCard({ label, value, unit, icon, danger }) {
  return (
    <div className="relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">{icon}</div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <h3 className={`text-2xl font-bold ${danger ? "text-red-400" : "text-white"}`}>{value}</h3>
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function TenantsTab() {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superadminService.listTenants({ search: query, page, limit });
      setTenants(data?.tenants || []);
      setPagination(data?.pagination || { page, limit, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.tenants.loadListErrorFallback"));
    } finally {
      setLoading(false);
    }
  }, [query, page, limit, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const doStatusToggle = async () => {
    if (!confirm?.tenant) return;
    setConfirmLoading(true);
    try {
      const next = !confirm.tenant.isActive;
      await superadminService.setTenantStatus(confirm.tenant.id, next);
      setTenants((list) => list.map((row) => (row.id === confirm.tenant.id ? { ...row, isActive: next } : row)));
      setConfirm(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.tenants.updateStatusErrorFallback"));
    } finally {
      setConfirmLoading(false);
    }
  };

  const onDrawerFeatureChange = (id, features) => {
    setTenants((list) => list.map((row) => (row.id === id ? { ...row, features } : row)));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("superadmin.tenants.searchPlaceholder")}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
          />
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("superadmin.tenants.createButton")}
        </button>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/50 rounded-2xl overflow-hidden">
        {loading ? (
          <StateBlock icon={<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />} title={t("superadmin.tenants.loadingTenants")} />
        ) : error ? (
          <StateBlock
            icon={<AlertTriangle className="w-6 h-6 text-red-400" />}
            title={t("superadmin.state.failedToLoad")}
            message={error}
            action={
              <button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">
                {t("common.retry")}
              </button>
            }
          />
        ) : tenants.length === 0 ? (
          <StateBlock
            icon={<Building2 className="w-6 h-6 text-slate-500" />}
            title={query ? t("common.noResults") : t("superadmin.tenants.noTenantsYetTitle")}
            message={query ? `${t("superadmin.tenants.noResultsFor")} "${query}".` : t("superadmin.tenants.createFirstHint")}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/30">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">{t("superadmin.field.tenant")}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">{t("superadmin.field.owner")}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">{t("superadmin.field.users")}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">{t("superadmin.field.documents")}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">{t("superadmin.field.storage")}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">{t("superadmin.field.tokens")}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">{t("superadmin.field.lastActive")}</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">{t("common.status")}</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {tenants.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-cyan-400">{row.name?.[0]?.toUpperCase() || "T"}</span>
                          </div>
                          <p className="text-sm font-medium text-white">{row.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">{row.ownerEmail || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{formatNumber(row.userCount)}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{formatNumber(row.docCount)}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{formatBytes(row.storageBytes)}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{formatNumber(row.aiTokens)}</td>
                      <td className="px-6 py-4 text-sm">
                        {row.lastActiveAt ? (
                          <span className={row.dormant ? "text-amber-400" : "text-slate-300"}>
                            {formatDate(row.lastActiveAt)}
                            {row.dormant && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">{t("superadmin.tenants.dormantBadge")}</span>}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                            row.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${row.isActive ? "bg-emerald-400" : "bg-red-400"}`} />
                          {row.isActive ? t("superadmin.status.active") : t("superadmin.status.disabled")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setDetailId(row.id)}
                            title={t("superadmin.field.detail")}
                            className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirm({ tenant: row })}
                            title={row.isActive ? t("superadmin.action.deactivate") : t("superadmin.action.activate")}
                            className={`p-2 rounded-lg transition-colors ${
                              row.isActive
                                ? "text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                            }`}
                          >
                            {row.isActive ? <Power className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={pagination.page}
              totalItems={pagination.total}
              pageSize={pagination.limit}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <CreateTenantModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />

      <AnimatePresence>
        {detailId && (
          <TenantDrawer
            key="drawer"
            tenantId={detailId}
            onClose={() => setDetailId(null)}
            onFeatureChange={onDrawerFeatureChange}
            onStatusToggle={(tenant) => setConfirm({ tenant })}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!confirm}
        danger={confirm?.tenant?.isActive}
        loading={confirmLoading}
        title={confirm?.tenant?.isActive ? t("superadmin.tenants.confirmDeactivateTitle") : t("superadmin.tenants.confirmActivateTitle")}
        message={
          confirm?.tenant?.isActive
            ? `Tenant "${confirm?.tenant?.name}" ${t("superadmin.tenants.deactivateConsequence")}`
            : `Tenant "${confirm?.tenant?.name}" ${t("superadmin.tenants.activateConsequence")}`
        }
        confirmLabel={confirm?.tenant?.isActive ? t("superadmin.action.deactivate") : t("superadmin.action.activate")}
        onCancel={() => setConfirm(null)}
        onConfirm={doStatusToggle}
      />
    </div>
  );
}

const AUDIT_EXPLORER = "https://amoy.polygonscan.com";
const shortHash = (s, head = 10, tail = 8) =>
  !s ? "-" : s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;
const formatDateTime = (s) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return String(s); }
};

function CopyChip({ value, label }) {
  const { t } = useLang();
  const [done, setDone] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {}
  };
  return (
    <button type="button" onClick={copy}
      aria-label={`${t("common.copy")} ${label || ""}`.trim()}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-[color:var(--crt-border)] text-[10px] font-mono text-[color:var(--crt-fg-dim)] hover:text-[color:var(--crt-accent)] hover:border-[color:var(--crt-accent-dim)] transition-colors align-middle">
      {done ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {done ? t("common.copied") : t("common.copy")}
    </button>
  );
}

function ProofRow({ step, label, value, verdict }) {
  return (
    <div className="grid grid-cols-[1.25rem_10rem_1fr] gap-x-2 items-start py-1.5 border-b border-[color:var(--crt-border)] last:border-0">
      <span className="text-[10px] text-[color:var(--crt-fg-faint)] pt-0.5">{step}</span>
      <span className="text-[11px] text-[color:var(--crt-fg-dim)] pt-0.5">{label}</span>
      <span className="min-w-0">
        <span className="block break-all text-[11px] text-[color:var(--crt-fg)]">{value}</span>
        {verdict != null && (
          <span className={`inline-flex items-center gap-1 mt-1 text-[10px] ${verdict ? "text-emerald-400" : "text-red-400"}`}>
            {verdict ? <Check className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
            {verdict ? "match" : "mismatch"}
          </span>
        )}
      </span>
    </div>
  );
}

const BREAK_KIND_KEY = {
  altered: "forensicsKindAltered",
  missing: "forensicsKindMissing",
  reordered: "forensicsKindReordered",
  linkage: "forensicsKindLinkage",
  head: "forensicsKindHead",
};

function ForensicsPanel({ report, onSelectSeq }) {
  const { t } = useLang();
  if (!report) return null;

  const breaks = report.breaks || [];
  // only accuse moved roots
  const rewritten = (report.anchors || []).filter((a) => a.noRowToBlame);
  const sparse = (report.anchors || []).filter((a) => a.sparseAnchor && !a.rootMatch);
  const localised = (report.anchors || []).filter((a) => a.localisable && !a.rootMatch);

  return (
    <TerminalPanel title={t("superadmin.audit.forensicsTitle")}>
      <p className="font-mono text-[10px] text-[color:var(--crt-fg-faint)] mb-3">{t("superadmin.audit.forensicsAllRows")}</p>

      {breaks.length === 0 ? (
        <p className="font-mono text-[11px] text-[color:var(--crt-fg-dim)]">{t("superadmin.audit.forensicsNoBreaks")}</p>
      ) : (
        <div className="border border-[color:var(--crt-border)] divide-y divide-[color:var(--crt-border)]">
          {breaks.map((b, i) => (
            <button key={i} type="button"
              onClick={b.seq != null && onSelectSeq ? () => onSelectSeq(b.seq) : undefined}
              disabled={b.seq == null || !onSelectSeq}
              className="w-full text-left px-3 py-2 font-mono text-[11px] flex items-start gap-3 disabled:cursor-default enabled:hover:bg-[color:var(--crt-panel-2)]">
              <span className="shrink-0 w-16" style={{ color: "var(--crt-crit)" }}>
                {b.seq != null ? `#${b.seq}` : t("superadmin.audit.forensicsNoRow")}
              </span>
              <span className="shrink-0 w-32 text-[color:var(--crt-fg-dim)]">
                {t(`superadmin.audit.${BREAK_KIND_KEY[b.kind] || "forensicsKindAltered"}`)}
              </span>
              <span className="min-w-0 text-[color:var(--crt-fg-faint)] break-words">{b.reason}</span>
            </button>
          ))}
        </div>
      )}

      {localised.map((a) => (
        <div key={a.anchorId} className="mt-3 border border-[color:var(--crt-border)] px-3 py-2 font-mono text-[11px] space-y-1">
          <p className="text-[color:var(--crt-fg-dim)]">
            {t("superadmin.audit.forensicsAnchorLabel")} #{a.fromSeq}–{a.toSeq}
          </p>
          {a.rowsAltered.length > 0 && (
            <p style={{ color: "var(--crt-crit)" }}>{t("superadmin.audit.forensicsRowsAltered")}: {a.rowsAltered.join(", ")}</p>
          )}
          {a.rowsMissing.length > 0 && (
            <p style={{ color: "var(--crt-crit)" }}>{t("superadmin.audit.forensicsRowsMissing")}: {a.rowsMissing.join(", ")}</p>
          )}
        </div>
      ))}

      {sparse.map((a) => (
        <div key={a.anchorId} className="mt-3 border px-3 py-2 font-mono text-[11px]"
          style={{ borderColor: "var(--crt-warn)", background: "var(--crt-warn-soft, rgba(234,179,8,0.06))" }}>
          <p style={{ color: "var(--crt-warn)" }}>
            {t("superadmin.audit.forensicsAnchorLabel")} #{a.fromSeq}–{a.toSeq}: {t("superadmin.audit.forensicsSparse")}
          </p>
        </div>
      ))}

      {rewritten.map((a) => (
        <div key={a.anchorId} className="mt-3 border px-4 py-3 font-mono text-[11px] space-y-2"
          style={{ borderColor: "var(--crt-crit)", background: "var(--crt-crit-soft)" }}>
          <p style={{ color: "var(--crt-crit)" }}>
            {t("superadmin.audit.forensicsAnchorLabel")} #{a.fromSeq}–{a.toSeq} — {t("superadmin.audit.forensicsUnlocalisableTitle")}
          </p>
          <p className="text-[color:var(--crt-fg-dim)] leading-relaxed">{t("superadmin.audit.forensicsUnlocalisableBody")}</p>
          <p className="text-[color:var(--crt-fg-faint)] break-all">{shortHash(a.recomputedRoot, 8, 6)} ≠ {shortHash(a.anchoredRoot, 8, 6)}</p>
        </div>
      ))}
    </TerminalPanel>
  );
}

function MerkleProofSection({ merkle }) {
  const { t } = useLang();
  if (!merkle) return null;

  const heading = (
    <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--crt-fg-faint)] mb-2">
      {t("superadmin.audit.merkleTitle")}
    </p>
  );

  if (!merkle.anchored) {
    return (
      <div>
        {heading}
        <div className="border border-[color:var(--crt-border)] px-4 py-3 text-[11px] text-[color:var(--crt-fg-dim)]">
          {t("superadmin.audit.merkleNotAnchored")}
        </div>
      </div>
    );
  }

  if (!merkle.usable) {
    return (
      <div>
        {heading}
        <div className="border px-4 py-3 text-[11px] space-y-1"
          style={{ borderColor: "var(--crt-crit)", background: "var(--crt-crit-soft)" }}>
          <p style={{ color: "var(--crt-crit)" }}>{t("superadmin.audit.merkleUnusablePrefix")}</p>
          <p className="text-[color:var(--crt-fg-dim)] break-words">{merkle.reason}</p>
          {merkle.foundCount != null && merkle.entryCount != null && merkle.foundCount !== merkle.entryCount && (
            <p className="text-[color:var(--crt-fg-dim)]">
              {merkle.foundCount} {t("superadmin.audit.merkleOfEntries")} {merkle.entryCount}
            </p>
          )}
        </div>
      </div>
    );
  }

  // db match isn't proof
  const proven = merkle.rootMatch && merkle.selfVerified && merkle.onChain === true;
  const unchecked = merkle.rootMatch && merkle.selfVerified && merkle.onChain == null;
  const tone = proven ? "var(--crt-accent)" : unchecked ? "var(--crt-warn)" : "var(--crt-crit)";
  const toneSoft = proven ? "var(--crt-accent-soft)" : unchecked ? "var(--crt-warn-soft, rgba(234,179,8,0.08))" : "var(--crt-crit-soft)";
  const verdict = proven
    ? t("superadmin.audit.merkleVerdictOk")
    : unchecked
      ? t("superadmin.audit.merkleVerdictUnchecked")
      : merkle.rootMatch
        ? t("superadmin.audit.merkleVerdictNotOnChain")
        : t("superadmin.audit.merkleVerdictBad");

  return (
    <div>
      {heading}

      <div className="flex items-center gap-3 px-4 py-3 border mb-3"
        style={{ borderColor: tone, background: toneSoft }}>
        {proven ? <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: tone }} />
                : <ShieldAlert className="w-5 h-5 shrink-0" style={{ color: tone }} />}
        <p className="text-xs" style={{ color: tone }}>{verdict}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
        <div className="border border-[color:var(--crt-border)] px-3 py-2">
          <p className="text-[10px] text-[color:var(--crt-fg-faint)]">{t("superadmin.audit.merkleBatchLabel")}</p>
          <p className="text-[color:var(--crt-fg)]">#{merkle.fromSeq}–{merkle.toSeq}</p>
        </div>
        <div className="border border-[color:var(--crt-border)] px-3 py-2">
          <p className="text-[10px] text-[color:var(--crt-fg-faint)]">{t("superadmin.audit.merkleLeafIndexLabel")}</p>
          <p className="text-[color:var(--crt-fg)]">{merkle.leafIndex} {t("superadmin.audit.merkleOfEntries")} {merkle.entryCount}</p>
        </div>
        <div className="border border-[color:var(--crt-border)] px-3 py-2">
          <p className="text-[10px] text-[color:var(--crt-fg-faint)]">{t("superadmin.audit.merkleProofSizeLabel")}</p>
          <p className="text-[color:var(--crt-accent)]">{merkle.proof.length} {t("superadmin.audit.merkleSiblingsSuffix")}</p>
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--crt-fg-faint)] mb-2">
        {t("superadmin.audit.merkleFoldTitle")}
      </p>
      <div className="border border-[color:var(--crt-border)] px-3">
        <ProofRow step="0" label={t("superadmin.audit.merkleStepLeaf")} value={merkle.leafHash} />
        {merkle.steps.map((s, i) => (
          <ProofRow key={i} step={String(i + 1)}
            label={`${t("superadmin.audit.merkleStepSibling")} ${shortHash(s.sibling, 6, 4)}`}
            value={s.result} />
        ))}
        <ProofRow step="=" label={t("superadmin.audit.merkleRootRecomputed")} value={merkle.root} />
        <ProofRow step="✓" label={t("superadmin.audit.merkleRootAnchored")} value={merkle.anchoredRoot} verdict={merkle.rootMatch} />
        <ProofRow step="⛓" label={t("superadmin.audit.merkleOnChainLabel")}
          value={merkle.onChain === true
            ? t("superadmin.audit.merkleOnChainYes")
            : merkle.onChain === false
              ? t("superadmin.audit.merkleOnChainNo")
              : `${t("superadmin.audit.merkleOnChainSkipped")} — ${merkle.onChainReason || ""}`}
          verdict={merkle.onChain == null ? undefined : merkle.onChain} />
      </div>
      <p className="mt-2 text-[10px] text-[color:var(--crt-fg-faint)] leading-relaxed">{t("superadmin.audit.merkleFoldHint")}</p>
    </div>
  );
}

function EntryProofDrawer({ orgId, seq, onClose }) {
  const { t } = useLang();
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    superadminService.getAuditEntryProof(orgId, seq)
      .then((d) => { if (alive) setProof(d); })
      .catch((err) => { if (alive) setError(err.response?.data?.message || err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orgId, seq]);

  useEffect(() => {
    const onKey = (ev) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ok = proof?.hashOk && proof?.prevLinkOk;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={`${t("superadmin.audit.proofTitle")} #${seq}`}
        className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto border border-[color:var(--crt-border)] bg-[color:var(--crt-panel)] font-mono">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-[color:var(--crt-border)] bg-[color:var(--crt-panel)]">
          <div className="min-w-0">
            <h3 className="text-sm text-[color:var(--crt-accent)]">{t("superadmin.audit.proofTitle")} #{seq}</h3>
            <p className="text-[11px] text-[color:var(--crt-fg-dim)] mt-0.5">{t("superadmin.audit.proofSubtitle")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")}
            className="shrink-0 p-2 border border-[color:var(--crt-border)] text-[color:var(--crt-fg-dim)] hover:text-[color:var(--crt-accent)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-[color:var(--crt-fg-dim)]">
            <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-[color:var(--crt-accent)]" />
            {t("superadmin.audit.proofLoading")}
          </div>
        ) : error ? (
          <div className="py-16 px-5 text-center text-sm text-red-400">
            <AlertTriangle className="w-6 h-6 mx-auto mb-3" />
            {error}
          </div>
        ) : proof && (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3 px-4 py-3 border"
              style={{ borderColor: ok ? "var(--crt-accent-dim)" : "var(--crt-crit)", background: ok ? "var(--crt-accent-soft)" : "var(--crt-crit-soft)" }}>
              {ok ? <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: "var(--crt-accent)" }} />
                  : <ShieldAlert className="w-5 h-5 shrink-0" style={{ color: "var(--crt-crit)" }} />}
              <p className="text-xs" style={{ color: ok ? "var(--crt-accent)" : "var(--crt-crit)" }}>
                {ok ? t("superadmin.audit.proofVerdictOk") : t("superadmin.audit.proofVerdictBad")}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--crt-fg-faint)] mb-2">{t("superadmin.audit.proofStepsTitle")}</p>
              <div className="border border-[color:var(--crt-border)] px-3">
                <ProofRow step="1" label={t("superadmin.audit.proofCanonical")} value={`sha256 = ${proof.canonicalSha256}`} />
                <ProofRow step="2" label={t("superadmin.audit.proofCanonicalLen")} value={`${formatNumber(proof.canonicalLength)} bytes`} />
                <ProofRow step="3" label={t("superadmin.audit.proofPrevStored")} value={proof.prevHash || "-"} />
                <ProofRow step="4" label={proof.isGenesis ? t("superadmin.audit.proofPrevGenesis") : t("superadmin.audit.proofPrevExpected")} value={proof.expectedPrevHash || "-"} verdict={proof.prevLinkOk} />
                <ProofRow step="5" label={t("superadmin.audit.proofRecomputed")} value={proof.recomputedHash} />
                <ProofRow step="6" label={t("superadmin.audit.proofStored")} value={proof.entryHash || "-"} verdict={proof.hashOk} />
              </div>
              <p className="mt-2 text-[10px] text-[color:var(--crt-fg-faint)]">{t("superadmin.audit.proofFormula")}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--crt-fg-faint)] mb-2">{t("superadmin.audit.proofFieldsTitle")}</p>
              <div className="overflow-x-auto border border-[color:var(--crt-border)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-[color:var(--crt-fg-faint)] border-b border-[color:var(--crt-border)]">
                      <th className="px-3 py-2 font-normal">{t("superadmin.audit.proofColField")}</th>
                      <th className="px-3 py-2 font-normal">{t("superadmin.audit.proofColValue")}</th>
                      <th className="px-3 py-2 font-normal">{t("superadmin.audit.proofColDigest")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proof.fields.map((f) => (
                      <tr key={f.key} className="border-b border-[color:var(--crt-border)] last:border-0">
                        <td className="px-3 py-2 text-[color:var(--crt-fg-dim)] whitespace-nowrap">{f.key}</td>
                        <td className="px-3 py-2 text-[color:var(--crt-fg)] break-all">
                          {f.redacted
                            ? <span className="text-[color:var(--crt-fg-faint)]">{f.present ? t("superadmin.audit.proofRedacted") : t("superadmin.audit.proofNull")}</span>
                            : (f.value == null ? <span className="text-[color:var(--crt-fg-faint)]">{t("superadmin.audit.proofNull")}</span> : String(f.value))}
                        </td>
                        <td className="px-3 py-2 text-[color:var(--crt-fg-dim)]">{shortHash(f.digest, 8, 6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-[color:var(--crt-fg-faint)]">{t("superadmin.audit.proofPrivacyNote")}</p>
            </div>

            <MerkleProofSection merkle={proof.merkle} />
          </div>
        )}
      </div>
    </div>
  );
}

function VerifyYourself({ chain, root }) {
  const { t } = useLang();
  if (!root) return null;
  const contract = chain?.contractAddress;
  const explorer = chain?.explorerBase || AUDIT_EXPLORER;
  return (
    <div className="border border-[color:var(--crt-border)] p-4 font-mono space-y-3">
      <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--crt-fg-faint)]">{t("superadmin.audit.verifySelfTitle")}</p>
      <div className="space-y-1.5 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[color:var(--crt-fg-dim)] w-24 shrink-0">merkle root</span>
          <code className="break-all text-[color:var(--crt-fg)] flex-1 min-w-0">{root}</code>
          <CopyChip value={root} label="merkle root" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[color:var(--crt-fg-dim)] w-24 shrink-0">contract</span>
          <code className="break-all text-[color:var(--crt-fg)] flex-1 min-w-0">{contract || "-"}</code>
          {contract && <CopyChip value={contract} label="contract" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[color:var(--crt-fg-dim)] w-24 shrink-0">network</span>
          <code className="text-[color:var(--crt-fg)]">{chain?.network || "-"} (chainId {chain?.chainId ?? "-"})</code>
        </div>
      </div>
      <ol className="text-[11px] text-[color:var(--crt-fg-dim)] space-y-1 list-decimal list-inside">
        <li>{t("superadmin.audit.verifySelfStep1")}</li>
        <li>{t("superadmin.audit.verifySelfStep2")}</li>
        <li>{t("superadmin.audit.verifySelfStep3")}</li>
      </ol>
      {contract && (
        <a href={`${explorer}/address/${contract}#readContract`} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-[color:var(--crt-accent)] hover:underline">
          {t("superadmin.audit.verifySelfOpenContract")} <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function AuditTab() {
  const { t } = useLang();
  const [tenants, setTenants] = useState([]);
  const [orgId, setOrgId] = useState("");
  const [status, setStatus] = useState(null);
  const [chain, setChain] = useState(null);
  const [anchors, setAnchors] = useState([]);
  const [anchorVerify, setAnchorVerify] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [anchoring, setAnchoring] = useState(false);
  const [notice, setNotice] = useState(null);
  const [proofSeq, setProofSeq] = useState(null);
  const [backups, setBackups] = useState([]);
  const [selBackup, setSelBackup] = useState("");
  const [recPreview, setRecPreview] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await superadminService.listTenants({ limit: 100 });
        const list = data?.tenants || [];
        setTenants(list);
        setOrgId((prev) => prev || list[0]?.id || "");
        if (list.length === 0) setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || err.message || t("superadmin.audit.loadTenantsErrorFallback"));
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // null when tail truncated
  const brokenText = (ch) =>
    ch?.brokenAtSeq != null
      ? `${t("superadmin.audit.brokenAtPrefix")} #${ch.brokenAtSeq}: ${ch.reason}`
      : `${t("superadmin.audit.brokenNoSeq")}: ${ch?.reason || ""}`;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [st, ch, an, en] = await Promise.all([
        superadminService.getAuditChainStatus(orgId),
        superadminService.verifyAuditChain(orgId),
        superadminService.listAuditAnchors(orgId),
        superadminService.listAuditEntries(orgId, 30),
      ]);
      setStatus(st);
      setChain(ch);
      setAnchors(an?.anchors || []);
      setEntries(en?.entries || []);
      setAnchorVerify((an?.anchors || []).length ? await superadminService.verifyAuditAnchors(orgId) : null);
      // only when something broke
      // rewrite keeps chain intact
      setReport(await superadminService.getAuditBreakReport(orgId).catch(() => null));
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.audit.loadDataErrorFallback"));
    } finally {
      setLoading(false);
    }
  }, [orgId, t]);

  useEffect(() => { load(); }, [load]);

  const reVerify = async () => {
    if (!orgId) return;
    setVerifying(true);
    setNotice(null);
    try {
      const [ch, av] = await Promise.all([
        superadminService.verifyAuditChain(orgId),
        anchors.length ? superadminService.verifyAuditAnchors(orgId) : Promise.resolve(null),
      ]);
      setChain(ch);
      setAnchorVerify(av);
      // rewrite keeps chain intact
      setReport(await superadminService.getAuditBreakReport(orgId).catch(() => null));
      setNotice({ kind: ch.intact ? "ok" : "bad", text: ch.intact ? t("superadmin.audit.reVerifyOkNotice") : brokenText(ch) });
    } catch (err) {
      setNotice({ kind: "bad", text: err.response?.data?.message || err.message || t("superadmin.audit.reVerifyErrorFallback") });
    } finally {
      setVerifying(false);
    }
  };

  const anchorNow = async () => {
    if (!orgId) return;
    setAnchoring(true);
    setNotice(null);
    try {
      const r = await superadminService.anchorAuditNow(orgId);
      if (r?.anchored) {
        setNotice({ kind: "ok", text: `${t("superadmin.audit.anchoredSeqPrefix")} ${r.fromSeq}–${r.toSeq} (${r.count} ${t("superadmin.unit.entries")}) ${t("superadmin.audit.toPolygon")}.` });
      } else {
        setNotice({ kind: r?.benign === false ? "bad" : "info", text: `${t("superadmin.audit.nothingAnchoredPrefix")} ${r?.reason || t("superadmin.audit.noPendingEntriesDefault")}.` });
      }
      await load();
    } catch (err) {
      setNotice({ kind: "bad", text: err.response?.data?.message || err.message || t("superadmin.audit.anchorErrorFallback") });
    } finally {
      setAnchoring(false);
    }
  };

  const intact = chain?.intact;
  const headMismatch = chain?.headMatch?.checked && !chain.headMatch.ok ? chain.headMatch : null;
  const ready = !!status?.blockchainReady;
  const chainMeta = status?.chain || null;
  const anchoringCfg = status?.anchoring || null;
  const anchoringOn = !!anchoringCfg?.enabled && ready;
  const explorerBase = chainMeta?.explorerBase || AUDIT_EXPLORER;
  const pending = status?.pendingAnchor || 0;
  const lastSeq = status?.lastSeq || 0;
  const anchoredUpTo = status?.anchoredUpTo || 0;
  const coveragePct = lastSeq ? Math.round((anchoredUpTo / lastSeq) * 100) : 0;
  const verifiedCount = chain?.count || 0;
  const latestAnchor = anchors.reduce((m, a) => ((a.toSeq ?? -1) > (m?.toSeq ?? -1) ? a : m), null);
  // seq to leaf index
  const latestAnchorBroken = (() => {
    if (!latestAnchor || !report) return null;
    const d = (report.anchors || []).find((x) => x.anchorId === latestAnchor.id);
    // slot map unknowable
    if (!d || d.sparseAnchor) return null;
    const from = Number(latestAnchor.fromSeq);
    const count = Number(latestAnchor.entryCount);
    return [...d.rowsAltered, ...d.rowsMissing]
      .map((s) => Number(s) - from)
      .filter((i) => i >= 0 && i < count);
  })();

  useEffect(() => {
    if (!orgId || intact) { setRecPreview(null); return; }
    let alive = true;
    superadminService.getAuditBackups()
      .then((d) => { if (alive) { const b = d?.backups || []; setBackups(b); setSelBackup((prev) => prev || b[0]?.file || ""); } })
      .catch(() => { if (alive) setBackups([]); });
    return () => { alive = false; };
  }, [orgId, intact]);

  const previewRecover = async () => {
    if (!orgId || !selBackup) return;
    setRecovering(true); setNotice(null);
    try {
      const p = await superadminService.previewAuditRecovery(orgId, selBackup);
      setRecPreview(p);
    } catch (err) {
      setNotice({ kind: "bad", text: err.response?.data?.message || err.message });
    } finally { setRecovering(false); }
  };

  const doRecover = async () => {
    if (!orgId || !selBackup) return;
    setRecovering(true); setNotice(null);
    try {
      const r = await superadminService.recoverAuditChain(orgId, selBackup);
      if (r?.blocked) {
        setNotice({ kind: "info", text: r.reason || t("superadmin.audit.recoverBlocked") });
        return;
      }
      const ok = !!r?.verifyAfter?.intact;
      setNotice({
        kind: ok ? "ok" : "bad",
        text: ok
          ? `${t("superadmin.audit.recoverDonePrefix")} ${r.restored} ${t("superadmin.unit.entries")} — ${t("superadmin.audit.chainIntactHeading")}.`
          : `${t("superadmin.audit.recoverDonePrefix")} ${r.restored} ${t("superadmin.unit.entries")}, ${t("superadmin.audit.recoverStillBroken")} ${r?.verifyAfter?.brokenAtSeq ?? ""}.`,
      });
      setRecPreview(null);
      await load();
    } catch (err) {
      setNotice({ kind: "bad", text: err.response?.data?.message || err.message });
    } finally { setRecovering(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <CustomSelect
            variant="admin-cyan"
            value={orgId}
            onChange={(val) => setOrgId(val)}
            leftIcon={<Building2 className="w-4 h-4 text-slate-500" />}
            placeholder={t("superadmin.audit.selectTenantOption")}
            ariaLabel={t("superadmin.audit.selectTenantOption")}
            options={tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reVerify} disabled={verifying || loading || !orgId}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {t("superadmin.audit.reVerifyButton")}
          </button>
          <button onClick={load} disabled={loading} title={t("common.refresh")}
            className="p-2.5 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
          notice.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
          : notice.kind === "bad" ? "bg-red-500/10 border-red-500/25 text-red-300"
          : "bg-slate-800/60 border-slate-700/50 text-slate-300"
        }`}>
          {notice.kind === "ok" ? <Check className="w-4 h-4" /> : notice.kind === "bad" ? <ShieldAlert className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
          {notice.text}
        </div>
      )}

      {loading ? (
        <StateBlock icon={<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />} title={t("superadmin.audit.loadingData")} />
      ) : error ? (
        <StateBlock icon={<AlertTriangle className="w-6 h-6 text-red-400" />} title={t("superadmin.state.failedToLoad")} message={error}
          action={<button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">{t("common.retry")}</button>} />
      ) : !orgId ? (
        <StateBlock icon={<ShieldCheck className="w-6 h-6 text-slate-500" />} title={t("superadmin.audit.selectTenantTitle")} message={t("superadmin.audit.selectTenantMessage")} />
      ) : (
        <>
          <div className="relative overflow-hidden border p-5"
            style={{
              borderColor: intact ? "var(--crt-accent-dim)" : "var(--crt-crit)",
              background: intact ? "var(--crt-accent-soft)" : "var(--crt-crit-soft)",
            }}>
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="shrink-0 p-3 border" style={{ borderColor: intact ? "var(--crt-accent-dim)" : "var(--crt-crit)" }}>
                  {intact
                    ? <Fingerprint className="w-8 h-8" style={{ color: "var(--crt-accent)", filter: "drop-shadow(var(--crt-glow))" }} />
                    : <ShieldAlert className="w-8 h-8" style={{ color: "var(--crt-crit)" }} />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-mono" style={{ color: intact ? "var(--crt-accent)" : "var(--crt-crit)" }}>
                    {intact ? t("superadmin.audit.chainIntactHeading") : t("superadmin.audit.chainBrokenHeading")}
                  </h3>
                  <p className="text-sm text-[color:var(--crt-fg-dim)] mt-1 font-mono">
                    {intact
                      ? `${formatNumber(verifiedCount)} ${t("superadmin.audit.verifiedEntriesSuffix")}`
                      : brokenText(chain)}
                  </p>
                  {headMismatch && (
                    <div className="mt-3 border p-3 font-mono text-[11px] space-y-1"
                      style={{ borderColor: "var(--crt-crit)", background: "var(--crt-crit-soft)" }}>
                      <p style={{ color: "var(--crt-crit)" }}>{t("superadmin.audit.headMismatchTitle")}</p>
                      <p className="text-[color:var(--crt-fg-dim)]">
                        {t("superadmin.audit.headExpectedLabel")}: seq #{headMismatch.expectedSeq} · {shortHash(headMismatch.expectedHash, 6, 6)}
                      </p>
                      <p className="text-[color:var(--crt-fg-dim)]">
                        {t("superadmin.audit.headActualLabel")}: seq #{headMismatch.actualSeq} · {shortHash(headMismatch.actualHash, 6, 6)}
                      </p>
                      {headMismatch.missingTail > 0 && (
                        <p style={{ color: "var(--crt-crit)" }}>
                          {formatNumber(headMismatch.missingTail)} {t("superadmin.audit.headMissingTail")}
                        </p>
                      )}
                      <p className="text-[color:var(--crt-fg-faint)] leading-relaxed">{t("superadmin.audit.headTruncatedHint")}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3 font-mono text-[11px]">
                    <span className="px-2 py-0.5 border border-[color:var(--crt-border)] text-[color:var(--crt-fg-dim)]">
                      SHA-256 hash-chain
                    </span>
                    <span className="px-2 py-0.5 border border-[color:var(--crt-border)] text-[color:var(--crt-fg-dim)]">
                      Merkle → Polygon
                    </span>
                    <span className="px-2 py-0.5 border border-[color:var(--crt-border)] text-[color:var(--crt-fg-dim)]">
                      {ready ? t("superadmin.audit.onchainActive") : t("superadmin.audit.onchainInactive")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="shrink-0 self-center md:self-auto">
                <RadialGauge value={coveragePct} max={100} label={t("superadmin.audit.coverageLabel")} tone={coveragePct >= 80 ? "accent" : coveragePct > 0 ? "warn" : "dim"} />
              </div>
            </div>
          </div>

          {!intact && (
            <div className="relative overflow-hidden border p-5"
              style={{ borderColor: "var(--crt-warn)", background: "var(--crt-warn-soft, rgba(234,179,8,0.06))" }}>
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 shrink-0" style={{ color: "var(--crt-warn)" }} />
                <div className="min-w-0">
                  <h3 className="text-sm font-mono" style={{ color: "var(--crt-warn)" }}>{t("superadmin.audit.recoverTitle")}</h3>
                  <p className="text-[11px] text-[color:var(--crt-fg-dim)] font-mono">{t("superadmin.audit.recoverSubtitle")}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <CustomSelect
                    variant="admin-cyan"
                    size="sm"
                    value={selBackup}
                    onChange={(val) => { setSelBackup(val); setRecPreview(null); }}
                    disabled={backups.length === 0}
                    leftIcon={<Database className="w-4 h-4" />}
                    placeholder={t("superadmin.audit.recoverNoBackups")}
                    ariaLabel={t("superadmin.audit.recoverTitle")}
                    options={backups.map((b) => ({
                      value: b.file,
                      label: `${b.file} · ${(b.size / 1024).toFixed(0)}KB · ${new Date(b.mtime).toLocaleString()}`,
                    }))}
                  />
                </div>
                <button onClick={previewRecover} disabled={recovering || !selBackup}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors disabled:opacity-50">
                  {recovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {t("superadmin.audit.recoverPreviewButton")}
                </button>
              </div>
              {recPreview && (
                <div className="mt-4 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 space-y-1.5">
                  <div>{t("superadmin.audit.recoverBackupCovers")}: seq 1..{recPreview.backupMaxSeq} ({formatNumber(recPreview.backupCount)} {t("superadmin.unit.entries")})</div>
                  <div>
                    {t("superadmin.audit.recoverMissing")}:{" "}
                    {recPreview.recoverable === 0
                      ? <span className="text-amber-400">{t("superadmin.audit.recoverNoneInBackup")}</span>
                      : <span className="text-emerald-400">{recPreview.recoverable} → seq [{recPreview.missingSeqs.join(", ")}]</span>}
                  </div>
                  {recPreview.recoverable > 0 && (
                    <button onClick={doRecover} disabled={recovering}
                      className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50">
                      {recovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                      {t("superadmin.audit.recoverConfirmButton")} ({recPreview.recoverable})
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!anchoringOn && (
            <div className="flex items-start gap-3 px-4 py-3 border font-mono"
              style={{ borderColor: "var(--crt-warn)", background: "var(--crt-warn-soft, rgba(234,179,8,0.08))" }}>
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--crt-warn)" }} />
              <div className="min-w-0 space-y-1">
                <p className="text-xs" style={{ color: "var(--crt-warn)" }}>{t("superadmin.audit.anchorOffHeading")}</p>
                <p className="text-[11px] text-[color:var(--crt-fg-dim)]">{t("superadmin.audit.anchorOffBody")}</p>
                <p className="text-[10px] text-[color:var(--crt-fg-faint)]">
                  {anchoringCfg && !anchoringCfg.enabled ? "AUDIT_ANCHOR_ENABLED=false" : null}
                  {anchoringCfg && !anchoringCfg.enabled && !ready ? " · " : null}
                  {!ready ? "BLOCKCHAIN_ENABLED / wallet belum siap" : null}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <TerminalStat icon={<Database />} label={t("superadmin.audit.statChainedEntries")} value={formatNumber(status?.chainedEntries)} sub={`${t("superadmin.audit.lastSeqSuffix")} #${lastSeq}`} />
            <TerminalStat icon={<Anchor />} label={t("superadmin.audit.statOnchainAnchors")} value={formatNumber(status?.anchorCount)} sub={`${t("superadmin.audit.upToSeqPrefix")} #${anchoredUpTo}`} />
            <TerminalStat icon={<Zap />} label={t("superadmin.audit.statNotAnchored")} value={formatNumber(pending)} sub={pending > 0 ? t("superadmin.audit.awaitingAnchor") : t("superadmin.audit.allAnchored")} tone={pending > 0 ? "warn" : "accent"} />
            <TerminalStat icon={<Hash />} label={t("superadmin.audit.headHashLabel")} value={<span className="text-base">{shortHash(status?.lastHash, 6, 6)}</span>} sub={t("superadmin.audit.chainTipSub")} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <TerminalPanel title={t("superadmin.audit.panelCoverageTitle")}>
              <div className="space-y-4">
                <GlowMeter
                  label={t("superadmin.audit.anchoredOverTotalLabel")}
                  value={anchoredUpTo}
                  max={lastSeq || 1}
                  display={`${formatNumber(anchoredUpTo)} / ${formatNumber(lastSeq)}`}
                  tone={coveragePct >= 80 ? "accent" : "warn"}
                />
                <SegmentBar
                  segments={[
                    { value: anchoredUpTo, label: t("superadmin.audit.segAnchored"), tone: "accent" },
                    { value: pending, label: t("superadmin.audit.segPending"), tone: "warn" },
                  ]}
                  hint={t("superadmin.audit.coverageHint")}
                />
                {anchoringCfg && (
                  <p className="font-mono text-[10px] text-[color:var(--crt-fg-faint)] leading-relaxed">
                    {t("superadmin.audit.scheduleLine")
                      .replace("{n}", formatNumber(anchoringCfg.everyN))
                      .replace("{check}", anchoringCfg.checkMinutes)
                      .replace("{flush}", anchoringCfg.intervalHours)}
                    {pending > 0 && anchoringOn
                      ? ` · ${t("superadmin.audit.scheduleNeedMore").replace("{k}", formatNumber(Math.max(0, anchoringCfg.everyN - pending)))}`
                      : ""}
                  </p>
                )}
              </div>
            </TerminalPanel>

            <TerminalPanel title={t("superadmin.audit.panelMerkleTitle")}>
              {latestAnchor ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-1/2">
                    <MerkleTree
                      leafCount={latestAnchor.entryCount}
                      root={latestAnchor.rootHash}
                      brokenIndexes={latestAnchorBroken}
                      proofIndex={latestAnchorBroken?.length ? Math.min(...latestAnchorBroken) : null}
                      onLeafClick={(i) => setProofSeq(Number(latestAnchor.fromSeq) + i)}
                      caption={`seq #${latestAnchor.fromSeq}–${latestAnchor.toSeq} ${t("superadmin.audit.rootHashArrow")}`}
                    />
                  </div>
                  <div className="w-full sm:w-1/2 font-mono text-[11px] space-y-2 text-[color:var(--crt-fg-dim)]">
                    <p><Layers className="inline w-3.5 h-3.5 mr-1 text-[color:var(--crt-accent)]" />{formatNumber(latestAnchor.entryCount)} {t("superadmin.audit.hashedPairwiseSuffix")}</p>
                    <p><ArrowRight className="inline w-3.5 h-3.5 mr-1 text-[color:var(--crt-accent)] rotate-90" />{t("superadmin.audit.rolledUpLine")}</p>
                    {latestAnchor.blockchainTxHash && (
                      <a href={`${explorerBase}/tx/${latestAnchor.blockchainTxHash}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[color:var(--crt-accent)] hover:underline">
                        {shortHash(latestAnchor.blockchainTxHash, 8, 6)} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <p className="text-[color:var(--crt-fg-faint)]">{t("superadmin.audit.mismatchLine")}</p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center font-mono text-sm text-[color:var(--crt-fg-dim)]">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-[color:var(--crt-fg-faint)]" />
                  {t("superadmin.audit.noAnchorsToVisualize")}
                </div>
              )}
              {latestAnchor && (
                <div className="mt-4">
                  <VerifyYourself chain={chainMeta} root={latestAnchor.rootHash} />
                </div>
              )}
            </TerminalPanel>
          </div>

          {report && report.intact === false && <ForensicsPanel report={report} onSelectSeq={(s) => setProofSeq(s)} />}

          <TerminalPanel title={t("superadmin.audit.panelChainTitle")}>
            {entries.length === 0 ? (
              <div className="py-6 text-center font-mono text-sm text-[color:var(--crt-fg-dim)]">
                <GitBranch className="w-7 h-7 mx-auto mb-2 text-[color:var(--crt-fg-faint)]" />
                {t("superadmin.audit.noChainedEntries")}
              </div>
            ) : (
              <>
                <HashChainViz entries={entries} onSelect={(e) => setProofSeq(e.sequenceNumber)} selectedSeq={proofSeq} />
                <p className="mt-3 font-mono text-[10px] text-[color:var(--crt-fg-faint)]">
                  {t("superadmin.audit.chainCaption")}
                </p>
                <p className="mt-1 font-mono text-[10px] text-[color:var(--crt-accent)]">
                  {t("superadmin.audit.chainClickHint")}
                </p>
              </>
            )}
          </TerminalPanel>

          <div className="border border-[color:var(--crt-border)] bg-[color:var(--crt-panel)] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 border border-[color:var(--crt-border)]">
                  <Anchor className="w-5 h-5 text-[color:var(--crt-accent)]" />
                </div>
                <div>
                  <p className="text-sm font-mono text-[color:var(--crt-fg)]">{t("superadmin.audit.anchorToPolygonTitle")}</p>
                  <p className="text-xs text-[color:var(--crt-fg-dim)] mt-0.5 font-mono">
                    {ready
                      ? `${t("superadmin.audit.blockchainActivePrefix")} ${pending} ${t("superadmin.audit.entriesNotAnchoredSuffix")}`
                      : t("superadmin.audit.blockchainInactiveDesc")}
                  </p>
                </div>
              </div>
              <button onClick={anchorNow} disabled={anchoring || !ready || pending === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[color:var(--crt-accent)] text-[color:var(--crt-on-accent)] text-sm font-mono font-semibold hover:bg-[color:var(--crt-accent-dim)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {anchoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Anchor className="w-4 h-4" />}
                {anchoring ? t("superadmin.audit.anchoringInProgress") : t("superadmin.audit.anchorNowButton")}
              </button>
            </div>
          </div>

          <div className="border border-[color:var(--crt-border)] bg-[color:var(--crt-panel)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[color:var(--crt-border)] flex items-center justify-between">
              <h3 className="text-base font-mono text-[color:var(--crt-accent)]">{t("superadmin.audit.onchainAnchorsTitle")}</h3>
              {anchorVerify && (
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                  anchorVerify.intact ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${anchorVerify.intact ? "bg-emerald-400" : "bg-red-400"}`} />
                  {anchorVerify.intact ? t("superadmin.audit.allMatchOnchain") : t("superadmin.audit.someMismatch")}
                </span>
              )}
            </div>
            {anchors.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Anchor className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t("superadmin.audit.noAnchorsYetPrefix")} "{t("superadmin.audit.anchorNowButton")}" {t("superadmin.audit.noAnchorsYetSuffix")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/30 text-xs text-slate-400 uppercase tracking-wide">
                    <tr>
                      <th className="px-6 py-3 font-medium">{t("superadmin.audit.colSeqRange")}</th>
                      <th className="px-6 py-3 font-medium">{t("superadmin.audit.colEntries")}</th>
                      <th className="px-6 py-3 font-medium">{t("superadmin.audit.colMerkleRoot")}</th>
                      <th className="px-6 py-3 font-medium">{t("superadmin.audit.colTx")}</th>
                      <th className="px-6 py-3 font-medium">{t("common.status")}</th>
                      <th className="px-6 py-3 font-medium">{t("superadmin.field.time")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {anchors.map((a) => {
                      const v = anchorVerify?.checks?.find((c) => c.anchorId === a.id);
                      return (
                        <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 text-sm font-mono text-slate-300">#{a.fromSeq}–{a.toSeq}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {a.entryCount}
                            {v && v.foundCount != null && v.foundCount !== a.entryCount && (
                              <span className="ml-1.5 text-xs text-red-400">
                                → {v.foundCount} ({t("superadmin.audit.rowMissingEntries")})
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4"><code className="font-mono text-xs text-slate-400">{shortHash(a.rootHash, 8, 6)}</code></td>
                          <td className="px-6 py-4">
                            {a.blockchainTxHash ? (
                              <a href={`${explorerBase}/tx/${a.blockchainTxHash}`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-xs text-cyan-400 hover:underline">
                                {shortHash(a.blockchainTxHash, 8, 6)} <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : <span className="text-slate-600 text-xs">-</span>}
                          </td>
                          <td className="px-6 py-4">
                            {v ? (
                              <span title={v.error || undefined}
                                className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${v.intact ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${v.intact ? "bg-emerald-400" : "bg-red-400"}`} />
                                {v.intact
                                  ? t("superadmin.audit.rowMatch")
                                  : v.error
                                    ? t("superadmin.audit.rowCorrupt")
                                    : v.onChain ? t("superadmin.audit.rowDbDiffers") : t("superadmin.audit.rowNotOnchain")}
                              </span>
                            ) : <span className="text-xs text-slate-500">{a.status}</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap">{formatDateTime(a.anchoredAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800/50 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{t("superadmin.audit.logEntriesTitle")}</h3>
              <span className="text-xs text-slate-500">{entries.length} {t("superadmin.audit.latestSuffix")}</span>
            </div>
            {entries.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Link2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t("superadmin.audit.noChainedEntries")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/50">
                {entries.map((e) => (
                  <li key={e.sequenceNumber}>
                    <button type="button" onClick={() => setProofSeq(e.sequenceNumber)}
                      aria-label={`${t("superadmin.audit.proofTitle")} #${e.sequenceNumber}`}
                      className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-slate-800/20 transition-colors cursor-pointer">
                      <span className="shrink-0 inline-flex items-center justify-center w-12 h-8 rounded-lg bg-slate-800/80 border border-slate-700/50 font-mono text-xs text-cyan-300">#{e.sequenceNumber}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200 capitalize">{e.action}</span>
                          <span className="text-xs text-slate-500">{e.resourceType}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono text-slate-500">
                          <Link2 className="w-3 h-3 text-slate-600" />
                          <span title={e.prevHash}>{shortHash(e.prevHash, 6, 4)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-600" />
                          <span className="text-slate-400" title={e.entryHash}>{shortHash(e.entryHash, 6, 4)}</span>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(e.createdAt)}</span>
                      <Fingerprint className="shrink-0 w-4 h-4 text-slate-600" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {proofSeq != null && orgId && (
        <EntryProofDrawer key={`${orgId}:${proofSeq}`} orgId={orgId} seq={proofSeq} onClose={() => setProofSeq(null)} />
      )}
    </div>
  );
}

const bcExplorer = (chainId) =>
  chainId === 137 ? "https://polygonscan.com" : chainId === 80002 ? "https://amoy.polygonscan.com" : null;

function BlockchainTab() {
  const { t } = useLang();
  const [stats, setStats] = useState(null);
  const [txs, setTxs] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, txsData, h] = await Promise.all([
        superadminService.getBlockchainStats(),
        superadminService.getBlockchainTransactions(25),
        superadminService.getBlockchainHealth().catch(() => null),
      ]);
      setStats(s);
      setTxs(Array.isArray(txsData) ? txsData : []);
      setHealth(h);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.blockchain.loadErrorFallback"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <StateBlock icon={<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />} title={t("superadmin.blockchain.loadingBlockchain")} />;
  if (error) return (
    <StateBlock icon={<AlertTriangle className="w-6 h-6 text-red-400" />} title={t("superadmin.state.failedToLoad")} message={error}
      action={<button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">{t("common.retry")}</button>} />
  );

  const chainId = stats?.chainId;
  const network = stats?.network || (chainId === 80002 ? "Polygon Amoy Testnet" : chainId === 137 ? "Polygon Mainnet" : "-");
  const explorer = bcExplorer(chainId);
  const enabled = !!stats?.enabled;

  const anchorStale = health?.lastAnchorAgeHours != null && health.lastAnchorAgeHours > 48;
  const showHealthBanner = health && (health.lowBalance || anchorStale || health.auditBacklog > 0);

  const txStatus = txs.reduce((acc, tx) => {
    const k = tx.status === "confirmed" ? "confirmed" : tx.status === "pending" ? "pending" : "failed";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const confirmedPct = txs.length ? Math.round(((txStatus.confirmed || 0) / txs.length) * 100) : 0;
  const balance = Number(stats?.polygonBalance || 0);
  const minBal = Number(health?.minBalance || 0);
  const balanceMax = Math.max(balance, minBal * 4, 0.5) || 1;
  const balTone = health?.lowBalance ? "crit" : balance <= minBal * 1.5 && minBal > 0 ? "warn" : "accent";
  const blocks = [...txs].slice(0, 22).reverse().map((tx) => ({
    tone: tx.status === "confirmed" ? "ok" : tx.status === "pending" ? "warn" : "crit",
    title: `${tx.docName || "tx"} · ${tx.status || "unknown"}${tx.blockNumber ? ` · #${tx.blockNumber}` : ""}`,
  }));

  return (
    <div className="space-y-6">
      {showHealthBanner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-300 mb-0.5">{t("superadmin.blockchain.attentionNeeded")}</p>
            <ul className="text-amber-200/80 space-y-0.5 list-disc list-inside">
              {health.lowBalance && (
                <li>{t("superadmin.blockchain.lowBalancePrefix")} <span className="font-mono">{health.walletBalance} POL</span> (min {health.minBalance}). {t("superadmin.blockchain.lowBalanceSuffix")}</li>
              )}
              {health.auditBacklog > 0 && (
                <li>{formatNumber(health.auditBacklog)} {t("superadmin.blockchain.auditBacklogSuffix")}</li>
              )}
              {anchorStale && (
                <li>{t("superadmin.blockchain.lastAnchorPrefix")} {health.lastAnchorAgeHours} {t("superadmin.blockchain.hoursAgoSuffix")}</li>
              )}
            </ul>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border ${
          enabled ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"
        }`}>
          <span className={`w-2 h-2 rounded-full ${enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`} />
          {enabled ? network : t("superadmin.blockchain.inactive")}
        </span>
        <button onClick={load} className="p-2.5 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800 transition-colors"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {!enabled && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300/90">{t("superadmin.blockchain.envWarningPart1")} <code className="font-mono">BLOCKCHAIN_ENABLED=true</code> {t("superadmin.blockchain.envWarningPart2")} <code className="font-mono">.env</code>{t("superadmin.blockchain.envWarningPart3")}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TerminalStat icon={<Coins />} label={t("superadmin.blockchain.statWalletBalance")} value={balance.toFixed(4)} sub={chainId === 137 ? "POL" : "POL (testnet)"} tone={balTone} />
        <TerminalStat icon={<Zap />} label={t("superadmin.blockchain.statTotalTx")} value={formatNumber(stats?.totalTransactions)} sub={`${formatNumber(stats?.pendingTransactions)} pending`} />
        <TerminalStat icon={<ShieldCheck />} label={t("superadmin.blockchain.statConfirmedAnchors")} value={formatNumber(stats?.documentsHashed)} sub="on-chain" />
        <TerminalStat icon={<Fuel />} label={t("superadmin.blockchain.statTotalGas")} value={formatNumber(stats?.gasUsed)} sub={t("superadmin.blockchain.cumulativeUnitsSub")} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <TerminalPanel title={t("superadmin.blockchain.panelWalletHealthTitle")}>
          <div className="flex items-center gap-5">
            <RadialGauge value={confirmedPct} max={100} label={t("superadmin.blockchain.confirmedTxLabel")} tone={confirmedPct >= 80 ? "accent" : confirmedPct > 0 ? "warn" : "dim"} size={112} />
            <div className="flex-1 space-y-4">
              <GlowMeter
                label={t("superadmin.blockchain.walletBalanceGasLabel")}
                value={balance}
                max={balanceMax}
                display={`${balance.toFixed(4)} POL`}
                tone={balTone}
              />
              {minBal > 0 && (
                <p className="font-mono text-[11px] text-[color:var(--crt-fg-faint)]">
                  {t("superadmin.blockchain.safeMinPrefix")} <span className="text-[color:var(--crt-fg-dim)]">{minBal} POL</span> {t("superadmin.blockchain.belowMinWarning")}
                </p>
              )}
              <div className="grid grid-cols-3 gap-2 font-mono text-center">
                {[
                  { l: "pending", v: formatNumber(health?.pendingAnchors ?? stats?.pendingTransactions), icon: <Anchor className="w-3.5 h-3.5" /> },
                  { l: "backlog", v: formatNumber(health?.auditBacklog ?? 0), icon: <Hash className="w-3.5 h-3.5" /> },
                  { l: "anchor", v: health?.lastAnchorAgeHours != null ? `${health.lastAnchorAgeHours}j` : "-", icon: <Clock className="w-3.5 h-3.5" /> },
                ].map((m) => (
                  <div key={m.l} className="border border-[color:var(--crt-border)] py-2">
                    <div className="flex items-center justify-center text-[color:var(--crt-accent)] mb-1">{m.icon}</div>
                    <div className="text-sm text-[color:var(--crt-fg)] tabular-nums">{m.v}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[color:var(--crt-fg-faint)]">{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TerminalPanel>

        <TerminalPanel title={t("superadmin.blockchain.panelFlowTitle")}>
          <div className="space-y-5">
            <BlockStrip items={blocks} label={`${txs.length} ${t("superadmin.blockchain.txFlowLabelSuffix")}`} />
            {txs.length > 0 ? (
              <SegmentBar
                segments={[
                  { value: txStatus.confirmed || 0, label: "confirmed", tone: "accent" },
                  { value: txStatus.pending || 0, label: "pending", tone: "warn" },
                  { value: txStatus.failed || 0, label: "failed", tone: "crit" },
                ]}
                hint={t("superadmin.blockchain.txDistributionHint")}
              />
            ) : (
              <p className="font-mono text-sm text-[color:var(--crt-fg-dim)] text-center py-4">
                <Network className="w-7 h-7 mx-auto mb-2 text-[color:var(--crt-fg-faint)]" />
                {t("superadmin.blockchain.noBlocksRecorded")}
              </p>
            )}
          </div>
        </TerminalPanel>
      </div>

      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/50"><h3 className="text-base font-semibold text-white">{t("superadmin.blockchain.networkConfigTitle")}</h3></div>
        <dl className="divide-y divide-slate-800/50">
          {[
            { k: t("superadmin.blockchain.rowNetwork"), v: network },
            { k: "Chain ID", v: chainId ?? "-" },
            { k: t("superadmin.blockchain.rowContract"), v: stats?.contractAddress ? (
              <span className="inline-flex items-center gap-2">
                <code className="font-mono text-sm text-cyan-400">{shortHash(stats.contractAddress, 10, 8)}</code>
                {explorer && <a href={`${explorer}/address/${stats.contractAddress}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-cyan-400"><ExternalLink className="w-4 h-4" /></a>}
              </span>
            ) : t("superadmin.blockchain.notDeployedYet") },
            { k: "Wallet", v: stats?.walletAddress ? <code className="font-mono text-sm text-slate-300">{shortHash(stats.walletAddress, 10, 8)}</code> : "-" },
          ].map((row) => (
            <div key={row.k} className="flex items-center justify-between px-6 py-3.5">
              <dt className="text-sm text-slate-400">{row.k}</dt>
              <dd className="text-sm font-medium text-white text-right">{row.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/50 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{t("superadmin.blockchain.txHistoryTitle")}</h3>
          <span className="text-xs text-slate-500">{txs.length} {t("superadmin.unit.entries")}</span>
        </div>
        {txs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Anchor className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">{t("superadmin.blockchain.noTxYet")}</p>
          </div>
        ) : (
          <div>
            {txs.map((tx, i) => {
              const st = tx.status || "unknown";
              const stColor = st === "confirmed" ? "var(--crt-accent)" : st === "pending" ? "var(--crt-warn)" : "var(--crt-crit)";
              return (
                <div
                  key={tx.id}
                  className="crt-row-in group relative flex items-center gap-4 px-5 py-3.5 border-b border-[color:var(--crt-border)] hover:bg-[color:var(--crt-accent-soft)] transition-colors"
                  style={{ animationDelay: `${Math.min(i * 28, 320)}ms` }}
                >
                  <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: stColor, opacity: 0.85 }} />
                  <div className="w-9 h-9 shrink-0 flex items-center justify-center border" style={{ borderColor: stColor, color: stColor, background: "var(--crt-panel-2)" }}>
                    <Anchor className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[color:var(--crt-fg)] truncate max-w-[15rem]">{tx.docName || "anchor"}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-px shrink-0" style={{ color: stColor, border: `1px solid ${stColor}` }}>
                        {st === "pending" ? <span className="crt-pulse inline-block">{st}</span> : st}
                      </span>
                    </div>
                    <div className="mt-1 text-xs">
                      {explorer && tx.transactionHash ? (
                        <a href={`${explorer}/tx/${tx.transactionHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[color:var(--crt-accent)] hover:underline">
                          <span className="text-[color:var(--crt-fg-faint)]">tx</span>{shortHash(tx.transactionHash, 10, 8)} <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : <code className="font-mono text-[color:var(--crt-fg-faint)]">tx {shortHash(tx.transactionHash, 10, 8)}</code>}
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-0.5 text-xs font-mono whitespace-nowrap">
                    <span className="text-[color:var(--crt-fg-dim)]">{tx.blockNumber ? `blk #${formatNumber(tx.blockNumber)}` : "-"}</span>
                    <span className="text-[color:var(--crt-fg-faint)]">{formatDateTime(tx.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, icon, children }) {
  return (
    <div className="rounded-2xl border border-slate-800/50 bg-slate-900/60 backdrop-blur-xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        {icon}
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function SplitBar({ a, b, aLabel, bLabel, aClass = "bg-cyan-500", bClass = "bg-slate-600" }) {
  const total = (a || 0) + (b || 0) || 1;
  const aPct = Math.round((a / total) * 100);
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-800">
        <motion.div initial={{ width: 0 }} animate={{ width: `${aPct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} className={aClass} />
        <div className={`flex-1 ${bClass}`} />
      </div>
      <div className="flex justify-between mt-2 text-xs">
        <span className="text-cyan-400">{aLabel}: {formatNumber(a)} ({aPct}%)</span>
        <span className="text-slate-400">{bLabel}: {formatNumber(b)}</span>
      </div>
    </div>
  );
}

function SecurityTab() {
  const { t } = useLang();
  const EVENT_LABELS = {
    brute_force: t("superadmin.security.eventBruteForce"),
    malware_detected: t("superadmin.security.eventMalware"),
    unauthorized_access: t("superadmin.security.eventUnauthorizedAccess"),
    honeytoken_triggered: t("superadmin.security.eventHoneytoken"),
  };
  const [sec, setSec] = useState(null);
  const [enc, setEnc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, e] = await Promise.all([
        superadminService.getSecurityOverview(),
        superadminService.getEncryptionAdoption(),
      ]);
      setSec(s);
      setEnc(e);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.security.loadErrorFallback"));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <StateBlock icon={<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />} title={t("superadmin.security.loadingSecurity")} />;
  if (error) return (
    <StateBlock icon={<AlertTriangle className="w-6 h-6 text-red-400" />} title={t("superadmin.state.failedToLoad")} message={error}
      action={<button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">{t("common.retry")}</button>} />
  );

  const p = sec?.platform || {};
  const ev = sec?.eventsByType || {};
  const evKeys = Object.keys(ev);
  const plat = enc?.platform || { v1: 0, v2: 0, total: 0, pctV2: 0 };
  const perTenant = sec?.perTenant || [];
  const encPer = enc?.perTenant || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t("superadmin.security.totp2faAdoption")} value={`${p.totpPct ?? 0}%`} subtitle={`${formatNumber(p.totpEnabled)}/${formatNumber(p.totalUsers)} user`} icon={<Lock className="w-5 h-5 text-cyan-400" />} delay={0} />
        <StatCard title={t("superadmin.security.lockedAccounts")} value={formatNumber(p.lockedNow)} subtitle={t("superadmin.security.currentlySub")} icon={<ShieldAlert className="w-5 h-5 text-amber-400" />} delay={0.05} />
        <StatCard title={t("superadmin.security.failedLogins")} value={formatNumber(p.failedLoginSum)} subtitle={t("superadmin.security.cumulativeSub")} icon={<AlertTriangle className="w-5 h-5 text-cyan-400" />} delay={0.1} />
        <StatCard title={t("superadmin.security.unverifiedEmail")} value={formatNumber(p.unverifiedEmail)} icon={<Users className="w-5 h-5 text-cyan-400" />} delay={0.15} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title={t("superadmin.security.loginMethodsTitle")} icon={<Lock className="w-4 h-4 text-cyan-400" />}>
          <SplitBar a={p.googleSso || 0} b={p.passwordOnly || 0} aLabel="Google SSO" bLabel={t("common.password")} />
        </Panel>
        <Panel title={t("superadmin.security.eventsTitle")} icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}>
          {evKeys.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              {t("superadmin.security.noOpenEvents")}
            </p>
          ) : (
            <div className="space-y-2">
              {evKeys.map((k) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{EVENT_LABELS[k] || k}</span>
                  <span className="font-mono text-amber-400">{formatNumber(ev[k])}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title={t("superadmin.security.encryptionTitle")}
        subtitle={`${enc?.orgsWithActiveKeypair ?? 0}/${enc?.totalOrgs ?? 0} ${t("superadmin.security.tenantsHaveKeypairSuffix")} ${enc?.pqcEnabled ? t("superadmin.toggle.on") : t("superadmin.toggle.off")}`}
        icon={<Cpu className="w-4 h-4 text-cyan-400" />}
      >
        <SplitBar a={plat.v2 || 0} b={plat.v1 || 0} aLabel={t("superadmin.security.v2HybridPqc")} bLabel={t("superadmin.security.v1Classic")} />
        {encPer.length > 0 && (
          <div className="mt-4 space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {encPer.map((org) => (
              <div key={org.orgId} className="flex items-center gap-3 text-xs">
                <span className="flex-1 truncate text-slate-300">{org.name || org.orgId.slice(0, 8)}</span>
                <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-500" style={{ width: `${org.pctV2}%` }} />
                </div>
                <span className="w-10 text-right font-mono text-cyan-400">{org.pctV2}%</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t("superadmin.security.perTenantTitle")} subtitle={t("superadmin.security.perTenantSubtitle")} icon={<Building2 className="w-4 h-4 text-cyan-400" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-4 font-medium">{t("superadmin.field.tenant")}</th>
                <th className="py-2 pr-4 font-medium">{t("superadmin.field.users")}</th>
                <th className="py-2 pr-4 font-medium">2FA</th>
                <th className="py-2 font-medium">{t("superadmin.security.colLocked")}</th>
              </tr>
            </thead>
            <tbody>
              {perTenant.map((org) => (
                <tr key={org.orgId} className="border-b border-slate-800/50">
                  <td className="py-2 pr-4 text-slate-300 truncate max-w-[12rem]">{org.name || org.orgId.slice(0, 8)}</td>
                  <td className="py-2 pr-4 text-slate-400 font-mono">{formatNumber(org.users)}</td>
                  <td className="py-2 pr-4">{org.suppressed ? <span className="text-slate-600">-</span> : <span className="text-cyan-400 font-mono">{org.totpPct}%</span>}</td>
                  <td className="py-2">{org.suppressed ? <span className="text-slate-600">-</span> : <span className="text-slate-400 font-mono">{formatNumber(org.locked)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

const ADMIN_SEVERITY_CLS = {
  critical: "bg-red-500/10 text-red-400",
  high: "bg-amber-500/10 text-amber-400",
  medium: "bg-cyan-500/10 text-cyan-400",
};
function summarizeAdminDetail(t, adminAction, d) {
  if (!d) return "-";
  if (adminAction === "tenant_create") return d.companyName || "-";
  if (adminAction === "tenant_status") return `${t("superadmin.adminActivity.activeLabel")} ${d.isActive ? t("common.yes") : t("common.no")}`;
  if (adminAction === "tenant_features") {
    const after = d.after || {};
    return Object.entries(after).map(([k, v]) => `${k}=${v ? "on" : "off"}`).join(", ") || "-";
  }
  if (adminAction?.startsWith("ssh_")) {
    const parts = [];
    if (d.ip) parts.push(`IP ${d.ip}`);
    if (d.user && d.host) parts.push(`${d.user}@${d.host}`);
    if (d.reason) parts.push(`${t("superadmin.adminActivity.reasonLabel")} ${d.reason}`);
    if (d.stage) parts.push(`${t("superadmin.adminActivity.stageLabel")} ${d.stage}`);
    return parts.join(" · ") || "-";
  }
  return "-";
}
function AdminActivityTab() {
  const { t } = useLang();
  const ADMIN_ACTION_LABELS = {
    tenant_create: t("superadmin.adminActivity.actionTenantCreate"),
    tenant_status: t("superadmin.adminActivity.actionTenantStatus"),
    tenant_features: t("superadmin.adminActivity.actionTenantFeatures"),
    ssh_otp_sent: t("superadmin.adminActivity.actionSshOtpSent"),
    ssh_otp_failed: t("superadmin.adminActivity.actionSshOtpFailed"),
    ssh_ticket_issued: t("superadmin.adminActivity.actionSshTicketIssued"),
    ssh_ticket_denied: t("superadmin.adminActivity.actionSshTicketDenied"),
    ssh_console_open: t("superadmin.adminActivity.actionSshConsoleOpen"),
    ssh_console_close: t("superadmin.adminActivity.actionSshConsoleClose"),
    ssh_console_denied: t("superadmin.adminActivity.actionSshConsoleDenied"),
    ssh_access_locked: t("superadmin.adminActivity.actionSshAccessLocked"),
  };
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await superadminService.getAdminActivity({ page, limit: 30 }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.adminActivity.loadErrorFallback"));
    } finally {
      setLoading(false);
    }
  }, [page, t]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <StateBlock icon={<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />} title={t("superadmin.adminActivity.loadingActivity")} />;
  if (error) return (
    <StateBlock icon={<AlertTriangle className="w-6 h-6 text-red-400" />} title={t("superadmin.state.failedToLoad")} message={error}
      action={<button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">{t("common.retry")}</button>} />
  );

  const rows = data?.activity || [];
  const pg = data?.pagination || { page: 1, total: 0, limit: 30 };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">{t("superadmin.adminActivity.description")}</p>
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                <th className="py-3 px-4 font-medium">{t("common.actions")}</th>
                <th className="py-3 px-4 font-medium">{t("superadmin.field.tenant")}</th>
                <th className="py-3 px-4 font-medium">{t("superadmin.field.detail")}</th>
                <th className="py-3 px-4 font-medium">{t("superadmin.field.time")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${ADMIN_SEVERITY_CLS[r.details?.severity] || "bg-cyan-500/10 text-cyan-400"}`}>{ADMIN_ACTION_LABELS[r.details?.adminAction] || r.details?.adminAction || r.action}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 truncate max-w-[12rem]">
                    {r.resourceType === "system"
                      ? <span className="inline-flex items-center gap-1.5 text-amber-400"><Server className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{t("superadmin.adminActivity.scopePlatform")}</span>
                      : r.orgName || (r.organizationId ? r.organizationId.slice(0, 8) : "-")}
                  </td>
                  <td className="py-3 px-4 text-slate-400 truncate max-w-[16rem]">{summarizeAdminDetail(t, r.details?.adminAction, r.details)}</td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{r.createdAt ? new Date(r.createdAt).toLocaleString("id-ID") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">{t("superadmin.adminActivity.noActivity")}</div>
        )}
      </div>
      <Pagination currentPage={pg.page} totalItems={pg.total} pageSize={pg.limit} onPageChange={setPage} />
    </div>
  );
}

function crtVar(name, fallback) {
  try {
    const el = document.querySelector(".crt");
    const v = el && getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}
function ConsoleTab() {
  const { t } = useLang();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [msg, setMsg] = useState(null);
  const termElRef = useRef(null);
  const xtermRef = useRef(null);
  const wsRef = useRef(null);
  const onResizeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try { setStatus(await superadminService.getSshStatus()); }
      catch { setStatus({ enabled: false }); }
      finally { setLoading(false); }
    })();
  }, []);

  const teardown = useCallback(() => {
    if (onResizeRef.current) { window.removeEventListener("resize", onResizeRef.current); onResizeRef.current = null; }
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    try { xtermRef.current?.dispose(); } catch {}
    xtermRef.current = null;
  }, []);
  useEffect(() => teardown, [teardown]);

  const requestOtp = async () => {
    setSendingOtp(true); setMsg(null);
    try {
      await superadminService.sendSshOtp();
      setOtpSent(true);
      setMsg(t("superadmin.console.otpSentNotice"));
    } catch (err) {
      setMsg(err.response?.data?.message || t("superadmin.console.otpSendErrorFallback"));
    } finally { setSendingOtp(false); }
  };

  const connect = async (e) => {
    e?.preventDefault?.();
    if (!password) { setMsg(t("superadmin.console.enterSshPassword")); return; }
    if (status?.otpRequired && !otp) { setMsg(t("superadmin.console.enterOtpFirst")); return; }
    setMsg(null); setPhase("connecting");
    teardown();

    let ticket;
    try { ticket = await superadminService.createSshTicket(otp); }
    catch (err) { setMsg(err.response?.data?.message || t("superadmin.console.ticketErrorFallback")); setPhase("error"); return; }

    const term = new XTerm({
      cursorBlink: true, fontFamily: "JetBrains Mono, ui-monospace, monospace", fontSize: 13, scrollback: 2500,
      theme: {
        background: crtVar("--crt-bg", "#0a0a0c"), foreground: crtVar("--crt-fg", "#ece7df"),
        cursor: crtVar("--crt-accent", "#f2a63a"), cursorAccent: crtVar("--crt-bg", "#0a0a0c"),
        selectionBackground: crtVar("--crt-accent-soft", "rgba(242,166,58,0.2)"),
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termElRef.current);
    xtermRef.current = term;
    requestAnimationFrame(() => { try { fit.fit(); } catch {} });

    const ws = new WebSocket(sshWsUrl(ticket.wsPath, ticket.ticket));
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "connect", password, cols: term.cols, rows: term.rows }));
      setPassword(""); setOtp(""); setOtpSent(false);
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === "ready") { setPhase("connected"); setMsg(null); term.focus(); }
        else if (m.type === "status") setMsg(m.message);
        else if (m.type === "error") { setMsg(m.message); setPhase("error"); }
        else if (m.type === "exit") { setMsg(`${t("superadmin.console.sessionEndedPrefix")} ${m.reason}`); setPhase("closed"); }
      } else {
        term.write(new Uint8Array(ev.data));
      }
    };
    ws.onclose = () => setPhase((p) => (p === "connected" || p === "connecting" ? "closed" : p));
    ws.onerror = () => { setMsg(t("superadmin.console.wsError")); setPhase("error"); };

    term.onData((d) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "data", data: d })); });
    const onResize = () => {
      try { fit.fit(); if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })); } catch {}
    };
    onResizeRef.current = onResize;
    window.addEventListener("resize", onResize);
  };

  const disconnect = () => { teardown(); setPhase("closed"); setMsg(t("superadmin.console.disconnectedNotice")); };

  if (loading) return <StateBlock icon={<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />} title={t("superadmin.console.loadingConsole")} />;
  if (!status?.enabled) {
    return (
      <Panel title={t("superadmin.dashboard.consoleTitle")} icon={<Fingerprint className="w-4 h-4 text-cyan-400" />}>
        <p className="text-sm text-slate-400">
          {t("superadmin.console.disabledPart1")} <code className="font-mono">SSH_CONSOLE_ENABLED=true</code> + <code className="font-mono">SSH_CONSOLE_HOST/USER</code> {t("superadmin.console.disabledPart3")} <code className="font-mono">.env</code>{t("superadmin.console.disabledPart4")}
        </p>
      </Panel>
    );
  }

  const live = phase === "connecting" || phase === "connected";
  return (
    <div className="space-y-4">
      <Panel
        title={`Web-SSH · ${status.user}@${status.host}:${status.port}`}
        subtitle={t("superadmin.console.panelSubtitle")}
        icon={<Fingerprint className="w-4 h-4 text-cyan-400" />}
      >
        {!live ? (
          <form onSubmit={connect} className="flex flex-wrap items-end gap-3">
            {status.otpRequired && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t("superadmin.console.otpFieldLabel")}</label>
                <div className="flex gap-2">
                  <input inputMode="numeric" value={otp} maxLength={6} onChange={(e) => setOtp(e.target.value)} placeholder={t("superadmin.console.otpPlaceholder")}
                    className="w-28 bg-[color:var(--crt-panel-2)] border border-[color:var(--crt-border)] px-3 py-2 text-sm font-mono text-[color:var(--crt-fg)] focus:outline-none focus:border-[color:var(--crt-accent-dim)]" />
                  <button type="button" onClick={requestOtp} disabled={sendingOtp}
                    className="px-3 py-2 border border-[color:var(--crt-border)] text-xs text-[color:var(--crt-fg-dim)] hover:text-[color:var(--crt-accent)] hover:border-[color:var(--crt-accent-dim)] transition-colors disabled:opacity-40">
                    {sendingOtp ? "…" : otpSent ? t("superadmin.console.resendOtp") : t("superadmin.console.sendOtp")}
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t("superadmin.console.sshPasswordLabel")}</label>
              <input type="password" value={password} autoComplete="off" onChange={(e) => setPassword(e.target.value)}
                className="w-56 bg-[color:var(--crt-panel-2)] border border-[color:var(--crt-border)] px-3 py-2 text-sm text-[color:var(--crt-fg)] focus:outline-none focus:border-[color:var(--crt-accent-dim)]" />
            </div>
            <button type="submit" className="px-4 py-2 bg-[color:var(--crt-accent)] text-[color:var(--crt-on-accent)] text-sm font-semibold hover:bg-[color:var(--crt-accent-dim)] transition-colors">&gt; {t("superadmin.console.connectAction")}</button>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--crt-accent)" }}>
              <span className="w-1.5 h-1.5 rounded-full crt-pulse" style={{ background: "var(--crt-accent)" }} />{phase}
            </span>
            <button onClick={disconnect} className="px-3 py-1.5 border text-xs transition-colors" style={{ borderColor: "var(--crt-crit)", color: "var(--crt-crit)" }}>{t("superadmin.console.disconnectAction")}</button>
          </div>
        )}
        {msg && <p className="mt-2 text-xs font-mono" style={{ color: "var(--crt-warn)" }}>{msg}</p>}
      </Panel>

      <div className="border" style={{ borderColor: "var(--crt-border)", background: "var(--crt-bg)" }}>
        <div ref={termElRef} className="h-[60vh] w-full p-2" />
      </div>
    </div>
  );
}

const SCAN_STATUS_STYLE = {
  completed: "text-emerald-600 dark:text-emerald-400",
  running: "text-cyan-600 dark:text-cyan-400",
  failed: "text-red-600 dark:text-red-400",
  pending: "text-slate-500",
};
function LeakMonitorTab() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await superadminService.getLeakMonitoring());
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.leakMonitor.loadErrorFallback"));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <StateBlock icon={<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />} title={t("superadmin.leakMonitor.loadingLeaks")} />;
  if (error) return (
    <StateBlock icon={<AlertTriangle className="w-6 h-6 text-red-400" />} title={t("superadmin.state.failedToLoad")} message={error}
      action={<button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">{t("common.retry")}</button>} />
  );

  const p = data?.platform || {};
  const prov = data?.providers || {};
  const byTenant = data?.byTenant || [];
  const recent = data?.recentScans || [];
  const used30 = p.serperCreditsLast30d || 0;
  const budget = p.serperMonthlyBudget || 0;
  const remaining = Math.max(0, budget - used30);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t("superadmin.leakMonitor.trackedDocs")} value={formatNumber(p.trackedDocs)} icon={<FileText className="w-5 h-5 text-cyan-400" />} delay={0} />
        <StatCard title={t("superadmin.leakMonitor.watermarkedDownloads")} value={formatNumber(p.watermarkedDownloads)} icon={<Hash className="w-5 h-5 text-cyan-400" />} delay={0.05} />
        <StatCard title={t("superadmin.leakMonitor.scans7d")} value={formatNumber(p.scansLast7d)} subtitle={`total ${formatNumber(p.totalScans)}`} icon={<Activity className="w-5 h-5 text-cyan-400" />} delay={0.1} />
        <StatCard title={t("superadmin.leakMonitor.leaks30d")} value={formatNumber(p.leaksLast30d)} subtitle={`total ${formatNumber(p.totalLeaks)}`} icon={<AlertTriangle className={`w-5 h-5 ${(p.leaksLast30d || 0) > 0 ? "text-red-400" : "text-cyan-400"}`} />} delay={0.15} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title={t("superadmin.leakMonitor.searchProviderTitle")} subtitle={`${t("superadmin.leakMonitor.lastScanPrefix")} ${p.lastScanAt ? formatDate(p.lastScanAt) : "-"}`} icon={<Database className="w-4 h-4 text-cyan-400" />}>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-400">Auto-scan</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${prov.autoScanEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${prov.autoScanEnabled ? "bg-emerald-400" : "bg-amber-400"}`} />
              {prov.autoScanEnabled ? t("superadmin.toggle.on") : t("superadmin.toggle.off")}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">{t("superadmin.leakMonitor.activeProviderLabel")}</span>
            <span className="font-mono text-cyan-400">{(prov.configured || []).join(", ") || t("superadmin.leakMonitor.noKeyFallback")}</span>
          </div>
        </Panel>

        <Panel title={t("superadmin.leakMonitor.serperCreditsTitle")} subtitle={`${t("superadmin.leakMonitor.allTimeTotalPrefix")} ${formatNumber(p.serperCreditsTotal)}`} icon={<Coins className="w-4 h-4 text-cyan-400" />}>
          {budget > 0 ? (
            <SplitBar a={used30} b={remaining} aLabel={t("superadmin.leakMonitor.usedLabel")} bLabel={t("superadmin.leakMonitor.remainingLabel")} />
          ) : (
            <p className="text-sm text-slate-500">{t("superadmin.leakMonitor.budgetNotSet")} {t("superadmin.leakMonitor.used30dPrefix")} {formatNumber(used30)}.</p>
          )}
        </Panel>
      </div>

      <Panel title={t("superadmin.leakMonitor.perTenantActivityTitle")} subtitle={t("superadmin.leakMonitor.perTenantActivitySubtitle")} icon={<Building2 className="w-4 h-4 text-cyan-400" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-4 font-medium">{t("superadmin.field.tenant")}</th>
                <th className="py-2 pr-4 font-medium">Tracked</th>
                <th className="py-2 pr-4 font-medium">Scan</th>
                <th className="py-2 pr-4 font-medium">{t("superadmin.leakMonitor.colLeaked")}</th>
                <th className="py-2 font-medium">{t("superadmin.leakMonitor.colLastScan")}</th>
              </tr>
            </thead>
            <tbody>
              {byTenant.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-slate-500">{t("superadmin.leakMonitor.noActivityYet")}</td></tr>
              ) : byTenant.map((org) => (
                <tr key={org.orgId} className="border-b border-slate-800/50">
                  <td className="py-2 pr-4 text-slate-300 truncate max-w-[12rem]">{org.name || org.orgId.slice(0, 8)}</td>
                  <td className="py-2 pr-4 text-slate-400 font-mono">{formatNumber(org.trackedDocs)}</td>
                  <td className="py-2 pr-4 text-slate-400 font-mono">{formatNumber(org.scans)}</td>
                  <td className="py-2 pr-4 font-mono"><span className={org.leaks > 0 ? "text-red-400" : "text-slate-400"}>{formatNumber(org.leaks)}</span></td>
                  <td className="py-2 text-slate-500">{org.lastScanAt ? formatDate(org.lastScanAt) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={t("superadmin.leakMonitor.recentScansTitle")} icon={<Activity className="w-4 h-4 text-cyan-400" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-4 font-medium">{t("superadmin.field.tenant")}</th>
                <th className="py-2 pr-4 font-medium">{t("common.type")}</th>
                <th className="py-2 pr-4 font-medium">{t("common.status")}</th>
                <th className="py-2 pr-4 font-medium">Query</th>
                <th className="py-2 pr-4 font-medium">{t("superadmin.leakMonitor.colLeaked")}</th>
                <th className="py-2 font-medium">{t("superadmin.field.time")}</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">{t("superadmin.leakMonitor.noScansYet")}</td></tr>
              ) : recent.map((s) => (
                <tr key={s.id} className="border-b border-slate-800/50">
                  <td className="py-2 pr-4 text-slate-300 truncate max-w-[10rem]">{s.orgName || "-"}</td>
                  <td className="py-2 pr-4 text-slate-400">{s.scanType}</td>
                  <td className={`py-2 pr-4 font-medium ${SCAN_STATUS_STYLE[s.status] || "text-slate-500"}`}>{s.status}</td>
                  <td className="py-2 pr-4 text-slate-400 font-mono">{formatNumber(s.queries)}</td>
                  <td className="py-2 pr-4 font-mono"><span className={s.leaksFound > 0 ? "text-red-400" : "text-slate-400"}>{formatNumber(s.leaksFound)}</span></td>
                  <td className="py-2 text-slate-500 whitespace-nowrap">{(s.completedAt || s.startedAt) ? new Date(s.completedAt || s.startedAt).toLocaleString("id-ID") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function DatabaseTab() {
  const { t } = useLang();
  const [overview, setOverview] = useState(null);
  const [tables, setTables] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backingUp, setBackingUp] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [ov, tb, bk] = await Promise.all([
        superadminService.getDatabaseOverview(),
        superadminService.getDatabaseTables(),
        superadminService.getDatabaseBackups(),
      ]);
      setOverview(ov);
      setTables(tb?.tables || []);
      setBackups(bk?.backups || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("superadmin.database.loadError"));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const backupNow = async () => {
    setBackingUp(true); setNotice(null);
    try {
      const r = await superadminService.backupDatabase();
      setNotice({ kind: "ok", text: `${t("superadmin.database.backupDonePrefix")} ${r.file} (${r.size})` });
      const bk = await superadminService.getDatabaseBackups();
      setBackups(bk?.backups || []);
    } catch (err) {
      setNotice({ kind: "bad", text: err.response?.data?.message || err.message || t("superadmin.database.backupError") });
    } finally { setBackingUp(false); }
  };

  if (loading) return <StateBlock icon={<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />} title={t("superadmin.database.loading")} />;
  if (error) return (
    <StateBlock icon={<AlertTriangle className="w-6 h-6 text-red-400" />} title={t("superadmin.state.failedToLoad")} message={error}
      action={<button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">{t("common.retry")}</button>} />
  );

  const cards = [
    { label: t("superadmin.database.cardName"), value: overview?.database },
    { label: t("superadmin.database.cardSize"), value: overview?.sizePretty },
    { label: t("superadmin.database.cardTables"), value: formatNumber(overview?.tableCount || 0) },
    { label: t("superadmin.database.cardConnections"), value: formatNumber(overview?.connections || 0) },
  ];

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
          notice.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300" : "bg-red-500/10 border-red-500/25 text-red-300"
        }`}>
          {notice.kind === "ok" ? <Check className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}{notice.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] font-mono text-[color:var(--crt-fg-faint)] truncate min-w-0">{overview?.version}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={backupNow} disabled={backingUp}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {t("superadmin.database.backupNow")}
          </button>
          <button onClick={load} title={t("common.refresh")}
            className="p-2.5 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="border border-[color:var(--crt-border)] p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--crt-fg-faint)]">{c.label}</p>
            <p className="text-lg font-mono text-[color:var(--crt-accent)] mt-1 truncate">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="border border-[color:var(--crt-border)]">
        <div className="px-4 py-2.5 border-b border-[color:var(--crt-border)] flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-[color:var(--crt-fg-dim)]">{t("superadmin.database.tablesTitle")}</span>
          <span className="text-[11px] font-mono text-[color:var(--crt-fg-faint)]">{formatNumber(tables.length)} {t("superadmin.database.tablesUnit")}</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm font-mono">
            <thead className="text-[10px] uppercase text-[color:var(--crt-fg-faint)] sticky top-0 bg-slate-900">
              <tr>
                <th className="text-left px-4 py-2 font-normal">{t("superadmin.database.colTable")}</th>
                <th className="text-right px-4 py-2 font-normal">{t("superadmin.database.colRows")}</th>
                <th className="text-right px-4 py-2 font-normal">{t("superadmin.database.colSize")}</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((tb) => (
                <tr key={tb.name} className="border-t border-[color:var(--crt-border)]">
                  <td className="px-4 py-1.5 text-[color:var(--crt-fg)]">{tb.name}</td>
                  <td className="px-4 py-1.5 text-right text-[color:var(--crt-fg-dim)]">{formatNumber(tb.rows)}</td>
                  <td className="px-4 py-1.5 text-right text-[color:var(--crt-fg-dim)]">{tb.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-[color:var(--crt-border)]">
        <div className="px-4 py-2.5 border-b border-[color:var(--crt-border)]">
          <span className="text-xs font-mono uppercase tracking-wider text-[color:var(--crt-fg-dim)]">{t("superadmin.database.backupsTitle")}</span>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-[color:var(--crt-border)]">
          {backups.length === 0 && <p className="px-4 py-3 text-xs font-mono text-[color:var(--crt-fg-faint)]">{t("superadmin.database.noBackups")}</p>}
          {backups.map((b) => (
            <div key={b.file} className="px-4 py-2 flex items-center justify-between gap-3 font-mono text-[11px]">
              <span className="text-[color:var(--crt-fg)] truncate min-w-0">{b.file}</span>
              <span className="text-[color:var(--crt-fg-faint)] shrink-0">{(b.size / 1024).toFixed(0)}KB · {new Date(b.mtime).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onLock, theme, onToggleTheme }) {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState("overview");

  const navItems = [
    { id: "overview", label: t("superadmin.dashboard.navOverview"), icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: "tenants", label: t("superadmin.dashboard.navTenants"), icon: <Building2 className="w-5 h-5" /> },
    { id: "security", label: t("superadmin.dashboard.navSecurity"), icon: <ShieldAlert className="w-5 h-5" /> },
    { id: "audit", label: t("superadmin.dashboard.navAuditIntegrity"), icon: <ShieldCheck className="w-5 h-5" /> },
    { id: "blockchain", label: t("superadmin.dashboard.navBlockchain"), icon: <Anchor className="w-5 h-5" /> },
    { id: "leaks", label: t("superadmin.dashboard.navLeakMonitor"), icon: <AlertTriangle className="w-5 h-5" /> },
    { id: "activity", label: t("superadmin.dashboard.navAdminActivity"), icon: <Activity className="w-5 h-5" /> },
    { id: "database", label: t("superadmin.dashboard.navDatabase"), icon: <Database className="w-5 h-5" /> },
    // web-ssh disabled
    // { id: "console", label: t("superadmin.dashboard.navSshConsole"), icon: <Fingerprint className="w-5 h-5" /> },
  ];

  const TAB_TITLES = {
    overview: { title: t("superadmin.dashboard.overviewTitle"), sub: t("superadmin.dashboard.overviewSub") },
    tenants: { title: t("superadmin.dashboard.tenantsTitle"), sub: t("superadmin.dashboard.tenantsSub") },
    security: { title: t("superadmin.dashboard.securityTitle"), sub: t("superadmin.dashboard.securitySub") },
    audit: { title: t("superadmin.dashboard.auditTitle"), sub: t("superadmin.dashboard.auditSub") },
    blockchain: { title: t("superadmin.dashboard.blockchainTitle"), sub: t("superadmin.dashboard.blockchainSub") },
    leaks: { title: t("superadmin.dashboard.leaksTitle"), sub: t("superadmin.dashboard.leaksSub") },
    console: { title: t("superadmin.dashboard.consoleTitle"), sub: t("superadmin.dashboard.consoleSub") },
    activity: { title: t("superadmin.dashboard.activityTitle"), sub: t("superadmin.dashboard.activitySub") },
    database: { title: t("superadmin.dashboard.databaseTitle"), sub: t("superadmin.dashboard.databaseSub") },
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900/90 backdrop-blur-2xl border-r border-cyan-500/10 flex flex-col z-40">
        <div className="absolute inset-0 bg-linear-to-b from-cyan-500/2 to-transparent pointer-events-none" />

        <div className="p-5 border-b border-[color:var(--crt-border)]">
          <h1 className="crt-pixel text-[color:var(--crt-accent)] crt-glow text-sm mb-1">DOCLOQ</h1>
          <p className="text-[11px] font-mono text-[color:var(--crt-fg-dim)]">root@docloq:~$ superadmin</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 font-mono text-sm">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 transition-colors duration-150 ${
                  active
                    ? "bg-[color:var(--crt-accent)] text-[color:var(--crt-on-accent)]"
                    : "text-[color:var(--crt-fg-dim)] hover:bg-[color:var(--crt-accent-soft)] hover:text-[color:var(--crt-accent)]"
                }`}
              >
                <span className={active ? "text-[color:var(--crt-on-accent)]" : "text-[color:var(--crt-accent)]"}>{active ? ">" : " "}</span>
                <span className="[&_svg]:w-4 [&_svg]:h-4">{item.icon}</span>
                <span className="lowercase tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[color:var(--crt-border)] space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-mono text-[color:var(--crt-fg-faint)] uppercase tracking-wider">{t("superadmin.dashboard.themeLabel")}</span>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
          <button
            onClick={onLock}
            className="w-full flex items-center gap-2 px-3 py-2 font-mono text-sm text-[color:var(--crt-fg-dim)] hover:text-[color:var(--crt-crit)] hover:bg-[color:var(--crt-crit-soft)] transition-colors"
          >
            <Lock className="w-4 h-4" />
            <span>{t("superadmin.dashboard.exitLockLabel")}</span>
          </button>
        </div>
      </aside>

      <main className="ml-64 p-8 relative z-10">
        <div className="mb-8 font-mono">
          <p className="text-sm text-[color:var(--crt-fg-dim)] mb-2">
            <span className="text-[color:var(--crt-accent)]">root@docloq</span>:<span className="text-[color:var(--crt-fg)]">~/kicawkicaw</span># cat {activeTab}
          </p>
          <h1 className="text-2xl sm:text-3xl mb-2">
            <Typewriter key={activeTab} text={TAB_TITLES[activeTab]?.title || ""} speed={22} cursor />
          </h1>
          <p className="text-[color:var(--crt-fg-dim)] text-sm">{TAB_TITLES[activeTab]?.sub}</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "tenants" && <TenantsTab />}
            {activeTab === "security" && <SecurityTab />}
            {activeTab === "audit" && <AuditTab />}
            {activeTab === "blockchain" && <BlockchainTab />}
            {activeTab === "leaks" && <LeakMonitorTab />}
            {activeTab === "console" && <ConsoleTab />}
            {activeTab === "activity" && <AdminActivityTab />}
            {activeTab === "database" && <DatabaseTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [unlocked, setUnlocked] = useState(() => getGate() === GATE_PASSWORD);
  const [theme, toggleTheme] = useCrtTheme();
  const [booting, setBooting] = useState(false);

  const doUnlock = () => {
    let already = true;
    try { already = sessionStorage.getItem(BOOT_SESSION_KEY) === "1"; } catch {}
    if (!already) setBooting(true);
    setUnlocked(true);
  };
  const finishBoot = () => {
    try { sessionStorage.setItem(BOOT_SESSION_KEY, "1"); } catch {}
    setBooting(false);
  };

  const themeClass = theme === "amber" ? "" : `theme-${theme}`;
  return (
    <div className={`crt ${themeClass} min-h-dvh`}>
      <CrtScanlines />
      {booting && <BootSequence onDone={finishBoot} />}
      {!unlocked ? (
        <Gate onUnlock={doUnlock} theme={theme} onToggleTheme={toggleTheme} />
      ) : (
        <Dashboard
          theme={theme}
          onToggleTheme={toggleTheme}
          onLock={() => {
            clearGate();
            setUnlocked(false);
          }}
        />
      )}
    </div>
  );
}
