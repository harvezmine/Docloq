// Sources panel, list + add document/URL with consent.
// A3 polling, A4 StatusDot, C3 card redesign, C6 empty state.

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';
import aiProjectService from '@/services/ai-project.service';
import usePolling from '../hooks/usePolling';
import AddDocumentModal from './AddDocumentModal';
import AddUrlModal from './AddUrlModal';
import AddTextModal from './AddTextModal';
import AddYouTubeModal from './AddYouTubeModal';
import AddFolderModal from './AddFolderModal';
import ConfirmModal from '@/components/ui/ConfirmModal';

const MAX_SOURCES = 10;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60_000;

const TYPE_STYLES = {
  document: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-400/15',
    fg: 'text-indigo-600 dark:text-indigo-300',
    label: 'Dokumen',
  },
  url: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/15',
    fg: 'text-emerald-600 dark:text-emerald-300',
    label: 'URL',
  },
  text: {
    bg: 'bg-amber-500/10 dark:bg-amber-400/15',
    fg: 'text-amber-600 dark:text-amber-300',
    label: 'Teks',
  },
  note: {
    bg: 'bg-violet-500/10 dark:bg-violet-400/15',
    fg: 'text-violet-600 dark:text-violet-300',
    label: 'Catatan',
  },
  youtube: {
    bg: 'bg-red-500/10 dark:bg-red-400/15',
    fg: 'text-red-600 dark:text-red-300',
    label: 'YouTube',
  },
};

function SourceIcon({ type }) {
  if (type === 'text' || type === 'note') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    );
  }
  if (type === 'url') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    );
  }
  if (type === 'youtube') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function StatusDot({ status, title }) {
  const { t } = useLang();
  const base = 'w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900';
  if (status === 'processing') {
    return (
      <span
        className={`${base} bg-amber-400 animate-pulse`}
        role="status"
        aria-label={t('aiSources.status.processing')}
        title={title || t('aiSources.status.processingTitle')}
      />
    );
  }
  if (status === 'failed') {
    return (
      <span
        className={`${base} bg-red-500`}
        role="status"
        aria-label={t('aiSources.status.failed')}
        title={title || t('aiSources.status.failedTitle')}
      />
    );
  }
  if (status === 'active') {
    return (
      <span
        className={`${base} bg-emerald-500`}
        role="status"
        aria-label={t('aiSources.status.ready')}
        title={title || t('aiSources.status.readyTitle')}
      />
    );
  }
  return (
    <span
      className={`${base} bg-slate-300 dark:bg-slate-600`}
      role="status"
      aria-label={status || t('aiSources.status.unknown')}
      title={status}
    />
  );
}

function formatRelative(date, t) {
  if (!date) return '';
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 60_000) return t('aiSources.time.justNow');
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}${t('aiSources.time.minute')}`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}${t('aiSources.time.hour')}`;
  return `${Math.floor(ms / 86_400_000)}${t('aiSources.time.day')}`;
}

