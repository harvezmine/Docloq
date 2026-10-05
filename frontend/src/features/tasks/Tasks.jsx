import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import OnlyOfficeEditor from "@/components/onlyoffice/OnlyOfficeEditor";
import SigningPanel from "@/features/tasks/SigningPanel";
import TaskDocumentPreview from "@/features/tasks/TaskDocumentPreview";
import taskService from "@/services/task.service";
import { useLang } from "@/app/providers/LanguageProvider";

const taskTypeConfig = {
  sign: {
    label: "Sign", action: "Sign Document", color: "violet", mode: "view",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    bg: "bg-violet-50 dark:bg-violet-500/10",
    border: "border-violet-100 dark:border-violet-500/20",
    text: "text-violet-600 dark:text-violet-400",
  },
  fill: {
    label: "Fill", action: "Edit Document", color: "blue", mode: "edit",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-100 dark:border-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
  },
  review: {
    label: "Review", action: "Review Document", color: "amber", mode: "view",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-100 dark:border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
  },
  approve: {
    label: "Approve", action: "Review & Approve", color: "emerald", mode: "view",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-100 dark:border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  general: {
    label: "Task", action: "Complete", color: "slate", mode: "view",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    bg: "bg-slate-100 dark:bg-slate-800",
    border: "border-slate-200 dark:border-slate-700",
    text: "text-slate-600 dark:text-slate-400",
  },
};

const priorityConfig = {
  urgent: { label: "Urgent", color: "bg-rose-600", ring: "ring-rose-600/20" },
  high: { label: "High", color: "bg-rose-500", ring: "ring-rose-500/20" },
  medium: { label: "Medium", color: "bg-amber-500", ring: "ring-amber-500/20" },
  low: { label: "Low", color: "bg-slate-400", ring: "ring-slate-400/20" },
};

const statusConfig = {
  pending: { label: "Waiting", dot: "bg-slate-400", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
  in_progress: { label: "Active", dot: "bg-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400" },
  completed: { label: "Done", dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  cancelled: { label: "Rejected", dot: "bg-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
};

const getDaysUntilDue = (dueDate) => {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function WorkflowProgress({ steps, currentStepOrder }) {
  const { t } = useLang();
  if (!steps || steps.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">{t("tasks.workflow.progress")}</p>
      <div className="relative">
        {steps.map((step, i) => {
          const isActive = step.stepOrder === currentStepOrder;
          const isDone = step.status === "completed";
          const isSkipped = step.status === "skipped";
          const cfgKey = taskTypeConfig[step.action] ? step.action : "general";
          return (
            <div key={step.id} className="flex items-start gap-3 relative">
              {i < steps.length - 1 && (
                <div className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${isDone ? "bg-emerald-300 dark:bg-emerald-600" : "bg-slate-200 dark:bg-slate-700"}`} />
              )}
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                isDone ? "bg-emerald-500 border-emerald-500 text-white"
                : isSkipped ? "bg-rose-100 dark:bg-rose-500/20 border-rose-300 dark:border-rose-500/50 text-rose-500"
                : isActive ? "bg-indigo-500 border-indigo-500 text-white animate-pulse"
                : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400"
              }`}>
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : isSkipped ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <span className="text-xs font-bold">{step.stepOrder}</span>
                )}
              </div>
              <div className={`pb-5 flex-1 min-w-0 ${isActive ? "" : "opacity-70"}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isActive ? "text-indigo-600 dark:text-indigo-400" : isDone ? "text-emerald-600 dark:text-emerald-400" : isSkipped ? "text-rose-500" : "text-slate-600 dark:text-slate-300"}`}>
                    {t(`tasks.taskType.${cfgKey}`)}
                  </span>
                  {isActive && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                      {t("tasks.workflow.current")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.assignee}</p>
                {step.notes && (
                  <p className="text-xs mt-1 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                    {t("tasks.workflow.note")} {step.notes}
                  </p>
                )}
                {step.completedAt && (
                  <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(step.completedAt)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Tasks() {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState("active");
  const [filterType, setFilterType] = useState("all");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDocConfig, setTaskDocConfig] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [docConfigLoading, setDocConfigLoading] = useState(false);
  const [workflowContext, setWorkflowContext] = useState(null);
  const [signedDocumentInfo, setSignedDocumentInfo] = useState(null);
  const [viewingSignedDoc, setViewingSignedDoc] = useState(false);
  const [previewKey, setPreviewKey] = useState(0); // bump to re-fetch inline preview (e.g. after editing)

  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await taskService.getTasks();
      if (res.success) setAllTasks(res.data);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const openTask = async (task) => {
    try {
      const res = await taskService.getTask(task.id);
      if (res.success) {
        setSelectedTask(res.data);
      } else {
        setSelectedTask(task);
      }
    } catch {
      setSelectedTask(task);
    }

    // Fetch document config + workflow context (for all task statuses, completed tasks get view mode)
    if (task.relatedDocumentId) {
      setDocConfigLoading(true);
      try {
        const dcRes = await taskService.getTaskDocumentConfig(task.id);
        if (dcRes.success) {
          setTaskDocConfig(dcRes.data.config);
          setWorkflowContext(dcRes.data.workflowContext);
          setSignedDocumentInfo(dcRes.data.signedDocumentInfo || null);
        }
      } catch (err) {
        console.error("Failed to fetch doc config:", err);
      } finally {
        setDocConfigLoading(false);
      }
    }

    setReviewNotes("");
  };

  const closeTaskDetail = () => {
    setSelectedTask(null);
    setTaskDocConfig(null);
    setWorkflowContext(null);
    setSignedDocumentInfo(null);
    setViewingSignedDoc(false);
    setReviewNotes("");
  };

  const openEditor = (useSignedDoc = false) => {
    setViewingSignedDoc(useSignedDoc);
    if (useSignedDoc && signedDocumentInfo?.signedConfig) {
      setShowEditor(true);
    } else if (taskDocConfig) {
      setShowEditor(true);
    }
  };

  const closeEditor = () => {
    setShowEditor(false);
    setPreviewKey((k) => k + 1); // refresh inline preview after editing
  };

  const handleSubmitFill = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      const res = await taskService.submitAction(selectedTask.id, {});
      if (res.success) {
        await fetchTasks();
        closeTaskDetail();
      }
    } catch (err) {
      console.error("Submit fill error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      const res = await taskService.submitAction(selectedTask.id, { notes: reviewNotes || undefined });
      if (res.success) {
        await fetchTasks();
        closeTaskDetail();
      }
    } catch (err) {
      console.error("Submit review error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      const res = await taskService.submitAction(selectedTask.id, { approved: true, notes: reviewNotes || undefined });
      if (res.success) {
        await fetchTasks();
        closeTaskDetail();
      }
    } catch (err) {
      console.error("Approve error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTask || !reviewNotes.trim()) return;
    setSubmitting(true);
    try {
      const res = await taskService.submitAction(selectedTask.id, { approved: false, notes: reviewNotes });
      if (res.success) {
        await fetchTasks();
        closeTaskDetail();
      }
    } catch (err) {
      console.error("Reject error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSign = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      const res = await taskService.submitAction(selectedTask.id, {});
      if (res.success) {
        await fetchTasks();
        closeTaskDetail();
      }
    } catch (err) {
      console.error("Submit sign error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      const tabMatch =
        activeTab === "active"
          ? t.status === "pending" || t.status === "in_progress"
          : activeTab === "completed"
          ? t.status === "completed"
          : t.status === "cancelled";
      const typeMatch = filterType === "all" || t.taskType === filterType;
      const dateMatch = !selectedCalendarDate || (t.dueDate && t.dueDate.startsWith(selectedCalendarDate));
      return tabMatch && typeMatch && dateMatch;
    });
  }, [allTasks, activeTab, filterType, selectedCalendarDate]);

  const activeCount = allTasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
  const completedCount = allTasks.filter((t) => t.status === "completed").length;
  const cancelledCount = allTasks.filter((t) => t.status === "cancelled").length;

  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startPadding; i++) days.push({ day: null, date: null });
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const dayTasks = allTasks.filter((t) => t.dueDate && t.dueDate.startsWith(dateStr) && (t.status === "pending" || t.status === "in_progress"));
      days.push({ day: i, date: dateStr, tasks: dayTasks, isToday: new Date().toDateString() === new Date(dateStr).toDateString() });
    }
    return days;
  }, [currentMonth, allTasks]);

  const monthNames = [
    t("tasks.months.jan"), t("tasks.months.feb"), t("tasks.months.mar"), t("tasks.months.apr"),
    t("tasks.months.may"), t("tasks.months.jun"), t("tasks.months.jul"), t("tasks.months.aug"),
    t("tasks.months.sep"), t("tasks.months.oct"), t("tasks.months.nov"), t("tasks.months.dec"),
  ];

  const typeFilterOptions = [
    { value: "all", label: t("tasks.filter.allTypes") },
    { value: "fill", label: t("tasks.taskType.fill"), cfg: taskTypeConfig.fill },
    { value: "review", label: t("tasks.taskType.review"), cfg: taskTypeConfig.review },
    { value: "approve", label: t("tasks.taskType.approve"), cfg: taskTypeConfig.approve },
    // sign task-type hidden while e-signature is unavailable
    // { value: "sign", label: t("tasks.taskType.sign"), cfg: taskTypeConfig.sign },
  ];

  if (showEditor && selectedTask) {
    const editorConfig = viewingSignedDoc && signedDocumentInfo?.signedConfig
      ? signedDocumentInfo.signedConfig
      : taskDocConfig;

    if (editorConfig) {
      return (
        <OnlyOfficeEditor
          config={editorConfig}
          documentName={viewingSignedDoc
            ? `${t("tasks.detail.signedPrefix")} - ${selectedTask.documentName || selectedTask.title}`
            : selectedTask.documentName || selectedTask.title}
          documentId={selectedTask.relatedDocumentId}
          onClose={() => { setShowEditor(false); setViewingSignedDoc(false); setPreviewKey((k) => k + 1); }}
        />
      );
    }
  }

  if (selectedTask) {
    const cfg = taskTypeConfig[selectedTask.taskType] || taskTypeConfig.general;
    const cfgKey = taskTypeConfig[selectedTask.taskType] ? selectedTask.taskType : "general";
    const statusKey = statusConfig[selectedTask.status] ? selectedTask.status : "pending";
    const priorityKey = priorityConfig[selectedTask.priority] ? selectedTask.priority : "medium";
    const isActive = selectedTask.status === "in_progress";
    const isDone = selectedTask.status === "completed";
    const isCancelled = selectedTask.status === "cancelled";
    const isPending = selectedTask.status === "pending";
    const daysLeft = getDaysUntilDue(selectedTask.dueDate);
    const isOverdue = isActive && daysLeft !== null && daysLeft < 0;

    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          <button onClick={closeTaskDetail} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            {t("tasks.detail.back")}
          </button>

          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl ${cfg.bg} ${cfg.border} border ${cfg.text} flex items-center justify-center flex-shrink-0`}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{selectedTask.title}</h1>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${(statusConfig[selectedTask.status] || statusConfig.pending).bg} ${(statusConfig[selectedTask.status] || statusConfig.pending).text}`}>
                    {t(`tasks.status.${statusKey}`)}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{selectedTask.description || t("tasks.detail.noDescription")}</p>
                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <span className={`flex items-center gap-1.5 font-medium ${cfg.text}`}>
                    {cfg.icon} {t(`tasks.taskType.${cfgKey}`)}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {t("tasks.detail.due")} {formatDate(selectedTask.dueDate)}
                    {isOverdue && <span className="text-rose-500 font-semibold ml-1">{t("tasks.detail.overdue")}</span>}
                  </span>
                  {selectedTask.priority && (
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${(priorityConfig[selectedTask.priority] || priorityConfig.medium).color}`} />
                      <span className="text-slate-500 dark:text-slate-400">{t(`tasks.priority.${priorityKey}`)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {selectedTask.relatedDocumentId ? (
                <Card className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {isDone && selectedTask.taskType === "sign" && signedDocumentInfo
                            ? `${t("tasks.detail.signedPrefix")} - ${selectedTask.documentName || t("tasks.detail.document")}`
                            : selectedTask.documentName || t("tasks.detail.document")}
                        </p>
                        <p className="text-xs text-slate-400">
                          {isActive && cfg.mode === "edit" ? t("tasks.detail.editAccess") : t("tasks.detail.viewOnly")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {docConfigLoading && (
                        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      )}
                      {isActive && cfg.mode === "edit" && taskDocConfig && (
                        <button onClick={() => openEditor(false)}
                          className="px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl flex items-center gap-2 bg-accent-gradient hover:brightness-110 text-white shadow-accent">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          {t("tasks.detail.editFill")}
                        </button>
                      )}
                      {isDone && selectedTask.taskType === "sign" && signedDocumentInfo && taskDocConfig && (
                        <button onClick={() => openEditor(true)}
                          className="px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl flex items-center gap-2 bg-accent-gradient hover:brightness-110 text-white shadow-accent">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          {t("tasks.detail.viewSigned")}
                        </button>
                      )}
                    </div>
                  </div>

                  {isDone && selectedTask.taskType === "sign" && signedDocumentInfo && taskDocConfig && (
                    <button onClick={() => openEditor(false)}
                      className="mb-3 text-xs text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors underline">
                      {t("tasks.detail.viewOriginal")}
                    </button>
                  )}

                  <TaskDocumentPreview taskId={selectedTask.id} refreshKey={previewKey} />
                </Card>
              ) : (
                <Card className="p-6">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t("tasks.detail.noDocumentLinked")}</p>
                </Card>
              )}
            </div>

            {/* Right: actions, status, details, workflow */}
            <div className="space-y-6">
              {/* Pending info */}
              {isPending && (
                <Card className="p-4">
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      <span className="font-semibold">Waiting:</span> This task will become active when the previous workflow step is completed.
                    </p>
                  </div>
                </Card>
              )}

              {/* Action Panel, role-specific, only for active tasks */}
              {isActive && (
                <Card className="p-6">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                    {selectedTask.taskType === "fill" && "Submit After Editing"}
                    {selectedTask.taskType === "sign" && "Submit After Signing"}
                    {selectedTask.taskType === "review" && "Review Notes"}
                    {selectedTask.taskType === "approve" && "Approval Decision"}
                    {!["fill", "sign", "review", "approve"].includes(selectedTask.taskType) && "Actions"}
                  </h3>

                  {/* Fill: edit + submit */}
                  {selectedTask.taskType === "fill" && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Open the document, make your edits, save, then mark as complete.
                      </p>
                      {/* Show Open & Edit button directly here if doc config is available */}
                      {taskDocConfig && !showEditor && (
                        <button onClick={() => openEditor(false)}
                          className="w-full px-4 py-3 rounded-xl bg-accent-gradient hover:brightness-110 text-white font-semibold shadow-lg shadow-accent transition-all flex items-center justify-center gap-2 mb-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Open & Edit Document
                        </button>
                      )}
                      {docConfigLoading && (
                        <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
                          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          Loading document...
                        </div>
                      )}
                      <button onClick={handleSubmitFill} disabled={submitting}
                        className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2">
                        {submitting ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        )}
                        Mark as Complete
                      </button>
                    </div>
                  )}

                  {/* Sign: DocuSeal signing panel — TEMPORARILY DISABLED.
                      The e-signature service is not available in this deployment,
                      so the panel is replaced with a notice instead of a broken flow.
                      To re-enable: restore the <SigningPanel> below and configure
                      DOCUSEAL_API_KEY on the backend. */}
                  {selectedTask.taskType === "sign" && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        E-signature is temporarily unavailable
                      </p>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400/80">
                        Document signing has been disabled by the administrator while the
                        signing service is being set up. Please check back later.
                      </p>
                    </div>
                  )}
                  {/* {selectedTask.taskType === "sign" && (
                    <SigningPanel
                      task={selectedTask}
                      onComplete={() => { fetchTasks(); closeTaskDetail(); }}
                    />
                  )} */}

                  {/* Review: view + notes */}
                  {selectedTask.taskType === "review" && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        View the document, then add your review notes. The filler will see your feedback if rejected.
                      </p>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add your review notes here... (optional)"
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                      />
                      <button onClick={handleSubmitReview} disabled={submitting}
                        className="w-full px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2">
                        {submitting ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        )}
                        Complete Review
                      </button>
                    </div>
                  )}

                  {/* Approve: view + approve/reject */}
                  {selectedTask.taskType === "approve" && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Review the document, then approve or reject. A reason is required when rejecting.
                      </p>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add notes or rejection reason..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                      />
                      <div className="flex gap-3">
                        <button onClick={handleReject} disabled={submitting || !reviewNotes.trim()}
                          className="flex-1 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-2">
                          {submitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          )}
                          Reject
                        </button>
                        <button onClick={handleApprove} disabled={submitting}
                          className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2">
                          {submitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          )}
                          Approve
                        </button>
                      </div>
                      {!reviewNotes.trim() && (
                        <p className="text-xs text-rose-500">A reason is required to reject.</p>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {/* Completed / Cancelled badge */}
              {(isDone || isCancelled) && (
                <Card className={`p-6 ${isDone ? "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20" : "bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20"}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDone ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-rose-100 dark:bg-rose-500/20"}`}>
                      {isDone ? (
                        <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-6 h-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${isDone ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                        {isDone ? "Task Completed" : "Task Rejected"}
                      </p>
                      <p className={`text-xs ${isDone ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"}`}>
                        {formatDate(selectedTask.completedAt || selectedTask.updatedAt)}
                      </p>
                    </div>
                  </div>

                  {/* For completed sign tasks, view signed document */}
                  {isDone && selectedTask.taskType === "sign" && signedDocumentInfo?.signedDocumentUrl && (
                    <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-500/20">
                      <a href={signedDocumentInfo.signedDocumentUrl} target="_blank" rel="noopener noreferrer"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Signed PDF
                      </a>
                    </div>
                  )}
                </Card>
              )}

              {/* Comments */}
              {selectedTask.comments && selectedTask.comments.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                    Comments ({selectedTask.comments.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedTask.comments.map((c, i) => (
                      <div key={c.comment?.id || c.id || i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{c.authorName || "User"}</span>
                          <span className="text-xs text-slate-400">{formatDate(c.comment?.createdAt || c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{c.comment?.content || c.content}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Task Info */}
              <Card className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Details</h3>

                {selectedTask.assignee && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {selectedTask.assignee.avatar || selectedTask.assignee.name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{selectedTask.assignee.name}</p>
                      <p className="text-xs text-slate-400">Assigned to</p>
                    </div>
                  </div>
                )}

                {selectedTask.assignedBy && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {selectedTask.assignedBy.avatar || selectedTask.assignedBy.name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{selectedTask.assignedBy.name}</p>
                      <p className="text-xs text-slate-400">Assigned by</p>
                    </div>
                  </div>
                )}

                {selectedTask.formName && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
                    <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span className="text-sm font-medium text-violet-600 dark:text-violet-400">{selectedTask.formName}</span>
                  </div>
                )}
              </Card>

              {/* Workflow Progress */}
              {workflowContext && (
                <Card className="p-5">
                  <WorkflowProgress steps={workflowContext.steps} currentStepOrder={workflowContext.currentStepOrder} />
                </Card>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ══════════════════════════════════════════════
  //  TASK LIST VIEW (default)
  // ══════════════════════════════════════════════
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:gap-6">
          <PageHeader
            className="mb-0"
            eyebrow="Workflow"
            title="My Tasks"
            subtitle="Your assigned workflow tasks, fill, review, approve, and sign documents"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
          />

          {/* Stats */}
          <div className="flex gap-3">
            <div className="flex-1 sm:flex-none px-4 sm:px-5 py-3 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{activeCount}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active</p>
            </div>
            <div className="flex-1 sm:flex-none px-4 sm:px-5 py-3 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</p>
              <p className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70">Completed</p>
            </div>
            {cancelledCount > 0 && (
              <div className="flex-1 sm:flex-none px-4 sm:px-5 py-3 rounded-xl sm:rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">{cancelledCount}</p>
                <p className="text-xs font-medium text-rose-600/70 dark:text-rose-400/70">Rejected</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex flex-col-reverse xl:grid xl:grid-cols-3 gap-6 xl:gap-8">
          {/* Tasks Column */}
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">
            {/* Tabs + Filters */}
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="inline-flex p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800/50 shadow-inner w-full sm:w-auto">
                {[
                  { key: "active", label: "Active", count: activeCount },
                  { key: "completed", label: "Completed", count: completedCount },
                  ...(cancelledCount > 0 ? [{ key: "cancelled", label: "Rejected", count: cancelledCount }] : []),
                ].map((tab) => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 sm:flex-none relative px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-sm font-semibold transition-all duration-200 ${
                      activeTab === tab.key
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}>
                    {tab.label}
                    <span className={`ml-1.5 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-xs ${
                      activeTab === tab.key
                        ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                        : "bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400"
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Type filter + date */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {selectedCalendarDate && (
                  <button onClick={() => setSelectedCalendarDate(null)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors">
                    <span className="text-xs sm:text-sm">{formatDate(selectedCalendarDate)}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}

                <div className="relative">
                  <button onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                    <span className="text-sm text-slate-500">Type:</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {typeFilterOptions.find((o) => o.value === filterType)?.label}
                    </span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showTypeDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  <AnimatePresence>
                    {showTypeDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowTypeDropdown(false)} />
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 top-full mt-2 w-48 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20">
                          {typeFilterOptions.map((option) => (
                            <button key={option.value}
                              onClick={() => { setFilterType(option.value); setShowTypeDropdown(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${filterType === option.value ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}>
                              <span className={`text-sm ${filterType === option.value ? "font-medium text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-300"}`}>{option.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Task Cards */}
            {!loading && (
              <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <Card className="p-16 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {activeTab === "active" ? "No active tasks" : activeTab === "completed" ? "No completed tasks" : "No rejected tasks"}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {activeTab === "active" ? "You're all caught up! Tasks assigned to you will appear here." : "Tasks will appear here once completed."}
                    </p>
                  </Card>
                ) : (
                  filteredTasks.map((task, index) => {
                    const cfg = taskTypeConfig[task.taskType] || taskTypeConfig.general;
                    const daysLeft = getDaysUntilDue(task.dueDate);
                    const isOverdue = (task.status === "in_progress" || task.status === "pending") && daysLeft !== null && daysLeft < 0;
                    const isDueSoon = (task.status === "in_progress" || task.status === "pending") && daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;
                    const stCfg = statusConfig[task.status] || statusConfig.pending;

                    return (
                      <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                        onClick={() => openTask(task)} className="cursor-pointer group">
                        <Card className={`p-4 sm:p-5 hover:shadow-xl transition-all duration-300 border-l-4 ${
                          isOverdue ? "border-l-rose-500 bg-rose-50/30 dark:bg-rose-500/5"
                          : isDueSoon ? "border-l-amber-500 bg-amber-50/30 dark:bg-amber-500/5"
                          : task.status === "completed" ? "border-l-emerald-500"
                          : task.status === "cancelled" ? "border-l-rose-400"
                          : task.status === "in_progress" ? "border-l-indigo-500"
                          : "border-l-slate-300 dark:border-l-slate-600"
                        }`}>
                          <div className="flex items-start gap-4">
                            {/* Type icon */}
                            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${cfg.bg} border ${cfg.border} ${cfg.text} flex items-center justify-center flex-shrink-0`}>
                              {cfg.icon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                                    {task.title}
                                  </h3>
                                  <span className={`w-2 h-2 rounded-full ring-3 flex-shrink-0 ${(priorityConfig[task.priority] || priorityConfig.medium).color} ${(priorityConfig[task.priority] || priorityConfig.medium).ring}`} />
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${stCfg.bg} ${stCfg.text}`}>
                                    {stCfg.label}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                                    {cfg.label}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-1">{task.description || "No description"}</p>

                              <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs sm:text-sm">
                                {/* Due date */}
                                <span className={`flex items-center gap-1.5 ${isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : isDueSoon ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  {task.status === "completed" ? formatDate(task.completedAt) : formatDate(task.dueDate)}
                                </span>

                                {/* Form */}
                                {task.formName && (
                                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    {task.formName}
                                  </span>
                                )}

                                {/* Document */}
                                {task.documentName && (
                                  <span className="hidden sm:inline-flex items-center gap-1 text-slate-400">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    {task.documentName}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Arrow */}
                            <svg className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Calendar Sidebar */}
          <div className="xl:col-span-1">
            <Card className="p-4 sm:p-5 xl:sticky xl:top-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Calendar</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>

              <p className="text-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </p>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-slate-400 py-2">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarData.map((dayData, idx) => (
                  <button key={idx} disabled={!dayData.day}
                    onClick={() => dayData.date && setSelectedCalendarDate(selectedCalendarDate === dayData.date ? null : dayData.date)}
                    className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs sm:text-sm transition-all ${
                      !dayData.day ? "cursor-default"
                      : dayData.isToday ? "bg-indigo-600 text-white font-bold"
                      : selectedCalendarDate === dayData.date ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold"
                      : dayData.tasks?.length > 0 ? "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}>
                    {dayData.day}
                    {dayData.tasks?.length > 0 && (
                      <div className="absolute bottom-0.5 sm:bottom-1 flex gap-0.5">
                        {dayData.tasks.slice(0, 3).map((t, i) => (
                          <span key={i} className={`w-1 h-1 rounded-full ${dayData.isToday ? "bg-white/70" : (priorityConfig[t.priority]?.color || "bg-indigo-500")}`} />
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Upcoming, hidden on mobile for space, shown on larger screens */}
              <div className="hidden sm:block mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Upcoming</h4>
                <div className="space-y-2">
                  {allTasks
                    .filter((t) => (t.status === "pending" || t.status === "in_progress") && t.dueDate)
                    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                    .slice(0, 5)
                    .map((task) => {
                      const cfg = taskTypeConfig[task.taskType] || taskTypeConfig.general;
                      return (
                        <div key={task.id} onClick={() => openTask(task)}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                          <div className={`w-7 h-7 rounded-md ${cfg.bg} ${cfg.text} flex items-center justify-center flex-shrink-0`}>
                            <span className="scale-75">{cfg.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{task.title}</p>
                            <p className="text-xs text-slate-400">{formatDate(task.dueDate)}</p>
                          </div>
                        </div>
                      );
                    })}
                  {allTasks.filter((t) => (t.status === "pending" || t.status === "in_progress") && t.dueDate).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No upcoming tasks</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}