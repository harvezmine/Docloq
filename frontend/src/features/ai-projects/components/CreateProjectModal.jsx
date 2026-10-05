// Create project modal, editorial, restrained

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';
import aiProjectService from '@/services/ai-project.service';

const MAX_INSTRUCTION = 2000;

export default function CreateProjectModal({ onClose, onCreated }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await aiProjectService.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        customInstructions: instructions.trim() || undefined,
      });
      if (res?.success) {
        onCreated?.(res.data);
      }
    } catch (err) {
      setError(err?.response?.data?.message || t('aiProjects.create.createError'));
    } finally {
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
        <motion.form
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-stone-100 dark:border-slate-800">
            <h2 className="text-2xl text-slate-900 dark:text-white">{t('aiProjects.create.title')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('aiProjects.create.subtitle')}
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                {t('common.name')}
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('aiProjects.create.namePlaceholder')}
                maxLength={120}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                {t('common.description')} <span className="font-normal normal-case text-slate-400">({t('common.optional')})</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('aiProjects.create.descriptionPlaceholder')}
                maxLength={300}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                {t('aiProjects.create.instructionsLabel')} <span className="font-normal normal-case text-slate-400">({t('common.optional')})</span>
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                placeholder={t('aiProjects.create.instructionsPlaceholder')}
                maxLength={MAX_INSTRUCTION}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all resize-none leading-relaxed"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                <span>{t('aiProjects.create.instructionsHint')}</span>
                <span>{instructions.length}/{MAX_INSTRUCTION}</span>
              </div>
            </div>

            {error && (
              <div className="px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-500/20">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-stone-50/50 dark:bg-slate-900/50 border-t border-stone-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-accent-gradient hover:brightness-110 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-md shadow-accent disabled:shadow-none transition-all"
            >
              {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {t('aiProjects.create.submit')}
            </button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
}
