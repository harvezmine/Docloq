// Add a source by pasting text. Unlike document/URL sources there is nothing to fetch or
// OCR, the text is chunked and encrypted directly, so this is the one source type that
// cannot fail on extraction.

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import aiProjectService from '@/services/ai-project.service';
import { useLang } from '@/app/providers/LanguageProvider';

const MAX_TITLE = 200;
const MAX_CONTENT = 200_000;

export default function AddTextModal({ projectId, open, onClose, onAdded }) {
  const { t } = useLang();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const titleRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setContent('');
      setError(null);
      // Defer so the element exists before focus.
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await aiProjectService.addTextSource(projectId, {
        title: title.trim(),
        content: content.trim(),
      });
      if (res?.success) {
        onAdded?.(res.data);
        onClose?.();
      } else {
        setError(res?.message || t('aiSources.text.addError'));
      }
    } catch (err) {
      const d = err?.response?.data;
      setError(
        d?.code === 'SOURCE_LIMIT'
          ? `${t('aiSources.text.limitPrefix')}(${d.used}/${d.max})${t('aiSources.text.limitSuffix')}`
          : d?.message || t('aiSources.text.addError')
      );
    } finally {
      setSaving(false);
    }
  };

  const overLimit = content.length > MAX_CONTENT;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-text-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={submit}>
              <div className="px-5 pt-5 pb-3">
                <h3 id="add-text-title" className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('aiSources.text.title')}
                </h3>
                <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('aiSources.text.subtitle')}
                </p>
              </div>

              <div className="px-5 space-y-3">
                <div>
                  <label htmlFor="text-src-title" className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('aiSources.text.titleLabel')}
                  </label>
                  <input
                    id="text-src-title"
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                    placeholder={t('aiSources.text.titlePlaceholder')}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="text-src-body" className="block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                      {t('aiSources.text.bodyLabel')}
                    </label>
                    <span className={`text-[11px] tabular-nums ${overLimit ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-400'}`}>
                      {content.length.toLocaleString('id-ID')} / {MAX_CONTENT.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <textarea
                    id="text-src-body"
                    rows={9}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('aiSources.text.bodyPlaceholder')}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-[12px] text-red-600 dark:text-red-400 leading-snug">
                    {error}
                  </p>
                )}
              </div>

              <div className="px-5 py-4 mt-2 flex items-center justify-end gap-2 border-t border-stone-100 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || !content.trim() || overLimit || saving}
                  className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-accent hover:brightness-110 disabled:bg-stone-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white transition-colors"
                >
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