export default function SourcesPanel({ project, onChanged, selectedIds, onSelectionChange }) {
  const { t } = useLang();
  const [sources, setSources] = useState(project.sources || []);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [showAddText, setShowAddText] = useState(false);
  const [showAddYouTube, setShowAddYouTube] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [error, setError] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null); // source awaiting confirm
  const [removing, setRemoving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiProjectService.listSources(project.id);
      if (res?.success) setSources(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiSources.panel.loadError'));
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { setSources(project.sources || []); }, [project.sources]);

  // A3, poll while any source is still processing.
  // Was an inline effect whose cleanup reset the start timestamp on every re-render (deps
  // [sources], and refresh() replaces sources), so the 60s timeout could never elapse and a
  // stuck source polled forever. usePolling scopes the clock to the polling session.
  usePolling(
    sources.some((s) => s.status === 'processing'),
    refresh,
    {
      intervalMs: POLL_INTERVAL_MS,
      timeoutMs: POLL_TIMEOUT_MS,
      // A stuck source stays 'processing', so no retry button renders for it, offer refresh.
      onTimeout: () => setError(t('aiSources.panel.pollTimeout')),
    },
  );

  const confirmRemove = async () => {
    const src = pendingRemove;
    if (!src) return;
    setRemoving(true);
    try {
      await aiProjectService.removeSource(project.id, src.id);
      await refresh();
      onChanged?.();
      setPendingRemove(null);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiSources.panel.removeError'));
      setPendingRemove(null);
    } finally { setRemoving(false); }
  };

  // Hits the unified /retry endpoint, which dispatches on source type server-side.
  const handleRetry = async (sourceId) => {
    try {
      await aiProjectService.retrySource(project.id, sourceId);
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || t('aiSources.panel.retryError'));
    }
  };

  const activeSources = sources.filter((s) => s.status === 'active');
  const activeCount = activeSources.length;
  const failedCount = sources.filter((s) => s.status === 'failed').length;
  const limitHit = activeCount >= MAX_SOURCES;

  // `selectedIds === null` means "no explicit scope" → all sources answer. Only a real array
  // narrows the scope, and [] deliberately means none (the backend honours that).
  const isSelected = (id) => selectedIds === null || selectedIds.includes(id);
  const selectedCount = selectedIds === null ? activeCount : selectedIds.length;
  const allSelected = selectedIds === null || selectedCount === activeCount;

  const toggleSource = (id) => {
    const current = selectedIds === null ? activeSources.map((s) => s.id) : selectedIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    // Back to "everything" → drop the scope entirely so the request omits sourceIds.
    onSelectionChange?.(next.length === activeCount ? null : next);
  };

  const toggleAll = () => onSelectionChange?.(allSelected ? [] : null);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-stone-100 dark:border-slate-800/60">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            {t('aiSources.panel.heading')}
          </h2>
          <div className="flex items-center gap-1.5">
            {failedCount > 0 && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                title={`${failedCount} ${t('aiSources.panel.failedTitleSuffix')}`}
              >
                {failedCount} {t('aiSources.panel.failedSuffix')}
              </span>
            )}
            <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500 font-medium">
              {activeCount}/{MAX_SOURCES}
            </span>
          </div>
        </div>

        {/* Add button + menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={limitHit}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-all ${
              limitHit
                ? 'bg-stone-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-accent-gradient hover:brightness-110 text-white shadow-sm shadow-accent'
            }`}
            title={limitHit ? `${t('aiSources.panel.maxTitlePrefix')}${MAX_SOURCES}${t('aiSources.panel.maxTitleSuffix')}` : t('aiSources.panel.addSourceTitle')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {t('aiSources.panel.addSource')}
          </button>

          <AnimatePresence>
            {showMenu && !limitHit && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-10"
                onMouseLeave={() => setShowMenu(false)}
              >
                <button
                  onClick={() => { setShowMenu(false); setShowAddDoc(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700/60 transition-colors"
                >
                  <span className={`w-7 h-7 rounded-md ${TYPE_STYLES.document.bg} ${TYPE_STYLES.document.fg} flex items-center justify-center`}>
                    <SourceIcon type="document" />
                  </span>
                  {t('aiSources.panel.fromDocument')}
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowAddUrl(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700/60 transition-colors border-t border-stone-100 dark:border-slate-700/60"
                >
                  <span className={`w-7 h-7 rounded-md ${TYPE_STYLES.url.bg} ${TYPE_STYLES.url.fg} flex items-center justify-center`}>
                    <SourceIcon type="url" />
                  </span>
                  {t('aiSources.panel.fromUrl')}
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowAddText(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700/60 transition-colors border-t border-stone-100 dark:border-slate-700/60"
                >
                  <span className={`w-7 h-7 rounded-md ${TYPE_STYLES.text.bg} ${TYPE_STYLES.text.fg} flex items-center justify-center`}>
                    <SourceIcon type="text" />
                  </span>
                  {t('aiSources.panel.pasteText')}
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowAddYouTube(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700/60 transition-colors border-t border-stone-100 dark:border-slate-700/60"
                >
                  <span className={`w-7 h-7 rounded-md ${TYPE_STYLES.youtube.bg} ${TYPE_STYLES.youtube.fg} flex items-center justify-center`}>
                    <SourceIcon type="youtube" />
                  </span>
                  {t('aiSources.types.youtube')}
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowAddFolder(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700/60 transition-colors border-t border-stone-100 dark:border-slate-700/60"
                >
                  <span className="w-7 h-7 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-300 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </span>
                  {t('aiSources.panel.fromFolder')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {limitHit && (
          <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
            {t('aiSources.panel.limitPrefix')}{MAX_SOURCES}{t('aiSources.panel.limitSuffix')}
          </p>
        )}

        {activeCount > 0 && (
          <div className="mt-2.5 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none min-h-[32px]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-stone-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-accent cursor-pointer"
                aria-label={allSelected ? t('aiSources.panel.deselectAll') : t('aiSources.panel.selectAllSources')}
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {allSelected ? t('aiSources.panel.allSources') : `${selectedCount} ${t('aiSources.panel.of')} ${activeCount} ${t('aiSources.panel.selectedWord')}`}
              </span>
            </label>
            {selectedCount === 0 && (
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                {t('aiSources.panel.selectMin')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sources list */}
      <div className="flex-1 overflow-y-auto px-3 py-3" role="region" aria-label={t('aiSources.panel.sourcesRegion')}>
        {error && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-[12px] text-red-700 dark:text-red-300 flex items-start justify-between gap-2">
            <span className="flex-1 leading-snug">{error}</span>
            <button
              onClick={() => { setError(null); refresh(); }}
              className="shrink-0 font-medium underline hover:no-underline"
            >
              {t('common.refresh')}
            </button>
            <button onClick={() => setError(null)} className="shrink-0 text-red-700/80 dark:text-red-300/80 hover:opacity-100 opacity-70" aria-label={t('aiSources.panel.dismiss')}>×</button>
          </div>
        )}

        {sources.length === 0 && !loading && (
          <div className="text-center py-12 px-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/15 flex items-center justify-center mb-3 text-indigo-600 dark:text-indigo-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('aiSources.panel.emptyTitle')}</p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-[220px] mx-auto">
              {t('aiSources.panel.emptyBody')}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          {sources.map((src) => {
            const type = TYPE_STYLES[src.sourceType] || TYPE_STYLES.document;
            const isFailed = src.status === 'failed';
            return (
              <motion.div
                key={src.id}
                data-source-id={src.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`group relative p-3 rounded-xl border transition-colors ${
                  isFailed
                    ? 'border-red-200/70 dark:border-red-500/30 bg-red-50/40 dark:bg-red-500/[0.04]'
                    : 'border-stone-200/70 dark:border-slate-800/70 hover:bg-stone-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {src.status === 'active' && (
                    <input
                      type="checkbox"
                      checked={isSelected(src.id)}
                      onChange={() => toggleSource(src.id)}
                      className="mt-3 shrink-0 w-4 h-4 rounded border-stone-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-accent cursor-pointer"
                      aria-label={`${isSelected(src.id) ? t('aiSources.panel.exclude') : t('aiSources.panel.include')} ${src.title} ${t('aiSources.panel.fromChat')}`}
                    />
                  )}
                  <div className={`shrink-0 w-9 h-9 rounded-lg ${type.bg} ${type.fg} flex items-center justify-center relative`}>
                    <SourceIcon type={src.sourceType} />
                    <span className="absolute -top-0.5 -right-0.5">
                      <StatusDot status={src.status} title={src.errorMessage} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-medium text-slate-800 dark:text-slate-100 leading-tight line-clamp-2 break-words"
                      title={src.title}
                    >
                      {src.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10.5px] text-slate-500 dark:text-slate-400">
                      <span className="uppercase tracking-wide font-medium">{t(`aiSources.types.${src.sourceType}`, type.label)}</span>
                      {src.addedAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span title={new Date(src.addedAt).toLocaleString()}>{formatRelative(src.addedAt, t)}</span>
                        </>
                      )}
                    </div>
                    {isFailed && (
                      <div className="mt-2 space-y-1">
                        {src.errorMessage && (
                          <p className="text-[11px] text-red-600/90 dark:text-red-300/90 leading-snug line-clamp-2" title={src.errorMessage}>
                            {src.errorMessage}
                          </p>
                        )}
                        {/* text/note have no origin to re-fetch, the backend rejects retry
                            for them. document + url both go through the unified endpoint. */}
                        {(src.sourceType === 'url' || src.sourceType === 'document') && (
                          <button
                            onClick={() => handleRetry(src.id)}
                            className="text-[11px] font-medium text-red-700 dark:text-red-300 hover:underline focus-visible:underline focus-visible:outline-none"
                          >
                            {t('aiSources.panel.retry')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setPendingRemove(src)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-all"
                    title={t('aiSources.panel.removeSourceTitle')}
                    aria-label={`${t('common.delete')} ${src.title}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        open={!!pendingRemove}
        variant="danger"
        title={t('aiSources.panel.removeConfirm')}
        message={pendingRemove ? `"${pendingRemove.title}"` : ''}
        confirmLabel={t('common.remove')}
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={() => !removing && setPendingRemove(null)}
      />
      {showAddDoc && (
        <AddDocumentModal
          projectId={project.id}
          existingDocIds={sources.filter(s => s.sourceType === 'document' && s.documentId).map(s => s.documentId)}
          onClose={() => setShowAddDoc(false)}
          onAdded={async () => { setShowAddDoc(false); await refresh(); onChanged?.(); }}
        />
      )}
      {showAddUrl && (
        <AddUrlModal
          projectId={project.id}
          onClose={() => setShowAddUrl(false)}
          onAdded={async () => { setShowAddUrl(false); await refresh(); onChanged?.(); }}
        />
      )}
      <AddTextModal
        projectId={project.id}
        open={showAddText}
        onClose={() => setShowAddText(false)}
        onAdded={async () => { await refresh(); onChanged?.(); }}
      />
      <AddYouTubeModal
        projectId={project.id}
        open={showAddYouTube}
        onClose={() => setShowAddYouTube(false)}
        onAdded={async () => { await refresh(); onChanged?.(); }}
      />
      <AddFolderModal
        projectId={project.id}
        open={showAddFolder}
        onClose={() => setShowAddFolder(false)}
        onAdded={async () => { await refresh(); onChanged?.(); }}
      />
    </div>
  );
}
