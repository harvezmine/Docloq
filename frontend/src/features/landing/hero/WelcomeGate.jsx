import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';
import WaterTransition from './WaterTransition';

const EASE = [0.22, 1, 0.36, 1];

/**
 * Full-page "hello / welcome to docloq" gate shown after the preloader.
 * One click (or Enter/Space) anywhere melts the page away with a water-ripple
 * dissolve and reveals the hero already running beneath it.
 *
 * Parent flow: onEnterStart fires at the click (phase -> 'entering'),
 * onEntered fires once the dissolve finishes (phase -> 'entered', unmount).
 */
export default function WelcomeGate({ onEnterStart, onEntered }) {
  const { t } = useLang();
  const [point, setPoint] = useState(null);
  const entering = point !== null;

  const enter = (clientX, clientY) => {
    if (entering) return;
    setPoint({
      x: clientX ?? window.innerWidth / 2,
      y: clientY ?? window.innerHeight / 2,
    });
    onEnterStart?.();
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={t("landing.welcome.ariaEnter")}
      onClick={(e) => enter(e.clientX, e.clientY)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          enter();
        }
      }}
      className="fixed inset-0 z-[90] cursor-pointer select-none overflow-hidden bg-[#05060D] outline-none"
      initial={{ opacity: 1 }}
      animate={entering ? { opacity: 0 } : { opacity: 1 }}
      transition={entering ? { delay: 0.45, duration: 0.95, ease: EASE } : { duration: 0 }}
      onAnimationComplete={() => {
        if (entering) onEntered?.();
      }}
    >
      <WaterTransition active={entering} point={point} />

      {/* Everything inside this wrapper gets displaced ("melts") during entry */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ filter: entering ? 'url(#lp-water)' : undefined }}
      >
        {/* Still water backdrop, soft glows so the displacement has texture */}
        <div aria-hidden="true" className="absolute inset-0">
          <div
            className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[90vw] h-[70vh] rounded-full"
            style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, transparent 65%)' }}
          />
          <div
            className="absolute -bottom-1/3 left-1/4 w-[70vw] h-[60vh] rounded-full"
            style={{ background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.09) 0%, transparent 65%)' }}
          />
          <motion.div
            className="absolute inset-x-0 bottom-[18%] h-px"
            style={{ background: 'linear-gradient(to right, transparent, rgba(148,163,184,0.25), transparent)' }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="lp-grain absolute inset-0 opacity-[0.05] mix-blend-overlay" />
        </div>

        <div className="relative text-center px-6">
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.9, ease: EASE }}
            className="lp-hero-serif italic text-2xl sm:text-3xl text-slate-400 mb-5"
          >
            {t("landing.welcome.hello")}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 1.1, ease: EASE }}
            className="lp-hero-serif text-5xl sm:text-7xl lg:text-8xl font-medium text-[#DDE4F5] leading-tight"
          >
            {t("landing.welcome.welcomeTo")}{' '}
            <span className="italic bg-gradient-to-r from-violet-300 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
              docloq
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.8 }}
            className="mt-14 flex flex-col items-center gap-3"
          >
            <motion.span
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="text-[11px] tracking-[0.45em] uppercase text-slate-500"
            >
              {t("landing.welcome.clickToEnter")}
            </motion.span>
            <motion.span
              aria-hidden="true"
              animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0.15, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-2 h-2 rounded-full border border-cyan-300/60"
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
