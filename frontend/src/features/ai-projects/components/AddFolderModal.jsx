// Attach every AI-granted document in a folder at once. Ungranted documents are skipped and
// reported, not silently dropped.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import aiProjectService from '@/services/ai-project.service';
import folderService from '@/services/folder.service';
import { useLang } from '@/app/providers/LanguageProvider';

export default function AddFolderModal({ projectId, open, onClose, onAdded }) {
  const { t } = useLang();
  const [folders, setFolders] = useState([]);
  const [saving, setSaving] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    folderService.getAllFolders()
      .then((r) => setFolders(Array.isArray(r) ? r : (r?.data || [])))
      .catch(() => setError(t('aiSources.folder.loadError')));
  }, [open]);

  const attach = async (folderId) => {
    setSaving(folderId);
    setError(null);
    try {
      const res = await aiProjectService.addFolderSources(projectId, folderId);
      if (res?.success) {
        setResult(res.data);
        onAdded?.();
      }
    } catch (err) {
      setError(err?.response?.data?.message || t('aiSources.folder.addError'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose} role="dialog" aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden flex flex-col"
          >
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('aiSources.folder.title')}</h3>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('aiSources.folder.subtitle')}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-2">
              {error && <p role="alert" className="mb-2 text-[12px] text-red-600 dark:text-red-400">{error}</p>}

              {result ? (
                <div className="py-3 text-[12.5px] text-slate-700 dark:text-slate-300 space-y-1">
                  <p><span className="font-semibold text-emerald-600 dark:text-emerald-400">{result.added}</span> {t('aiSources.folder.docsAddedSuffix')}</p>
                  {result.skippedNotGranted?.length > 0 && (
                    <p className="text-amber-700 dark:text-amber-400">
                      {result.skippedNotGranted.length} {t('aiSources.folder.skippedSuffix')}
                    </p>
                  )}
                  {result.limitHit && <p className="text-amber-700 dark:text-amber-400">{t('aiSources.folder.limitHit')}</p>}
                  {result.failed?.length > 0 && <p className="text-red-600 dark:text-red-400">{result.failed.length} {t('aiSources.folder.failedSuffix')}</p>}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => attach(f.id)}
                      disabled={!!saving}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-stone-50 dark:hover:bg-slate-800/60 disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-sky-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                      <span className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-100 truncate">{f.name}</span>
                      {saving === f.id && <span className="text-[11px] text-slate-400">...</span>}
                    </button>
                  ))}
                  {folders.length === 0 && !error && <p className="text-[12px] text-slate-400 py-4 text-center">{t('aiSources.folder.empty')}</p>}
                </div>
              )}
            </div>

            <div className="px-5 py-4 flex justify-end border-t border-stone-100 dark:border-slate-800/60">
              <button onClick={onClose} className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800">
                {result ? t('common.done') : t('common.cancel')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
