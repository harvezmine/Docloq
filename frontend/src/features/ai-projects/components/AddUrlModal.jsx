// Add URL modal, explicit consent before fetch

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import aiProjectService from '@/services/ai-project.service';
import { useLang } from '@/app/providers/LanguageProvider';

export default function AddUrlModal({ projectId, onClose, onAdded }) {
  const { t } = useLang();
  const [url, setUrl] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleNext = (e) => {
    e?.preventDefault();
    if (!url.trim()) return;
    try {
      const u = new URL(url.trim());
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    } catch {
      setError(t('aiSources.url.invalid'));
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await aiProjectService.addUrlSource(projectId, url.trim());
      onAdded?.();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || t('aiSources.url.addError'));
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden"
        >
          {!confirming ? (
            <>
              <div className="px-6 pt-6 pb-3 border-b border-stone-100 dark:border-slate-800">
                <h2 className="text-2xl text-slate-900 dark:text-white">{t('aiSources.url.title')}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t('aiSources.url.subtitle')}
                </p>
              </div>

              <form onSubmit={handleNext} className="px-6 py-5 space-y-4">
                <div>
                  <input
                    autoFocus
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t('aiSources.url.placeholder')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                  />
                </div>

                {error && (
                  <div className="px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-500/20">
                    {error}
                  </div>
                )}
              </form>

              <div className="px-6 py-4 bg-stone-50/50 dark:bg-slate-900/50 border-t border-stone-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-stone-100 rounded-lg transition-colors">{t('common.cancel')}</button>
                <button onClick={handleNext} disabled={!url.trim()} className="px-4 py-2 bg-accent-gradient hover:brightness-110 text-white text-sm font-semibold rounded-lg shadow-sm shadow-accent disabled:opacity-50">{t('common.next')}</button>
              </div>
            </>
          ) : (
            <>
              <div className="px-6 pt-6 pb-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-2xl text-slate-900 dark:text-white">{t('aiSources.url.confirmTitle')}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {t('aiSources.url.confirmBody')}
                </p>
                <div className="mt-3 px-3 py-2 rounded-lg bg-stone-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-400 break-all font-mono">
                  {url}
                </div>
              </div>

              {error && (
                <div className="mx-6 mb-3 px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-500/20">
                  {error}
                </div>
              )}

              <div className="px-6 py-4 bg-stone-50/50 dark:bg-slate-900/50 border-t border-stone-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button onClick={() => setConfirming(false)} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">{t('common.back')}</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-gradient hover:brightness-110 text-white text-sm font-semibold rounded-lg shadow-md shadow-accent disabled:opacity-60"
                >
                  {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {t('aiSources.url.agreeAdd')}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
