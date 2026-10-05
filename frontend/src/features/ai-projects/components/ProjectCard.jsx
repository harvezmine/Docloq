// Project card, match dashboard tokens: font-semibold tracking-tight,
// shared icon container style, accent ring on hover, stats with mini icons.

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLang } from '@/app/providers/LanguageProvider';

const ICON_MAP = {
  notebook: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  folder: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
    </svg>
  ),
  docs: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
    </svg>
  ),
  briefcase: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  ),
  beaker: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  ),
  collection: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
    </svg>
  ),
  presentation: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  ),
};

const ICON_ORDER = ['notebook', 'folder', 'docs', 'briefcase', 'beaker', 'collection', 'presentation'];
const COLOR_ORDER = ['indigo', 'emerald', 'violet', 'rose', 'amber', 'cyan'];

function hashId(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const COLOR_MAP = {
  indigo: { bg: 'bg-brand-500/10 dark:bg-brand-400/15', fg: 'text-brand-600 dark:text-brand-300', hover: 'group-hover:text-brand-700 dark:group-hover:text-brand-300' },
  emerald: { bg: 'bg-emerald-500/10 dark:bg-emerald-400/15', fg: 'text-emerald-600 dark:text-emerald-300', hover: 'group-hover:text-emerald-700 dark:group-hover:text-emerald-300' },
  violet: { bg: 'bg-brand-500/10 dark:bg-brand-400/15', fg: 'text-brand-600 dark:text-brand-300', hover: 'group-hover:text-brand-700 dark:group-hover:text-brand-300' },
  rose: { bg: 'bg-rose-500/10 dark:bg-rose-400/15', fg: 'text-rose-600 dark:text-rose-300', hover: 'group-hover:text-rose-700 dark:group-hover:text-rose-300' },
  amber: { bg: 'bg-amber-500/10 dark:bg-amber-400/15', fg: 'text-amber-600 dark:text-amber-300', hover: 'group-hover:text-amber-700 dark:group-hover:text-amber-300' },
  cyan: { bg: 'bg-cyan-500/10 dark:bg-cyan-400/15', fg: 'text-cyan-600 dark:text-cyan-300', hover: 'group-hover:text-cyan-700 dark:group-hover:text-cyan-300' },
};

function formatRelative(dateStr, t) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return t('aiProjects.card.justNow');
  if (m < 60) return `${m}${t('aiProjects.card.minuteSuffix')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${t('aiProjects.card.hourSuffix')}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}${t('aiProjects.card.daySuffix')}`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function ProjectCard({ project, index = 0 }) {
  const { t } = useLang();
  const h = hashId(project.id || project.name || '');
  const iconKey = project.icon && project.icon !== 'sparkles' && ICON_MAP[project.icon]
    ? project.icon
    : ICON_ORDER[h % ICON_ORDER.length];
  const colorKey = project.color && project.color !== 'indigo' && COLOR_MAP[project.color]
    ? project.color
    : COLOR_ORDER[(h >>> 3) % COLOR_ORDER.length];
  const icon = ICON_MAP[iconKey];
  const color = COLOR_MAP[colorKey];
  const sourceCount = project.sourceCount || 0;
  const messageCount = project.messageCount || 0;
  const outputCount = project.outputCount || 0;
  const isEmpty = sourceCount === 0 && messageCount === 0 && outputCount === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={`/ai-projects/${project.id}`}
        className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 rounded-2xl"
      >
        <div className="relative bg-white dark:bg-slate-900 border border-stone-200/70 dark:border-slate-800/70 rounded-2xl p-5 hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/[0.06] dark:hover:shadow-black/30 transition-all duration-200 ease-out h-full flex flex-col">
          {/* Top: icon + meta */}
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl ${color.bg} ${color.fg} flex items-center justify-center`}>
              {icon}
            </div>
            <div className="flex items-center gap-1.5">
              {isEmpty && (
                <span className="px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide rounded bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  {t('aiProjects.card.empty')}
                </span>
              )}
              <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 font-medium" title={new Date(project.updatedAt || project.createdAt).toLocaleString('id-ID')}>
                {formatRelative(project.updatedAt || project.createdAt, t)}
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className={`text-base font-semibold tracking-tight text-slate-900 dark:text-white leading-snug mb-1.5 line-clamp-2 transition-colors ${color.hover}`}>
            {project.name}
          </h3>

          {/* Description */}
          {project.description ? (
            <p className="text-[13px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
              {project.description}
            </p>
          ) : (
            <p className="text-[13px] text-slate-400 dark:text-slate-600 italic mb-4">{t('aiProjects.card.noDescription')}</p>
          )}

          {/* Bottom: stats with mini icons matching dashboard chip style */}
          <div className="mt-auto pt-3 border-t border-stone-100 dark:border-slate-800/70 flex items-center justify-between gap-3 text-[11.5px]">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{sourceCount}</span>
                <span>{t('aiProjects.card.sources')}</span>
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{messageCount}</span>
                <span>{t('aiProjects.card.messages')}</span>
              </span>
              {outputCount > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25zM2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75z" />
                  </svg>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{outputCount}</span>
                  <span>{t('aiProjects.card.outputs')}</span>
                </span>
              )}
            </div>
            <span className={`inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium ${color.fg}`}>
              {t('aiProjects.card.open')}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
