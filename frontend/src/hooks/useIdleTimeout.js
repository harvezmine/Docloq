// Idle timeout hook, logs user out after 3 hours of no mouse/keyboard/touch activity
import { useEffect, useRef, useCallback } from 'react';
import useAuthStore from '../app/store/auth.store';
import api from '../services/api';

const IDLE_TIMEOUT = 3 * 60 * 60 * 1000;
const HEARTBEAT_INTERVAL = 5 * 60 * 1000;

export default function useIdleTimeout() {
  const { isAuthenticated, logout } = useAuthStore();
  const timerRef = useRef(null);
  const heartbeatRef = useRef(null);
  const isIdleRef = useRef(false);

  const handleLogout = useCallback(() => {
    console.warn('[IdleTimeout] Session expired due to inactivity');
    logout();
    window.location.href = '/login?reason=idle';
  }, [logout]);

  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return;

    // If returning from idle, send heartbeat to update server-side lastActivityAt
    if (isIdleRef.current) {
      isIdleRef.current = false;
      api.post('/auth/heartbeat').catch(() => {
        // If heartbeat fails (401), the interceptor will handle logout
      });
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleLogout, IDLE_TIMEOUT);
  }, [isAuthenticated, handleLogout]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

    // Throttle: only reset every 30 seconds max to avoid excessive timer resets
    let lastReset = Date.now();
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 30000) {
        lastReset = now;
        resetTimer();
      }
    };

    events.forEach(event => window.addEventListener(event, throttledReset, { passive: true }));

    resetTimer();

    // Periodic heartbeat to keep server session alive while active
    heartbeatRef.current = setInterval(() => {
      if (!isIdleRef.current && isAuthenticated) {
        api.post('/auth/heartbeat').catch(() => {});
      }
    }, HEARTBEAT_INTERVAL);

    const originalTimeout = timerRef.current;

    return () => {
      events.forEach(event => window.removeEventListener(event, throttledReset));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [isAuthenticated, resetTimer]);

  return null;
}
