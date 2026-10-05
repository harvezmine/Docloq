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
import StatSparkline from "./components/StatSparkline";
import { dailyCounts, countByMatchType } from "./lib/osint-metrics";

// Shared surface for every panel on this page: one border, one radius, no glow.
const PANEL = "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const TH = "px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider";

// Detection-type vocabulary, reused by the leaks table, the mobile list and the filter.
const MATCH_DOT = {
  visible_code: "bg-brand-600 dark:bg-brand-400",
  watermark: "bg-brand-300",
  honeytoken: "bg-amber-500",
};

const Dot = ({ className }) => <span aria-hidden="true" className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${className}`} />;

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const DocGlyph = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

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

  const leakCount30d = stats?.leakReportsLast30d || 0;
  const statCards = useMemo(() => [
    { label: t("osint.stats.trackedDocuments"), value: stats?.trackedDocsCount ?? '-', series: trackedSeries, spark: "var(--brand-500)" },
    { label: t("osint.stats.leaks30d"), value: stats?.leakReportsLast30d ?? '-', alert: leakCount30d > 0, series: leakSeries, spark: leakCount30d > 0 ? "#ef4444" : "#94a3b8" },
    { label: t("osint.stats.watermarkedDownloads"), value: stats?.downloadWatermarkCount ?? '-' },
    { label: t("osint.stats.autoScan"), value: stats?.autoScanEnabled ? t("osint.stats.on") : t("osint.stats.off"), state: stats?.autoScanEnabled ? "on" : "off" },
  ], [stats, leakCount30d, trackedSeries, leakSeries, t]);

  const fmtRelative = (dateStr) => {
    if (!dateStr) return t("osint.relative.never");
    const ms = Date.now() - new Date(dateStr).getTime();
    if (ms < 60_000) return t("osint.relative.justNow");
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}${t("osint.relative.min")}`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}${t("osint.relative.hour")}`;
    return `${Math.floor(ms / 86_400_000)}${t("osint.relative.day")}`;
  };

  const searchProviderName = stats?.autoScanSource?.includes('mock')
    ? 'Mock Search (PoC Demo)'
    : stats?.autoScanSource?.includes('google_cse')
      ? 'Google Web Search (CSE)'
      : stats?.autoScanSource?.includes('searxng')
        ? 'SearXNG Meta Search'
        : stats?.autoScanSource?.includes('serper')
          ? 'Serper Web Search'
          : 'Web Search Provider';

  const tabs = [
    { id: "monitor", label: t("osint.tabs.monitor"), count: null },
    { id: "leaks", label: t("osint.tabs.leaks"), count: leaks.length },
    { id: "check", label: t("osint.tabs.check"), count: null },
    { id: "scan_watermark", label: t("osint.tabs.scanWatermark"), count: null },
  ];

  const enter = reduceMotion
    ? { initial: false, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2, ease: "easeOut" } };

  return (
    <DashboardLayout>
      <div className="min-h-screen">

        <PageHeader
          eyebrow={t("osint.header.eyebrow")}
          title={t("osint.header.title")}
          subtitle={t("osint.header.subtitle")}
          actions={
            <>
              {/* One status line instead of a row of colored pills */}
              <div className="flex items-center divide-x divide-slate-200 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-2 px-3 py-1.5">
                  <Dot className={leaks.length > 0 ? "bg-red-500" : "bg-emerald-500"} />
                  {leaks.length > 0
                    ? <span><span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">{leaks.length}</span> {leaks.length > 1 ? t("osint.header.leakReportMany") : t("osint.header.leakReportOne")}</span>
                    : t("osint.header.noLeaks")}
                </span>
                <span
                  className="flex items-center gap-2 px-3 py-1.5"
                  title={stats?.autoScanEnabled ? undefined : t("osint.header.autoscanTooltip")}
                >
                  <Dot className={stats?.autoScanEnabled ? "bg-emerald-500" : "bg-amber-500"} />
                  {stats?.autoScanEnabled ? t("osint.header.liveMonitoring") : t("osint.header.manualMode")}
                  <span className="text-slate-400 dark:text-slate-500">· {fmtRelative(stats?.lastScanAt)}</span>
                </span>
              </div>
              <button
                onClick={loadOsint}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                title={t("osint.header.refreshTitle")}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {t("common.refresh")}
              </button>
            </>
          }
        />

        {/* Metric strip: one panel, hairline dividers */}
        <div className={`${PANEL} grid grid-cols-2 lg:grid-cols-4 overflow-hidden mb-6`}>
          {statCards.map((stat, i) => (
            <div
              key={stat.label}
              className={`p-4 sm:p-5 border-slate-200 dark:border-slate-800 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
            >
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 leading-tight">{stat.label}</p>
              <p className={`flex items-center gap-2 text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums ${stat.alert ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
                {stat.state && <Dot className={`w-2 h-2 ${stat.state === "on" ? "bg-emerald-500" : "bg-slate-400"}`} />}
                {stat.value}
              </p>
              {stat.series && <StatSparkline series={stat.series} color={stat.spark} />}
            </div>
          ))}
        </div>

        {/* Underline tabs */}
        <div className="flex gap-6 border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto scrollbar-none" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`relative -mb-px flex items-center gap-2 pb-3 pt-1 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus:outline-none focus-visible:text-slate-900 dark:focus-visible:text-white ${
                  isActive
                    ? "border-brand-600 dark:border-brand-400 text-slate-900 dark:text-white"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className={`text-[11px] font-semibold tabular-nums px-1.5 py-px rounded-md ${
                    tab.id === "leaks" ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "monitor" && (
          <motion.div {...enter} className="space-y-6">
            {osintLoading && (
              <div className={`${PANEL} p-5`}>
                <div className="space-y-2">
                  <div className="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  <div className="h-3 w-64 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
                <p className="mt-3 text-xs text-slate-400">{t("osint.monitor.loading")}</p>
              </div>
            )}
            {osintError && (
              <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{osintError}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TrackingFunnel stats={stats} leaks={leaks} />
              <DetectionDonut leaks={leaks} />
            </div>

            <section className={`${PANEL} overflow-hidden`}>
              <header className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("osint.tracked.title")}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{trackedDocs.length} {t("osint.tracked.activeSuffix")}</p>
              </header>

              {trackedDocs.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Belum ada dokumen ter-tracking</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    Aktifkan &quot;OSINT Tracking&quot; pada sebuah dokumen agar muncul di sini; setiap unduhannya lalu diberi kode kanari yang bisa dilacak.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trackedDocs.map((doc) => (
                    <li key={doc.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                        <DocGlyph />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{doc.title || 'Untitled'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                          {doc.mimeType} &middot; uploaded {doc.createdAt ? fmtRelative(doc.createdAt) : 'unknown'}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 shrink-0">
                        <Dot className="bg-emerald-500" />
                        Tracked
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={`${PANEL} overflow-hidden`}>
              <header className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Monitored Sources</h2>
              </header>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <li className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">{searchProviderName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Last scan: {fmtRelative(stats?.lastScanAt)}</p>
                  </div>
                  {stats?.autoScanEnabled ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><Dot className="bg-emerald-500" />Auto-scan ON</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300" title="Set OSINT_AUTOSCAN_ENABLED=true to enable"><Dot className="bg-amber-500" />Manual only</span>
                  )}
                </li>
                <li className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">SearXNG Meta Search</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Self-hosted · No API key · Privacy-first</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <Dot className={stats?.autoScanSource?.includes('searxng') ? "bg-emerald-500" : "bg-slate-400"} />
                    {stats?.autoScanSource?.includes('searxng') ? 'Active' : 'Available'}
                  </span>
                </li>
                <li className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">External Report Webhook</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">POST /api/osint/report (auth: x-osint-key)</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><Dot className="bg-slate-400" />Webhook</span>
                </li>
              </ul>
              <p className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <strong className="font-medium text-slate-600 dark:text-slate-300">Catatan:</strong> DocLoq menggunakan Google CSE, SearXNG, dan Serper untuk web search. GitHub monitoring via SearXNG. Untuk monitoring eksternal lain, kirim laporan via webhook.
              </p>
            </section>
          </motion.div>
        )}

        {activeTab === "leaks" && (
          <motion.div {...enter}>
            {leaks.length === 0 ? (
              <div className={`${PANEL} px-6 py-14 text-center`}>
                <svg className="w-8 h-8 mx-auto mb-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1.5">No Leaks Detected</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Tab ini akan terisi saat scanner menemukan watermark, cron menemukan honeytoken di GitHub, atau webhook menerima laporan eksternal.
                </p>
              </div>
            ) : (
              <section className={`${PANEL} overflow-hidden`}>
                <header className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                      <Dot className="w-2 h-2 bg-red-500" />
                      {leaks.length} Leak{leaks.length > 1 ? 's' : ''} Detected
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Total reports from all sources</p>
                  </div>
                  <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/70 w-fit">
                    {[
                      { key: "all", label: "All", n: leakTypeCounts.total },
                      { key: "visible_code", label: "visible-code", n: leakTypeCounts.visible_code },
                      { key: "watermark", label: "watermark", n: leakTypeCounts.watermark },
                      { key: "honeytoken", label: "honeytoken", n: leakTypeCounts.honeytoken },
                    ].filter((c) => c.key === "all" || c.n > 0).map((c) => (
                      <button
                        key={c.key}
                        onClick={() => setLeakFilter(c.key)}
                        aria-pressed={leakFilter === c.key}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          leakFilter === c.key
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {MATCH_DOT[c.key] && <Dot className={MATCH_DOT[c.key]} />}
                        {c.label} <span className="tabular-nums text-slate-400 dark:text-slate-500">{c.n}</span>
                      </button>
                    ))}
                  </div>
                </header>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/40">
                      <tr>
                        <th className={TH}>Document</th>
                        <th className={TH}>Source</th>
                        <th className={TH}>Detected</th>
                        <th className={TH}>Match</th>
                        <th className={TH}>Confidence</th>
                        <th className={TH}>Traced User</th>
                        <th className={TH}>Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredLeaks.map((leak) => (
                        <tr key={leak.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <span className="block text-sm font-medium text-slate-900 dark:text-white truncate max-w-55" title={leak.documentName}>{leak.documentName || 'Unknown'}</span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {leak.sourceUrl ? (
                              <a href={leak.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate max-w-40 inline-block align-bottom" title={leak.sourceUrl}>
                                {leak.sourceName || leak.sourceUrl}
                              </a>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">{leak.sourceName || leak.scanType}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 tabular-nums">{fmtRelative(leak.discoveredAt)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                              <Dot className={MATCH_DOT[leak.matchType] || "bg-slate-400"} />
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
                          <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                            {leak.tracedUserEmail ? (
                              <span title={leak.tracedUserName}>{leak.tracedUserEmail}</span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                              leak.isAcknowledged
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}>
                              {leak.isAcknowledged ? 'Ack' : 'New'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLeaks.map((leak) => (
                    <li key={leak.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate flex-1" title={leak.documentName}>{leak.documentName || 'Unknown'}</p>
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 shrink-0">
                          <Dot className={MATCH_DOT[leak.matchType] || "bg-slate-400"} />
                          {leak.matchType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <p>Source: {leak.sourceUrl ? <a href={leak.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{leak.sourceName || 'link'}</a> : leak.sourceName || leak.scanType}</p>
                        <p>Detected: {fmtRelative(leak.discoveredAt)} &middot; {leak.matchConfidence ?? '-'}%</p>
                        {leak.tracedUserEmail && <p>Traced: {leak.tracedUserEmail}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </motion.div>
        )}

        {activeTab === "check" && (
          <motion.div {...enter} className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 items-start">
            <section className={`lg:col-span-3 ${PANEL} p-5 sm:p-6`}>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Check Document for Leaks</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 mb-4">On-demand web search (Google)</p>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent hover:bg-brand-700 text-white disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
              >
                {checking ? (
                  <>
                    <Spinner />
                    Searching…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    Check for Leaks
                  </>
                )}
              </button>

              {checkResult && (checkResult.error || checkResult.searchUnavailable || checkResult.skippedReason) && (
                <motion.div {...enter} className="mt-5 p-4 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-sm text-amber-800 dark:text-amber-300">
                  {checkResult.skippedReason === 'never_downloaded'
                    ? 'Dokumen ini belum pernah diunduh, belum ada kode kanari untuk dicari. Unduh dulu agar bisa dilacak.'
                    : checkResult.skippedReason === 'no_visible_code'
                      ? 'Dokumen ini sudah pernah diunduh, tapi unduhannya belum membawa kode kanari, jadi belum ada yang bisa dicari. Unduhan lama (sebelum tracking aktif) dan format yang belum didukung (XLSX, PPTX, gambar, .doc lama) tidak diberi kode. Unduh ulang dokumennya, lalu jalankan Check lagi.'
                      : (checkResult.error || checkResult.searchErrorMessage || 'Web search tidak tersedia saat ini.')}
                </motion.div>
              )}

              {checkResult && !checkResult.error && !checkResult.searchUnavailable && !checkResult.skippedReason && (
                <motion.div
                  {...enter}
                  className={`mt-5 p-4 rounded-xl border ${checkResult.hits > 0 ? 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10' : 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'}`}
                >
                  <p className={`flex items-center gap-2 text-sm font-semibold ${checkResult.hits > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                    <Dot className={`w-2 h-2 ${checkResult.hits > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    {checkResult.hits > 0 ? `${checkResult.hits} potential leak${checkResult.hits > 1 ? 's' : ''} found` : 'No leaks found'}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {(checkResult.queries || 0)} {checkResult.queries === 1 ? 'query' : 'queries'} sent
                    {checkResult.confirmed > 0 && ` · ${checkResult.confirmed} new`}
                    {checkResult.searchError && ' · sebagian pencarian gagal'}
                  </p>
                  {checkResult.hits > 0 && (
                    <button
                      onClick={() => setActiveTab('leaks')}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                    >
                      Lihat detail di Leaks tab
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  )}
                </motion.div>
              )}
            </section>

            <section className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">How it works</h3>
              <ol className="space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
                {[
                  <span key="1">Tiap unduhan dokumen ter-tracking diberi kode kanari terlihat <code className="font-mono">DLQ-&#123;docCode&#125;-&#123;dlCode&#125;</code> (PDF/TXT/DOCX)</span>,
                  <span key="2">Backend query Google Custom Search untuk prefix <code className="font-mono">&quot;DLQ-&#123;docCode&#125;&quot;</code></span>,
                  <span key="3">Tiap hit di-fetch (SSRF-guarded) + kode diekstrak; dicocokkan ke docCode ini</span>,
                  <span key="4">Match &rarr; dlCode ditelusuri balik ke pengunduh + dicatat di leakReports (audit trail)</span>,
                ].map((content, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 shrink-0 text-right font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500 pt-px tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <span className="leading-relaxed">{content}</span>
                  </li>
                ))}
              </ol>
            </section>
          </motion.div>
        )}

        {activeTab === "scan_watermark" && (
          <motion.div {...enter} className="space-y-6">
            <section className={`${PANEL} p-5 sm:p-6`}>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Scan for Invisible Watermarks</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 mb-5">Upload a suspected leaked document to identify the source</p>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative border border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  isDragOver
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : scanFile
                    ? "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
                    : "border-slate-300 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500/60 hover:bg-slate-50 dark:hover:bg-slate-800/30"
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
                    <span className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                      <DocGlyph className="w-5 h-5" />
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{scanFile.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{(scanFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setScanFile(null); setScanResult(null); setScanHistory([]); }}
                      className="ml-4 w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/40 transition-colors"
                      aria-label="Remove file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <svg className="w-7 h-7 mx-auto mb-3 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">Drop a suspected leaked document here</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">PDF, DOCX, TXT, XLSX, PNG, JPG supported</p>
                  </>
                )}
              </div>

              <button
                onClick={handleScanFile}
                disabled={!scanFile || scanLoading}
                className="mt-4 w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent hover:bg-brand-700 text-white disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {scanLoading ? (
                  <>
                    <Spinner />
                    Scanning document...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    Scan for Watermarks
                  </>
                )}
              </button>
            </section>

            {scanResult && (
              <motion.div {...enter} className="space-y-4">
                {scanResult.downloadWatermark && (
                  <section className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-slate-900 overflow-hidden">
                    <header className="px-5 py-4 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-200 dark:border-emerald-500/30">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        <Dot className="w-2 h-2 bg-emerald-500" />
                        Leak Source Identified
                      </h3>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">Per-download watermark detected</p>
                    </header>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 text-sm">
                      {[
                        ["Downloader", <>
                          {scanResult.downloadWatermark.downloader?.name || 'Unknown'}
                          {scanResult.downloadWatermark.downloader?.email && (
                            <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{scanResult.downloadWatermark.downloader.email}</span>
                          )}
                        </>],
                        ["Downloaded On", formatScanDate(scanResult.downloadWatermark.downloadedAt)],
                        ["Document", scanResult.downloadWatermark.document?.name || 'Unknown'],
                        ["Confidence", (
                          <span className="flex items-center gap-2">
                            <span className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <span
                                className="block h-full rounded-full bg-emerald-500"
                                style={{ width: `${Math.round((scanResult.downloadWatermark.confidence || 0) * 100)}%` }}
                              />
                            </span>
                            <span className="tabular-nums">{Math.round((scanResult.downloadWatermark.confidence || 0) * 100)}%</span>
                          </span>
                        )],
                        ...(scanResult.downloadWatermark.ipAddress ? [["IP Address", <span className="font-mono">{scanResult.downloadWatermark.ipAddress}</span>]] : []),
                        ["Method", "Unicode Invisible Characters"],
                      ].map(([label, value]) => (
                        <div key={label} className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                          <dt className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</dt>
                          <dd className="font-medium text-slate-900 dark:text-white">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                {scanResult.uploadHoneytoken && !scanResult.downloadWatermark && (
                  <section className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-slate-900 overflow-hidden">
                    <header className="px-5 py-4 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                        <Dot className="w-2 h-2 bg-amber-500" />
                        Upload Honeytoken Detected
                      </h3>
                      <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">Uploader identified, but per-download watermark not found</p>
                    </header>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 text-sm">
                      <div className="px-5 py-3">
                        <dt className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Uploader</dt>
                        <dd className="font-medium text-slate-900 dark:text-white">
                          {scanResult.uploadHoneytoken.uploader?.name || 'Unknown'}
                          {scanResult.uploadHoneytoken.uploader?.email && (
                            <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{scanResult.uploadHoneytoken.uploader.email}</span>
                          )}
                        </dd>
                      </div>
                      <div className="px-5 py-3">
                        <dt className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Detection Method</dt>
                        <dd className="font-medium text-slate-900 dark:text-white capitalize">{scanResult.uploadHoneytoken.method}</dd>
                      </div>
                    </dl>
                    <p className="px-5 pb-4 text-xs text-slate-500 dark:text-slate-400">
                      Note: Per-download watermark not found, document may pre-date the watermark system or was sanitized.
                    </p>
                  </section>
                )}

                {scanResult.uploadHoneytoken && scanResult.downloadWatermark && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                      <Dot className="bg-amber-500" />
                      Upload Honeytoken Also Detected
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Original uploader: <span className="text-slate-900 dark:text-white">{scanResult.uploadHoneytoken.uploader?.name || 'Unknown'}</span>
                      {scanResult.uploadHoneytoken.uploader?.email && <span className="text-slate-500"> ({scanResult.uploadHoneytoken.uploader.email})</span>}
                    </p>
                  </div>
                )}

                {!scanResult.found && (
                  <div className={`${PANEL} px-5 py-8 text-center`}>
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">No Markers Detected</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{scanResult.message || 'Document may have been sanitized or is not from this system.'}</p>
                  </div>
                )}

                {scanHistory.length > 0 && (
                  <section className={`${PANEL} overflow-hidden`}>
                    <header className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">All Watermarked Downloads for This Document</h3>
                    </header>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800/40">
                          <tr>
                            <th className={TH}>User</th>
                            <th className={TH}>Email</th>
                            <th className={TH}>Downloaded At</th>
                            <th className={TH}>IP Address</th>
                            <th className={TH}>Watermark ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {scanHistory.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{record.user}</td>
                              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{record.email || 'N/A'}</td>
                              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{formatScanDate(record.downloadedAt)}</td>
                              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 font-mono">{record.ipAddress || 'N/A'}</td>
                              <td className="px-4 py-3">
                                <code className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                                  {record.watermarkId?.substring(0, 8)}...
                                </code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </motion.div>
            )}

            {!scanResult && (
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">How Watermark Scanning Works</h3>
                <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                  {[
                    { title: "Upload Document", desc: "Upload the suspected leaked document" },
                    { title: "Extract Text", desc: "System extracts text content from the file" },
                    { title: "Detect Watermarks", desc: "Scans for invisible Unicode character patterns" },
                    { title: "Identify Leaker", desc: "Decodes watermark to identify the downloader" },
                  ].map((item, i) => (
                    <li key={item.title}>
                      <p className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums mb-1">{String(i + 1).padStart(2, "0")}</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white mb-0.5">{item.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
