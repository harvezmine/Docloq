// Share modal, public preview-only link. Editorial/restrained theme, lucide icons, no emoji.

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Eye, Copy, Check, Clock, Link as LinkIcon, Trash2, X, Loader2 } from 'lucide-react';
import shareService from '@/services/share.service';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useLang } from '@/app/providers/LanguageProvider';

const EXPIRY_OPTIONS = (t) => [
  { label: t('share.expiry7'), value: 7 },
  { label: t('share.expiry30'), value: 30 },
  { label: t('share.expiryNever'), value: null },
];

const fmtDate = (d, t) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : t('share.dateNever'));

const STATUS_STYLE = {
  active: 'bg-emerald-500',
  expired: 'bg-slate-400',
  revoked: 'bg-slate-400',
  exhausted: 'bg-amber-500',
};

function LinkRow({ link, onCopy, copiedId, onRevoke }) {
  const { t } = useLang();
  const dead = link.status !== 'active';
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800/40">
      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_STYLE[link.status] || 'bg-slate-400'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-mono truncate ${dead ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
          /share/{link.shareToken.slice(0, 12)}…
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2.5 tabular-nums mt-0.5">
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(link.expiresAt, t)}</span>
          <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{link.viewCount || 0}{link.maxViews ? `/${link.maxViews}` : ''}</span>
        </p>
      </div>
      {!dead && (
        <button onClick={() => onCopy(link)} title={t('share.copyLink')}
          className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors">
          {copiedId === link.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
      <button onClick={() => onRevoke(link)} title={t('share.revokeLink')}
        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ShareModal({ document: doc, onClose }) {
  const { t } = useLang();
  const [expiry, setExpiry] = useState(7);
  const [limitOn, setLimitOn] = useState(false);
  const [maxViews, setMaxViews] = useState(50);
  const [creating, setCreating] = useState(false);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await shareService.list(doc.id);
      if (res?.success) setLinks(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || t('share.loadError'));
    } finally { setLoading(false); }
  }, [doc.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async (link) => {
    try {
      await navigator.clipboard.writeText(link.shareUrl);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await shareService.create(doc.id, {
        expiresInDays: expiry,
        maxViews: limitOn ? Number(maxViews) : null,
      });
      if (res?.success) {
        await load();
        // auto-copy the fresh link
        await navigator.clipboard.writeText(res.data.shareUrl).catch(() => {});
        setCopiedId(res.data.id);
        setTimeout(() => setCopiedId(null), 1500);
      }
    } catch (e) {
      setError(e?.response?.data?.message || t('share.createError'));
    } finally { setCreating(false); }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await shareService.revoke(revokeTarget.id);
      setRevokeTarget(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || t('share.revokeError'));
    } finally { setRevoking(false); }
  };

  const activeLinks = links.filter((l) => l.status === 'active');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-stone-100 dark:border-slate-800 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('share.title')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{doc.originalFilename || doc.filename}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Preview-only callout */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
              <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200/90 leading-relaxed">
                {t('share.previewOnly')} <strong>{t('share.previewOnlyStrong')}</strong> {t('share.previewOnlyRest')}
              </p>
            </div>

            {/* Settings */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{t('share.validityLabel')}</label>
              <div className="flex gap-2">
                {EXPIRY_OPTIONS(t).map((opt) => (
                  <button key={String(opt.value)} onClick={() => setExpiry(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                      expiry === opt.value
                        ? 'bg-brand-600 text-white border-brand-600 '
                        : 'bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-stone-200 dark:border-slate-700 hover:border-brand-300'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={limitOn} onChange={(e) => setLimitOn(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-brand-600 focus:ring-accent" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{t('share.limitViews')}</span>
              </label>
              {limitOn && (
                <input type="number" min={1} value={maxViews} onChange={(e) => setMaxViews(e.target.value)}
                  className="mt-2 w-32 px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
              )}
            </div>

            <button onClick={handleCreate} disabled={creating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:brightness-110 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl disabled:shadow-none transition-all">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              {t('share.createPreviewLink')}
            </button>

            {error && (
              <div className="px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-500/20">{error}</div>
            )}

            {/* Existing links */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                {t('share.activeLinks')} {activeLinks.length > 0 && <span className="text-slate-400">({activeLinks.length})</span>}
              </label>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> {t('share.loadingEllipsis')}</div>
              ) : links.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <LinkIcon className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-400">{t('share.noLinks')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {links.map((link) => (
                    <LinkRow key={link.id} link={link} onCopy={copy} copiedId={copiedId} onRevoke={setRevokeTarget} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      <ConfirmModal
        open={!!revokeTarget}
        title={t('share.confirmRevokeTitle')}
        message={t('share.confirmRevokeMessage')}
        confirmLabel={t('share.confirmRevokeConfirm')}
        variant="danger"
        loading={revoking}
        onConfirm={confirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </AnimatePresence>
  );
}
