// Themed replacement for native window.confirm; styling matches CommentModal.

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/app/providers/LanguageProvider";

const IconWarning = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);
const IconQuestion = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useLang();
  const cancelRef = useRef(null);
  const resolvedConfirmLabel = confirmLabel || t("common.confirm");
  const resolvedCancelLabel = cancelLabel || t("common.cancel");

  // Default focus on Cancel so accidental Enter doesn't confirm.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onCancel?.();
      if (e.key === "Enter" && !loading) onConfirm?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel, onConfirm]);

  const danger = variant === "danger";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !loading && onCancel?.()}
          role="dialog" aria-modal="true" aria-labelledby="confirm-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  danger ? "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400"
                         : "bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400"
                }`}>
                  {danger ? <IconWarning /> : <IconQuestion />}
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 id="confirm-title" className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
                  {message && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{message}</p>}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
              <button
                ref={cancelRef}
                onClick={() => !loading && onCancel?.()}
                disabled={loading}
                className="min-h-[44px] px-5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50"
              >
                {resolvedCancelLabel}
              </button>
              <button
                onClick={() => !loading && onConfirm?.()}
                disabled={loading}
                className={`min-h-[44px] px-5 rounded-xl text-sm font-semibold text-white shadow-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 ${
                  danger ? "bg-red-600 hover:bg-red-700"
                         : "bg-accent hover:brightness-110"
                }`}
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {resolvedConfirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
