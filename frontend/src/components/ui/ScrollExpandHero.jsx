import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

// Adapted from scroll-expansion-hero (no Next.js); renders `children` instead of a fixed video/image.
const ScrollExpandHero = ({
  children,
  title = '',
  subtitle = '',
  scrollLabel = 'Scroll to explore',
  afterContent = null,
  overlay = null,
  bgElement = null,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [fullyExpanded, setFullyExpanded] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const sectionRef = useRef(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const handleWheel = (e) => {
      if (fullyExpanded && e.deltaY < 0 && window.scrollY <= 5) {
        setFullyExpanded(false);
        setShowContent(false);
        e.preventDefault();
      } else if (!fullyExpanded) {
        e.preventDefault();
        const delta = e.deltaY * 0.0009;
        const next = Math.min(Math.max(scrollProgress + delta, 0), 1);
        setScrollProgress(next);
        if (next >= 1) {
          setFullyExpanded(true);
          setShowContent(true);
        } else if (next < 0.75) {
          setShowContent(false);
        }
      }
    };

    const handleTouchStart = (e) => setTouchStartY(e.touches[0].clientY);

    const handleTouchMove = (e) => {
      if (!touchStartY) return;
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;

      if (fullyExpanded && deltaY < -20 && window.scrollY <= 5) {
        setFullyExpanded(false);
        setShowContent(false);
        e.preventDefault();
      } else if (!fullyExpanded) {
        e.preventDefault();
        const factor = deltaY < 0 ? 0.008 : 0.005;
        const next = Math.min(Math.max(scrollProgress + deltaY * factor, 0), 1);
        setScrollProgress(next);
        if (next >= 1) {
          setFullyExpanded(true);
          setShowContent(true);
        } else if (next < 0.75) {
          setShowContent(false);
        }
        setTouchStartY(touchY);
      }
    };

    const handleTouchEnd = () => setTouchStartY(0);

    const handleScroll = () => {
      if (!fullyExpanded) window.scrollTo(0, 0);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scrollProgress, fullyExpanded, touchStartY]);

  const containerWidth = 300 + scrollProgress * (isMobile ? 650 : 1250);
  const containerHeight = 350 + scrollProgress * (isMobile ? 250 : 450);
  const textTranslateX = scrollProgress * (isMobile ? 120 : 100);

  // Split title into two lines for the split-scroll effect
  const words = title.split(' ');
  const midpoint = Math.ceil(words.length / 2);
  const firstLine = words.slice(0, midpoint).join(' ');
  const secondLine = words.slice(midpoint).join(' ');

  return (
    <div ref={sectionRef} className="overflow-x-hidden">
      <section className="relative flex flex-col items-center justify-start min-h-[100dvh]">
        <div className="relative w-full flex flex-col items-center min-h-[100dvh]">
          {bgElement && (
            <motion.div
              className="absolute inset-0 z-0 h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 - scrollProgress * 0.6 }}
              transition={{ duration: 0.1 }}
            >
              {bgElement}
            </motion.div>
          )}

          <div className="w-full flex flex-col items-center justify-start relative z-10">
            <div className="flex flex-col items-center justify-center w-full h-[100dvh] relative">
              <div
                className="absolute z-0 top-1/2 left-1/2 rounded-2xl overflow-hidden"
                style={{
                  width: `${containerWidth}px`,
                  height: `${containerHeight}px`,
                  maxWidth: '95vw',
                  maxHeight: '85vh',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: `0px 0px ${30 + scrollProgress * 40}px rgba(139, 92, 246, ${0.1 + scrollProgress * 0.15})`,
                  border: `1px solid rgba(255,255,255,${0.05 + scrollProgress * 0.05})`,
                }}
              >
                <div className="relative w-full h-full">
                  {children}

                  {overlay || (
                    <motion.div
                      className="absolute inset-0 bg-slate-950/40 rounded-2xl pointer-events-none"
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: Math.max(0.6 - scrollProgress * 0.5, 0.1) }}
                      transition={{ duration: 0.15 }}
                    />
                  )}
                </div>

              </div>

              <div className="absolute z-20 left-1/2 -translate-x-1/2 flex flex-col items-center text-center"
                style={{ top: `calc(50% + ${containerHeight / 2 + 16}px)` }}
              >
                {subtitle && (
                  <motion.p
                    className="text-sm md:text-base text-brand-300/80 font-medium tracking-wide"
                    style={{ transform: `translateX(-${textTranslateX}vw)` }}
                    animate={{ opacity: 1 - scrollProgress * 1.5 }}
                  >
                    {subtitle}
                  </motion.p>
                )}
                {scrollLabel && (
                  <motion.p
                    className="text-xs md:text-sm text-slate-400 mt-1 flex items-center gap-2"
                    style={{ transform: `translateX(${textTranslateX}vw)` }}
                    animate={{ opacity: 1 - scrollProgress * 2 }}
                  >
                    <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    {scrollLabel}
                  </motion.p>
                )}
              </div>

              <div className="flex items-center justify-center text-center gap-3 md:gap-4 w-full relative z-10 flex-col mix-blend-difference pointer-events-none">
                <motion.h2
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-white/90 whitespace-nowrap"
                  style={{ transform: `translateX(-${textTranslateX}vw)` }}
                >
                  {firstLine}
                </motion.h2>
                <motion.h2
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-white/90 whitespace-nowrap"
                  style={{ transform: `translateX(${textTranslateX}vw)` }}
                >
                  {secondLine}
                </motion.h2>
              </div>
            </div>

            <motion.section
              className="flex flex-col w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: showContent ? 1 : 0 }}
              transition={{ duration: 0.7 }}
            >
              {afterContent}
            </motion.section>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ScrollExpandHero;
