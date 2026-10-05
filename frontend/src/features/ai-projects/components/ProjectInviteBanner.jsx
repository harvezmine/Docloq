// Pending project invitations, shown above the project grid. Accept adds the project to the
// list; decline hides it.

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';
import aiProjectService from '@/services/ai-project.service';

export default function ProjectInviteBanner({ onChanged }) {
  const { t } = useLang();
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await aiProjectService.listPendingInvites();
      if (res?.success) setInvites(res.data || []);
    } catch { /* silent, a banner failing to load must not break the page */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const respond = async (projectId, accept) => {
    setBusy(projectId);
    try {
      await aiProjectService.respondToInvite(projectId, accept);
      await refresh();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  };

  if (invites.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      <AnimatePresence>
        {invites.map((inv) => (
          <motion.div
            key={inv.projectId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium text-slate-900 dark:text-white truncate">
                {t('aiProjects.invite.invitationTo')} &ldquo;{inv.name}&rdquo;
              </span>
              {inv.description && (
                <span className="block text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{inv.description}</span>
              )}
            </span>
            <button
              onClick={() => respond(inv.projectId, true)}
              disabled={busy === inv.projectId}
              className="shrink-0 min-h-[36px] px-3 rounded-lg bg-accent-gradient hover:brightness-110 disabled:opacity-50 text-white text-[12px] font-medium transition-colors"
            >
              {t('aiProjects.invite.accept')}
            </button>
            <button
              onClick={() => respond(inv.projectId, false)}
              disabled={busy === inv.projectId}
              className="shrink-0 min-h-[36px] px-3 rounded-lg border border-stone-200 dark:border-slate-700 text-[12px] font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {t('aiProjects.invite.decline')}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
