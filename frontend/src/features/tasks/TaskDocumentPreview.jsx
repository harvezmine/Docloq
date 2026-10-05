import { useState, useEffect, useRef } from "react";
import taskService from "@/services/task.service";
import { useLang } from "@/app/providers/LanguageProvider";

// View-only page-image preview of a task's document; editing happens in the
// full-screen OnlyOffice editor, not here.
export default function TaskDocumentPreview({ taskId, refreshKey = 0 }) {
  const { t } = useLang();
  const [status, setStatus] = useState("loading"); // loading | ready | unsupported | error
  const [pages, setPages] = useState([]); // object URLs
  const [pageCount, setPageCount] = useState(0);
  const urlsRef = useRef([]);

  useEffect(() => {
    let cancelled = false;

    // Revoke any URLs from a previous render before loading fresh ones.
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setPages([]);
    setPageCount(0);
    setStatus("loading");

    (async () => {
      try {
        const res = await taskService.getTaskDocumentPreview(taskId);
        if (cancelled) return;
        const manifest = res?.data;
        if (!res?.success || !manifest?.previewable) {
          setStatus("unsupported");
          return;
        }
        const count = Math.max(1, manifest.pageCount || 1);
        setPageCount(count);

        const collected = [];
        for (let i = 1; i <= count; i++) {
          if (cancelled) return;
          try {
            const url = await taskService.getTaskDocumentPreviewPageUrl(taskId, i);
            if (cancelled) { URL.revokeObjectURL(url); return; }
            collected.push(url);
            urlsRef.current.push(url);
            setPages([...collected]); // progressive reveal as pages arrive
            setStatus("ready");
          } catch {
            break; // stop on first failed page
          }
        }
        if (cancelled) return;
        if (collected.length === 0) setStatus("error");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [taskId, refreshKey]);

  // Revoke all object URLs on unmount.
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">{t("tasks.preview.loading")}</p>
      </div>
    );
  }

  if (status === "unsupported" || status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {status === "unsupported"
            ? t("tasks.preview.unsupported")
            : t("tasks.preview.error")}
        </p>
        <p className="text-xs text-slate-400">{t("tasks.preview.useButtons")}</p>
      </div>
    );
  }

  // ready
  return (
    <div className="max-h-[calc(100vh-220px)] overflow-y-auto rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 sm:p-4 space-y-4">
      {pages.map((url, idx) => (
        <div key={idx} className="relative bg-white rounded-lg shadow-md ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
          <img
            src={url}
            alt={`${t("tasks.preview.page")} ${idx + 1}`}
            loading={idx === 0 ? "eager" : "lazy"}
            className="w-full h-auto block"
          />
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/70 text-white text-[11px] font-medium">
            {idx + 1}{pageCount ? ` / ${pageCount}` : ""}
          </span>
        </div>
      ))}
      {pages.length < pageCount && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          {t("tasks.preview.loadingPagePrefix")} {pages.length + 1} {t("tasks.preview.of")} {pageCount}…
        </div>
      )}
    </div>
  );
}
