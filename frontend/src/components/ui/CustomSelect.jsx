import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

/**
 * Shared themed dropdown that replaces the native <select>.
 *
 * Native <select> renders its option list with OS chrome (white popup, blue
 * highlight) that ignores the app theme — broken in dark mode. This renders the
 * list itself, portaled to <body> with fixed positioning so it is never clipped
 * by a scroll container or modal, flips above the trigger when there is no room
 * below, and is fully keyboard accessible.
 *
 * Props:
 *  - value            selected value (compared as string)
 *  - onChange(value)  called with the raw selected value (NOT an event)
 *  - options          [{ value, label, disabled? }]
 *  - placeholder      shown when nothing is selected
 *  - variant          "app" (theme-aware, default) | "landing-violet" | "admin-cyan"
 *  - size             "md" (default) | "sm"
 *  - disabled, error, ariaLabel, id, name, className, menuClassName
 */

const VARIANTS = {
  // Theme-aware surface used across the authenticated app (light + dark).
  app: {
    trigger:
      "bg-slate-100/70 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-accent focus:border-accent",
    triggerError: "border-rose-500 focus:ring-2 focus:ring-rose-500/40",
    text: "text-slate-900 dark:text-white",
    placeholder: "text-slate-400 dark:text-slate-500",
    chevron: "text-slate-400",
    menu: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-black/10 dark:shadow-black/50",
    optSelected: "bg-accent-soft text-accent font-medium",
    optActive: "bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white",
    optIdle: "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]",
  },
  // Always-dark public landing (Contact) — violet accent.
  "landing-violet": {
    trigger:
      "bg-slate-800/50 border-white/[0.08] focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/50",
    triggerError: "border-rose-500 focus:ring-1 focus:ring-rose-500/40",
    text: "text-white",
    placeholder: "text-slate-500",
    chevron: "text-slate-500",
    menu: "border-white/[0.08] bg-slate-900 shadow-black/50",
    optSelected: "bg-violet-500/15 text-violet-300 font-medium",
    optActive: "bg-white/[0.06] text-white",
    optIdle: "text-slate-200 hover:bg-white/[0.06]",
  },
  // Always-dark super-admin console — cyan accent.
  "admin-cyan": {
    trigger:
      "bg-slate-900/60 border-slate-800 focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/60",
    triggerError: "border-rose-500 focus:ring-1 focus:ring-rose-500/40",
    text: "text-white",
    placeholder: "text-slate-500",
    chevron: "text-slate-500",
    menu: "border-slate-800 bg-slate-900 shadow-black/50",
    optSelected: "bg-cyan-500/15 text-cyan-300 font-medium",
    optActive: "bg-slate-800 text-white",
    optIdle: "text-slate-200 hover:bg-slate-800/70",
  },
};

const SIZES = {
  md: { base: "py-2.5 text-sm", padX: "px-4", padXIcon: "pl-10 pr-4", opt: "px-3.5 py-2.5 text-sm" },
  sm: { base: "py-1.5 text-sm", padX: "px-2.5", padXIcon: "pl-9 pr-2.5", opt: "px-3 py-2 text-sm" },
};

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  variant = "app",
  size = "md",
  leftIcon = null,
  disabled = false,
  error = false,
  className = "",
  menuClassName = "",
  ariaLabel,
  id,
  name,
}) {
  const v = VARIANTS[variant] || VARIANTS.app;
  const sz = SIZES[size] || SIZES.md;

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const autoId = useId();
  const listboxId = `${id || "cs"}-${autoId}-listbox`;

  const selectedIdx = options.findIndex((o) => String(o.value) === String(value));
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;

  const firstEnabled = () => options.findIndex((o) => !o.disabled);

  // Compute fixed position from the trigger rect; flip up when short on space below.
  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 6;
    const MAX = 260;
    const spaceBelow = window.innerHeight - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    const openUp = spaceBelow < Math.min(MAX, 200) && spaceAbove > spaceBelow;
    setPos({
      left: r.left,
      width: r.width,
      openUp,
      top: openUp ? undefined : r.bottom + GAP,
      bottom: openUp ? window.innerHeight - r.top + GAP : undefined,
      maxHeight: Math.max(120, Math.min(MAX, openUp ? spaceAbove : spaceBelow)),
    });
  };

  useLayoutEffect(() => {
    if (open) updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePosition();
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("mousedown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) setActiveIdx(selectedIdx >= 0 ? selectedIdx : firstEnabled());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || activeIdx < 0 || !menuRef.current) return;
    const el = menuRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const commit = (idx) => {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    onChange?.(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (dir) => {
    setActiveIdx((cur) => {
      if (options.length === 0) return -1;
      let next = cur;
      for (let i = 0; i < options.length; i++) {
        next = (next + dir + options.length) % options.length;
        if (!options[next]?.disabled) return next;
      }
      return cur;
    });
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        open ? moveActive(1) : setOpen(true);
        break;
      case "ArrowUp":
        e.preventDefault();
        open ? moveActive(-1) : setOpen(true);
        break;
      case "Home":
        if (open) { e.preventDefault(); setActiveIdx(firstEnabled()); }
        break;
      case "End":
        if (open) { e.preventDefault(); setActiveIdx(options.length - 1); }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        open ? commit(activeIdx) : setOpen(true);
        break;
      case "Escape":
        if (open) { e.preventDefault(); setOpen(false); }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {leftIcon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 z-[1] pointer-events-none flex items-center">
          {leftIcon}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border text-left transition-all focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${sz.base} ${
          leftIcon ? sz.padXIcon : sz.padX
        } ${error ? v.triggerError : v.trigger} ${selected ? v.text : v.placeholder}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 ${v.chevron} transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {name && <input type="hidden" name={name} value={value ?? ""} />}

      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.ul
              ref={menuRef}
              id={listboxId}
              role="listbox"
              initial={{ opacity: 0, y: pos.openUp ? 4 : -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.openUp ? 4 : -4, scale: 0.98 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              style={{
                position: "fixed",
                left: pos.left,
                top: pos.top,
                bottom: pos.bottom,
                width: pos.width,
                maxHeight: pos.maxHeight,
              }}
              className={`z-[200] overflow-y-auto rounded-xl border p-1 shadow-xl ${v.menu} ${menuClassName}`}
            >
              {options.length === 0 && (
                <li className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500">—</li>
              )}
              {options.map((o, idx) => {
                const isSel = idx === selectedIdx;
                const isActive = idx === activeIdx;
                return (
                  <li key={`${o.value}-${idx}`} data-idx={idx} role="option" aria-selected={isSel}>
                    <button
                      type="button"
                      disabled={o.disabled}
                      onClick={() => commit(idx)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full flex items-center justify-between gap-3 rounded-lg text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sz.opt} ${
                        isSel ? v.optSelected : isActive ? v.optActive : v.optIdle
                      }`}
                    >
                      <span className="truncate">{o.label}</span>
                      {isSel && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
