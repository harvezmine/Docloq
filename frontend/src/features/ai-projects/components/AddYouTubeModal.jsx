// Add a YouTube video as a source. Uses its transcript, a video without captions fails.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import aiProjectService from '@/services/ai-project.service';
import { useLang } from '@/app/providers/LanguageProvider';

export default function AddYouTubeModal({ projectId, open, onClose, onAdded }) {
  const { t } = useLang();
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setUrl(''); setError(null); } }, [open]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!url.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await aiProjectService.addYouTubeSource(projectId, url.trim());
      if (res?.success) { onAdded?.(res.data); onClose?.(); }
      else setError(res?.message || t('aiSources.addFailed'));
    } catch (err) {
      setError(err?.response?.data?.message || t('aiSources.yt.addVideoError'));
    } finally {
      setSaving(false);
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
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden"
          >
            <form onSubmit={submit}>
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('aiSources.yt.title')}</h3>
                <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('aiSources.yt.subtitle')}
                </p>
              </div>
              <div className="px-5">
                <input
                  autoFocus
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {error && <p role="alert" className="mt-2 text-[12px] text-red-600 dark:text-red-400 leading-snug">{error}</p>}
              </div>
              <div className="px-5 py-4 mt-2 flex justify-end gap-2 border-t border-stone-100 dark:border-slate-800/60">
                <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800">{t('common.cancel')}</button>
                <button type="submit" disabled={!url.trim() || saving} className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-accent-gradient hover:brightness-110 disabled:bg-stone-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white">
                  {saving ? t('aiSources.adding') : t('aiSources.addAction')}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
