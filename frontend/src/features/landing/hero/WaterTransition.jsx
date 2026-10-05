import { useEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];

/**
 * Water-ripple dissolve for the welcome gate.
 *
 * Renders an SVG turbulence/displacement filter (id "lp-water") plus expanding
 * ripple rings from the click point. While `active`, the displacement scale is
 * animated via direct attribute writes (no React re-renders). Apply
 * `filter: url(#lp-water)` to the content being dissolved.
 */
export default function WaterTransition({ active, point }) {
  const dispRef = useRef(null);
  const t = useMotionValue(0);

  // Animate only the displacement scale, the turbulence noise is computed once
  // and cached. Recomputing baseFrequency per frame is very costly (esp. Safari)
  // and the ripple reads the same visually.
  useMotionValueEvent(t, 'change', (v) => {
    dispRef.current?.setAttribute('scale', String(v * 140));
  });

  useEffect(() => {
    if (!active) return undefined;
    const controls = animate(t, 1, { duration: 1.4, ease: EASE });
    return () => controls.stop();
  }, [active, t]);

  const diagonal =
    typeof window !== 'undefined'
      ? Math.hypot(window.innerWidth, window.innerHeight)
      : 1600;

  return (
    <>
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <filter id="lp-water" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02 0.035"
              numOctaves="2"
              result="noise"
            />
            <feDisplacementMap
              ref={dispRef}
              in="SourceGraphic"
              in2="noise"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Ripple rings expanding from the click point */}
      {active && point &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className={`fixed z-[95] rounded-full border-2 pointer-events-none ${
              i === 1 ? 'border-violet-400/30' : 'border-cyan-300/40'
            }`}
            style={{
              left: point.x,
              top: point.y,
              width: 80,
              height: 80,
              translateX: '-50%',
              translateY: '-50%',
            }}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: (diagonal * 2.4) / 80, opacity: 0 }}
            transition={{ duration: 1.2, delay: i * 0.12, ease: EASE }}
          />
        ))}
    </>
  );
}
