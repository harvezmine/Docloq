import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Upload, Pencil, Download, Share2, Archive, RotateCcw, Trash2,
  KeyRound, Sparkles, FolderPlus, MessageSquare, Activity as ActivityIcon,
  ShieldCheck, ShieldAlert, Link2, RefreshCw, ExternalLink, Type, FileText,
  FileClock, UserPlus, Building2, MessagesSquare,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import CustomSelect from "@/components/ui/CustomSelect";
import { useLang } from "@/app/providers/LanguageProvider";
import activityService from "@/services/activity.service";

// category → { icon, tint classes, verb {id,en} }
const CATEGORY = {
  upload:        { icon: Upload,        cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400",       verb: { id: "mengunggah", en: "uploaded" } },
  edit:          { icon: Pencil,        cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", verb: { id: "mengedit", en: "edited" } },
  rename:        { icon: Type,          cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", verb: { id: "mengganti nama", en: "renamed" } },
  download:      { icon: Download,      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", verb: { id: "mengunduh", en: "downloaded" } },
  share:         { icon: Share2,        cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400", verb: { id: "membagikan", en: "shared" } },
  archive:       { icon: Archive,       cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",    verb: { id: "mengarsipkan", en: "archived" } },
  restore:       { icon: RotateCcw,     cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",    verb: { id: "memulihkan", en: "restored" } },
  delete:        { icon: Trash2,        cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400",       verb: { id: "menghapus", en: "deleted" } },
  ai_access:     { icon: KeyRound,      cls: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",       verb: { id: "mengubah akses AI untuk", en: "changed AI access for" } },
  ai_analyze:    { icon: Sparkles,      cls: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",       verb: { id: "menganalisis dengan AI", en: "analyzed with AI" } },
  folder_create: { icon: FolderPlus,    cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300",    verb: { id: "membuat folder", en: "created a folder" } },
  chatbot:       { icon: MessageSquare, cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300",    verb: { id: "menggunakan asisten AI", en: "used the AI assistant" } },
  version:       { icon: FileClock,     cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", verb: { id: "menyimpan versi dokumen baru", en: "saved a new document version" } },
  ai_chat_receipt:   { icon: ShieldCheck, cls: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",     verb: { id: "mencatat bukti jawaban chat AI", en: "logged proof of an AI chat answer" } },
  ai_output_receipt: { icon: ShieldCheck, cls: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",     verb: { id: "mencatat bukti hasil Studio AI", en: "logged proof of an AI Studio output" } },
  ai_project_share:  { icon: MessagesSquare, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400", verb: { id: "membagikan project AI", en: "shared an AI project" } },
  org_create:    { icon: Building2,     cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300",    verb: { id: "membuat organisasi", en: "created the organization" } },
  user_create:   { icon: UserPlus,      cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400",       verb: { id: "menambahkan pengguna", en: "added a user" } },
  create:        { icon: ActivityIcon,  cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300",    verb: { id: "membuat entri baru", en: "created a new entry" } },
  update:        { icon: Pencil,        cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300",    verb: { id: "memperbarui", en: "updated" } },
  read:          { icon: FileText,      cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300",    verb: { id: "mengakses", en: "accessed" } },
  other:         { icon: ActivityIcon,  cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300",    verb: { id: "melakukan aksi pada", en: "acted on" } },
};

// Filter dropdown values map 1:1 to the backend's indexed audit_action column.
const ACTION_FILTERS = [
  { value: "all",      label: { id: "Semua aktivitas", en: "All activity" } },
  { value: "create",   label: { id: "Dibuat / Diunggah", en: "Created / Uploaded" } },
  { value: "update",   label: { id: "Diedit / Diubah", en: "Edited / Updated" } },
  { value: "download", label: { id: "Diunduh", en: "Downloaded" } },
  { value: "share",    label: { id: "Dibagikan", en: "Shared" } },
  { value: "archive",  label: { id: "Diarsipkan", en: "Archived" } },
  { value: "restore",  label: { id: "Dipulihkan", en: "Restored" } },
  { value: "delete",   label: { id: "Dihapus", en: "Deleted" } },
  { value: "read",     label: { id: "Diakses / AI", en: "Accessed / AI" } },
];

function relativeTime(iso, lang) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const id = lang !== "en";
  if (s < 45) return id ? "baru saja" : "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return id ? `${m} menit lalu` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return id ? `${h} jam lalu` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return id ? `${d} hari lalu` : `${d}d ago`;
  return new Date(iso).toLocaleDateString(id ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" });
}

function StatCard({ icon, iconCls, label, value, sub, tone = "slate" }) {
  const Icon = icon; // aliased in body: repo eslint has no react plugin, JSX-only params flag no-unused-vars
  const toneBorder = tone === "emerald"
    ? "border-emerald-200 dark:border-emerald-500/30"
    : tone === "rose"
    ? "border-rose-200 dark:border-rose-500/30"
    : "border-slate-200 dark:border-slate-800";
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${toneBorder} bg-white dark:bg-slate-900 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${iconCls}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function Activity() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [integrity, setIntegrity] = useState(null);
  const [chain, setChain] = useState(null);

  const loadMeta = useCallback(async () => {
    try {
      const [ig, bc] = await Promise.all([
        activityService.getIntegrity(),
        activityService.getBlockchain(),
      ]);
      if (ig?.success) setIntegrity(ig.data);
      if (bc?.success) setChain(bc.data);
    } catch {
      /* meta is best-effort; feed still renders */
    }
  }, []);

  const loadFeed = useCallback(async (nextPage, replace) => {
    if (nextPage === 1) setLoading(true); else setLoadingMore(true);
    setError("");
    try {
      const res = await activityService.getFeed({ action, from, to, page: nextPage, pageSize: 25 });
      if (res?.success) {
        setItems((prev) => (replace ? res.data.items : [...prev, ...res.data.items]));
        setTotal(res.data.total);
        setHasMore(res.data.hasMore);
        setPage(nextPage);
      }
    } catch {
      setError(t({ id: "Gagal memuat aktivitas.", en: "Failed to load activity." }));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [action, from, to, t]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  // Reload the feed whenever a filter changes (reset to page 1).
  useEffect(() => { loadFeed(1, true); }, [loadFeed]);

  const chainIntact = integrity?.intact;
  const coverage = chain?.coverage ?? 0;
  const anchoredDocs = chain?.anchoredDocuments ?? 0;

  const actionOptions = useMemo(
    () => ACTION_FILTERS.map((o) => ({ value: o.value, label: t(o.label) })),
    [t]
  );

  const refresh = () => { loadMeta(); loadFeed(1, true); };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <PageHeader
          eyebrow={t({ id: "Log Organisasi", en: "Organization Logs" })}
          title={t({ id: "Aktivitas", en: "Activity" })}
          subtitle={t({
            id: "Catatan lengkap siapa melakukan apa di organisasi Anda — anti-manipulasi dengan rantai hash dan jangkar blockchain.",
            en: "A complete record of who did what in your organization — tamper-evident via hash chaining and blockchain anchoring.",
          })}
          actions={
            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {t({ id: "Segarkan", en: "Refresh" })}
            </button>
          }
        />

        {/* Stat row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={ActivityIcon}
            iconCls="bg-accent-soft text-accent"
            label={t({ id: "Total aktivitas", en: "Total activity" })}
            value={total.toLocaleString(lang === "en" ? "en-US" : "id-ID")}
            sub={t({ id: "tercatat untuk organisasi ini", en: "recorded for this organization" })}
          />
          <StatCard
            icon={chainIntact === false ? ShieldAlert : ShieldCheck}
            iconCls={chainIntact === false ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}
            tone={chainIntact === false ? "rose" : "emerald"}
            label={t({ id: "Integritas rantai", en: "Chain integrity" })}
            value={integrity == null
              ? "—"
              : chainIntact
              ? t({ id: "Utuh", en: "Intact" })
              : t({ id: "Terganggu", en: "Broken" })}
            sub={integrity == null
              ? t({ id: "memeriksa…", en: "checking…" })
              : chainIntact
              ? t({ id: `${integrity.count} entri terverifikasi`, en: `${integrity.count} entries verified` })
              : integrity.brokenAtSeq != null
              ? t({ id: `putus di #${integrity.brokenAtSeq}`, en: `broken at #${integrity.brokenAtSeq}` })
              : t({ id: "gagal verifikasi", en: "verification failed" })}
          />
          <StatCard
            icon={Link2}
            iconCls="bg-cyan-500/10 text-cyan-500"
            label={t({ id: "Terjangkar di blockchain", en: "Anchored on blockchain" })}
            value={`${coverage}%`}
            sub={t({ id: `${anchoredDocs} dokumen di Polygon`, en: `${anchoredDocs} documents on Polygon` })}
          />
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-5">
          <div className="w-full sm:w-64">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {t({ id: "Jenis aktivitas", en: "Activity type" })}
            </label>
            <CustomSelect value={action} onChange={setAction} options={actionOptions} variant="app" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {t({ id: "Dari tanggal", en: "From date" })}
            </label>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.04] px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {t({ id: "Sampai tanggal", en: "To date" })}
            </label>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.04] px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
          {(from || to || action !== "all") && (
            <button
              onClick={() => { setAction("all"); setFrom(""); setTo(""); }}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline underline-offset-2 sm:mb-2"
            >
              {t({ id: "Reset filter", en: "Reset filters" })}
            </button>
          )}
        </div>

        {/* Feed */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3 w-1/4 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center">
              <p className="text-sm text-rose-500">{error}</p>
              <button onClick={refresh} className="mt-3 text-sm text-accent hover:underline">
                {t({ id: "Coba lagi", en: "Try again" })}
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-14 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <ActivityIcon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                {t({ id: "Belum ada aktivitas", en: "No activity yet" })}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t({ id: "Aktivitas akan muncul di sini saat dokumen diunggah, diedit, atau diunduh.", en: "Activity appears here as documents are uploaded, edited, or downloaded." })}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((it, idx) => {
                const meta = CATEGORY[it.category] || CATEGORY.other;
                const Icon = meta.icon;
                return (
                  <motion.li
                    key={it.id}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.2, delay: Math.min(idx, 8) * 0.02 }}
                    className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${meta.cls}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                        <span className="font-semibold text-slate-900 dark:text-white">{it.actorName}</span>
                        {" "}
                        {t(meta.verb)}
                        {it.resourceName && (
                          <>
                            {" "}
                            {it.resourceExists ? (
                              <button
                                onClick={() => navigate("/documents")}
                                className="font-medium text-accent hover:underline break-all"
                                title={t({ id: "Buka di Dokumen", en: "Open in Documents" })}
                              >
                                “{it.resourceName}”
                              </button>
                            ) : (
                              <span className="font-medium text-slate-500 dark:text-slate-400 break-all">“{it.resourceName}”</span>
                            )}
                          </>
                        )}
                      </p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400 dark:text-slate-500">{relativeTime(it.createdAt, lang)}</span>
                        {it.onChain && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 text-[10px] font-semibold">
                            <Link2 className="w-3 h-3" />
                            {t({ id: "di blockchain", en: "on-chain" })}
                          </span>
                        )}
                        {typeof it.sequenceNumber === "number" && (
                          <span className="text-[10px] font-mono text-slate-300 dark:text-slate-600">#{it.sequenceNumber}</span>
                        )}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}

          {!loading && !error && hasMore && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => loadFeed(page + 1, false)}
                disabled={loadingMore}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
              >
                {loadingMore ? t({ id: "Memuat…", en: "Loading…" }) : t({ id: "Muat lebih banyak", en: "Load more" })}
              </button>
            </div>
          )}
        </div>

        {/* Blockchain trail */}
        {chain?.recentAnchors?.length > 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <Link2 className="w-4 h-4 text-cyan-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t({ id: "Jejak Blockchain", en: "Blockchain Trail" })}
              </h2>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {t({ id: "jangkar dokumen terbaru di Polygon", en: "recent document anchors on Polygon" })}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-5 py-2.5 font-medium">{t({ id: "Dokumen", en: "Document" })}</th>
                    <th className="px-5 py-2.5 font-medium">{t({ id: "Blok", en: "Block" })}</th>
                    <th className="px-5 py-2.5 font-medium">{t({ id: "Status", en: "Status" })}</th>
                    <th className="px-5 py-2.5 font-medium">{t({ id: "Transaksi", en: "Transaction" })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {chain.recentAnchors.map((a) => (
                    <tr key={a.id} className="text-slate-700 dark:text-slate-200">
                      <td className="px-5 py-3 max-w-[220px] truncate">{a.docName || "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {a.blockNumber ? `#${a.blockNumber}` : t({ id: "pending", en: "pending" })}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          a.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}>
                          {a.status === "confirmed" ? t({ id: "terkonfirmasi", en: "confirmed" }) : t({ id: "menunggu", en: "pending" })}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {a.explorerUrl ? (
                          <a
                            href={a.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
                          >
                            {a.txHash ? `${a.txHash.slice(0, 10)}…` : t({ id: "lihat", en: "view" })}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
