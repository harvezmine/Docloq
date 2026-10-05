// Terminal/CRT UI atoms for the superadmin dashboard; presentation-only, respects prefers-reduced-motion.

import { useState, useEffect, useRef, useCallback } from "react";
import { useReducedMotion } from "./crt-hooks.js";
import { useLang } from "@/app/providers/LanguageProvider";

// Fixed scanline + vignette + flicker overlay (render once).
export function CrtScanlines() {
  return <div className="crt-scanlines" aria-hidden="true" />;
}

// Blinking block cursor.
export function Cursor() {
  return <span className="crt-cursor" aria-hidden="true" />;
}

export function Typewriter({ text = "", speed = 26, className = "", cursor = false, onDone }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    if (reduced) {
      setN(text.length);
      onDone?.();
      return;
    }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) {
        clearInterval(id);
        if (!doneRef.current) { doneRef.current = true; onDone?.(); }
      }
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, reduced]);

  return (
    <span className={className}>
      {text.slice(0, n)}
      {cursor && n >= text.length && <Cursor />}
    </span>
  );
}

const SPIN = ["|", "/", "-", "\\"];
export function AsciiSpinner({ label, className = "" }) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((v) => (v + 1) % SPIN.length), 110);
    return () => clearInterval(id);
  }, [reduced]);
  const resolvedLabel = label ?? t("superadmin.terminal.asciiSpinnerDefaultLabel");
  return (
    <span className={`font-mono text-[color:var(--crt-accent)] crt-glow ${className}`}>
      [{SPIN[i]}] {resolvedLabel}
      <span className="crt-cursor ml-1" />
    </span>
  );
}

// Fake dmesg lines, skippable; calls onDone when finished.
export function BootSequence({ onDone }) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const [line, setLine] = useState(0);
  const skip = useCallback(() => onDone?.(), [onDone]);
  const bootLines = [
    t("superadmin.terminal.bootKernel"),
    t("superadmin.terminal.bootAuth"),
    t("superadmin.terminal.bootMount"),
    t("superadmin.terminal.bootAuditSvc"),
    t("superadmin.terminal.bootBlockchainSvc"),
    t("superadmin.terminal.bootCrypto"),
    t("superadmin.terminal.bootReady"),
  ];

  useEffect(() => {
    if (reduced) { onDone?.(); return; }
    const id = setTimeout(skip, 4200); // hard cap in case a line stalls
    return () => clearTimeout(id);
  }, [reduced, skip, onDone]);

  if (reduced) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-[color:var(--crt-bg)] flex items-center justify-center cursor-pointer"
      onClick={skip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " " || e.key === "Escape") && skip()}
      aria-label={t("superadmin.terminal.skipBootAria")}
    >
      <div className="w-full max-w-lg px-6 font-mono text-sm leading-relaxed">
        {bootLines.slice(0, line + 1).map((l, idx) => (
          <div key={idx} className={idx === bootLines.length - 1 ? "text-[color:var(--crt-accent)] crt-glow font-bold" : "text-[color:var(--crt-fg-dim)]"}>
            <span className="text-[color:var(--crt-accent)]">$</span>{" "}
            {idx === line ? (
              <Typewriter
                text={l}
                speed={16}
                cursor
                onDone={() => {
                  if (line < bootLines.length - 1) setTimeout(() => setLine((v) => v + 1), 130);
                  else setTimeout(() => onDone?.(), 500);
                }}
              />
            ) : (
              l
            )}
          </div>
        ))}
        <p className="mt-6 text-[color:var(--crt-fg-faint)] text-xs">{t("superadmin.terminal.skipHint")}</p>
      </div>
    </div>
  );
}

// Theme state lives in ./crt-hooks useCrtTheme.
const THEME_LABEL = { amber: "AMB", blue: "BLU", mono: "MNO" };
export function ThemeToggle({ theme, onToggle }) {
  const { t } = useLang();
  return (
    <button
      onClick={onToggle}
      title={t("superadmin.terminal.themeToggleTitle")}
      className="inline-flex items-center gap-2 px-2.5 py-1.5 border border-[color:var(--crt-border)] text-[color:var(--crt-fg-dim)] hover:text-[color:var(--crt-accent)] hover:border-[color:var(--crt-accent-dim)] transition-colors text-xs font-mono"
    >
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--crt-accent)", boxShadow: "var(--crt-glow)" }} />
      {THEME_LABEL[theme] || "AMB"}
    </button>
  );
}

export function TerminalPanel({ title, children, className = "" }) {
  return (
    <div className={`border border-[color:var(--crt-border)] bg-[color:var(--crt-panel)] ${className}`}>
      {title && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[color:var(--crt-border)] text-[color:var(--crt-fg-dim)] text-xs">
          <span className="text-[color:var(--crt-accent)]">┌─</span>
          <span className="uppercase tracking-wider">{title}</span>
          <span className="flex-1 border-t border-dashed border-[color:var(--crt-border)]" />
          <span className="text-[color:var(--crt-accent)]">─┐</span>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
