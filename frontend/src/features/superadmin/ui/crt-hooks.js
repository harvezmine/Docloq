// Non-component helpers for the CRT skin (kept out of terminal.jsx so that file
// only exports components, satisfies react-refresh/only-export-components).

import { useState, useEffect, useCallback } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

export const CRT_THEME_KEY = "docloq_crt_theme";

// Cycle order for the toggle. Amber-gold is the default (no green). All black-based.
export const CRT_THEMES = ["amber", "blue", "mono"];

export function useCrtTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(CRT_THEME_KEY);
      return CRT_THEMES.includes(saved) ? saved : "amber";
    } catch { return "amber"; }
  });
  const toggle = useCallback(() => {
    setTheme((t) => {
      const i = CRT_THEMES.indexOf(t);
      const next = CRT_THEMES[(i + 1) % CRT_THEMES.length];
      try { localStorage.setItem(CRT_THEME_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return [theme, toggle];
}
