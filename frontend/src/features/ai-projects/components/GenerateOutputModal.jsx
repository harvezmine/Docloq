// The NotebookLM-style "what should this be about?" popup, shown before generating slides,
// mind map, or infographic. Reports generate directly (no popup).

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';

export default function GenerateOutputModal({ open, kind, title, onGenerate, onClose }) {
  const { t } = useLang();
  const HINTS = {
    slides: [t('aiStudio.hints.slides.h1'), t('aiStudio.hints.slides.h2'), t('aiStudio.hints.slides.h3')],
    mindmap: [t('aiStudio.hints.mindmap.h1'), t('aiStudio.hints.mindmap.h2'), t('aiStudio.hints.mindmap.h3')],
    infographic: [t('aiStudio.hints.infographic.h1'), t('aiStudio.hints.infographic.h2'), t('aiStudio.hints.infographic.h3')],
  };
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open, kind]);

  const submit = (e) => { e?.preventDefault(); onGenerate(text.trim()); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="gen-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden"
          >
            <form onSubmit={submit}>
              <div className="px-5 pt-5 pb-3">
                <h3 id="gen-title" className="text-base font-semibold text-slate-900 dark:text-white">{t('aiStudio.modal.createTitle')} {title}</h3>
                <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">{t('aiStudio.modal.focusPrompt')}</p>
              </div>
              <div className="px-5">
                <textarea
                  autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))}
                  placeholder={t('aiStudio.modal.placeholder')}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(HINTS[kind] || []).map((h) => (
                    <button key={h} type="button" onClick={() => setText(h)}
                      className="text-[11px] px-2 py-1 rounded-lg bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-stone-200 dark:hover:bg-slate-700">
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 mt-2 flex justify-end gap-2 border-t border-stone-100 dark:border-slate-800/60">
                <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800">{t('common.cancel')}</button>
                <button type="submit" className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-accent-gradient hover:brightness-110 text-white">{t('aiStudio.modal.generate')}</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
