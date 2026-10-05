import { useEffect, useMemo, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const MOODS = {
  hero: { a: { color: 'rgba(139,92,246,0.14)', x: '-12vw', y: '18vh' }, b: { color: 'rgba(34,211,238,0.12)', x: '68vw', y: '55vh' } },
  platform: { a: { color: 'rgba(34,211,238,0.13)', x: '-8vw', y: '30vh' }, b: { color: 'rgba(14,165,233,0.1)', x: '70vw', y: '20vh' } },
  doki: { a: { color: 'rgba(217,70,239,0.12)', x: '60vw', y: '10vh' }, b: { color: 'rgba(139,92,246,0.12)', x: '-10vw', y: '60vh' } },
  features: { a: { color: 'rgba(139,92,246,0.13)', x: '-10vw', y: '25vh' }, b: { color: 'rgba(168,85,247,0.1)', x: '72vw', y: '60vh' } },
  analysis: { a: { color: 'rgba(139,92,246,0.13)', x: '65vw', y: '25vh' }, b: { color: 'rgba(217,70,239,0.1)', x: '-8vw', y: '55vh' } },
  how: { a: { color: 'rgba(34,211,238,0.12)', x: '-12vw', y: '40vh' }, b: { color: 'rgba(6,182,212,0.1)', x: '70vw', y: '15vh' } },
  chain: { a: { color: 'rgba(16,185,129,0.12)', x: '62vw', y: '35vh' }, b: { color: 'rgba(34,211,238,0.1)', x: '-10vw', y: '20vh' } },
  security: { a: { color: 'rgba(16,185,129,0.13)', x: '-10vw', y: '30vh' }, b: { color: 'rgba(52,211,153,0.1)', x: '68vw', y: '55vh' } },

  cta: { a: { color: 'rgba(124,110,230,0.09)', x: '30vw', y: '30vh' }, b: { color: 'rgba(52,211,153,0.06)', x: '60vw', y: '60vh' } },
};

const ORB_TRANSITION = { duration: 1.6, ease: 'easeInOut' };

const orbGradient = (color) => `radial-gradient(circle, ${color} 0%, transparent 70%)`;

export default function LandingBackdrop() {
  const [mood, setMood] = useState('hero');
  const { scrollYProgress } = useScroll();
  const orbsY = useTransform(scrollYProgress, [0, 1], [0, -250]);

  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-mood]'));
    if (els.length === 0) return undefined;
    const coverage = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          coverage.set(
            entry.target,
            entry.intersectionRect.height / Math.max(1, window.innerHeight)
          );
        });
        let best = null;
        let bestCoverage = 0;
        coverage.forEach((value, el) => {
          if (value > bestCoverage) {
            bestCoverage = value;
            best = el;
          }
        });
        if (best?.dataset.mood && MOODS[best.dataset.mood]) {
          setMood(best.dataset.mood);
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const particles = useMemo(
    () =>
      [...Array(12)].map((_, i) => ({
        id: i,
        size: (i % 4) + 2,
        x: (i * 47 + 13) % 100,
        y: (i * 31 + 7) % 100,
        duration: 14 + (i % 5) * 4,
        delay: (i % 7) * 0.8,
      })),
    []
  );

  const target = MOODS[mood] ?? MOODS.hero;

  return (
    <div className="fixed inset-0 z-0 bg-[#05060D]" aria-hidden="true">
      
      <motion.div style={{ y: orbsY }} className="absolute inset-0">
        <motion.div
          className="absolute left-0 top-0 w-[640px] h-[640px] will-change-transform"
          animate={{ background: orbGradient(target.a.color), x: target.a.x, y: target.a.y }}
          transition={ORB_TRANSITION}
        />
        <motion.div
          className="absolute left-0 top-0 w-[560px] h-[560px] will-change-transform"
          animate={{ background: orbGradient(target.b.color), x: target.b.x, y: target.b.y }}
          transition={ORB_TRANSITION}
        />
      </motion.div>

      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
        }}
      />

      {particles.map((el) => (
        <motion.div
          key={el.id}
          className="absolute rounded-full bg-white/10"
          style={{ width: el.size, height: el.size, left: `${el.x}%`, top: `${el.y}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: el.duration, repeat: Infinity, delay: el.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
