// Full-screen docs page: unified background, three columns, no inverted-contrast blocks.

import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/app/providers/ThemeProvider";
import { useLang } from "@/app/providers/LanguageProvider";
import DOCS_CONTENT from "./content";

const LANGS = [
  { key: "id", label: "ID" },
  { key: "en", label: "EN" },
];

const IconHome = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /></svg>);
const IconFolder = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>);
const IconShield = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" /></svg>);
const IconCheckSquare = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 11l3 3 8-8M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>);
const IconSparkles = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 3v4M3 5h4M19 13v4m-2-2h4M11 3l2.5 6L20 11l-6.5 2L11 19l-2.5-6L2 11l6.5-2L11 3z" /></svg>);
const IconCog = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>);
const IconUserShield = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 4a4 4 0 110 8 4 4 0 010-8zM4 21a8 8 0 0116 0" /></svg>);
const IconSearch = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const IconArrowLeft = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>);
const IconMenu = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const IconSun = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>);
const IconMoon = (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>);

const I = {
  lock: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 11v3m-6 6h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>),
  check: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
  bot: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 7h6a2 2 0 012 2v7a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2zM9 7V4m6 3V4M9 12h.01M15 12h.01M9 16h6" /></svg>),
  eye: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>),
  bug: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 7V5a4 4 0 118 0v2m-9 4h10a3 3 0 013 3v3a5 5 0 11-10 0v-3a3 3 0 013-3z" /></svg>),
  fingerprint: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 11a4 4 0 014 4v2m-4-6a4 4 0 00-4 4v2m4-10a8 8 0 018 8m-8-8a8 8 0 00-8 8m8-3v6m0-6a2 2 0 012 2m-2-2a2 2 0 00-2 2" /></svg>),
  qr: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM18 18h2v2h-2z" /></svg>),
  cloud: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 15a4 4 0 014-4 5 5 0 0110 0 4 4 0 011 7.874M12 12v9m0 0l-3-3m3 3l3-3" /></svg>),
  scale: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 6l9-3 9 3M5 6v14h14V6M9 21V9h6v12" /></svg>),
  bulb: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 18h6m-5 3h4M12 3a6 6 0 00-3 11.196V17h6v-2.804A6 6 0 0012 3z" /></svg>),
  chart: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 19V9m6 10v-6m-6 6h12M3 5h6v14H3z" /></svg>),
  cap: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 14l9-5-9-5-9 5 9 5zm0 0v7m6-3v-5" /></svg>),
  key: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 7a4 4 0 11-4 4m4-4l5 5m-5-5l-7 7-3-3m3 3l3 3" /></svg>),
  phone: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 4h6a2 2 0 012 2v12a2 2 0 01-2 2H9a2 2 0 01-2-2V6a2 2 0 012-2zm3 14h.01" /></svg>),
  diskette: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 5a2 2 0 012-2h8l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V5zM8 3v4h6V3M8 21v-7h8v7" /></svg>),
  door: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M7 21V3h10v18M11 12h.01M3 21h18" /></svg>),
  clipboard: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>),
  globe: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18M3 12a9 9 0 1018 0 9 9 0 00-18 0z" /></svg>),
  link: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>),
  megaphone: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M11 5.882V19.24a1 1 0 01-1.555.832L4.5 17H3a1 1 0 01-1-1v-4a1 1 0 011-1h1.5l4.945-3.072A1 1 0 0111 5.882zM18 7a4 4 0 010 8m-3-4a1 1 0 100 2 1 1 0 000-2z" /></svg>),
  ban: (p) => (<svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>),
};

