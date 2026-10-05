import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useMotionValueEvent, useScroll, useSpring, useTransform } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';
import { useLenis } from '../SmoothScrollProvider';
import Hero3DFallback from './Hero3DFallback';
import SceneErrorBoundary from './SceneErrorBoundary';
import { GATE_PROGRESS, HERO_HEIGHT_VH, RANGES, STAGES } from './heroStages';

const HeroScene3D = lazy(() => import('./HeroScene3D'));

const EASE = [0.22, 1, 0.36, 1];

const DUST = [
  [8, 22, 2], [16, 68, 3], [24, 38, 2], [31, 82, 2], [38, 14, 3],
  [46, 58, 2], [55, 30, 2], [62, 76, 3], [70, 20, 2], [78, 52, 2],
  [86, 34, 3], [92, 70, 2], [12, 48, 2], [83, 88, 2],
];

function detectMode() {
  if (typeof window === 'undefined') return '2d';

  const small = window.matchMedia('(max-width: 767px)').matches;
  if (small) return '2d';
  try {
    const canvas = document.createElement('canvas');
    if (!(canvas.getContext('webgl2') || canvas.getContext('webgl'))) return '2d';
  } catch {
    return '2d';
  }
  return '3d';
}

function StageBlock({ progress, stage }) {
  const [a, b] = stage.range;
  const pad = Math.min(0.05, (b - a) / 3);
  const opacity = useTransform(progress, [a, a + pad, b - pad, b], [0, 1, 1, 0]);
  const y = useTransform(progress, [a, b], [56, -56]);
  const isRight = stage.align === 'right';

  return (
    <motion.div
      style={{ opacity, y }}
      className={`absolute z-10 flex flex-col pointer-events-none px-6
        inset-x-0 bottom-0 justify-end pb-24 items-start text-left
        sm:inset-x-auto sm:top-0 sm:justify-center sm:pb-0 sm:px-12 lg:px-24 sm:max-w-xl ${
        isRight ? 'sm:right-0 sm:items-end sm:text-right' : 'sm:left-0'
      }`}
    >
      <p className="font-mono text-[11px] tracking-[0.35em] uppercase text-slate-500 mb-3 sm:mb-4">
        {stage.eyebrow}
      </p>
      <h3 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#DDE4F5] leading-tight">
        {stage.title[0]}
        <br />
        <span className="lp-hero-serif italic font-medium bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
          {stage.title[1]}
        </span>
      </h3>
      <p className="mt-3 sm:mt-5 text-sm sm:text-lg text-slate-400 leading-relaxed max-w-md">
        {stage.sub}
      </p>
    </motion.div>
  );
}

const introContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.5 } },
};
const introItem = {
  hidden: { opacity: 0, y: 34 },
  show: { opacity: 1, y: 0, transition: { duration: 1, ease: EASE } },
};

