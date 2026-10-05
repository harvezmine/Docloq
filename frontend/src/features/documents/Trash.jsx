import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import trashService from "@/services/trash.service";
import { useLang } from "@/app/providers/LanguageProvider";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + "d ago";
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks + "w ago";
  return new Date(dateStr).toLocaleDateString();
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return d > 0 ? d : 0;
}

const IconRestore = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconSearch = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IconDoc = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconTemplate = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const TYPE_COLORS = {
  document: { bg: "bg-blue-100 dark:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
  template: { bg: "bg-violet-100 dark:bg-violet-500/20", text: "text-violet-600 dark:text-violet-400" },
};
const EXT_COLORS = {
  pdf: "from-red-500 to-rose-600",
  docx: "from-blue-500 to-blue-600",
  doc: "from-blue-500 to-blue-600",
  xlsx: "from-emerald-500 to-emerald-600",
  xls: "from-emerald-500 to-emerald-600",
  pptx: "from-orange-500 to-orange-600",
  ppt: "from-orange-500 to-orange-600",
};

const Checkbox = ({ checked, onChange, className = "" }) => (
  <button
    type="button"
    onClick={onChange}
    className={
      "w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 " +
      (checked
        ? "bg-indigo-500 border-indigo-500 dark:bg-indigo-400 dark:border-indigo-400"
        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-indigo-400") +
      " " +
      className
    }
  >
    {checked && (
      <svg className="w-3 h-3 text-white dark:text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )}
  </button>
);

function getItemName(item, t) {
  if (item.itemType === "template") return item.itemMetadata?.title || item.originalPath || t("trash.fallbackTemplate");
  return item.itemMetadata?.originalFilename || item.originalPath || t("trash.fallbackDocument");
}
function getItemSize(item) {
  return item.itemMetadata?.fileSize ? formatBytes(item.itemMetadata.fileSize) : "\u2014";
}
function getItemGradient(item) {
  if (item.itemType === "template") return "from-violet-500 to-violet-600";
  const name = item.itemMetadata?.originalFilename || "";
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  return EXT_COLORS[ext] || "from-slate-500 to-slate-600";
}

export default function Trash() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | document | template
  const [actionModal, setActionModal] = useState({ show: false, type: null, item: null, bulk: false });
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchTrash = useCallback(async () => {
    try {
      setLoading(true);
      const res = await trashService.list();
      if (res.success) setItems(res.data || []);
    } catch (err) {
      console.error("Fetch trash error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = items.filter((item) => {
    if (filter !== "all" && item.itemType !== filter) return false;
    return getItemName(item, t).toLowerCase().includes(search.toLowerCase());
  });

  const docCount = items.filter((i) => i.itemType === "document").length;
  const templateCount = items.filter((i) => i.itemType === "template").length;
  const expiringSoon = items.filter((i) => {
    const d = daysUntil(i.autoDeleteAt);
    return d !== null && d <= 7;
  }).length;
  const totalBytes = items.reduce((a, i) => a + (i.itemMetadata?.fileSize || 0), 0);

  const toggleSelect = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((i) => i.id));

  const openRestoreModal = (item) => setActionModal({ show: true, type: "restore", item, bulk: false });
  const openDeleteModal = (item) => setActionModal({ show: true, type: "delete", item, bulk: false });
  const openBulkRestore = () => setActionModal({ show: true, type: "restore", item: null, bulk: true });
  const openBulkDelete = () => setActionModal({ show: true, type: "delete", item: null, bulk: true });
  const openEmptyTrash = () => setActionModal({ show: true, type: "empty", item: null, bulk: false });
  const closeModal = () => {
    setActionModal({ show: false, type: null, item: null, bulk: false });
    setActionLoading(false);
  };

  const confirmAction = async () => {
    setActionLoading(true);
    try {
      const { type, item, bulk } = actionModal;

      if (type === "empty") {
        await trashService.emptyTrash();
        showToast(t("trash.toastTrashEmptied"));
      } else if (bulk) {
        for (const id of selectedIds) {
          if (type === "restore") await trashService.restore(id);
          else await trashService.permanentDelete(id);
        }
        showToast(
          type === "restore"
            ? selectedIds.length + " " + t("trash.toastItemsRestored")
            : selectedIds.length + " " + t("trash.toastItemsDeleted")
        );
        setSelectedIds([]);
      } else if (item) {
        if (type === "restore") await trashService.restore(item.id);
        else await trashService.permanentDelete(item.id);
        showToast(type === "restore" ? t("trash.toastItemRestored") : t("trash.toastItemDeleted"));
      }

      await fetchTrash();
    } catch (err) {
      console.error("Action error:", err);
      showToast(t("trash.toastActionFailed"), "error");
    } finally {
      closeModal();
    }
  };

  const expiryBadge = (dateStr) => {
    const d = daysUntil(dateStr);
    if (d === null) return { label: "\u2014", cls: "bg-slate-100 dark:bg-slate-800 text-slate-500" };
    if (d <= 3)
      return { label: d + " " + t("trash.daysLeft"), cls: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400" };
    if (d <= 7)
      return {
        label: d + " " + t("trash.daysLeft"),
        cls: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
      };
    return {
      label: d + " " + t("trash.daysLeft"),
      cls: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
    };
  };

  const modalDescription = () => {
    const { type, item, bulk } = actionModal;
    if (type === "empty")
      return t("trash.modalEmptyDesc");
    if (type === "restore") {
      if (bulk) return selectedIds.length + " " + t("trash.modalRestoreBulkSuffix");
      return t("trash.quote") + getItemName(item, t) + t("trash.modalRestoreSingleSuffix");
    }
    if (bulk)
      return selectedIds.length + " " + t("trash.modalDeleteBulkSuffix");
    return t("trash.quote") + getItemName(item, t) + t("trash.modalDeleteSingleSuffix");
  };

  const modalTitle = () => {
    const { type, bulk } = actionModal;
    if (type === "empty") return t("trash.modalEmptyTitle");
    if (type === "restore") return bulk ? t("trash.modalRestoreBulkTitlePrefix") + " " + selectedIds.length + " " + t("trash.modalRestoreBulkTitleSuffix") : t("trash.modalRestoreSingleTitle");
    return bulk ? t("trash.modalDeleteBulkTitlePrefix") + " " + selectedIds.length + " " + t("trash.modalDeleteBulkTitleSuffix") : t("trash.modalDeleteSingleTitle");
  };

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow={t("trash.eyebrow")}
        title={t("trash.title")}
        subtitle={<>{t("trash.subtitle")}</>}
        accent="from-rose-500 to-red-600"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        }
        actions={
          items.length > 0 ? (
            <button
              onClick={openEmptyTrash}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors border border-red-200 dark:border-red-500/20"
            >
              <IconTrash /> {t("trash.emptyTrash")}
            </button>
          ) : null
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap gap-2 mb-5"
      >
        {[
          {
            label: t("trash.statTotal"),
            value: items.length,
            color: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
          },
          {
            label: t("trash.statDocuments"),
            value: docCount,
            color: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
          },
          {
            label: t("trash.statTemplates"),
            value: templateCount,
            color: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",
          },
          {
            label: t("trash.statExpiringSoon"),
            value: expiringSoon,
            color:
              expiringSoon > 0
                ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
          },
          {
            label: t("trash.statSize"),
            value: formatBytes(totalBytes),
            color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          },
        ].map((s) => (
          <span
            key={s.label}
            className={
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold " +
              s.color
            }
          >
            {s.label}: <span className="font-bold">{s.value}</span>
          </span>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-5"
      >
        <Card className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IconSearch />
              </div>
              <input
                type="text"
                placeholder={t("trash.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                {[
                  { key: "all", label: t("trash.filterAll") },
                  { key: "document", label: t("trash.filterDocs") },
                  { key: "template", label: t("trash.filterTemplates") },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all " +
                      (filter === f.key
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1.5"
                  >
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg">
                      {selectedIds.length}
                    </span>
                    <button
                      onClick={openBulkRestore}
                      className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                      title={t("trash.restoreSelected")}
                    >
                      <IconRestore />
                    </button>
                    <button
                      onClick={openBulkDelete}
                      className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                      title={t("trash.deleteForever")}
                    >
                      <IconTrash />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {items.length > 0 && (
                <button
                  onClick={openEmptyTrash}
                  className="sm:hidden p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                  title={t("trash.emptyTrash")}
                >
                  <IconTrash />
                </button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        {loading ? (
          <Card className="p-16 text-center">
            <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">{t("trash.loadingTrash")}</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="py-16 px-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-5 text-slate-300 dark:text-slate-600">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {items.length === 0 ? t("trash.trashEmpty") : t("trash.noMatches")}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              {items.length === 0
                ? t("trash.emptyDescription")
                : t("trash.noMatchDescription")}
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60">
                    <th className="w-10 px-4 py-3">
                      <Checkbox
                        checked={selectedIds.length === filtered.length && filtered.length > 0}
                        onChange={toggleAll}
                      />
                      
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t("trash.colName")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t("trash.colType")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t("trash.colSize")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t("trash.colDeleted")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t("trash.colExpires")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t("trash.colActions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filtered.map((item, idx) => {
                    const badge = expiryBadge(item.autoDeleteAt);
                    return (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="group hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <Checkbox
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelect(item.id)}
                          />
                          
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={
                                "w-9 h-9 rounded-xl bg-gradient-to-br " +
                                getItemGradient(item) +
                                " flex items-center justify-center text-white shadow-sm shrink-0"
                              }
                            >
                              {item.itemType === "template" ? <IconTemplate /> : <IconDoc />}
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[220px]">
                              {getItemName(item, t)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={
                              "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium " +
                              (TYPE_COLORS[item.itemType]?.bg || "") +
                              " " +
                              (TYPE_COLORS[item.itemType]?.text || "")
                            }
                          >
                            {item.itemType === "template" ? t("trash.typeTemplate") : t("trash.typeDocument")}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400">
                          {getItemSize(item)}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400">
                          {timeAgo(item.deletedAt)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={"px-2 py-1 rounded-lg text-xs font-semibold " + badge.cls}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openRestoreModal(item)}
                              className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                              title={t("trash.titleRestore")}
                            >
                              <IconRestore />
                            </button>
                            <button
                              onClick={() => openDeleteModal(item)}
                              className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                              title={t("trash.deleteForever")}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
              {filtered.map((item, idx) => {
                const badge = expiryBadge(item.autoDeleteAt);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="mt-2"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-2">
                          <div
                            className={
                              "w-9 h-9 rounded-xl bg-gradient-to-br " +
                              getItemGradient(item) +
                              " flex items-center justify-center text-white shadow-sm shrink-0"
                            }
                          >
                            {item.itemType === "template" ? <IconTemplate /> : <IconDoc />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {getItemName(item, t)}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className={
                                  "inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold " +
                                  (TYPE_COLORS[item.itemType]?.bg || "") +
                                  " " +
                                  (TYPE_COLORS[item.itemType]?.text || "")
                                }
                              >
                                {item.itemType === "template" ? t("trash.typeTemplate") : t("trash.typeDoc")}
                              </span>
                              <span className="text-xs text-slate-400">{getItemSize(item)}</span>
                              <span className="text-xs text-slate-400">{timeAgo(item.deletedAt)}</span>
                            </div>
                          </div>
                          <span
                            className={
                              "px-2 py-1 rounded-lg text-[10px] font-semibold shrink-0 " + badge.cls
                            }
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => openRestoreModal(item)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium transition-colors"
                          >
                            <IconRestore /> {t("trash.restore")}
                          </button>
                          <button
                            onClick={() => openDeleteModal(item)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium transition-colors"
                          >
                            <IconTrash /> {t("trash.delete")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        )}
      </motion.div>

      <AnimatePresence>
        {actionModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200/50 dark:border-slate-700/50"
            >
              <div
                className={
                  "h-0.5 " +
                  (actionModal.type === "restore" ? "bg-emerald-500" : "bg-red-500")
                }
              />

              <div className="p-6">
                <div
                  className={
                    "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 " +
                    (actionModal.type === "restore"
                      ? "bg-emerald-100 dark:bg-emerald-500/20"
                      : "bg-red-100 dark:bg-red-500/20")
                  }
                >
                  {actionModal.type === "restore" ? (
                    <svg
                      className="w-7 h-7 text-emerald-600 dark:text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-7 h-7 text-red-600 dark:text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-2">
                  {modalTitle()}
                </h3>

                <p className="text-sm text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                  {modalDescription()}
                </p>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={closeModal}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={confirmAction}
                  disabled={actionLoading}
                  className={
                    "flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 " +
                    (actionModal.type === "restore"
                      ? "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/25"
                      : "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/25")
                  }
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {actionModal.type === "restore" ? <IconCheck /> : <IconTrash />}
                      {actionModal.type === "empty"
                        ? t("trash.empty")
                        : actionModal.type === "restore"
                          ? t("trash.restore")
                          : t("trash.delete")}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={
              "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 " +
              (toast.type === "error"
                ? "bg-red-600 text-white"
                : "bg-slate-900 dark:bg-white text-white dark:text-slate-900")
            }
          >
            {toast.type === "error" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <IconCheck />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