const GROUP_ICONS = {
  mulai: IconHome, dokumen: IconFolder, verifikasi: IconShield,
  tugas: IconCheckSquare, ai: IconSparkles, admin: IconCog, akun: IconUserShield,
  start: IconHome, documents: IconFolder, verify: IconShield,
  tasks: IconCheckSquare, account: IconUserShield,
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Falls back to a placeholder if the image is missing, so docs never look broken
// before real screenshots are added.
function Figure({ src, caption, alt, placeholder, onZoom }) {
  const [err, setErr] = useState(false);
  return (
    <figure className="mt-5">
      <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 overflow-hidden bg-slate-50 dark:bg-slate-900/40 shadow-sm">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-100/70 dark:bg-slate-800/40">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500 truncate">docloq.site</span>
        </div>
        {err || !src ? (
          <div className="aspect-[16/9] flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-[11px] font-medium">{placeholder}</span>
          </div>
        ) : (
          <button type="button" onClick={() => onZoom?.(src)} className="block w-full" aria-label="Zoom screenshot">
            <img src={src} alt={alt || caption || ""} loading="lazy" onError={() => setErr(true)}
              className="block w-full h-auto cursor-zoom-in" />
          </button>
        )}
      </div>
      {caption && <figcaption className="mt-2 text-[12.5px] text-slate-500 dark:text-slate-400 text-center">{caption}</figcaption>}
    </figure>
  );
}

export default function Docs() {
  const { lang, setLang } = useLang();
  const [openGroups, setOpenGroups] = useState({}); // multi-open
  const [activeId, setActiveId] = useState(null);
  const [activeHeading, setActiveHeading] = useState(null);
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [zoom, setZoom] = useState(null); // screenshot lightbox src
  const contentRef = useRef(null);
  const { theme, toggleTheme } = useTheme();

  const data = DOCS_CONTENT[lang] || DOCS_CONTENT.id;
  const shotSoon = lang === "id" ? "Screenshot segera hadir" : "Screenshot coming soon";

  // Falls back to the first page of the first group when the active id doesn't
  // exist in the current language tree (switching lang changes page ids).
  useEffect(() => {
    if (!data?.groups?.length) return;
    const allIds = data.groups.flatMap((g) => g.pages.map((p) => p.id));
    if (!activeId || !allIds.includes(activeId)) {
      const firstGroup = data.groups[0];
      const firstPage = firstGroup?.pages?.[0];
      if (firstPage) {
        setActiveId(firstPage.id);
        setOpenGroups({ [firstGroup.id]: true });
      }
    }
  }, [data, activeId]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return data.groups;
    const q = search.trim().toLowerCase();
    return data.groups
      .map((g) => ({
        ...g,
        pages: g.pages.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            (p.subtitle || "").toLowerCase().includes(q) ||
            p.sections.some((s) =>
              s.heading.toLowerCase().includes(q) ||
              (s.body || []).join(" ").toLowerCase().includes(q)
            )
        ),
      }))
      .filter((g) => g.pages.length > 0);
  }, [data, search]);

  const activePage = useMemo(() => {
    for (const g of data.groups) {
      const p = g.pages.find((x) => x.id === activeId);
      if (p) return p;
    }
    return data.groups[0]?.pages?.[0] || null;
  }, [data, activeId]);

  useEffect(() => {
    if (!activePage) return;
    // Defer to next frame so the DOM is painted before we query sections.
    const raf = requestAnimationFrame(() => {
      const root = contentRef.current;
      if (!root) return;
      const ids = activePage.sections.map((s) => slug(s.heading));
      const els = ids.map((id) => root.querySelector(`#${id}`)).filter(Boolean);
      if (els.length === 0) return;
      setActiveHeading(ids[0]);

      // Scroll-position spy (no IntersectionObserver): picks the last heading above the activation line.
      const onScroll = () => {
        const rootTop = root.getBoundingClientRect().top;
        const offset = 120; // activation line from top of the scroll container
        let current = els[0].id;
        for (const el of els) {
          const top = el.getBoundingClientRect().top - rootTop;
          if (top - offset <= 0) current = el.id;
          else break;
        }
        setActiveHeading(current);
      };
      root.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      // Stash cleanup on the root via a property so the outer effect can reach it.
      root._docsCleanup = () => root.removeEventListener("scroll", onScroll);
    });
    return () => {
      cancelAnimationFrame(raf);
      const root = contentRef.current;
      if (root && root._docsCleanup) { root._docsCleanup(); root._docsCleanup = null; }
    };
  }, [activePage]);

  const goToPage = (groupId, pageId) => {
    setOpenGroups((c) => ({ ...c, [groupId]: true }));
    setActiveId(pageId);
    setMobileNavOpen(false);
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
  };

  // Find the group containing the active page (for breadcrumb).
  const activeGroup = useMemo(() => data.groups.find((g) => g.pages.some((p) => p.id === activeId)), [data, activeId]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      <header className="shrink-0 h-14 px-4 lg:px-6 flex items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
            <IconArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === "id" ? "Kembali ke Dashboard" : "Back to Dashboard"}</span>
            <span className="sm:hidden">Dashboard</span>
          </Link>
          <span className="hidden sm:inline-block w-px h-4 bg-slate-200 dark:bg-slate-700" />
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center text-white font-black text-[11px]">D</div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">DocLoq Docs</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMobileNavOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400 transition-colors"
            aria-label="Toggle navigation">
            <IconMenu className="w-5 h-5" />
          </button>
          <button onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400 transition-colors"
            aria-label="Toggle theme">
            {theme === "light" ? <IconMoon className="w-5 h-5" /> : <IconSun className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_240px]">

        <aside className={`${mobileNavOpen ? "block" : "hidden"} lg:block min-h-0 overflow-y-auto px-5 py-6 border-b lg:border-b-0 lg:border-r border-slate-200/70 dark:border-slate-800/70`}>
          <div className="relative mb-4">
            <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={data.ui.search}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-100/70 dark:bg-slate-800/40 border border-transparent focus:border-brand-400/50 dark:focus:border-brand-500/50 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-all" />
          </div>

          <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800/40 mb-6">
            {LANGS.map((l) => (
              <button key={l.key} onClick={() => setLang(l.key)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  lang === l.key
                    ? "bg-white dark:bg-slate-700/80 text-brand-600 dark:text-brand-300 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}>{l.label}</button>
            ))}
          </div>

          <nav className="space-y-1">
            {filteredGroups.map((g) => {
              const Icon = GROUP_ICONS[g.id] || IconFolder;
              const open = openGroups[g.id] || !!search;
              return (
                <div key={g.id}>
                  <button onClick={() => setOpenGroups((c) => ({ ...c, [g.id]: !c[g.id] }))}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors group">
                    <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                    <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{g.label}</span>
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                        className="overflow-hidden ml-2 pl-4 border-l border-slate-200/60 dark:border-slate-800/60 mt-0.5 mb-1 space-y-0.5">
                        {g.pages.map((p) => {
                          const sel = p.id === activeId;
                          return (
                            <li key={p.id}>
                              <button onClick={() => goToPage(g.id, p.id)}
                                className={`block w-full text-left text-sm py-1.5 px-2 rounded-md transition-colors ${
                                  sel
                                    ? "text-brand-600 dark:text-brand-300 font-medium"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
                                }`}>
                                {p.title}
                              </button>
                            </li>
                          );
                        })}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {filteredGroups.length === 0 && (
              <p className="text-xs text-slate-400 px-2 py-4">{data.ui.noResults}</p>
            )}
          </nav>
        </aside>

        <article ref={contentRef} className="min-h-0 overflow-y-auto scroll-smooth">
          <div className="max-w-4xl mx-auto px-8 lg:px-14 py-10 lg:py-14">
            {activePage ? (
              <motion.div key={activePage.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
                {(() => {
                  const HeroIcon = GROUP_ICONS[activeGroup?.id] || IconFolder;
                  return (
                    <div className="mb-12 pb-8 border-b border-slate-200/60 dark:border-slate-800/60">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300 text-[11px] font-semibold uppercase tracking-[0.14em] mb-5">
                        <HeroIcon className="w-3.5 h-3.5" />
                        {activeGroup?.label}
                      </div>
                      <h1 className="text-[34px] md:text-[40px] leading-[1.15] font-semibold tracking-tight text-slate-900 dark:text-white mb-3">{activePage.title}</h1>
                      {activePage.subtitle && (
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[16px] max-w-2xl">{activePage.subtitle}</p>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-10">
                  {activePage.sections.map((s, i) => {
                    const sid = slug(s.heading);
                    const variant = s.variant || "default";
                    return (
                      <section key={sid + i} id={sid} className="scroll-mt-8">
                        <h2 className="group flex items-center gap-3 text-[22px] md:text-[24px] font-semibold text-slate-900 dark:text-white mb-4 tracking-tight">
                          <span className="w-1 h-6 rounded-full bg-brand-500" />
                          {s.heading}
                        </h2>
                        {(s.body || []).map((para, idx) => (
                          <p key={idx} className="text-slate-600 dark:text-slate-300 leading-7 mb-3 text-[15px]">{para}</p>
                        ))}

                        {variant === "cards" && s.list && s.list.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                            {s.list.map((item, idx) => {
                              const obj = typeof item === "string" ? { text: item } : item;
                              const Ico = (obj.icon && I[obj.icon]) || I.check;
                              return (
                                <div key={idx} className="group rounded-xl border border-slate-200/70 dark:border-slate-800/70 p-4 hover:border-brand-400/50 dark:hover:border-brand-500/40 hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                                  <div className="flex items-start gap-3">
                                    <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300 flex items-center justify-center">
                                      <Ico className="w-[18px] h-[18px]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      {obj.title && <p className="text-[14px] font-semibold text-slate-900 dark:text-white mb-1">{obj.title}</p>}
                                      <p className="text-[13.5px] text-slate-600 dark:text-slate-400 leading-6">{obj.text}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {variant === "steps-boxed" && s.steps && s.steps.length > 0 && (
                          <ol className="space-y-2 mt-4">
                            {s.steps.map((st, idx) => (
                              <li key={idx} className="flex items-start gap-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70 px-4 py-3 hover:border-brand-400/40 dark:hover:border-brand-500/40 transition-colors">
                                <span className="shrink-0 w-7 h-7 rounded-lg bg-brand-600 text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                                <span className="text-[15px] text-slate-700 dark:text-slate-200 leading-7">{st}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {variant !== "cards" && s.list && s.list.length > 0 && (
                          <ul className="space-y-2 mt-3">
                            {s.list.map((li, idx) => {
                              const text = typeof li === "string" ? li : li.text;
                              return (
                                <li key={idx} className="flex gap-3 text-slate-600 dark:text-slate-300 leading-7 text-[15px]">
                                  <span className="mt-2.5 w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                                  <span>{text}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {variant !== "steps-boxed" && s.steps && s.steps.length > 0 && (
                          <ol className="space-y-3 mt-3">
                            {s.steps.map((st, idx) => (
                              <li key={idx} className="flex gap-3 text-slate-600 dark:text-slate-300 leading-7 text-[15px]">
                                <span className="shrink-0 w-6 h-6 rounded-md bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300 text-[12px] font-semibold flex items-center justify-center mt-0.5">{idx + 1}</span>
                                <span>{st}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {s.image && (
                          <Figure src={s.image.src} caption={s.image.caption} alt={s.image.alt} placeholder={shotSoon} onZoom={setZoom} />
                        )}

                        {s.shots && s.shots.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                            {s.shots.map((sh, idx) => (
                              <Figure key={idx} src={sh.src} caption={sh.caption} alt={sh.alt} placeholder={shotSoon} onZoom={setZoom} />
                            ))}
                          </div>
                        )}

                        {s.callout && (
                          <div className={`mt-5 rounded-xl border p-4 flex gap-3 ${
                            s.callout.tone === "info" ? "border-brand-200 dark:border-brand-500/25 bg-brand-50/60 dark:bg-brand-500/5" :
                            s.callout.tone === "success" ? "border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-500/5" :
                            "border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5"
                          }`}>
                            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                              s.callout.tone === "info" ? "bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300" :
                              s.callout.tone === "success" ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300" :
                              "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300"
                            }`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div className="min-w-0 text-[14px]">
                              {s.callout.title && (
                                <p className={`font-semibold mb-1 ${
                                  s.callout.tone === "info" ? "text-brand-800 dark:text-brand-200" :
                                  s.callout.tone === "success" ? "text-emerald-800 dark:text-emerald-200" :
                                  "text-amber-800 dark:text-amber-200"
                                }`}>{s.callout.title}</p>
                              )}
                              <p className={`leading-6 ${
                                s.callout.tone === "info" ? "text-brand-700 dark:text-brand-200/90" :
                                s.callout.tone === "success" ? "text-emerald-700 dark:text-emerald-200/90" :
                                "text-amber-700 dark:text-amber-200/90"
                              }`}>{s.callout.text}</p>
                            </div>
                          </div>
                        )}

                        {s.note && (
                          <div className="mt-5 rounded-lg border-l-2 border-amber-400 dark:border-amber-500 bg-amber-50/60 dark:bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                            {s.note}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <p className="text-slate-500">{data.ui.empty}</p>
            )}
          </div>
        </article>

        <aside className="hidden lg:block min-h-0 overflow-y-auto px-5 py-10 border-l border-slate-200/70 dark:border-slate-800/70">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-400 dark:text-slate-500 mb-4">{data.ui.onThisPage}</p>
          <ul className="space-y-0.5">
            {activePage?.sections?.map((s, i) => {
              const sid = slug(s.heading);
              const active = activeHeading === sid;
              return (
                <li key={sid + i}>
                  <a href={`#${sid}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const root = contentRef.current;
                      const target = root?.querySelector(`#${sid}`);
                      if (!root || !target) return;
                      const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 32;
                      try { root.scrollTo({ top, behavior: "smooth" }); }
                      catch { root.scrollTop = top; }
                      setActiveHeading(sid);
                    }}
                    className={`block pl-3 py-1.5 text-sm transition-colors border-l ${
                      active
                        ? "border-brand-500 text-brand-600 dark:text-brand-300 font-medium"
                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}>
                    {s.heading}
                  </a>
                </li>
              );
            })}
          </ul>
        </aside>

      </div>

      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setZoom(null)}
            className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out">
            <motion.img
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18 }}
              src={zoom} alt="" onClick={(e) => e.stopPropagation()}
              className="max-w-[92vw] max-h-[88vh] rounded-xl border border-white/10 shadow-2xl object-contain" />
            <button onClick={() => setZoom(null)} aria-label="Close"
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
