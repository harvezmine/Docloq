import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import verificationService from "@/services/verification.service";
import { useAuthStore } from "@/app/store/auth.store";
import useQrScanner from "./useQrScanner.js";
import { isPhone } from "./qrScan.util.js";
import { useLang } from "@/app/providers/LanguageProvider";

const IconQR = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
  </svg>
);
const IconUpload = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);
const IconCheck = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
const IconShield = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const IconX = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconWarning = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);
const IconBolt = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const IconArrowLeft = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const IconArrowRight = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const IconInfo = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconFile = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);
const IconClock = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconUser = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const IconHashtag = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
  </svg>
);
const IconRefresh = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const IconEye = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const IconChevronLeft = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const IconChevronRight = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const Spinner = ({ className = "w-5 h-5" }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

function Stepper({ current, total = 3 }) {
  const { t } = useLang();
  const labels = [t("verify.stepMethod"), t("verify.stepInput"), t("verify.stepResult")];
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-10">
      {Array.from({ length: total }, (_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all duration-300 ${
                  done
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                    : active
                    ? "bg-accent-gradient-br text-white shadow-lg shadow-accent ring-4 ring-indigo-500/15"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                }`}
              >
                {done ? <IconCheck className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`hidden sm:inline text-sm font-medium transition-colors ${
                  active
                    ? "text-slate-900 dark:text-white"
                    : done
                    ? "text-slate-600 dark:text-slate-300"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {labels[i]}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className={`h-0.5 w-6 sm:w-10 rounded-full transition-colors duration-300 ${
                  done ? "bg-emerald-400 dark:bg-emerald-500/50" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

const shortHash = (s) => (!s ? "-" : s.length <= 18 ? s : `${s.slice(0, 10)}…${s.slice(-6)}`);

// Shows one plain-language assurance line by default; technical proof (tx hash, block, etc.) is behind "View details".
function BlockchainTrust({ result }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const state = result.chainState;

  // Don't show the block at all if the document was never anchored.
  if (!result.blockchainTxHash && state === "not_anchored") return null;

  const config = {
    chain_verified: {
      ring: "border-emerald-200 dark:border-emerald-500/25", bg: "bg-emerald-50 dark:bg-emerald-500/10",
      iconBg: "bg-emerald-100 dark:bg-emerald-500/15", iconColor: "text-emerald-600 dark:text-emerald-400",
      title: "text-emerald-800 dark:text-emerald-300", icon: <IconShield className="w-5 h-5" />,
      heading: t("verify.chainVerifiedHeading"), sub: t("verify.chainVerifiedSub"),
    },
    mismatch: {
      ring: "border-red-200 dark:border-red-500/25", bg: "bg-red-50 dark:bg-red-500/10",
      iconBg: "bg-red-100 dark:bg-red-500/15", iconColor: "text-red-600 dark:text-red-400",
      title: "text-red-800 dark:text-red-300", icon: <IconWarning className="w-5 h-5" />,
      heading: t("verify.mismatchHeading"), sub: t("verify.mismatchSub"),
    },
    db_only: {
      ring: "border-amber-200 dark:border-amber-500/25", bg: "bg-amber-50 dark:bg-amber-500/10",
      iconBg: "bg-amber-100 dark:bg-amber-500/15", iconColor: "text-amber-600 dark:text-amber-400",
      title: "text-amber-800 dark:text-amber-300", icon: <IconClock className="w-5 h-5" />,
      heading: t("verify.dbOnlyHeading"), sub: t("verify.dbOnlySub"),
    },
  };
  const c = config[state] || config.db_only;

  const copyTx = async () => {
    try { await navigator.clipboard.writeText(result.blockchainTxHash || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className={`rounded-2xl border ${c.ring} overflow-hidden`}>
      <div className={`flex items-center gap-3 p-4 ${c.bg}`}>
        <div className={`w-11 h-11 rounded-xl ${c.iconBg} ${c.iconColor} flex items-center justify-center flex-shrink-0`}>{c.icon}</div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${c.title}`}>{c.heading}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.sub}</p>
        </div>
      </div>

      {result.blockchainTxHash && (
        <div className="bg-white dark:bg-slate-900">
          <button onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors border-t border-slate-100 dark:border-slate-800">
            <span>{open ? t("verify.hideDetails") : t("verify.viewDetails")}</span>
            <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-4 pb-4 pt-1 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t("verify.networkLabel")}</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{result.blockchainNetwork || "-"}</span>
                  </div>
                  {result.blockNumber != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t("verify.blockLabel")}</span>
                      <span className="text-xs font-mono text-slate-700 dark:text-slate-300 tabular-nums">#{Number(result.blockNumber).toLocaleString()}</span>
                    </div>
                  )}
                  {result.anchoredAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t("verify.recordedLabel")}</span>
                      <span className="text-xs text-slate-700 dark:text-slate-300">{formatDate(result.anchoredAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">{t("verify.txHashLabel")}</span>
                    <button onClick={copyTx} className="flex items-center gap-1 min-w-0 font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline" title={t("verify.copyTitle")}>
                      {copied ? (
                        <>
                          <IconCheck className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t("verify.copied")}</span>
                        </>
                      ) : (
                        <span className="truncate">{shortHash(result.blockchainTxHash)}</span>
                      )}
                    </button>
                  </div>
                  {result.blockchainExplorerUrl && (
                    <a href={result.blockchainExplorerUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline pt-1">
                      {t("verify.viewOnExplorer")}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

const toTrustProps = (b) => ({
  chainState: b?.state || (b ? "db_only" : "not_anchored"),
  blockchainNetwork: b?.network || null,
  blockchainTxHash: b?.txHash || null,
  blockchainExplorerUrl: b?.explorerUrl || null,
  blockNumber: b?.blockNumber ?? null,
  onChainHash: b?.onChainHash || null,
  anchoredAt: b?.anchoredAt || null,
});

function SectionTitle({ icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-slate-400">{icon}</span>
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{children}</h3>
    </div>
  );
}

function Fact({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/40">
      <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/50 flex items-center justify-center text-slate-400 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
}

// Maps QR/file backend statuses to a { tone, title, sub } verdict.
function normalizeVerdict(r, t) {
  const s = r.status;
  if (s === "verified_exact" || s === "verified_fuzzy" || s === "VALID") {
    return {
      tone: "green",
      title: t("verify.verifiedTitle"),
      sub: s === "verified_exact"
        ? t("verify.verifiedExactSub")
        : s === "verified_fuzzy"
        ? t("verify.verifiedFuzzySub")
        : t("verify.verifiedValidSub"),
    };
  }
  if (s === "partial" || s === "SUPERSEDED") {
    return {
      tone: "amber",
      title: s === "SUPERSEDED" ? t("verify.supersededTitle") : t("verify.partialTitle"),
      sub: s === "SUPERSEDED"
        ? (r.message || t("verify.supersededSub"))
        : `${t("verify.partialSubPrefix")}${r.similarity ?? 0}${t("verify.partialSubSuffix")}`,
    };
  }
  if (s === "not_found") {
    return { tone: "red", title: t("verify.notFoundTitle"), sub: r.message || t("verify.notFoundSub") };
  }
  return {
    tone: "red",
    title: s === "REVOKED" ? t("verify.revokedTitle") : s === "PURGED" ? t("verify.removedTitle") : s === "TAMPERED" || s === "UNSIGNED" ? t("verify.invalidQrTitle") : t("verify.notVerifiedTitle"),
    sub: r.message || t("verify.couldNotVerifySub"),
  };
}

const toneStyles = {
  green: {
    heroBg: "bg-gradient-to-b from-emerald-50 via-emerald-50/40 to-transparent dark:from-emerald-500/10 dark:via-emerald-500/[0.04] dark:to-transparent",
    glow: "bg-emerald-400/20 dark:bg-emerald-500/15",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/40",
    titleText: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
    icon: <IconShield className="w-9 h-9 text-white" />,
  },
  amber: {
    heroBg: "bg-gradient-to-b from-amber-50 via-amber-50/40 to-transparent dark:from-amber-500/10 dark:via-amber-500/[0.04] dark:to-transparent",
    glow: "bg-amber-400/20 dark:bg-amber-500/15",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/40",
    titleText: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/20",
    icon: <IconWarning className="w-9 h-9 text-white" />,
  },
  red: {
    heroBg: "bg-gradient-to-b from-red-50 via-red-50/40 to-transparent dark:from-red-500/10 dark:via-red-500/[0.04] dark:to-transparent",
    glow: "bg-red-400/20 dark:bg-red-500/15",
    iconBg: "bg-gradient-to-br from-red-500 to-rose-500 shadow-red-500/40",
    titleText: "text-red-700 dark:text-red-400",
    badge: "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 ring-red-500/20",
    icon: <IconX className="w-9 h-9 text-white" />,
  },
};

const CAMERA_FAIL_KEYS = {
  denied: ["verify.camDeniedT", "verify.camDeniedS"],
  inapp: ["verify.camInappT", "verify.camInappS"],
  insecure: ["verify.camInsecureT", "verify.camInsecureS"],
  nocamera: ["verify.camNocameraT", "verify.camNocameraS"],
  unsupported: ["verify.camUnsupportedT", "verify.camUnsupportedS"],
  error: ["verify.camErrorT", "verify.camErrorS"],
};

// Auto-detects the QR code; no capture button (phone only).
function CameraScanner({ scanner, isVerifying, onUseUpload, onStart }) {
  const { t } = useLang();
  const { videoRef, status, phase, error, torchSupported, torchOn, toggleTorch } = scanner;
  const reduce = useReducedMotion();

  const failed = status in CAMERA_FAIL_KEYS;
  const starting = status === "requesting" || status === "preparing";
  const failCopy = failed ? { t: t(CAMERA_FAIL_KEYS[status][0]), s: t(CAMERA_FAIL_KEYS[status][1]) } : null;
  // Camera isn't opened until tapped, browsers require a real user gesture to show the permission prompt.
  const idle = status === "idle";

  const bracketColor =
    phase === "locked" ? "border-emerald-400"
      : phase === "sighted" ? "border-amber-400"
        : "border-white/80";

  const corners = [
    "top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
    "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
    "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
    "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
  ];

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-sm aspect-square rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${failed || starting || idle ? "opacity-0" : "opacity-100"}`}
        />

        {/* BIG tap target, getUserMedia must fire from a real click for the permission prompt to show */}
        {idle && (
          <button
            type="button"
            onClick={onStart}
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6 active:bg-slate-900/60 transition-colors"
          >
            <span className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <IconQR className="w-8 h-8 text-indigo-400" />
            </span>
            <span className="text-sm font-semibold text-white">{t("verify.openCamera")}</span>
            <span className="text-xs text-slate-400 max-w-[15rem]">
              {t("verify.tapToActivate")}
            </span>
          </button>
        )}

        {!failed && !starting && !idle && (
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-slate-950/35" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-3/5 aspect-square">
                {corners.map((c, i) => (
                  <div key={i} className={`absolute w-8 h-8 ${c} ${bracketColor} transition-colors duration-200`} />
                ))}
                {!reduce && phase !== "locked" && (
                  <motion.div
                    initial={{ top: "8%" }}
                    animate={{ top: ["8%", "92%", "8%"] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-2 right-2 h-0.5 rounded-full bg-indigo-400/90 shadow-[0_0_8px_2px_rgba(99,102,241,0.55)]"
                  />
                )}
                {phase === "locked" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                      <IconCheck className="w-8 h-8 text-white" />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )}

        {starting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300">
            <Spinner className="w-6 h-6" />
            <p className="text-xs">{status === "preparing" ? t("verify.preparingScanner") : t("verify.startingCamera")}</p>
          </div>
        )}

        {failed && failCopy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center mb-1">
              <IconWarning className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-sm font-semibold text-white">{failCopy.t}</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[16rem]">{status === "error" && error ? error : failCopy.s}</p>
            {status !== "unsupported" && status !== "insecure" && (
              <button
                type="button"
                onClick={onStart}
                className="mt-2 px-4 py-2 rounded-xl bg-accent-gradient hover:brightness-110 text-white text-xs font-semibold transition-colors"
              >
                {t("verify.tryOpenCameraAgain")}
              </button>
            )}
          </div>
        )}

        {/* Torch (Android only) */}
        {status === "scanning" && torchSupported && (
          <button
            onClick={toggleTorch}
            aria-label={t("verify.toggleFlashlight")}
            className="absolute top-3 right-3 w-11 h-11 rounded-full bg-slate-900/70 backdrop-blur flex items-center justify-center active:scale-95 transition-transform"
          >
            <IconBolt className={`w-5 h-5 ${torchOn ? "text-amber-300" : "text-white"}`} />
          </button>
        )}
      </div>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400 min-h-[1.25rem]">
        {isVerifying
          ? t("verify.verifyingEllipsis")
          : idle
            ? t("verify.tapBoxToOpen")
            : status === "scanning"
              ? phase === "sighted"
                ? t("verify.holdSteady")
                : t("verify.pointCamera")
              : ""}
      </p>

      <button
        onClick={onUseUpload}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <IconUpload className="w-4 h-4" /> {t("verify.uploadQrInstead")}
      </button>
    </div>
  );
}

export default function Verification({ public: isPublic = false }) {
  const { t } = useLang();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fileMethodAvailable = !isPublic && isAuthenticated;

  const [step, setStep] = useState(0);
  const [method, setMethod] = useState(null); // 'qr' | 'file'
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const [phoneCanScan] = useState(() => isPhone());
  const [qrMode, setQrMode] = useState(() => (isPhone() ? "camera" : "image")); // 'camera' | 'image'

  // On-demand blockchain integrity (file path).
  const [integrity, setIntegrity] = useState(null);
  const [checkingChain, setCheckingChain] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const previewUrlRef = useRef(null); // tracks the live object URL for safe revocation

  const fileInputRef = useRef(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const loadPreviewPage = useCallback(async (documentId, page) => {
    if (!documentId) return;
    setPreviewLoading(true);
    setPreviewError(false);
    try {
      const { blobUrl, totalPages } = await verificationService.getVerifyPreview(documentId, page);
      revokePreview();
      previewUrlRef.current = blobUrl;
      setPreviewUrl(blobUrl);
      setPreviewTotalPages(totalPages);
      setPreviewPage(page);
    } catch {
      // 415 (or any failure) → no renderable preview for this file type.
      revokePreview();
      setPreviewUrl(null);
      setPreviewError(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [revokePreview]);

  const resetPreview = useCallback(() => {
    revokePreview();
    setShowPreview(false);
    setPreviewUrl(null);
    setPreviewPage(1);
    setPreviewTotalPages(1);
    setPreviewLoading(false);
    setPreviewError(false);
  }, [revokePreview]);

  useEffect(() => () => revokePreview(), [revokePreview]);

  const togglePreview = () => {
    if (showPreview) {
      resetPreview();
    } else {
      setShowPreview(true);
      loadPreviewPage(verificationResult?.documentId, 1);
    }
  };

  const goToPage = (page) => {
    if (page < 1 || page > previewTotalPages || page === previewPage || previewLoading) return;
    loadPreviewPage(verificationResult?.documentId, page);
  };

  // QR deep-link: /verify?code=XXXX → auto-run shortcode lookup (public page).
  useEffect(() => {
    if (!isPublic) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    let cancelled = false;
    (async () => {
      setMethod("qr");
      setIsVerifying(true);
      setStep(1);
      try {
        const res = await verificationService.verifyByShortCode(code);
        if (!cancelled) {
          setVerificationResult(buildQrResult(res?.data));
          setStep(2);
        }
      } catch (err) {
        if (!cancelled) {
          const data = err?.response?.data;
          setVerificationResult(buildQrResult(data?.data) || { method: "qr", status: "not_found", message: data?.message });
          setStep(2);
        }
      } finally {
        if (!cancelled) setIsVerifying(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isPublic]);

  // QR data shape: { status, verified, message, signatureValid,
  //   document: {id, filename, uploader, createdAt, blockchain}, blockchain, currentVersionNumber }
  function buildQrResult(data) {
    if (!data) return null;
    const doc = data.document;
    const blockchain = doc?.blockchain || data.blockchain || null;
    return {
      method: "qr",
      status: data.status || (data.verified ? "VALID" : "not_found"),
      message: data.message,
      signatureValid: data.signatureValid ?? null,
      documentId: doc?.id || null,
      document: doc?.filename || null,
      uploadedBy: doc?.uploader?.name || "-",
      uploadDate: formatDate(doc?.createdAt),
      version: data.currentVersionNumber ?? null,
      blockchain, // QR path: chain auto-resolved
      anchored: !!blockchain && blockchain.state !== "not_anchored",
    };
  }

  // File data shape: { verified, status, similarity, exactMatch,
  //   document: {id, filename, uploader, createdAt, version, anchored} }
  function buildFileResult(data) {
    if (!data) return null;
    const doc = data.document;
    return {
      method: "file",
      status: data.status || (data.verified ? "verified_fuzzy" : "not_found"),
      message: data.message,
      similarity: data.similarity ?? (data.verified ? 100 : 0),
      exactMatch: !!data.exactMatch,
      documentId: doc?.id || null,
      document: doc?.filename || null,
      uploadedBy: doc?.uploader?.name || "-",
      uploadDate: formatDate(doc?.createdAt),
      version: doc?.version ?? null,
      anchored: !!doc?.anchored,
      blockchain: null, // file path: resolved on demand via the button
    };
  }

  const extractApiError = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

  const handleSelectMethod = (m) => {
    setMethod(m);
    setStep(1);
    setVerificationResult(null);
    setUploadedFile(null);
    setErrorMessage(null);
  };

  const handleBack = () => {
    if (step === 1) {
      setStep(0);
      setMethod(null);
      setUploadedFile(null);
      setErrorMessage(null);
    } else if (step === 2) {
      setStep(1);
      setVerificationResult(null);
      setIntegrity(null);
      resetPreview();
      setErrorMessage(null);
    }
  };

  const handleReset = () => {
    setStep(0);
    setMethod(null);
    setVerificationResult(null);
    setUploadedFile(null);
    setErrorMessage(null);
    setIntegrity(null);
    setCheckingChain(false);
    resetPreview();
  };

  // Used by both QR-image and document upload
  const handleFileSelect = useCallback((file) => {
    if (file) {
      setUploadedFile(file);
      setErrorMessage(null);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleVerify = async () => {
    if (!uploadedFile) {
      setErrorMessage(t("verify.errSelectFile"));
      return;
    }
    setErrorMessage(null);
    setIsVerifying(true);
    setIntegrity(null);
    try {
      if (method === "qr") {
        const res = await verificationService.verifyByQrImage(uploadedFile);
        setVerificationResult(buildQrResult(res?.data));
      } else {
        const res = await verificationService.verifyByFile(uploadedFile);
        setVerificationResult(buildFileResult(res?.data));
      }
      setStep(2);
    } catch (err) {
      const data = err?.response?.data;
      const built = method === "qr" ? buildQrResult(data?.data) : buildFileResult(data?.data);
      if (built) {
        setVerificationResult(built);
        setStep(2);
      } else if (err?.response?.status === 404 || err?.response?.status === 422) {
        setVerificationResult({ method, status: "not_found", message: data?.message });
        setStep(2);
      } else {
        setErrorMessage(extractApiError(err, t("verify.errVerifyFailed")));
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Same verdict path as the public ?code= deep-link
  const handleScanDetect = async (code) => {
    setErrorMessage(null);
    setIsVerifying(true);
    setIntegrity(null);
    try {
      const res = await verificationService.verifyByShortCode(code);
      setVerificationResult(buildQrResult(res?.data));
      setStep(2);
    } catch (err) {
      const data = err?.response?.data;
      setVerificationResult(buildQrResult(data?.data) || { method: "qr", status: "not_found", message: data?.message });
      setStep(2);
    } finally {
      setIsVerifying(false);
    }
  };

  const scanner = useQrScanner(handleScanDetect);
  const { start: startScan, stop: stopScan } = scanner;

  // Runs the camera only on the QR scan screen; `!isVerifying` also keeps it off during
  // the public ?code= deep-link auto-verify (a code is already in hand, no need to flash the camera).
  useEffect(() => {
    // Never auto-start: getUserMedia needs a real user gesture or iOS Safari silently
    // suppresses the permission prompt. The user taps the viewfinder to call startScan().
    const active = step === 1 && method === "qr" && qrMode === "camera" && phoneCanScan && !isVerifying;
    if (!active) stopScan();
    return () => stopScan();
  }, [step, method, qrMode, phoneCanScan, isVerifying, stopScan]);

  // On-demand blockchain integrity check (file path only).
  const checkIntegrity = async () => {
    if (!verificationResult?.documentId) return;
    setCheckingChain(true);
    try {
      const res = await verificationService.getBlockchainIntegrity(verificationResult.documentId);
      setIntegrity(res?.data || { state: "not_anchored" });
    } catch {
      setIntegrity({ state: "not_anchored" });
    } finally {
      setCheckingChain(false);
    }
  };

  const acceptForMethod = method === "qr"
    ? "image/png,image/jpeg,image/jpg"
    : ".pdf,.doc,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

  const verdict = verificationResult ? normalizeVerdict(verificationResult, t) : null;
  const tone = verdict ? toneStyles[verdict.tone] : null;
  const hasDoc = verificationResult?.document && verificationResult?.documentId;

  const body = (
    <div className="max-w-3xl mx-auto w-full">
      {!isPublic && (
        <PageHeader
          className="mb-8"
          eyebrow={t("verify.headerEyebrow")}
          title={t("verify.headerTitle")}
          subtitle={
            <>
              {step === 0 && t("verify.subStep0")}
              {step === 1 && method === "qr" && (qrMode === "camera" && phoneCanScan ? t("verify.subStep1QrCamera") : t("verify.subStep1QrImage"))}
              {step === 1 && method === "file" && t("verify.subStep1File")}
              {step === 2 && t("verify.subStep2")}
            </>
          }
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
          onBack={step > 0 ? handleBack : undefined}
        />
      )}

      {isPublic && step > 0 && (
        <button onClick={handleBack} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          <IconArrowLeft className="w-4 h-4" /> {t("verify.back")}
        </button>
      )}

      <Stepper current={step} />

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.3, ease: "easeOut" }}>
            <div className="text-center mb-7">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("verify.howVerify")}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("verify.chooseMethod")}</p>
            </div>

            <div className={`grid grid-cols-1 gap-5 ${fileMethodAvailable ? "sm:grid-cols-2" : ""}`}>
              <motion.button whileHover={{ y: -5 }} whileTap={{ scale: 0.98 }} onClick={() => handleSelectMethod("qr")}
                className="group relative overflow-hidden p-7 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left transition-all duration-200 hover:shadow-xl hover:shadow-accent hover:border-indigo-300 dark:hover:border-indigo-500/40"
              >
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-2xl transition-opacity opacity-0 group-hover:opacity-100" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-accent-gradient-br flex items-center justify-center shadow-lg shadow-accent">
                      <IconQR className="w-7 h-7 text-white" />
                    </div>
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <IconArrowRight />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1.5">{t("verify.scanQr")}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                    {phoneCanScan
                      ? t("verify.scanQrDescPhone")
                      : t("verify.scanQrDescDesktop")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">{t("verify.badgeSignedQr")}</span>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">{t("verify.badgeBlockchainAutoCheck")}</span>
                  </div>
                </div>
              </motion.button>

              {fileMethodAvailable && (
                <motion.button whileHover={{ y: -5 }} whileTap={{ scale: 0.98 }} onClick={() => handleSelectMethod("file")}
                  className="group relative overflow-hidden p-7 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left transition-all duration-200 hover:shadow-xl hover:shadow-accent hover:border-violet-300 dark:hover:border-violet-500/40"
                >
                  <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-violet-500/5 dark:bg-violet-500/10 blur-2xl transition-opacity opacity-0 group-hover:opacity-100" />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-14 h-14 rounded-2xl bg-accent-gradient-br flex items-center justify-center shadow-lg shadow-accent">
                        <IconUpload className="w-7 h-7 text-white" />
                      </div>
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-violet-600 group-hover:text-white transition-all">
                        <IconArrowRight />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1.5">{t("verify.uploadFile")}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                      {t("verify.uploadFileDesc")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-[11px] font-medium text-violet-600 dark:text-violet-400">{t("verify.badgeExactFuzzy")}</span>
                      <span className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-[11px] font-medium text-violet-600 dark:text-violet-400">{t("verify.badgeSha256")}</span>
                    </div>
                  </div>
                </motion.button>
              )}
            </div>

            {!fileMethodAvailable && (
              <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 text-center">
                {t("verify.loginToVerifyFile")}
              </p>
            )}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="mt-7 flex gap-3.5 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-200/60 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0">
                <IconInfo className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </div>
              <div className="text-sm leading-relaxed">
                <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">{t("verify.whatVerifyConfirms")}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("verify.whatVerifyConfirmsDesc")}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.3, ease: "easeOut" }}>
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg ${method === "qr" ? "bg-accent-gradient-br shadow-accent" : "bg-accent-gradient-br shadow-accent"}`}>
                    {method === "qr" ? <IconQR className="w-5 h-5 text-white" /> : <IconUpload className="w-5 h-5 text-white" />}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">{method === "qr" ? t("verify.scanQr") : t("verify.uploadFile")}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {method === "qr"
                        ? (qrMode === "camera" && phoneCanScan ? t("verify.scanQrHeaderSubCamera") : t("verify.scanQrHeaderSubImage"))
                        : t("verify.uploadDigitalDoc")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-7 space-y-5">
                {method === "qr" && phoneCanScan && (
                  <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60">
                    {[["camera", t("verify.tabScan")], ["image", t("verify.tabUpload")]].map(([m, label]) => (
                      <button
                        key={m}
                        onClick={() => setQrMode(m)}
                        className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${qrMode === m ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {method === "qr" && qrMode === "camera" && phoneCanScan ? (
                  <CameraScanner scanner={scanner} isVerifying={isVerifying} onStart={startScan} onUseUpload={() => setQrMode("image")} />
                ) : (
                <>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? method === "qr"
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/5 scale-[1.01]"
                        : "border-violet-500 bg-violet-50 dark:bg-violet-500/5 scale-[1.01]"
                      : uploadedFile
                      ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5"
                      : "border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <input ref={fileInputRef} type="file" accept={acceptForMethod} onChange={(e) => handleFileSelect(e.target.files?.[0])} className="hidden" />

                  {uploadedFile ? (
                    <div>
                      <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                        <IconCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5 break-all px-4">{uploadedFile.name}</p>
                      <p className="text-xs text-slate-400 mb-3">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                      >
                        {t("verify.removeChooseAnother")}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${method === "qr" ? "bg-indigo-100 dark:bg-indigo-500/15" : "bg-violet-100 dark:bg-violet-500/15"}`}>
                        {method === "qr" ? <IconQR className="w-8 h-8 text-indigo-600 dark:text-indigo-400" /> : <IconUpload className="w-8 h-8 text-violet-600 dark:text-violet-400" />}
                      </div>
                      <p className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                        {method === "qr" ? t("verify.dragDropQr") : t("verify.dragDropDoc")}
                      </p>
                      <p className="text-xs text-slate-400 mb-5">
                        {method === "qr" ? t("verify.qrImageHint") : t("verify.docTypesHint")}
                      </p>
                      <span className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        {t("verify.browseFiles")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50">
                  <IconInfo className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {method === "qr" ? (
                      <><span className="font-medium text-slate-600 dark:text-slate-300">{t("verify.qrInfoStrong")}</span> {t("verify.qrInfoRest")}</>
                    ) : (
                      <><span className="font-medium text-slate-600 dark:text-slate-300">{t("verify.fileInfoStrong")}</span> {t("verify.fileInfoRest")}</>
                    )}
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 text-sm text-red-700 dark:text-red-400">
                    {errorMessage}
                  </div>
                )}

                <button
                  onClick={handleVerify}
                  disabled={!uploadedFile || isVerifying}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-white text-sm font-semibold shadow-lg transition-all disabled:opacity-50 ${method === "qr" ? "bg-accent-gradient hover:brightness-110 disabled:hover:bg-indigo-600 shadow-accent" : "bg-accent-gradient hover:brightness-110 disabled:hover:bg-violet-600 shadow-accent"}`}
                >
                  {isVerifying ? <><Spinner className="w-4 h-4" /> {t("verify.verifyingBtn")}</> : <><IconShield className="w-4 h-4" /> {t("verify.verifyDocumentBtn")}</>}
                </button>
                </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && verificationResult && verdict && tone && (
          <motion.div key="step2" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.35, ease: "easeOut" }}>
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className={`relative px-6 pt-10 pb-8 text-center overflow-hidden ${tone.heroBg}`}>
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-56 h-56 rounded-full blur-3xl ${tone.glow}`} />
                <div className="relative">
                  <motion.div initial={{ scale: 0, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
                    <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5 shadow-xl ${tone.iconBg}`}>
                      {tone.icon}
                    </div>
                  </motion.div>
                  <h2 className={`text-2xl font-bold mb-2 ${tone.titleText}`}>{verdict.title}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{verdict.sub}</p>
                  <div className={`inline-flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full text-xs font-medium ring-1 ${tone.badge}`}>
                    {verificationResult.method === "qr" ? <IconQR className="w-3.5 h-3.5" /> : <IconUpload className="w-3.5 h-3.5" />}
                    {verificationResult.method === "qr" ? t("verify.verifiedByQr") : t("verify.verifiedByFile")}
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-7 space-y-7">
                {hasDoc ? (
                  <>
                    <div>
                      <SectionTitle icon={<IconFile className="w-4 h-4" />}>{t("verify.sectionIdentity")}</SectionTitle>
                      <div className={`grid grid-cols-1 gap-3 ${verificationResult.version != null ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
                        <Fact icon={<IconFile className="w-4 h-4" />} label={t("verify.factDocument")} value={verificationResult.document} />
                        <Fact icon={<IconUser className="w-4 h-4" />} label={t("verify.factIssuer")} value={verificationResult.uploadedBy} />
                        <Fact icon={<IconClock className="w-4 h-4" />} label={t("verify.factUploadDate")} value={verificationResult.uploadDate} />
                        {verificationResult.version != null && (
                          <Fact icon={<IconHashtag className="w-4 h-4" />} label={t("verify.factVersion")} value={`v${verificationResult.version}`} />
                        )}
                      </div>
                    </div>

                    <div>
                      <SectionTitle icon={<IconShield className="w-4 h-4" />}>{t("verify.sectionAuthenticity")}</SectionTitle>
                      {verificationResult.method === "qr" ? (
                        <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${verificationResult.signatureValid ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                            {verificationResult.signatureValid ? <IconCheck className="w-5 h-5" /> : <IconWarning className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {verificationResult.signatureValid ? t("verify.qrVerifiedIssued") : t("verify.qrCouldNotVerify")}
                            </p>
                            <p className="text-xs text-slate-400">
                              {verificationResult.signatureValid ? t("verify.qrVerifiedIssuedSub") : t("verify.qrForgedSub")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {verificationResult.exactMatch ? t("verify.exactMatch") : t("verify.contentSimilarity")}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {verificationResult.exactMatch
                                  ? t("verify.exactMatchSub")
                                  : verificationResult.similarity >= 95
                                  ? t("verify.veryCloseSub")
                                  : t("verify.partialSub")}
                              </p>
                            </div>
                            <div className={`text-3xl font-bold tabular-nums ${
                              verificationResult.similarity >= 95 ? "text-emerald-600 dark:text-emerald-400"
                              : verificationResult.similarity >= 78 ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                            }`}>
                              {verificationResult.similarity}%
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${verificationResult.similarity}%` }}
                              transition={{ duration: 1.2, ease: "easeOut" }}
                              className={`h-full rounded-full ${
                                verificationResult.similarity >= 95 ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                : verificationResult.similarity >= 78 ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                : "bg-gradient-to-r from-red-500 to-rose-500"
                              }`}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <SectionTitle icon={<IconShield className="w-4 h-4" />}>{t("verify.sectionIntegrity")}</SectionTitle>
                      {verificationResult.method === "qr" ? (
                        // QR path: chain auto-resolved by the verify call.
                        verificationResult.anchored ? (
                          <BlockchainTrust result={toTrustProps(verificationResult.blockchain)} />
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/40">
                            {t("verify.notAnchored")}
                          </p>
                        )
                      ) : (
                        // File path: on-demand check.
                        integrity ? (
                          integrity.state && integrity.state !== "not_anchored" ? (
                            <BlockchainTrust result={toTrustProps(integrity)} />
                          ) : (
                            <p className="text-xs text-slate-400 dark:text-slate-500 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/40">
                              {t("verify.notAnchored")}
                            </p>
                          )
                        ) : verificationResult.anchored ? (
                          <button
                            onClick={checkIntegrity}
                            disabled={checkingChain}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors disabled:opacity-50"
                          >
                            {checkingChain ? <><Spinner className="w-4 h-4" /> {t("verify.checkingBlockchain")}</> : <><IconShield className="w-4 h-4" /> {t("verify.checkBlockchainIntegrity")}</>}
                          </button>
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/40">
                            {t("verify.notAnchored")}
                          </p>
                        )
                      )}
                    </div>

                    <div>
                      <SectionTitle icon={<IconEye className="w-4 h-4" />}>{t("verify.sectionViewDocument")}</SectionTitle>
                      <button
                        onClick={togglePreview}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <IconEye className="w-4 h-4" />
                        {showPreview ? t("verify.hideDocument") : t("verify.viewDocument")}
                      </button>
                      <AnimatePresence initial={false}>
                        {showPreview && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                            <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 sm:p-4">
                              {!previewError && previewTotalPages > 1 && (
                                <div className="flex items-center justify-between mb-3">
                                  <button
                                    onClick={() => goToPage(previewPage - 1)}
                                    disabled={previewPage <= 1 || previewLoading}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <IconChevronLeft className="w-3.5 h-3.5" /> {t("verify.prev")}
                                  </button>
                                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                                    {t("verify.pageOf1")} {previewPage} {t("verify.pageOf2")} {previewTotalPages}
                                  </span>
                                  <button
                                    onClick={() => goToPage(previewPage + 1)}
                                    disabled={previewPage >= previewTotalPages || previewLoading}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {t("verify.next")} <IconChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              <div className="relative min-h-[220px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center">
                                {previewError ? (
                                  <div className="py-16 px-6 text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                      <IconFile className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm text-slate-400">{t("verify.previewNotAvailable")}</p>
                                  </div>
                                ) : (
                                  <>
                                    {previewUrl && (
                                      <img
                                        key={previewUrl}
                                        src={previewUrl}
                                        alt={`${t("verify.previewAltPrefix")} ${previewPage}`}
                                        className="w-full h-auto"
                                      />
                                    )}
                                    {previewLoading && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
                                        <Spinner className="w-6 h-6 text-indigo-500" />
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>

                              <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
                                {t("verify.previewDisclaimer")}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                ) : (
                  // Not found / no document
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 text-center">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {verificationResult.message || t("verify.noMatchingRegistry")}
                    </p>
                    <p className="text-xs text-slate-400 mt-3">
                      {t("verify.notRegisteredHint")}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity">
                    <IconRefresh className="w-4 h-4" />
                    {t("verify.verifyAnother")}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isPublic) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
        <div className="flex-1 flex flex-col items-center px-4 py-10 sm:py-16">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-11 h-11 rounded-2xl bg-accent-gradient-br flex items-center justify-center shadow-lg shadow-accent">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <div className="leading-tight">
              <p className="text-base font-semibold text-slate-900 dark:text-white">DocLoq</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("verify.documentVerification")}</p>
            </div>
          </div>

          {body}
        </div>

        <footer className="py-6 text-center text-xs text-slate-400 dark:text-slate-600">
          {t("verify.poweredBy")}
        </footer>
      </div>
    );
  }

  return <DashboardLayout>{body}</DashboardLayout>;
}
