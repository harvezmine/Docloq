// Public preview-only viewer (/share/:token). Standalone branded page, no app chrome.
// Renders server-side watermarked page images. No download/print affordances.

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, ShieldCheck, ShieldOff, Clock, FileQuestion, FileX2, Loader2 } from 'lucide-react';
import shareService from '@/services/share.service';
import { useLang } from '@/app/providers/LanguageProvider';

function Centered({ icon: Icon, title, message, tone = 'slate' }) {
  const { t } = useLang();
  const ring = {
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  }[tone];
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        className="w-full max-w-md text-center bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-stone-200 dark:border-slate-800 px-8 py-10">
        <div className={`w-14 h-14 rounded-2xl ${ring} flex items-center justify-center mx-auto mb-4`}>
          <Icon className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{message}</p>
        <div className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5" /> {t('share.securedBy')}
        </div>
      </motion.div>
    </div>
  );
}

export default function SharePreview() {
  const { t } = useLang();
  const { token } = useParams();
  const [state, setState] = useState({ status: 'loading' }); // loading | ok | gone | notfound | error
  const [manifest, setManifest] = useState(null);
  const [current, setCurrent] = useState(1);
  const pagesRef = useRef([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await shareService.getManifest(token);
        if (!alive) return;
        setManifest(res.data);
        setState({ status: 'ok' });
      } catch (e) {
        if (!alive) return;
        const code = e?.response?.data?.code;
        if (e?.response?.status === 410 || code === 'SHARE_GONE') setState({ status: 'gone', message: e?.response?.data?.message });
        else if (e?.response?.status === 404 || code === 'SHARE_NOT_FOUND') setState({ status: 'notfound' });
        else setState({ status: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [token]);

  // Track current page via scroll (which page card is centered).
  useEffect(() => {
    if (state.status !== 'ok' || !manifest?.previewable) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) setCurrent(Number(en.target.dataset.page));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    pagesRef.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [state.status, manifest]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /> {t('share.loading')}</div>
      </div>
    );
  }
  if (state.status === 'gone') return <Centered icon={Clock} tone="amber" title={t('share.gone.title')} message={state.message || t('share.gone.message')} />;
  if (state.status === 'notfound') return <Centered icon={ShieldOff} tone="red" title={t('share.notfound.title')} message={t('share.notfound.message')} />;
  if (state.status === 'error') return <Centered icon={FileX2} tone="red" title={t('share.error.title')} message={t('share.error.message')} />;

  const pageCount = manifest?.pageCount || 1;

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-stone-200/70 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <span className="font-bold text-slate-900 dark:text-white tracking-tight">DocLoq</span>
          <span className="text-stone-300 dark:text-slate-700">/</span>
          <p className="text-sm text-slate-600 dark:text-slate-300 truncate flex-1">{manifest?.docName}</p>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium shrink-0">
            <Eye className="w-3.5 h-3.5" /> {t('share.previewBadge')}
          </span>
          {manifest?.previewable && (
            <span className="text-xs text-slate-400 tabular-nums shrink-0 hidden sm:inline">{t('share.pageShort')} {current}/{pageCount}</span>
          )}
        </div>
        {manifest?.previewable && pageCount > 1 && (
          <div className="h-0.5 bg-stone-100 dark:bg-slate-800">
            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(current / pageCount) * 100}%` }} />
          </div>
        )}
      </header>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {!manifest?.previewable ? (
          <Centered icon={FileQuestion} tone="slate" title={t('share.unsupported.title')}
            message={t('share.unsupported.message')} />
        ) : (
          <div className="space-y-5">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <div key={n} ref={(el) => (pagesRef.current[n - 1] = el)} data-page={n}
                className="rounded-xl overflow-hidden border border-stone-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800">
                <img
                  src={shareService.pageUrl(token, n)}
                  alt={`${t('share.page')} ${n}`}
                  loading="lazy"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full block select-none"
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5" /> {t('share.footer')}
        </div>
      </main>
    </div>
  );
}
