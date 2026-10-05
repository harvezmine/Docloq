import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Adapted from hero-shutter-text.tsx for React/Vite (no TypeScript, no shadcn).
export default function HeroShutterText({
  text = 'DOCLOQ',
  className = '',
  autoReplay = false,
  interval = 6000,
  accentColor = 'text-brand-500',
}) {
  const [count, setCount] = useState(0);
  const characters = text.split('');

  useEffect(() => {
    if (!autoReplay) return;
    const timer = setInterval(() => setCount((c) => c + 1), interval);
    return () => clearInterval(timer);
  }, [autoReplay, interval]);

  return (
    <div className={`relative flex items-center justify-center w-full ${className}`}>
      <div className="relative z-10 w-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={count}
            className="flex flex-wrap justify-center items-center w-full"
          >
            {characters.map((char, i) => (
              <div
                key={i}
                className="relative px-[0.1vw] overflow-hidden"
              >
                <motion.span
                  initial={{ opacity: 0, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  transition={{ delay: i * 0.04 + 0.3, duration: 0.8 }}
                  className="text-[11vw] sm:text-[10vw] md:text-[9vw] lg:text-8xl leading-none font-black text-white tracking-tighter"
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>

                <motion.span
                  initial={{ x: '-100%', opacity: 0 }}
                  animate={{ x: '100%', opacity: [0, 1, 0] }}
                  transition={{
                    duration: 0.7,
                    delay: i * 0.04,
                    ease: 'easeInOut',
                  }}
                  className={`absolute inset-0 text-[11vw] sm:text-[10vw] md:text-[9vw] lg:text-8xl leading-none font-black ${accentColor} z-10 pointer-events-none`}
                  style={{ clipPath: 'polygon(0 0, 100% 0, 100% 35%, 0 35%)' }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>

                <motion.span
                  initial={{ x: '100%', opacity: 0 }}
                  animate={{ x: '-100%', opacity: [0, 1, 0] }}
                  transition={{
                    duration: 0.7,
                    delay: i * 0.04 + 0.1,
                    ease: 'easeInOut',
                  }}
                  className="absolute inset-0 text-[11vw] sm:text-[10vw] md:text-[9vw] lg:text-8xl leading-none font-black text-slate-200 z-10 pointer-events-none"
                  style={{
                    clipPath: 'polygon(0 35%, 100% 35%, 100% 65%, 0 65%)',
                  }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>

                <motion.span
                  initial={{ x: '-100%', opacity: 0 }}
                  animate={{ x: '100%', opacity: [0, 1, 0] }}
                  transition={{
                    duration: 0.7,
                    delay: i * 0.04 + 0.2,
                    ease: 'easeInOut',
                  }}
                  className={`absolute inset-0 text-[11vw] sm:text-[10vw] md:text-[9vw] lg:text-8xl leading-none font-black ${accentColor} z-10 pointer-events-none`}
                  style={{
                    clipPath: 'polygon(0 65%, 100% 65%, 100% 100%, 0 100%)',
                  }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