export default function HeroSection({ phase }) {
  const { t } = useLang();
  const heroRef = useRef(null);
  const [mode, setMode] = useState(detectMode);

  const [forced2d, setForced2d] = useState(false);
  const activeMode = forced2d ? '2d' : mode;

  const [finePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );
  const gateEligible = activeMode === '3d' && finePointer;
  const [hintDone, setHintDone] = useState(false);
  const [gateLocked, setGateLocked] = useState(false);
  const inView = useInView(heroRef, { margin: '200px 0px 200px 0px' });
  const revealed = phase === 'entering' || phase === 'entered';
  const lenis = useLenis();

  const gateRef = useRef({ done: false, bypass: false });

  const scatterCtl = useRef({ requested: false });

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end end'],
  });

  useEffect(() => {
    const bypass = () => { gateRef.current.bypass = true; setGateLocked(false); };
    window.addEventListener('lp:gate-bypass', bypass);
    return () => window.removeEventListener('lp:gate-bypass', bypass);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setMode(detectMode());
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!gateLocked) return undefined;
    const timer = setTimeout(() => { scatterCtl.current.requested = true; }, 7000);
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scatterCtl.current.requested = true;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [gateLocked]);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const gate = gateRef.current;

    if (v < 0.03) {
      if (gate.done) gate.done = false;
      return;
    }
    if (!gateEligible || gate.done || gate.bypass || phase !== 'entered') return;
    if (v > GATE_PROGRESS + 0.002) {

      const el = heroRef.current;
      if (!el) return;
      const top = window.scrollY + el.getBoundingClientRect().top;
      const gateY = Math.round(top + GATE_PROGRESS * (el.offsetHeight - window.innerHeight));
      if (lenis) lenis.scrollTo(gateY, { immediate: true, force: true });
      else window.scrollTo(0, gateY);
      setGateLocked(true);
    } else if (v < GATE_PROGRESS - 0.02) {
      setGateLocked(false);
    }
  });

  const releaseGate = () => {
    gateRef.current.done = true;
    setGateLocked(false);
    setHintDone(true);
  };

  const springCfg = { stiffness: 48, damping: 22 };
  const materialize = useSpring(useTransform(scrollYProgress, RANGES.materialize, [0, 1]), springCfg);
  const spread = useSpring(useTransform(scrollYProgress, RANGES.spread, [0, 1]), springCfg);
  const gather = useSpring(useTransform(scrollYProgress, RANGES.gather, [0, 1]), springCfg);

  const condense = useSpring(useTransform(scrollYProgress, RANGES.condense, [0, 0.5, 0.5, 1]), springCfg);

  const prog = useSpring(scrollYProgress, springCfg);
  const camZ = useSpring(useTransform(scrollYProgress, RANGES.camZ, RANGES.camZValues), springCfg);

  const sceneOpacity = useTransform(scrollYProgress, [0.962, 0.995], [1, 0]);
  const sceneY = useTransform(scrollYProgress, [0.94, 1], [0, -70]);

  const nebula1Y = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const nebula2Y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const dustY = useTransform(scrollYProgress, [0, 1], [0, -70]);

  const introOpacity = useTransform(scrollYProgress, [0.05, 0.11], [1, 0]);
  const introScale = useTransform(scrollYProgress, [0, 0.13], [1, 1.9]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  const hintOpacity = useTransform(scrollYProgress, [0.13, 0.17, 0.27, 0.32], [0, 1, 1, 0]);

  const ctaOpacity = useTransform(scrollYProgress, [0.958, 0.985], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.958, 0.992], [44, 0]);

  return (
    <section
      ref={heroRef}
      id="hero"
      data-mood="hero"
      className="relative"
      style={{ height: `${HERO_HEIGHT_VH}vh` }}
    >
      <h1 className="sr-only">
        {t("landing.hero.srIntro")}
      </h1>

      <div className="sticky top-0 h-dvh overflow-hidden">

        <motion.div aria-hidden="true" style={{ y: nebula1Y }} className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-32 -left-40 w-[42rem] h-[42rem] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 68%)' }}
          />
        </motion.div>
        <motion.div aria-hidden="true" style={{ y: nebula2Y }} className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -bottom-40 -right-32 w-[40rem] h-[40rem] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 68%)' }}
          />
        </motion.div>

        <motion.div aria-hidden="true" style={{ y: dustY }} className="absolute inset-0 pointer-events-none">
          {DUST.map(([left, top, size], i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white/15"
              style={{ left: `${left}%`, top: `${top}%`, width: size, height: size }}
            />
          ))}
        </motion.div>

        <motion.div style={{ opacity: sceneOpacity, y: sceneY }} className="absolute inset-0">
          {activeMode === '3d' ? (
            <SceneErrorBoundary
              onError={() => setForced2d(true)}
              fallback={
                <Hero3DFallback
                  materialize={materialize}
                  spread={spread}
                  gather={gather}
                  condense={condense}
                  prog={prog}
                />
              }
            >
              <Suspense
                fallback={
                  <Hero3DFallback
                    materialize={materialize}
                    spread={spread}
                    gather={gather}
                    condense={condense}
                    prog={prog}
                  />
                }
              >
                <HeroScene3D
                  materialize={materialize}
                  spread={spread}
                  gather={gather}
                  condense={condense}
                  prog={prog}
                  camZ={camZ}
                  paused={!inView}
                  onUserScatter={releaseGate}
                  scatterCtl={scatterCtl}
                  onContextLost={() => setForced2d(true)}
                />
              </Suspense>
            </SceneErrorBoundary>
          ) : (
            <Hero3DFallback
              materialize={materialize}
              spread={spread}
              gather={gather}
              condense={condense}
              prog={prog}
            />
          )}
        </motion.div>

        <div aria-hidden="true" className="lp-grain absolute inset-0 pointer-events-none opacity-[0.035]" />

        <motion.div
          style={{ opacity: introOpacity, scale: introScale }}
          className="absolute inset-0 z-10 flex items-center justify-center text-center pointer-events-none px-6"
        >
          <motion.div
            variants={introContainer}
            initial={false}
            animate={revealed ? 'show' : 'hidden'}
            className="max-w-3xl"
          >
            <motion.p
              variants={introItem}
              className="font-mono text-[11px] tracking-[0.45em] uppercase text-slate-500 mb-6"
            >
              {t("landing.hero.eyebrow")}
            </motion.p>
            <motion.h2
              variants={introItem}
              className="text-4xl sm:text-6xl lg:text-7xl font-bold text-[#DDE4F5] leading-[1.06]"
            >
              {t("landing.hero.introA")}{' '}
              <span className="lp-hero-serif italic font-medium bg-gradient-to-r from-violet-300 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
                {t("landing.hero.introB")}
              </span>
              .
            </motion.h2>
            <motion.p variants={introItem} className="mt-7 text-lg text-slate-400 max-w-xl mx-auto">
              {t("landing.hero.introSub")}
            </motion.p>
          </motion.div>
        </motion.div>

        {gateEligible && (
        <motion.div
          style={{ opacity: hintOpacity, pointerEvents: hintDone ? 'none' : undefined }}
          className="absolute inset-x-0 bottom-14 z-10 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)]"
        >
          <motion.div
            animate={hintDone ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-2.5 pointer-events-auto"
          >
            <motion.button
              type="button"
              onClick={() => { scatterCtl.current.requested = true; }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="group relative flex items-center gap-3 px-6 py-3 rounded-full border border-cyan-400/30 bg-slate-950/60 cursor-pointer hover:border-cyan-300/70 hover:bg-slate-900/70 transition-colors"
            >
              <span
                aria-hidden="true"
                className="absolute -inset-1 rounded-full border border-cyan-400/20 animate-ping [animation-duration:2.4s]"
              />
              <svg className="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <span className="text-[11px] tracking-[0.3em] uppercase text-slate-200">
                {t("landing.hero.scatterButton")}
              </span>
            </motion.button>
            <span
              className={`text-[10px] tracking-[0.25em] uppercase text-slate-500 transition-opacity duration-300 ${
                gateLocked ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {t("landing.hero.scatterHint")}
            </span>
          </motion.div>
        </motion.div>
        )}

        {STAGES.map((stage) => (
          <StageBlock key={stage.key} progress={scrollYProgress} stage={stage} />
        ))}

        <motion.div
          style={{ opacity: ctaOpacity, y: ctaY }}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center pointer-events-none px-6"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 52%, rgba(5,6,13,0.72) 0%, transparent 75%)' }}
          />
          <p className="font-mono text-[11px] tracking-[0.45em] uppercase text-slate-500 mb-6">docloq</p>
          <h3 className="text-4xl sm:text-6xl font-bold text-[#DDE4F5] leading-tight">
            {t("landing.hero.closingA")}{' '}
            <span className="lp-hero-serif italic font-medium text-violet-300">{t("landing.hero.closingThink")}</span>
            {' '}&amp;{' '}
            <span className="lp-hero-serif italic font-medium text-emerald-300">{t("landing.hero.closingProve")}</span>.
          </h3>
          <p className="mt-6 text-lg text-slate-400 max-w-xl">
            {t("landing.hero.closingSub")}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 pointer-events-auto">
            <Link
              to="/contact"
              className="group inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-gradient-to-b from-cyan-300 to-cyan-500 text-slate-950 text-base font-semibold shadow-[0_8px_32px_rgba(34,211,238,0.22)] hover:shadow-[0_10px_40px_rgba(34,211,238,0.38)] hover:brightness-105 transition-all"
            >
              {t("landing.nav.requestAccess")}
              <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-base font-medium text-slate-300 border border-white/15 hover:border-cyan-400/50 hover:text-white transition-colors"
            >
              {t("landing.nav.signIn")}
            </Link>
          </div>
        </motion.div>

        <motion.div
          style={{ opacity: cueOpacity }}
          className="absolute bottom-7 inset-x-0 z-10 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)]"
          aria-hidden="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={phase === 'entered' ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 0.9, duration: 0.8 }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-[10px] tracking-[0.35em] uppercase text-slate-500">{t("landing.hero.scrollSlowly")}</span>
            <div className="w-px h-12 bg-slate-800 overflow-hidden">
              <motion.div
                animate={{ y: ['-100%', '100%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="w-full h-1/2 bg-cyan-400"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
