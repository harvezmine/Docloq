// Share a project: invite specific users, or enable a link. Both grant implicit read to the
// project's documents, so the exposure warning is not dismissible.

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';
import aiProjectService from '@/services/ai-project.service';
import userService from '@/services/user.service';

const STATUS_CLS = {
  pending: 'bg-amber-400/15 text-amber-700 dark:text-amber-300',
  accepted: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  declined: 'bg-slate-300/30 text-slate-600 dark:text-slate-400',
};

export default function ShareProjectModal({ project, open, onClose }) {
  const { t } = useLang();
  const STATUS_LABEL = {
    pending: { text: t('aiProjects.share.status.pending'), cls: STATUS_CLS.pending },
    accepted: { text: t('aiProjects.share.status.accepted'), cls: STATUS_CLS.accepted },
    declined: { text: t('aiProjects.share.status.declined'), cls: STATUS_CLS.declined },
  };
  const [members, setMembers] = useState([]);
  const [orgUsers, setOrgUsers] = useState([]);
  const [exposed, setExposed] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [linkToken, setLinkToken] = useState(project?.shareLinkToken || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [m, e] = await Promise.all([
        aiProjectService.listMembers(project.id),
        aiProjectService.exposedDocuments(project.id),
      ]);
      if (m?.success) setMembers(m.data || []);
      if (e?.success) setExposed(e.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiProjects.share.loadError'));
    }
  }, [project.id]);

  useEffect(() => {
    if (!open) return;
    refresh();
    // GET /users returns { success, data: { users, pagination } }, the array is data.users.
    userService.getUsers({ limit: 200 })
      .then((r) => setOrgUsers(r?.data?.users || r?.users || (Array.isArray(r) ? r : [])))
      .catch(() => setOrgUsers([]));
  }, [open, refresh]);

  const memberIds = new Set(members.map((m) => m.userId));
  const candidates = orgUsers.filter((u) =>
    u.id !== project.createdBy
    && !memberIds.has(u.id)
    && `${u.firstName || ''} ${u.lastName || ''} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  const invite = async () => {
    if (!selected.length) return;
    setBusy(true);
    setError(null);
    try {
      await aiProjectService.inviteMembers(project.id, selected);
      setSelected([]);
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || t('aiProjects.share.inviteError'));
    } finally {
      setBusy(false);
    }
  };

  const toggleLink = async () => {
    setBusy(true);
    setError(null);
    try {
      if (linkToken) {
        await aiProjectService.disableShareLink(project.id);
        setLinkToken(null);
      } else {
        const r = await aiProjectService.enableShareLink(project.id);
        setLinkToken(r?.data?.token || null);
      }
    } catch (err) {
      setError(err?.response?.data?.message || t('aiProjects.share.linkError'));
    } finally {
      setBusy(false);
    }
  };

  const linkUrl = linkToken ? `${window.location.origin}/ai-projects/join/${linkToken}` : '';

  const copy = async () => {
    await navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="share-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden flex flex-col"
          >
            <div className="px-5 pt-5 pb-3">
              <h3 id="share-title" className="text-base font-semibold text-slate-900 dark:text-white">
                {t('aiProjects.share.titlePrefix')} &ldquo;{project.name}&rdquo;
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4">
              {error && (
                <div role="alert" className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-[12px] text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {/* Not dismissible: sharing widens document access, and the creator must see what. */}
              {exposed.length > 0 && (
                <div className="px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25">
                  <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-200">
                    {t('aiProjects.share.exposureWarning')}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {exposed.map((d) => (
                      <li key={d.documentId} className="text-[11.5px] text-amber-800 dark:text-amber-300 truncate">
                        • {d.name}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-snug">
                    {t('aiProjects.share.exposureNote')}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{t('aiProjects.share.invitePeople')}</p>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('aiProjects.share.searchPlaceholder')}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="mt-1.5 max-h-40 overflow-y-auto space-y-0.5">
                  {candidates.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-50 dark:hover:bg-slate-800/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.includes(u.id)}
                        onChange={() => setSelected((s) => (s.includes(u.id) ? s.filter((x) => x !== u.id) : [...s, u.id]))}
                        className="w-4 h-4 rounded border-stone-300 text-brand-600 focus:ring-2 focus:ring-accent"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12.5px] text-slate-800 dark:text-slate-100 truncate">
                          {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}
                        </span>
                        <span className="block text-[10.5px] text-slate-400 truncate">{u.email}</span>
                      </span>
                    </label>
                  ))}
                  {candidates.length === 0 && (
                    <p className="text-[11.5px] text-slate-400 py-2 text-center">{t('aiProjects.share.noOtherUsers')}</p>
                  )}
                </div>
                <button
                  onClick={invite}
                  disabled={!selected.length || busy}
                  className="mt-2 w-full min-h-[40px] rounded-xl bg-accent hover:brightness-110 disabled:bg-stone-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-sm font-medium transition-colors"
                >
                  {t('aiProjects.share.invite')} {selected.length > 0 ? `(${selected.length})` : ''}
                </button>
              </div>

              {members.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{t('aiProjects.share.alreadyShared')}</p>
                  <div className="space-y-0.5">
                    {members.map((m) => {
                      const s = STATUS_LABEL[m.status] || STATUS_LABEL.declined;
                      return (
                        <div key={m.userId} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-50 dark:hover:bg-slate-800/60">
                          <span className="flex-1 min-w-0">
                            <span className="block text-[12.5px] text-slate-800 dark:text-slate-100 truncate">
                              {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}
                            </span>
                            <span className="block text-[10.5px] text-slate-400 truncate">{m.email}</span>
                          </span>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.cls}`}>{s.text}</span>
                          <button
                            onClick={async () => { await aiProjectService.removeMember(project.id, m.userId); await refresh(); }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-opacity"
                            aria-label={`${t('aiProjects.share.removeAccessAria')} ${m.email}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{t('aiProjects.share.link')}</p>
                {linkToken ? (
                  <>
                    <div className="flex gap-1.5">
                      <input
                        readOnly
                        value={linkUrl}
                        className="flex-1 min-w-0 min-h-[40px] px-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-[11.5px] text-slate-600 dark:text-slate-300"
                      />
                      <button onClick={copy} className="shrink-0 min-h-[40px] px-3 rounded-xl border border-stone-200 dark:border-slate-700 text-[12px] font-medium hover:bg-stone-50 dark:hover:bg-slate-800">
                        {copied ? t('common.copied') : t('common.copy')}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {t('aiProjects.share.linkNote')}
                    </p>
                    <button onClick={toggleLink} disabled={busy} className="mt-1.5 text-[11.5px] font-medium text-red-600 dark:text-red-400 hover:underline">
                      {t('aiProjects.share.disableLink')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={toggleLink}
                    disabled={busy}
                    className="w-full min-h-[40px] rounded-xl border border-dashed border-stone-300 dark:border-slate-700 text-[12.5px] font-medium text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 transition-colors"
                  >
                    {t('aiProjects.share.createLink')}
                  </button>
                )}
              </div>
            </div>

            <div className="px-5 py-4 flex justify-end border-t border-stone-100 dark:border-slate-800/60">
              <button onClick={onClose} className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800">
                {t('common.close')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
