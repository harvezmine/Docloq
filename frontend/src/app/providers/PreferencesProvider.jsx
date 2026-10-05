// Accent-color preference for the authenticated app.
//
// Scope discipline: the accent CSS variables are written onto a target element
// registered by the authenticated shell (DashboardLayout), NEVER onto :root, so the
// landing page and login/OTP screens (outside the shell) keep the indigo defaults
// baked into the accent utilities' fallbacks. Default preset === the original look.

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { ACCENT_PRESETS, DEFAULT_ACCENT_ID, getPreset, applyAccentVars } from "./accent-presets";

const STORAGE_KEY = "docloq_accent";

const PreferencesContext = createContext({
  accent: DEFAULT_ACCENT_ID,
  setAccent: () => {},
  accentPreset: getPreset(DEFAULT_ACCENT_ID),
  presets: ACCENT_PRESETS,
  registerAccentTarget: () => {},
});

export function PreferencesProvider({ children }) {
  const [accent, setAccentState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_ACCENT_ID;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_ACCENT_ID;
  });

  // The authenticated shell registers its root node here (as a ref callback); only
  // that subtree receives the vars, so public pages keep the indigo fallback.
  const [target, setTarget] = useState(null);
  const registerAccentTarget = useCallback((el) => setTarget(el), []);

  const accentPreset = useMemo(() => getPreset(accent), [accent]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, accent); } catch { /* ignore */ }
  }, [accent]);

  useEffect(() => {
    if (target) applyAccentVars(target, accentPreset);
  }, [target, accentPreset]);

  const setAccent = useCallback((id) => {
    if (ACCENT_PRESETS.some((p) => p.id === id)) setAccentState(id);
  }, []);

  const value = useMemo(
    () => ({ accent, setAccent, accentPreset, presets: ACCENT_PRESETS, registerAccentTarget }),
    [accent, setAccent, accentPreset, registerAccentTarget]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
