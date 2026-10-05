// AI Projects list, landing page workspace.
// Redesign: match Dashboard typography (text-xl/2xl font-semibold), stat strip,
// search + sort, view toggle, grid polish. Konsisten dengan rest of app.

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import aiProjectService from '@/services/ai-project.service';
import ProjectCard from './components/ProjectCard';
import CreateProjectModal from './components/CreateProjectModal';
import ProjectInviteBanner from './components/ProjectInviteBanner';


function SectionIcon({ className = 'w-5 h-5', strokeWidth = 1.7 }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="6.5" r="2.3" strokeWidth={strokeWidth} />
      <circle cx="18" cy="7" r="2.3" strokeWidth={strokeWidth} />
      <circle cx="12" cy="17.5" r="2.6" strokeWidth={strokeWidth} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M7.9 8.2l2.9 7M16.2 8.7l-2.9 6.6M8.2 6.8l7.6.4" />
    </svg>
  );
}

function NotebookIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function StatCard({ icon, label, value, sub, accent = 'indigo' }) {
  const accentMap = {
    indigo: { bg: 'bg-brand-500/10 dark:bg-brand-400/15', fg: 'text-brand-600 dark:text-brand-300' },
    emerald: { bg: 'bg-emerald-500/10 dark:bg-emerald-400/15', fg: 'text-emerald-600 dark:text-emerald-300' },
    violet: { bg: 'bg-brand-500/10 dark:bg-brand-400/15', fg: 'text-brand-600 dark:text-brand-300' },
    amber: { bg: 'bg-amber-500/10 dark:bg-amber-400/15', fg: 'text-amber-600 dark:text-amber-300' },
  };
  const a = accentMap[accent] || accentMap.indigo;
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-stone-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/40 backdrop-blur-sm">
      <div className={`shrink-0 w-10 h-10 rounded-xl ${a.bg} ${a.fg} flex items-center justify-center`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white leading-tight mt-0.5">
          {value}
        </p>
        {sub && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const SORT_OPTIONS = [
  { key: 'updated', labelKey: 'aiProjects.list.sort.updated' },
  { key: 'created', labelKey: 'aiProjects.list.sort.created' },
  { key: 'name', labelKey: 'aiProjects.list.sort.name' },
  { key: 'sources', labelKey: 'aiProjects.list.sort.sources' },
];

// Custom themed dropdown, replaces native <select> (no OS-default chrome).
function SortDropdown({ value, onChange }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = SORT_OPTIONS.find((o) => o.key === value) || SORT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox" aria-expanded={open}
        className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-white hover:border-brand-400/60 dark:hover:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
      >
        <span>{t(current.labelKey)}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            role="listbox"
            className="absolute right-0 mt-2 min-w-[220px] z-30 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-black/5 dark:shadow-black/40 overflow-hidden"
          >
            {SORT_OPTIONS.map((o) => {
              const selected = o.key === value;
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    role="option" aria-selected={selected}
                    onClick={() => { onChange(o.key); setOpen(false); }}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm text-left transition-colors ${
                      selected
                        ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span>{t(o.labelKey)}</span>
                    {selected && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AIProjectsList() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState(null);
  const [limits, setLimits] = useState(null);
  const [usage, setUsage] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated');

  const refresh = async () => {
    try {
      const res = await aiProjectService.listProjects();
      if (res?.success) {
        setProjects(res.data || []);
        setLimits(res.limits);
      }
    } catch (err) {
      setError(err?.response?.data?.message || t('aiProjects.list.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const loadUsage = async () => {
    try {
      const res = await aiProjectService.fetchUsage({ days: 30 });
      if (res?.success) setUsage(res.data);
    } catch { /* non-critical */ }
  };

  useEffect(() => { refresh(); loadUsage(); }, []);

  const handleCreated = (project) => {
    setShowCreate(false);
    navigate(`/ai-projects/${project.id}`);
  };

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.archivedAt),
    [projects],
  );

  const totalSources = useMemo(
    () => activeProjects.reduce((sum, p) => sum + (p.sourceCount || 0), 0),
    [activeProjects],
  );

  const totalMessages = useMemo(
    () => activeProjects.reduce((sum, p) => sum + (p.messageCount || 0), 0),
    [activeProjects],
  );

  const filteredSorted = useMemo(() => {
    let list = activeProjects;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        p.name?.toLowerCase().includes(q)
        || p.description?.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    switch (sort) {
      case 'created':
        sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'name':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'sources':
        sorted.sort((a, b) => (b.sourceCount || 0) - (a.sourceCount || 0));
        break;
      case 'updated':
      default:
        sorted.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    }
    return sorted;
  }, [activeProjects, search, sort]);

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        <div>
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 lg:py-7">
            <PageHeader
              className="mb-0"
              eyebrow={t('aiProjects.list.eyebrow')}
              title={t('aiProjects.list.title')}
              subtitle={t('aiProjects.list.subtitle')}
              icon={<SectionIcon />}
              actions={
                <button
                  onClick={() => setShowCreate(true)}
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-accent hover:brightness-110 text-white text-sm font-semibold rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('aiProjects.list.newProject')}
                </button>
              }
            />

            {/* Stat strip */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <StatCard
                accent="indigo"
                icon={<NotebookIcon />}
                label={t('aiProjects.list.stats.activeProjects')}
                value={activeProjects.length}
                sub={limits ? `${t('aiProjects.list.stats.of')} ${limits.MAX_PROJECTS_PER_ORG} ${t('aiProjects.list.stats.max')}` : ''}
              />
              <StatCard
                accent="emerald"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                label={t('aiProjects.list.stats.totalSources')}
                value={totalSources.toLocaleString('id-ID')}
                sub={t('aiProjects.list.stats.acrossAll')}
              />
              <StatCard
                accent="violet"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                label={t('aiProjects.list.stats.totalMessages')}
                value={totalMessages.toLocaleString('id-ID')}
                sub={t('aiProjects.list.stats.userAndAi')}
              />
              <StatCard
                accent="amber"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                label={t('aiProjects.list.stats.token30d')}
                value={usage ? usage.totals.totalTokens.toLocaleString('id-ID') : '-'}
                sub={usage ? `${usage.totals.responses} ${t('aiProjects.list.stats.aiResponses')}` : t('aiProjects.list.stats.loading')}
              />
            </motion.div>
          </div>
        </div>

        {/* Toolbar, search + sort */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('aiProjects.list.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                aria-label={t('aiProjects.list.searchAria')}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium uppercase tracking-wide">{t('aiProjects.list.sortLabel')}</span>
              <SortDropdown value={sort} onChange={setSort} />
            </div>
            <div className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              {filteredSorted.length} / {activeProjects.length} {t('aiProjects.list.shown')}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <ProjectInviteBanner onChanged={refresh} />
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 rounded-2xl bg-stone-100 dark:bg-slate-900/50 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && activeProjects.length === 0 && (
            <div className="text-center py-16 max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 flex items-center justify-center mb-4">
                <SectionIcon className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white mb-2">{t('aiProjects.list.empty.title')}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                {t('aiProjects.list.empty.body')}
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 min-h-[44px] bg-accent hover:brightness-110 text-white text-sm font-semibold rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-colors"
              >
                {t('aiProjects.list.empty.cta')}
              </button>
            </div>
          )}

          {!loading && activeProjects.length > 0 && filteredSorted.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('aiProjects.list.noMatch')}</p>
              <button
                onClick={() => setSearch('')}
                className="mt-2 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                {t('aiProjects.list.resetSearch')}
              </button>
            </div>
          )}

          {!loading && filteredSorted.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSorted.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} />
              ))}
            </div>
          )}

          {error && (
            <div role="alert" className="mt-6 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-500/20">
              {error}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </DashboardLayout>
  );
}
