import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useDebounce } from "@/hooks/useDebounce";
import useAuthStore from "@/app/store/auth.store";
import dashboardService from "@/services/dashboard.service";
import { useLang } from "@/app/providers/LanguageProvider";

const Icons = {
  document: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  task: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  folder: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  storage: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  ),
  upload: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  verify: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  ai: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  osint: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  clock: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  activity: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
};

const ActivityIcons = {
  create: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  upload: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  update: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  delete: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  download: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  share: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  ),
  verify: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  restore: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  archive: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
  read: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
};

const ACTIVITY_ICON_STYLES = {
  create: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  upload: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  update: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  delete: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  download: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  share: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  verify: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  restore: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  archive: 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400',
  read: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
};

function timeAgo(dateStr, t) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return t("dashboard.time.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${t("dashboard.time.minutesAgoSuffix")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t("dashboard.time.hoursAgoSuffix")}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}${t("dashboard.time.daysAgoSuffix")}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(dateStr, t) {
  if (!dateStr) return null;
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: `${Math.abs(diff)}${t("dashboard.time.overdueSuffix")}`, overdue: true };
  if (diff === 0) return { text: t("dashboard.time.today"), urgent: true };
  if (diff === 1) return { text: t("dashboard.time.tomorrow"), urgent: true };
  return { text: `${diff}${t("dashboard.time.leftSuffix")}`, overdue: false };
}

