import { useEffect, useRef } from 'react';

/**
 * Poll `onTick` every intervalMs while `active`, giving up after timeoutMs.
 * The start time is captured once per session, so onTick's own re-renders can't reset the clock.
 */
export default function usePolling(active, onTick, opts = {}) {
  const { intervalMs = 2000, timeoutMs = 60_000, onTimeout } = opts;
  const timerRef = useRef(null);
  const startRef = useRef(0);

  // Refs, not deps: an inline arrow callback would otherwise restart the session every render.
  const tickRef = useRef(onTick);
  const timeoutCbRef = useRef(onTimeout);
  tickRef.current = onTick;
  timeoutCbRef.current = onTimeout;

  useEffect(() => {
    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!active) {
      stop();
      startRef.current = 0;
      return undefined;
    }

    if (!startRef.current) startRef.current = Date.now();
    if (timerRef.current) return undefined;

    timerRef.current = setInterval(() => {
      if (Date.now() - startRef.current > timeoutMs) {
        stop();
        timeoutCbRef.current?.();
        return;
      }
      tickRef.current?.();
    }, intervalMs);

    // No cleanup: the timer must survive the re-renders onTick causes. Unmount clears it below.
    return undefined;
  }, [active, intervalMs, timeoutMs]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);
}
