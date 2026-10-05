// Global language provider, persists choice to localStorage; components read useLang().

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import DICT from "@/i18n";

const LanguageContext = createContext({ lang: "id", setLang: () => {}, t: (key, fallback) => fallback || key });

// Resolve a dot-path ("nav.dashboard") against the dictionary; returns the {id,en} leaf or undefined.
function lookup(path) {
  if (typeof path !== "string" || !path.includes(".")) return undefined;
  let node = DICT;
  for (const part of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return node && typeof node === "object" ? node : undefined;
}

const STORAGE_KEY = "docloq_lang";

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window === "undefined") return "id";
    return localStorage.getItem(STORAGE_KEY) || "id";
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    // Reflect on the <html> element for CSS / accessibility.
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
    // Broadcast for any non-React consumer that might want to react.
    try { window.dispatchEvent(new CustomEvent("docloq:lang", { detail: lang })); } catch { /* ignore */ }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (next === "id" || next === "en") setLangState(next);
  }, []);

  // Accepts a dot-path key ("nav.dashboard"), a {id,en} object, or a plain string.
  // Resolution order: dictionary key → inline object → fallback → raw value.
  const t = useCallback((value, fallback) => {
    if (value && typeof value === "object") {
      return value[lang] ?? value.id ?? value.en ?? fallback ?? "";
    }
    if (typeof value === "string") {
      const entry = lookup(value);
      if (entry) return entry[lang] ?? entry.id ?? entry.en ?? fallback ?? value;
    }
    return fallback ?? value ?? "";
  }, [lang]);

  const ctx = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={ctx}>{children}</LanguageContext.Provider>;
}

export function useLang() { return useContext(LanguageContext); }