const TYPE_COLORS = {
  PDF: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', hex: '#ef4444' },
  DOCX: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500', hex: '#3b82f6' },
  DOC: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500', hex: '#3b82f6' },
  XLSX: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', hex: '#10b981' },
  XLS: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', hex: '#10b981' },
  PPTX: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500', hex: '#f97316' },
  CSV: { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400', bar: 'bg-teal-500', hex: '#14b8a6' },
  TXT: { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', bar: 'bg-slate-500', hex: '#64748b' },
};
const DEFAULT_TYPE_COLOR = { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', bar: 'bg-slate-400', hex: '#94a3b8' };

const PRIORITY_STYLES = {
  urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  low: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

function DonutChart({ data, size = 140 }) {
  const { t } = useLang();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const radius = size / 2;
  const strokeWidth = 22;
  const innerRadius = radius - strokeWidth / 2 - 4;
  const circumference = 2 * Math.PI * innerRadius;
  const gapAngle = data.length > 1 ? 3 : 0;
  const totalGap = gapAngle * data.length;
  const availableDegrees = 360 - totalGap;

  const segAngles = data.map((d) => (d.value / total) * availableDegrees);
  const arcs = data.map((d, i) => {
    const segmentAngle = segAngles[i];
    const segmentLength = (segmentAngle / 360) * circumference;
    const dashoffset = circumference - segmentLength;

    const rotation = -90 + segAngles.slice(0, i).reduce((a, b) => a + b, 0) + gapAngle * i;
    return { ...d, dashoffset, rotation, segmentLength, percent: (d.value / total * 100).toFixed(0) };
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={radius} cy={radius} r={innerRadius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-slate-100 dark:text-slate-800/60"
        />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={radius} cy={radius} r={innerRadius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.segmentLength} ${circumference - arc.segmentLength}`}
            strokeLinecap="butt"
            transform={`rotate(${arc.rotation} ${radius} ${radius})`}
            className="transition-all duration-1000"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
          />
        ))}
        <circle
          cx={radius} cy={radius} r={innerRadius - strokeWidth / 2 - 1}
          className="fill-white dark:fill-slate-900"
        />
        <circle
          cx={radius} cy={radius} r={innerRadius - strokeWidth / 2 - 1}
          className="fill-slate-50/50 dark:fill-slate-800/30"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">{total}</span>
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider">{t("dashboard.donut.total")}</span>
      </div>
    </div>
  );
}

function TaskBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const barColors = {
    'bg-amber-500': { bar: 'from-amber-400 to-amber-500', glow: 'bg-amber-500/20' },
    'bg-blue-500': { bar: 'from-blue-400 to-blue-500', glow: 'bg-blue-500/20' },
    'bg-emerald-500': { bar: 'from-emerald-400 to-emerald-500', glow: 'bg-emerald-500/20' },
    'bg-red-500': { bar: 'from-red-400 to-red-500', glow: 'bg-red-500/20' },
  };

  return (
    <div className="space-y-4">
      {total > 0 && (
        <div className="flex items-center gap-0.5 h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800/60">
          {data.filter(d => d.value > 0).map((bar, i) => {
            const pct = (bar.value / total) * 100;
            const colors = barColors[bar.color] || { bar: 'from-slate-400 to-slate-500' };
            return (
              <motion.div
                key={i}
                className={`h-full bg-linear-to-r ${colors.bar}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: "easeOut" }}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {data.map((bar, i) => {
          const pct = max > 0 ? (bar.value / max) * 100 : 0;
          const colors = barColors[bar.color] || { bar: 'from-slate-400 to-slate-500', glow: 'bg-slate-500/20' };
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
              className="relative"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{bar.label}</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{bar.value}</span>
              </div>
              <div className="relative h-2 rounded-full bg-slate-100 dark:bg-slate-800/60 overflow-hidden">
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full bg-linear-to-r ${colors.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, bar.value > 0 ? 8 : 0)}%` }}
                  transition={{ duration: 0.8, delay: 0.4 + i * 0.1, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg ${className}`} />;
}

function StatSkeleton() {
  return (
    <Card className="p-4 sm:p-5" animate={false}>
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="w-12 h-5 rounded-full" />
      </div>
      <Skeleton className="w-20 h-7 mb-2" />
      <Skeleton className="w-28 h-4" />
    </Card>
  );
}

export default function Dashboard() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const isAdmin = ['owner', 'admin'].includes(user?.role);
  const isOwner = user?.role === 'owner';
  const firstName = user?.firstName || user?.email?.split('@')[0] || 'User';

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await dashboardService.getStats();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(t("dashboard.errorState.fetch"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const stats = useMemo(() => {
    if (!data?.stats) return [];
    const s = data.stats;
    const items = [
      {
        label: t("dashboard.stats.documents"),
        value: s.totalDocuments,
        sub: `${s.totalFolders} ${t("dashboard.stats.foldersSuffix")}`,
        icon: Icons.document,
        color: 'from-blue-500 to-indigo-500',
        iconBg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      },
      {
        label: t("dashboard.stats.tasks"),
        value: s.totalTasks,
        sub: `${s.pendingTasks} ${t("dashboard.stats.pendingSuffix")}`,
        icon: Icons.task,
        color: 'from-emerald-500 to-teal-500',
        iconBg: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
        alert: s.overdueTasks > 0 ? `${s.overdueTasks} ${t("dashboard.stats.overdueSuffix")}` : null,
      },
      {
        label: t("dashboard.stats.storage"),
        value: s.totalStorage,
        sub: `${s.totalDocuments} ${t("dashboard.stats.filesSuffix")}`,
        icon: Icons.storage,
        color: 'from-purple-500 to-pink-500',
        iconBg: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      },
      {
        label: t("dashboard.stats.forms"),
        value: s.totalFormInstances,
        sub: `${s.totalTemplates} ${t("dashboard.stats.templatesSuffix")}`,
        icon: Icons.folder,
        color: 'from-amber-500 to-orange-500',
        iconBg: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      },
    ];

    if (isAdmin) {
      items[2] = { ...items[2], sub: `${s.totalUsers} ${t("dashboard.stats.activeUsersSuffix")}` };
    }

    return items;
  }, [data, isAdmin, t]);

  const taskChartData = useMemo(() => {
    if (!data?.stats) return [];
    const s = data.stats;
    return [
      { label: t("dashboard.taskChart.pending"), value: s.pendingTasks, color: 'bg-amber-500' },
      { label: t("dashboard.taskChart.inProgress"), value: s.inProgressTasks, color: 'bg-blue-500' },
      { label: t("dashboard.taskChart.completed"), value: s.completedTasks, color: 'bg-emerald-500' },
      { label: t("dashboard.taskChart.overdue"), value: s.overdueTasks, color: 'bg-red-500' },
    ];
  }, [data, t]);

  const donutData = useMemo(() => {
    if (!data?.documentTypes) return [];
    return data.documentTypes.map(dt => ({
      label: dt.type,
      value: dt.count,
      color: (TYPE_COLORS[dt.type] || DEFAULT_TYPE_COLOR).hex,
    }));
  }, [data]);

  const filteredDocs = useMemo(() => {
    if (!data?.recentDocuments) return [];
    if (!debouncedSearch) return data.recentDocuments;
    const q = debouncedSearch.toLowerCase();
    return data.recentDocuments.filter(d =>
      d.name.toLowerCase().includes(q) || d.uploadedBy.toLowerCase().includes(q)
    );
  }, [data, debouncedSearch]);

  const quickActions = [
    { name: t("dashboard.quickActions.upload.name"), desc: t("dashboard.quickActions.upload.desc"), icon: Icons.upload, href: "/documents", color: "from-blue-500 to-indigo-600" },
    isOwner
      ? { name: t("dashboard.quickActions.verify.name"), desc: t("dashboard.quickActions.verify.desc"), icon: Icons.verify, href: "/verification", color: "from-emerald-500 to-teal-600" }
      : { name: t("dashboard.quickActions.tasks.name"), desc: t("dashboard.quickActions.tasks.desc"), icon: Icons.task, href: "/tasks", color: "from-emerald-500 to-teal-600" },
    { name: t("dashboard.quickActions.ai.name"), desc: t("dashboard.quickActions.ai.desc"), icon: Icons.ai, href: "/ai-analysis", color: "from-violet-500 to-purple-600" },
    isOwner
      ? { name: t("dashboard.quickActions.osint.name"), desc: t("dashboard.quickActions.osint.desc"), icon: Icons.osint, href: "/osint-tracker", color: "from-amber-500 to-orange-600" }
      : { name: t("dashboard.quickActions.forms.name"), desc: t("dashboard.quickActions.forms.desc"), icon: Icons.folder, href: "/forms", color: "from-amber-500 to-orange-600" },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="mb-6">
          <Skeleton className="w-48 h-7 mb-2" />
          <Skeleton className="w-64 h-4" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[...Array(4)].map((_, i) => <StatSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("dashboard.errorState.title")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <Button onClick={fetchDashboard}>{t("dashboard.errorState.tryAgain")}</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mb-6"
      >
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-accent-wash blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -left-16 w-64 h-64 rounded-full bg-linear-to-tr from-blue-500/10 to-transparent blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between gap-4 p-5 sm:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {t("dashboard.header.welcome")}{' '}
              <span className="bg-accent-gradient bg-clip-text text-transparent">{firstName}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              {t("dashboard.header.subtitle")}
            </p>
          </div>
          <button
            onClick={fetchDashboard}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            title={t("dashboard.header.refresh")}
          >
            {Icons.refresh}
            <span className="hidden sm:inline">{t("dashboard.header.refresh")}</span>
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
          >
            <Card className="p-4 sm:p-5 relative overflow-hidden group" hover>
              <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-linear-to-br ${stat.color} opacity-[0.08] group-hover:opacity-[0.16] blur-2xl transition-opacity duration-300 pointer-events-none`} />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${stat.iconBg} ring-1 ring-inset ring-black/5 dark:ring-white/10 flex items-center justify-center`}>
                    {stat.icon}
                  </div>
                  {stat.alert && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-1">
                      {Icons.warning}
                      {stat.alert}
                    </span>
                  )}
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{stat.sub}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {quickActions.map((action, i) => (
          <motion.button
            key={action.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05, duration: 0.4 }}
            onClick={() => navigate(action.href)}
            className="group relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-5 text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
          >
            <div className={`absolute inset-0 bg-linear-to-br ${action.color} opacity-0 group-hover:opacity-[0.07] transition-opacity duration-300`} />
            <div className={`absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-r ${action.color} scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300`} />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-linear-to-br ${action.color} flex items-center justify-center text-white shadow-sm`}>
                  {action.icon}
                </div>
                <svg
                  className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-0.5">{action.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{action.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Card className="p-4 sm:p-5 h-full" animate={false}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("dashboard.taskOverview.title")}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{data?.stats?.totalTasks || 0} {t("dashboard.taskOverview.totalTasksSuffix")}</p>
              </div>
              <Link to="/tasks">
                <Button variant="ghost" size="sm">{t("dashboard.taskOverview.viewAll")}</Button>
              </Link>
            </div>
            {data?.stats?.totalTasks > 0 ? (
              <TaskBarChart data={taskChartData} />
            ) : (
              <div className="flex items-center justify-center h-36 text-sm text-slate-400 dark:text-slate-500">
                {t("dashboard.taskOverview.empty")}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <Card className="p-4 sm:p-5 h-full" animate={false}>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-5">{t("dashboard.documentBreakdown.title")}</h2>
            {donutData.length > 0 ? (
              <div className="flex items-center gap-8">
                <DonutChart data={donutData} size={140} />
                <div className="flex-1 space-y-3">
                  {donutData.map((d) => {
                    const total = donutData.reduce((sum, x) => sum + x.value, 0);
                    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                    return (
                      <div key={d.label} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-sm ring-1 ring-black/5 dark:ring-white/10 shadow-sm" style={{ backgroundColor: d.color }} />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{d.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">{pct}%</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums min-w-[1.5rem] text-right">{d.value}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-36 text-sm text-slate-400 dark:text-slate-500">
                {t("dashboard.documentBreakdown.empty")}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {(data?.storageBreakdown?.length > 0 || data?.aiQuota) && (
        <div className={`grid grid-cols-1 gap-5 mb-6 ${data?.storageBreakdown?.length > 0 && data?.aiQuota ? 'lg:grid-cols-2' : ''}`}>
          
          {data?.storageBreakdown?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.4 }}
            >
              <Card className="p-4 sm:p-5 h-full" animate={false}>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">{t("dashboard.storageBreakdown.title")}</h2>
                <div className="space-y-3">
                  {data.storageBreakdown.map((item) => {
                    const maxBytes = data.storageBreakdown[0]?.bytes || 1;
                    const pct = Math.max(5, Math.round((item.bytes / maxBytes) * 100));
                    const colors = TYPE_COLORS[item.type] || DEFAULT_TYPE_COLOR;
                    return (
                      <div key={item.type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${colors.text}`}>{item.type}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{item.size}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full ${colors.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {data?.aiQuota && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <Card className="p-4 sm:p-5 h-full" animate={false}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      {Icons.ai}
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("dashboard.aiQuota.title")}</h2>
                      {data.aiQuota.periodEnd && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          {t("dashboard.aiQuota.resets")} {new Date(data.aiQuota.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  {(data.aiQuota.analysesUsed / data.aiQuota.analysesLimit > 0.7 || data.aiQuota.pagesUsed / data.aiQuota.pagesLimit > 0.7) && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium">
                      {t("dashboard.aiQuota.highUsage")}
                    </span>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("dashboard.aiQuota.analysesThisMonth")}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{data.aiQuota.analysesUsed}/{data.aiQuota.analysesLimit}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          data.aiQuota.analysesUsed / data.aiQuota.analysesLimit > 0.9
                            ? 'bg-red-500' : data.aiQuota.analysesUsed / data.aiQuota.analysesLimit > 0.7
                            ? 'bg-amber-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.min(100, (data.aiQuota.analysesUsed / data.aiQuota.analysesLimit) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("dashboard.aiQuota.pagesProcessed")}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{data.aiQuota.pagesUsed}/{data.aiQuota.pagesLimit}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          data.aiQuota.pagesUsed / data.aiQuota.pagesLimit > 0.9
                            ? 'bg-red-500' : data.aiQuota.pagesUsed / data.aiQuota.pagesLimit > 0.7
                            ? 'bg-amber-500' : 'bg-violet-500'
                        }`}
                        style={{ width: `${Math.min(100, (data.aiQuota.pagesUsed / data.aiQuota.pagesLimit) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{t("dashboard.aiQuota.lifetime")}: {data.aiQuota.totalAnalysesAllTime ?? 0} {t("dashboard.aiQuota.analysesWord")}</span>
                    <Link to="/ai-analysis" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                      {t("dashboard.aiQuota.open")}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <Card className="overflow-hidden" animate={false}>
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {t("dashboard.urgentTasks.title")}
                {data?.stats?.overdueTasks > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-1">
                    {Icons.warning}
                    {data.stats.overdueTasks} {t("dashboard.urgentTasks.overdueSuffix")}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("dashboard.urgentTasks.sortedByUrgency")} &middot; {data?.stats?.pendingTasks || 0} {t("dashboard.urgentTasks.pendingWord")} &middot; {data?.stats?.inProgressTasks || 0} {t("dashboard.urgentTasks.inProgressWord")}
              </p>
            </div>
            <Link to="/tasks">
              <Button variant="ghost" size="sm">{t("dashboard.urgentTasks.viewAll")}</Button>
            </Link>
          </div>

          {data?.upcomingTasks?.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.upcomingTasks.map((task) => {
                const deadline = daysUntil(task.dueDate, t);
                return (
                  <Link
                    key={task.id}
                    to="/tasks"
                    className="flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      task.priority === 'urgent' ? 'bg-red-500 animate-pulse' :
                      task.priority === 'high' ? 'bg-orange-500' :
                      task.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>
                          {task.priority}
                        </span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          task.status === 'in_progress'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {task.status === 'in_progress' ? t("dashboard.urgentTasks.statusInProgress") : task.status === 'pending' ? t("dashboard.urgentTasks.statusPending") : task.status}
                        </span>
                        {task.taskType !== 'general' && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">{task.taskType}</span>
                        )}
                        {task.assignee && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">&rarr; {task.assignee}</span>
                        )}
                      </div>
                    </div>
                    {deadline && (
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 ${
                        deadline.overdue
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                          : deadline.urgent
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {Icons.clock}
                        {deadline.text}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("dashboard.urgentTasks.allCaughtUp")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("dashboard.urgentTasks.noPending")}</p>
            </div>
          )}
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <Card className="overflow-hidden" animate={false}>
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("dashboard.recentDocs.title")}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("dashboard.recentDocs.subtitle")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:flex-none">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">{Icons.search}</div>
                    <input
                      type="text"
                      placeholder={t("dashboard.recentDocs.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent w-full sm:w-44"
                    />
                  </div>
                  <Link to="/documents">
                    <Button variant="ghost" size="sm">{t("dashboard.recentDocs.viewAll")}</Button>
                  </Link>
                </div>
              </div>
            </div>

            {filteredDocs.length > 0 ? (
              <>
                
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/40">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("dashboard.recentDocs.colDocument")}</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("common.type")}</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("common.size")}</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("dashboard.recentDocs.colUploadedBy")}</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("common.status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredDocs.map((doc) => {
                        const typeColor = TYPE_COLORS[doc.type] || DEFAULT_TYPE_COLOR;
                        return (
                          <tr key={doc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg ${typeColor.bg} flex items-center justify-center`}>
                                  <span className={`text-xs font-bold ${typeColor.text}`}>{doc.type?.charAt(0)}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-50">{doc.name}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">{timeAgo(doc.createdAt, t)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${typeColor.bg} ${typeColor.text}`}>{doc.type}</span>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400 tabular-nums">{doc.size}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">{doc.uploadedBy}</td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                                doc.status === 'active'
                                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                  : doc.status === 'archived'
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                  : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  doc.status === 'active' ? 'bg-emerald-500' : doc.status === 'archived' ? 'bg-slate-400' : 'bg-amber-500'
                                }`} />
                                {doc.status === 'active' ? t("dashboard.recentDocs.statusActive") : doc.status?.charAt(0).toUpperCase() + doc.status?.slice(1)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDocs.map((doc) => {
                    const typeColor = TYPE_COLORS[doc.type] || DEFAULT_TYPE_COLOR;
                    return (
                      <div key={doc.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg ${typeColor.bg} flex items-center justify-center shrink-0`}>
                            <span className={`text-xs font-bold ${typeColor.text}`}>{doc.type?.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{doc.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{doc.uploadedBy} &middot; {timeAgo(doc.createdAt, t)}</p>
                          </div>
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${typeColor.bg} ${typeColor.text} shrink-0`}>{doc.type}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 ml-12">
                          <span className="text-xs text-slate-400 dark:text-slate-500">{doc.size}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            doc.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${doc.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {doc.status === 'active' ? t("dashboard.recentDocs.statusActive") : doc.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                {searchQuery ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t("dashboard.recentDocs.noMatchPrefix")} &quot;{searchQuery}&quot;</p>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("dashboard.recentDocs.emptyTitle")}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t("dashboard.recentDocs.emptySubtitle")}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Card className="h-full overflow-hidden" animate={false}>
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {Icons.activity}
                {t("dashboard.activity.title")}
              </h2>
            </div>

            {data?.recentActivity?.length > 0 ? (
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {data.recentActivity.map((activity) => {
                  const iconStyle = ACTIVITY_ICON_STYLES[activity.action] || ACTIVITY_ICON_STYLES.read;
                  const icon = ActivityIcons[activity.action] || ActivityIcons.read;
                  return (
                    <div key={activity.id} className="px-4 sm:px-5 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconStyle}`}>
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{activity.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{activity.user}</span>
                            <span className="text-xs text-slate-300 dark:text-slate-600">&middot;</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">{timeAgo(activity.createdAt, t)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("dashboard.activity.emptyTitle")}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t("dashboard.activity.emptySubtitle")}</p>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
