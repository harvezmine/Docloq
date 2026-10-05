// Citation marker, inline [N] button with hover popover

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useLang } from '@/app/providers/LanguageProvider';

export default function CitationMarker({ n, citation, onClick }) {
  const { t } = useLang();
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  const orphan = !citation;

  const showPopover = () => {
    if (orphan) return;
    if (timer.current) clearTimeout(timer.current);
    setShow(true);
  };
  const hidePopover = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 100);
  };

  if (orphan) {
    return (
      <span
        className="inline-flex items-center justify-center px-1.5 py-0 mx-0.5 text-[10px] font-semibold rounded border border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-help align-baseline"
        title={t('aiProjects.citation.sourceRemoved')}
      >
        [?]
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onMouseEnter={showPopover}
        onMouseLeave={hidePopover}
        onFocus={showPopover}
        onBlur={hidePopover}
        onClick={() => onClick?.(citation)}
        className="inline-flex items-center justify-center px-1.5 py-0 mx-0.5 text-[10px] font-semibold rounded border border-brand-600/40 dark:border-brand-400/40 text-brand-700 dark:text-brand-300 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-colors align-baseline cursor-pointer"
      >
        {/* Label the SOURCE, not the raw marker: `n` indexes chunks, so a 3-source project
            can emit [17] while this citation's own popover reads "Sumber 2". `n` stays the
            lookup key in ChatPanel; only the label changes. */}
        [{citation.sourceNumber ?? n}]
      </button>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            onMouseEnter={showPopover}
            onMouseLeave={hidePopover}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 z-50 pointer-events-auto"
          >
            <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-lg shadow-xl p-3 text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-wider text-brand-300 font-semibold">
                {/* n indexes the chunk list; sourceNumber is the human-facing source.
                    Fallback keeps pre-chunking messages (no sourceNumber stored) correct. */}
                <span>{t('aiProjects.citation.source')} {citation.sourceNumber ?? n}</span>
                {citation.page && <span className="text-slate-400">· {t('aiProjects.citation.page')} {citation.page}</span>}
              </div>
              <p className="font-semibold mb-1 line-clamp-1">{citation.title}</p>
              {citation.quote && (
                <p className="text-slate-300 line-clamp-3 italic">"{citation.quote}"</p>
              )}
              <p className="mt-2 flex items-center gap-1 text-[10px] text-brand-300">
                {t('aiProjects.citation.clickForDetail')}
                <ArrowRight className="w-3 h-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              </p>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45 -mt-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
