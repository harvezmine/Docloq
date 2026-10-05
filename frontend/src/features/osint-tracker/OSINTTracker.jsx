import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import CustomSelect from "@/components/ui/CustomSelect";
import { useLang } from "@/app/providers/LanguageProvider";
import watermarkScannerService from "@/services/watermark-scanner.service";
import osintService from "@/services/osint.service";
import TrackingFunnel from "./components/TrackingFunnel";
import DetectionDonut from "./components/DetectionDonut";
import ScanRadar from "./components/ScanRadar";
import StatSparkline from "./components/StatSparkline";
import { dailyCounts, countByMatchType } from "./lib/osint-metrics";

const STAT_ACCENTS = {
  indigo: {
    bar: "from-indigo-400 to-indigo-600",
    glow: "bg-indigo-500/15",
    iconBg: "bg-indigo-500/10",
    iconText: "text-indigo-500 dark:text-indigo-400",
    border: "border-slate-200 dark:border-slate-800",
  },
  red: {
    bar: "from-red-400 to-red-600",
    glow: "bg-red-500/15",
    iconBg: "bg-red-500/10",
    iconText: "text-red-500 dark:text-red-400",
    border: "border-red-200 dark:border-red-500/30",
  },
  amber: {
    bar: "from-amber-400 to-amber-600",
    glow: "bg-amber-500/15",
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-500 dark:text-amber-400",
    border: "border-slate-200 dark:border-slate-800",
  },
  emerald: {
    bar: "from-emerald-400 to-emerald-600",
    glow: "bg-emerald-500/15",
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-500 dark:text-emerald-400",
    border: "border-slate-200 dark:border-slate-800",
  },
  slate: {
    bar: "from-slate-400 to-slate-600",
    glow: "bg-slate-500/15",
    iconBg: "bg-slate-500/10",
    iconText: "text-slate-500 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-800",
  },
};

