// Shown before a document is sent to AI. Says "identitas", never "PII", users don't know it.

import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';

export default function GrantConsentModal({ open, documentName, onChoose, onCancel }) {
  const { t } = useLang();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          // stopPropagation: this modal is a DOM child of AddDocumentModal's backdrop, so a bare
          // onCancel would bubble to that backdrop's onClose and shut the whole document picker.
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="grant-consent-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3">
              <h3 id="grant-consent-title" className="text-base font-semibold text-slate-900 dark:text-white">
                {t('aiProjects.consent.title')}
              </h3>
              <p className="mt-1.5 text-[12.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {t('aiProjects.consent.bodyPrefix')} <span className="font-medium text-slate-900 dark:text-white">{documentName}</span>{' '}
                {t('aiProjects.consent.bodySuffix')}
              </p>
            </div>

            <div className="px-5 pb-2 space-y-2">
              <button
                onClick={() => onChoose('censored')}
                className="w-full text-left p-3 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/[0.06] hover:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-white">{t('aiProjects.consent.censorTitle')}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                    {t('aiProjects.consent.recommended')}
                  </span>
                </span>
                <span className="block mt-1 text-[11.5px] text-slate-600 dark:text-slate-400 leading-snug">
                  {t('aiProjects.consent.censorBody')}
                </span>
              </button>

              <button
                onClick={() => onChoose('full')}
                className="w-full text-left p-3 rounded-xl border border-stone-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors"
              >
                <span className="block text-[13px] font-semibold text-slate-900 dark:text-white">
                  {t('aiProjects.consent.fullTitle')}
                </span>
                <span className="block mt-1 text-[11.5px] text-slate-600 dark:text-slate-400 leading-snug">
                  {t('aiProjects.consent.fullBody')}
                </span>
              </button>
            </div>

            <div className="px-5 py-4 mt-2 flex justify-end border-t border-stone-100 dark:border-slate-800/60">
              <button
                onClick={onCancel}
                className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
