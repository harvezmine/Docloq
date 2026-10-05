import { createContext, useContext, useEffect, useState } from 'react';
import Lenis from 'lenis';

const LenisContext = createContext(null);

/** Lenis instance for the landing page, or null (reduced motion / not mounted yet). */
export function useLenis() {
  return useContext(LenisContext);
}

/**
 * Landing-scoped inertial scrolling. Runs Lenis in window mode (no wrapper
 * transform) so position: sticky/fixed and framer-motion's useScroll keep
 * reading native window scroll. Destroyed on unmount so app routes are untouched.
 *
 * NOTE: Lenis runs regardless of the OS reduced-motion setting. The landing
 * experience is intentionally always-on (see docs/landing-hero.md), earlier
 * "disable on reduced-motion" behavior stripped the luxury scroll delay and
 * parallax on machines that happen to have the Windows "Animation effects"
 * toggle off, which read as broken.
 */
export default function SmoothScrollProvider({ children }) {
  const [lenis, setLenis] = useState(null);

  useEffect(() => {
    const prevRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    const instance = new Lenis({
      autoRaf: true,
      lerp: 0.06, // slow catch-up = the "luxury delay" scroll feel
      smoothWheel: true,
      wheelMultiplier: 1,
      syncTouch: false, // keep native touch inertia on mobile
      touchMultiplier: 1.5,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- exposing the instance created here is the point
    setLenis(instance);
    // Expose for e2e/debug scripting (deterministic scrollTo without wheel inertia).
    window.__lenis = instance;

    return () => {
      instance.destroy();
      setLenis(null);
      if (window.__lenis === instance) delete window.__lenis;
      window.history.scrollRestoration = prevRestoration || 'auto';
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
