import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'framer-motion';

// Wraps v into [min, max) so the strip loops seamlessly.
const wrap = (min, max, v) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

/**
 * SecurityMarquee, horizontal strip of security specs, driven by scroll
 * velocity: perfectly still at rest, glides left as you scroll down,
 * reverses when you scroll up. Content is duplicated 4× so the -25%
 * wrap never exposes a gap on ultrawide screens.
 */
export default function SecurityMarquee({ items = [] }) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(velocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smoothVelocity, [-1500, 0, 1500], [-5, 0, 5], {
    clamp: true,
  });

  useAnimationFrame((_, delta) => {
    const moveBy = factor.get() * (delta / 1000) * 6;
    if (moveBy !== 0) baseX.set(baseX.get() + moveBy);
  });

  // Scroll down (positive velocity) pushes the strip left.
  const x = useTransform(baseX, (v) => `${wrap(-25, 0, -v)}%`);

  const row = (ariaHidden) => (
    <div className="flex items-center shrink-0" aria-hidden={ariaHidden}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center font-mono text-xs sm:text-sm tracking-widest uppercase whitespace-nowrap">
          <span className="text-slate-300 font-semibold">{item.value}</span>
          <span className="ml-2 text-slate-600">{item.label}</span>
          <span className="mx-6 sm:mx-10 text-violet-500/60">✦</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="relative py-6 border-y border-white/5 bg-slate-950/25 overflow-hidden lp-marquee-mask">
      <motion.div className="flex w-max" style={{ x }}>
        {row(false)}
        {row(true)}
        {row(true)}
        {row(true)}
      </motion.div>
    </div>
  );
}
