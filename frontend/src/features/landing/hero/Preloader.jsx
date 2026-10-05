import { motion, useReducedMotion } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';
import DocLoqMark from '@/components/brand/DocLoqMark';
import DocLoqWordmark from '@/components/brand/DocLoqWordmark';

/**
 * Full-screen DocLoq intro loader. Purely visual, the parent phase machine
 * decides when to unmount it (wrap in <AnimatePresence> for the exit fade).
 * Plays on every reload by design.
 *
 * Uses the real brand lockup (shield mark + wordmark) rather than a bare "D".
 * The accent utilities here always resolve to the DEFAULT brand gradient: the
 * --accent-* vars are only set on the authenticated shell, so a user's personal
 * accent can never leak onto the public landing page.
 */
export default function Preloader() {
  const { t } = useLang();
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center overflow-hidden"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {/* Ambient brand wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-wash blur-3xl"
      />

      <div className="relative flex flex-col items-center">
        {/* Mark + pulsing rings */}
        <div className="relative mb-7">
          {!reduce && [0, 1].map((i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="absolute inset-0 rounded-[1.4rem] border border-white/20"
              initial={{ scale: 1, opacity: 0.45 }}
              animate={{ scale: 1.75, opacity: 0 }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 1.2, ease: 'easeOut' }}
            />
          ))}

          <motion.div
            aria-hidden="true"
            className="absolute -inset-5 rounded-full bg-accent-gradient blur-2xl"
            initial={{ opacity: 0.3 }}
            animate={reduce ? { opacity: 0.3 } : { opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduce ? { duration: 0.3 } : { type: 'spring', damping: 13, stiffness: 190 }}
            className="relative flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-accent-gradient-br text-white shadow-2xl shadow-accent ring-1 ring-white/15"
          >
            <DocLoqMark className="h-11 w-11" variant="current" />
          </motion.div>
        </div>

        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.45, ease: 'easeOut' }}
        >
          <DocLoqWordmark className="h-6 w-auto text-white" />
        </motion.div>

        {/* Progress */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.38 }}
          className="mt-6 h-[3px] w-48 overflow-hidden rounded-full bg-white/10"
        >
          <motion.div
            className="h-full rounded-full bg-accent-gradient"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.1, delay: 0.3, ease: 'easeInOut' }}
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-sm tracking-wide text-slate-400"
        >
          {t('landing.preloader.tagline')}
        </motion.p>
      </div>
    </motion.div>
  );
}