export default function OSINTTracker() {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState("monitor");
  const [leakFilter, setLeakFilter] = useState("all");
  const reduceMotion = useReducedMotion();

  const [stats, setStats] = useState(null);
  const [leaks, setLeaks] = useState([]);
  const [trackedDocs, setTrackedDocs] = useState([]);
  const [osintLoading, setOsintLoading] = useState(true);
  const [osintError, setOsintError] = useState(null);

  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [selectedTrackedDocId, setSelectedTrackedDocId] = useState("");

  const [scanFile, setScanFile] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleScanFile = useCallback(async () => {
    if (!scanFile) return;
    setScanLoading(true);
    setScanResult(null);
    setScanHistory([]);
    try {
      const { data } = await watermarkScannerService.scanDocument(scanFile);
      const result = data?.data || data;
      setScanResult(result);
      const docId = result?.downloadWatermark?.document?.id || result?.uploadHoneytoken?.documentId;
      if (docId) {
        try {
          const { data: histData } = await watermarkScannerService.getHistory(docId);
          setScanHistory(histData?.data || []);
        } catch {  }
      }
    } catch (err) {
      setScanResult({ found: false, message: err?.response?.data?.message || t("osint.scan.scanFailed") });
    } finally {
      setScanLoading(false);
    }
  }, [scanFile, t]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) setScanFile(file);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const formatScanDate = (dateStr) => {
    if (!dateStr) return t("osint.na");
    try {
      return new Date(dateStr).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    } catch { return dateStr; }
  };

  const loadOsint = useCallback(async () => {
    setOsintLoading(true);
    setOsintError(null);
    try {
      const [statsRes, leaksRes, trackedRes] = await Promise.all([
        osintService.getStats(),
        osintService.listLeaks({ limit: 50 }),
        osintService.listTrackedDocs(),
      ]);
      if (statsRes?.data?.success) setStats(statsRes.data.data);
      if (leaksRes?.data?.success) setLeaks(leaksRes.data.data || []);
      if (trackedRes?.data?.success) setTrackedDocs(trackedRes.data.data || []);
    } catch (err) {
      setOsintError(err?.response?.data?.message || t("osint.errors.loadFailed"));
    } finally {
      setOsintLoading(false);
    }
  }, [t]);

  useEffect(() => { loadOsint(); }, [loadOsint]);

  const handleCheckDocument = useCallback(async () => {
    if (!selectedTrackedDocId) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const { data } = await osintService.checkDocument(selectedTrackedDocId);
      setCheckResult(data?.data || data);
      const [statsRes, leaksRes] = await Promise.all([
        osintService.getStats(),
        osintService.listLeaks({ limit: 50 }),
      ]);
      if (statsRes?.data?.success) setStats(statsRes.data.data);
      if (leaksRes?.data?.success) setLeaks(leaksRes.data.data || []);
    } catch (err) {
      setCheckResult({ error: err?.response?.data?.message || t("osint.errors.checkFailed") });
    } finally {
      setChecking(false);
    }
  }, [selectedTrackedDocId, t]);

  const leakSeries = useMemo(() => dailyCounts(leaks, "discoveredAt", 30), [leaks]);
  const trackedSeries = useMemo(() => dailyCounts(trackedDocs, "createdAt", 30), [trackedDocs]);

  const leakTypeCounts = useMemo(() => countByMatchType(leaks), [leaks]);
  const filteredLeaks = useMemo(
    () => (leakFilter === "all" ? leaks : leaks.filter((l) => l.matchType === leakFilter)),
    [leaks, leakFilter],
  );

  const statCards = useMemo(() => [
    { label: t("osint.stats.trackedDocuments"), value: stats?.trackedDocsCount ?? '-', icon: "document", color: "indigo", series: trackedSeries, spark: "#818cf8" },
    { label: t("osint.stats.leaks30d"), value: stats?.leakReportsLast30d ?? '-', icon: "alert", color: "red", alert: (stats?.leakReportsLast30d || 0) > 0, series: leakSeries, spark: "#f87171" },
    { label: t("osint.stats.watermarkedDownloads"), value: stats?.downloadWatermarkCount ?? '-', icon: "token", color: "amber" },
    { label: t("osint.stats.autoScan"), value: stats?.autoScanEnabled ? t("osint.stats.on") : t("osint.stats.off"), icon: "shield", color: stats?.autoScanEnabled ? "emerald" : "slate" },
  ], [stats, trackedSeries, leakSeries, t]);

  const getStatIcon = (icon) => {
    const icons = {
      document: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      alert: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
      token: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
      shield: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    };
    return icons[icon] || null;
  };

  const getSourceIcon = (icon) => {
    const icons = {
      cloud: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>,
    };
    return icons[icon] || null;
  };

  const fmtRelative = (dateStr) => {
    if (!dateStr) return t("osint.relative.never");
    const ms = Date.now() - new Date(dateStr).getTime();
    if (ms < 60_000) return t("osint.relative.justNow");
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}${t("osint.relative.min")}`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}${t("osint.relative.hour")}`;
    return `${Math.floor(ms / 86_400_000)}${t("osint.relative.day")}`;
  };

  const tabs = [
    { id: "monitor", label: t("osint.tabs.monitor"), count: null, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> },
    { id: "leaks", label: t("osint.tabs.leaks"), count: leaks.length, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
    { id: "check", label: t("osint.tabs.check"), count: null, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
    { id: "scan_watermark", label: t("osint.tabs.scanWatermark"), count: null, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg> },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-screen">

        <PageHeader
          eyebrow={t("osint.header.eyebrow")}
          title={t("osint.header.title")}
          subtitle={t("osint.header.subtitle")}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
          actions={
            <>
              {leaks.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25">
                  <span className={`w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400 ${reduceMotion ? '' : 'animate-pulse'}`} />
                  {leaks.length} {leaks.length > 1 ? t("osint.header.leakReportMany") : t("osint.header.leakReportOne")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  {t("osint.header.noLeaks")}
                </span>
              )}
              {stats?.autoScanEnabled ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 ${reduceMotion ? '' : 'animate-pulse'}`} />
                  {t("osint.header.liveMonitoring")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25" title={t("osint.header.autoscanTooltip")}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                  {t("osint.header.manualMode")}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {t("osint.header.lastScan")} {fmtRelative(stats?.lastScanAt)}
              </span>
              <button
                onClick={loadOsint}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:text-slate-700 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
                title={t("osint.header.refreshTitle")}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {t("common.refresh")}
              </button>
            </>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {statCards.map((stat, index) => {
            const accent = STAT_ACCENTS[stat.color] || STAT_ACCENTS.indigo;
            return (
              <motion.div
                key={stat.label}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { delay: index * 0.07, duration: 0.35 }}
                className={`relative overflow-hidden rounded-2xl border ${accent.border} bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className={`absolute inset-y-0 left-0 w-1 bg-linear-to-b ${accent.bar}`} />
                <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full ${accent.glow} blur-2xl pointer-events-none`} />
                <div className="relative">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 leading-tight">{stat.label}</p>
                    <div className={`w-8 h-8 shrink-0 rounded-lg ${accent.iconBg} ${accent.iconText} flex items-center justify-center`}>
                      {getStatIcon(stat.icon)}
                    </div>
                  </div>
                  <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${stat.alert ? "text-red-500 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
                    {stat.value}
                  </p>
                  {stat.series && <StatSparkline series={stat.series} color={stat.spark} />}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="flex gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm w-fit max-w-full overflow-x-auto mb-6">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive ? "text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="osint-tab-pill"
                    className="absolute inset-0 rounded-lg bg-accent-gradient shadow-lg shadow-accent"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count != null && (
                    <span className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {activeTab === "monitor" && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {osintLoading && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    <div className="h-3 w-64 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">{t("osint.monitor.loading")}</p>
              </div>
            )}
            {osintError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{osintError}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TrackingFunnel stats={stats} leaks={leaks} />
              <DetectionDonut leaks={leaks} />
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("osint.tracked.title")}</h2>
                    <p className="text-xs text-slate-400 tabular-nums">{trackedDocs.length} {t("osint.tracked.activeSuffix")}</p>
                  </div>
                </div>
              </div>

              {trackedDocs.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Belum ada dokumen ter-tracking</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    Aktifkan &quot;OSINT Tracking&quot; pada sebuah dokumen agar muncul di sini; setiap unduhannya lalu diberi kode kanari yang bisa dilacak.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trackedDocs.map((doc, i) => (
                    <motion.div
                      key={doc.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reduceMotion ? { duration: 0 } : { delay: Math.min(i * 0.04, 0.3), duration: 0.25 }}
                      className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{doc.title || 'Untitled'}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">
                          {doc.mimeType} &middot; uploaded {doc.createdAt ? fmtRelative(doc.createdAt) : 'unknown'}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 ${reduceMotion ? '' : 'animate-pulse'}`}></span>
                        Tracked
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                Monitored Sources
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <ScanRadar active={!!stats?.autoScanEnabled} pingCount={Math.min(leaks.length, 3)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                          {getSourceIcon('cloud')}
                        </div>
                        {stats?.autoScanEnabled ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 ${reduceMotion ? '' : 'animate-pulse'}`}></span>
                            Auto-scan ON
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Set OSINT_AUTOSCAN_ENABLED=true to enable">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400"></span>
                            Manual only
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                        {stats?.autoScanSource?.includes('mock')
                          ? 'Mock Search (PoC Demo)'
                          : stats?.autoScanSource?.includes('google_cse')
                            ? 'Google Web Search (CSE)'
                            : stats?.autoScanSource?.includes('searxng')
                              ? 'SearXNG Meta Search'
                              : stats?.autoScanSource?.includes('serper')
                                ? 'Serper Web Search'
                                : 'Web Search Provider'}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        Last scan: {fmtRelative(stats?.lastScanAt)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${stats?.autoScanSource?.includes('searxng') ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'}`}>
                      {stats?.autoScanSource?.includes('searxng') ? 'Active' : 'Available'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">SearXNG Meta Search</p>
                  <p className="text-xs text-slate-500 font-mono">Self-hosted · No API key · Privacy-first</p>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      Webhook
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">External Report Webhook</p>
                  <p className="text-xs text-slate-500 font-mono">POST /api/osint/report (auth: x-osint-key)</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                <strong className="text-slate-600 dark:text-slate-300">Catatan:</strong> DocLoq menggunakan Google CSE, SearXNG, dan Serper untuk web search. GitHub monitoring via SearXNG. Untuk monitoring eksternal lain, kirim laporan via webhook.
              </p>
            </div>
          </motion.div>
        )}

        {activeTab === "leaks" && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {leaks.length === 0 ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-40 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Leaks Detected</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    Tab ini akan terisi saat scanner menemukan watermark, cron menemukan honeytoken di GitHub, atau webhook menerima laporan eksternal.
                  </p>
                </div>
              </div>
            ) : (
              <>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { key: "all", label: "All", n: leakTypeCounts.total },
                  { key: "visible_code", label: "visible-code", n: leakTypeCounts.visible_code },
                  { key: "watermark", label: "watermark", n: leakTypeCounts.watermark },
                  { key: "honeytoken", label: "honeytoken", n: leakTypeCounts.honeytoken },
                ].filter((c) => c.key === "all" || c.n > 0).map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setLeakFilter(c.key)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      leakFilter === c.key
                        ? "bg-accent-gradient text-white border-transparent shadow-md shadow-accent"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500"
                    }`}
                  >
                    {c.label} <span className="tabular-nums opacity-70">{c.n}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <div className="relative px-5 py-4 border-b border-red-500/20 flex items-center gap-3 overflow-hidden">
                  <div className="absolute inset-0 bg-linear-to-r from-red-500/10 via-red-500/5 to-transparent pointer-events-none" />
                  <div className="relative w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center text-red-500 dark:text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <div className="relative">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">{leaks.length} Leak{leaks.length > 1 ? 's' : ''} Detected</p>
                    <p className="text-xs text-red-500/70 dark:text-red-400/70">Total reports from all sources</p>
                  </div>
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Document</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Detected</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Match</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Confidence</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Traced User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredLeaks.map((leak, i) => (
                        <motion.tr
                          key={leak.id}
                          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={reduceMotion ? { duration: 0 } : { delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                                <svg className="w-3.5 h-3.5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              </div>
                              <span className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]" title={leak.documentName}>{leak.documentName || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {leak.sourceUrl ? (
                              <a href={leak.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[160px] inline-block" title={leak.sourceUrl}>
                                {leak.sourceName || leak.sourceUrl}
                              </a>
                            ) : (
                              <span className="text-slate-500">{leak.sourceName || leak.scanType}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">{fmtRelative(leak.discoveredAt)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              leak.matchType === 'visible_code'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : leak.matchType === 'watermark'
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                : leak.matchType === 'honeytoken'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-slate-500/10 text-slate-500'
                            }`}>
                              {leak.matchType === 'visible_code' ? 'visible code' : leak.matchType}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {leak.matchConfidence != null ? (
                              <div className="flex items-center gap-2 min-w-[90px]">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${leak.matchConfidence >= 80 ? 'bg-red-500' : leak.matchConfidence >= 50 ? 'bg-amber-500' : 'bg-slate-400'}`}
                                    style={{ width: `${Math.min(100, leak.matchConfidence)}%` }}
                                  />
                                </div>
                                <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">{leak.matchConfidence}%</span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {leak.tracedUserEmail ? (
                              <span title={leak.tracedUserName}>{leak.tracedUserEmail}</span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              leak.isAcknowledged
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}>
                              {leak.isAcknowledged ? 'Ack' : 'New'}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLeaks.map((leak, i) => (
                    <motion.div
                      key={leak.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reduceMotion ? { duration: 0 } : { delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                      className="p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate flex-1 pr-2" title={leak.documentName}>{leak.documentName || 'Unknown'}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${
                          leak.matchType === 'watermark' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : leak.matchType === 'honeytoken' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-500/10 text-slate-500'
                        }`}>{leak.matchType}</span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-1">
                        <p>Source: {leak.sourceUrl ? <a href={leak.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 dark:text-indigo-400 hover:underline">{leak.sourceName || 'link'}</a> : leak.sourceName || leak.scanType}</p>
                        <p>Detected: {fmtRelative(leak.discoveredAt)} &middot; {leak.matchConfidence ?? '-'}%</p>
                        {leak.tracedUserEmail && <p>Traced: {leak.tracedUserEmail}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === "check" && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 items-start"
          >
            <div className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-accent-gradient-br flex items-center justify-center shadow-lg shadow-accent">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Check Document for Leaks</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">On-demand web search (Google)</p>
                </div>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Pilih dokumen ter-tracking, lalu jalankan pencarian web untuk kode kanari-nya (<code className="font-mono text-xs px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">DLQ-…</code>). Aktifkan &quot;OSINT Tracking&quot; pada dokumen agar setiap unduhan diberi kode unik yang bisa dilacak balik ke pengunduhnya.
              </p>

              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Dokumen ter-tracking</label>
              <CustomSelect
                className="mb-4"
                value={selectedTrackedDocId}
                onChange={(val) => { setSelectedTrackedDocId(val); setCheckResult(null); }}
                disabled={trackedDocs.length === 0}
                placeholder="- pilih dokumen -"
                ariaLabel="Pilih dokumen"
                options={trackedDocs.map((d) => ({ value: d.id, label: d.title || 'Untitled' }))}
              />

              {trackedDocs.length === 0 && (
                <p className="mb-4 text-xs text-amber-700 dark:text-amber-400">
                  Belum ada dokumen ter-tracking. Aktifkan &quot;OSINT Tracking&quot; pada sebuah dokumen (menu dokumen) dulu.
                </p>
              )}

              <button
                onClick={handleCheckDocument}
                disabled={!selectedTrackedDocId || checking}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-accent-gradient hover:brightness-110 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-700 disabled:cursor-not-allowed text-white shadow-lg shadow-accent disabled:shadow-none transition-all"
              >
                {checking ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Searching…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    Check for Leaks
                  </>
                )}
              </button>

              {checking && !reduceMotion && (
                <div className="mt-3 h-1 rounded-full bg-indigo-500/15 overflow-hidden">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-accent-gradient"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              )}

              {checkResult && (checkResult.error || checkResult.searchUnavailable || checkResult.skippedReason) && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
                  className="mt-5 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-300"
                >
                  {checkResult.skippedReason === 'never_downloaded'
                    ? 'Dokumen ini belum pernah diunduh, belum ada kode kanari untuk dicari. Unduh dulu agar bisa dilacak.'
                    : checkResult.skippedReason === 'no_visible_code'
                      ? 'Dokumen ini sudah pernah diunduh, tapi unduhannya belum membawa kode kanari, jadi belum ada yang bisa dicari. Unduhan lama (sebelum tracking aktif) dan format yang belum didukung (XLSX, PPTX, gambar, .doc lama) tidak diberi kode. Unduh ulang dokumennya, lalu jalankan Check lagi.'
                      : (checkResult.error || checkResult.searchErrorMessage || 'Web search tidak tersedia saat ini.')}
                </motion.div>
              )}

              {checkResult && !checkResult.error && !checkResult.searchUnavailable && !checkResult.skippedReason && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
                  className={`mt-5 p-4 rounded-xl border ${checkResult.hits > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {checkResult.hits > 0 ? (
                      <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    )}
                    <p className={`text-sm font-semibold ${checkResult.hits > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                      {checkResult.hits > 0 ? `${checkResult.hits} potential leak${checkResult.hits > 1 ? 's' : ''} found` : 'No leaks found'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {(checkResult.queries || 0)} {checkResult.queries === 1 ? 'query' : 'queries'} sent
                    {checkResult.confirmed > 0 && ` · ${checkResult.confirmed} new`}
                    {checkResult.searchError && ' · sebagian pencarian gagal'}
                  </p>
                  {checkResult.hits > 0 && (
                    <button
                      onClick={() => setActiveTab('leaks')}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Lihat detail di Leaks tab
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  )}
                </motion.div>
              )}
            </div>

            <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">How it works</p>
              </div>
              <ol className="relative text-xs text-slate-600 dark:text-slate-400 space-y-0">
                {[
                  <span key="1">Tiap unduhan dokumen ter-tracking diberi kode kanari terlihat <code className="font-mono">DLQ-&#123;docCode&#125;-&#123;dlCode&#125;</code> (PDF/TXT/DOCX)</span>,
                  <span key="2">Backend query Google Custom Search untuk prefix <code className="font-mono">&quot;DLQ-&#123;docCode&#125;&quot;</code></span>,
                  <span key="3">Tiap hit di-fetch (SSRF-guarded) + kode diekstrak; dicocokkan ke docCode ini</span>,
                  <span key="4">Match &rarr; dlCode ditelusuri balik ke pengunduh + dicatat di leakReports (audit trail)</span>,
                ].map((content, i, arr) => (
                  <li key={i} className="relative flex items-start gap-3 pb-4 last:pb-0">
                    {i < arr.length - 1 && (
                      <span className="absolute left-[13px] top-7 bottom-0 w-px bg-indigo-500/20" aria-hidden="true" />
                    )}
                    <span className="w-[26px] h-[26px] shrink-0 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500 dark:text-indigo-400 text-[10px] font-semibold">{i + 1}</span>
                    <span className="pt-1 leading-relaxed">{content}</span>
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}

        {activeTab === "scan_watermark" && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-accent-gradient-br flex items-center justify-center shadow-lg shadow-accent">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Scan for Invisible Watermarks</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Upload a suspected leaked document to identify the source</p>
                </div>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  isDragOver
                    ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
                    : scanFile
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/[0.03]"
                }`}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf,.docx,.doc,.txt,.xlsx,.xls,.pptx,.png,.jpg,.jpeg';
                  input.onchange = (e) => {
                    const file = e.target.files?.[0];
                    if (file) setScanFile(file);
                  };
                  input.click();
                }}
              >
                {scanFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{scanFile.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{(scanFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setScanFile(null); setScanResult(null); setScanHistory([]); }}
                      className="ml-4 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-accent-soft border border-accent-soft flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">Drop a suspected leaked document here</p>
                    <p className="text-xs text-slate-500">PDF, DOCX, TXT, XLSX, PNG, JPG supported</p>
                  </>
                )}
              </div>

              <button
                onClick={handleScanFile}
                disabled={!scanFile || scanLoading}
                className="mt-4 w-full px-4 py-3 rounded-xl text-sm font-medium bg-accent-gradient text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent transition-all flex items-center justify-center gap-2"
              >
                {scanLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Scanning document...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    Scan for Watermarks
                  </>
                )}
              </button>
            </div>

            {scanResult && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {scanResult.downloadWatermark && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-emerald-600 dark:text-emerald-400">Leak Source Identified</h3>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Per-download watermark detected</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-1">Downloader</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{scanResult.downloadWatermark.downloader?.name || 'Unknown'}</p>
                        {scanResult.downloadWatermark.downloader?.email && (
                          <p className="text-xs text-slate-400">{scanResult.downloadWatermark.downloader.email}</p>
                        )}
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-1">Downloaded On</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{formatScanDate(scanResult.downloadWatermark.downloadedAt)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-1">Document</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{scanResult.downloadWatermark.document?.name || 'Unknown'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-1">Confidence</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.round((scanResult.downloadWatermark.confidence || 0) * 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{Math.round((scanResult.downloadWatermark.confidence || 0) * 100)}%</span>
                        </div>
                      </div>
                      {scanResult.downloadWatermark.ipAddress && (
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                          <p className="text-xs text-slate-500 mb-1">IP Address</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white font-mono">{scanResult.downloadWatermark.ipAddress}</p>
                        </div>
                      )}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-1">Method</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Unicode Invisible Characters</p>
                      </div>
                    </div>
                  </div>
                )}

                {scanResult.uploadHoneytoken && !scanResult.downloadWatermark && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-amber-600 dark:text-amber-400">Upload Honeytoken Detected</h3>
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Uploader identified, but per-download watermark not found</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-1">Uploader</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{scanResult.uploadHoneytoken.uploader?.name || 'Unknown'}</p>
                        {scanResult.uploadHoneytoken.uploader?.email && (
                          <p className="text-xs text-slate-400">{scanResult.uploadHoneytoken.uploader.email}</p>
                        )}
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-1">Detection Method</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">{scanResult.uploadHoneytoken.method}</p>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-3">
                      Note: Per-download watermark not found, document may pre-date the watermark system or was sanitized.
                    </p>
                  </div>
                )}

                {scanResult.uploadHoneytoken && scanResult.downloadWatermark && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Upload Honeytoken Also Detected</p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Original uploader: <span className="text-slate-900 dark:text-white">{scanResult.uploadHoneytoken.uploader?.name || 'Unknown'}</span>
                      {scanResult.uploadHoneytoken.uploader?.email && <span className="text-slate-500"> ({scanResult.uploadHoneytoken.uploader.email})</span>}
                    </p>
                  </div>
                )}

                {!scanResult.found && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 p-5 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    </div>
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">No Markers Detected</h3>
                    <p className="text-sm text-slate-500">{scanResult.message || 'Document may have been sanitized or is not from this system.'}</p>
                  </div>
                )}

                {scanHistory.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        All Watermarked Downloads for This Document
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Downloaded At</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">IP Address</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Watermark ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {scanHistory.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{record.user}</td>
                              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{record.email || 'N/A'}</td>
                              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{formatScanDate(record.downloadedAt)}</td>
                              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 font-mono">{record.ipAddress || 'N/A'}</td>
                              <td className="px-4 py-3">
                                <code className="text-xs px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-mono">
                                  {record.watermarkId?.substring(0, 8)}...
                                </code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {!scanResult && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">How Watermark Scanning Works</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { step: 1, title: "Upload Document", desc: "Upload the suspected leaked document" },
                    { step: 2, title: "Extract Text", desc: "System extracts text content from the file" },
                    { step: 3, title: "Detect Watermarks", desc: "Scans for invisible Unicode character patterns" },
                    { step: 4, title: "Identify Leaker", desc: "Decodes watermark to identify the downloader" },
                  ].map((item) => (
                    <div key={item.step} className="relative p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                      <span className="absolute -top-2 -right-1 text-5xl font-black text-slate-200/60 dark:text-slate-700/40 select-none" aria-hidden="true">{item.step}</span>
                      <div className="relative">
                        <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500 dark:text-indigo-400 text-xs font-semibold mb-2">{item.step}</div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white mb-0.5">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
