import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

const ThemeContext = createContext();

const MODE_KEY = "docloq_theme_mode"; // 'light' | 'dark' | 'system'
const LEGACY_KEY = "theme";           // pre-preferences key: 'light' | 'dark'

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }) {
  // Mode is the user's choice; `theme` below is the resolved light/dark actually applied.
  const [mode, setModeState] = useState(() => {
    if (typeof window === "undefined") return "system";
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
    // Migrate the old two-state key so existing users keep their explicit choice.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === "light" || legacy === "dark") return legacy;
    return "system";
  });

  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Track OS changes live so 'system' mode stays in sync without a reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem(MODE_KEY, mode);
    // Keep the legacy key aligned for any code still reading it.
    localStorage.setItem(LEGACY_KEY, theme);
  }, [theme, mode]);

  const setMode = useCallback((next) => {
    if (next === "light" || next === "dark" || next === "system") setModeState(next);
  }, []);

  // Sidebar quick-toggle: always resolves to an explicit light/dark choice.
  const toggleTheme = useCallback(() => {
    setModeState(theme === "light" ? "dark" : "light");
  }, [theme]);

  const value = useMemo(
    () => ({ theme, mode, setMode, toggleTheme }),
    [theme, mode, setMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
