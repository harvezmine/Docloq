// OnlyOffice Editor, glassmorphism shell, lock + presence + reload + auto-recover
import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import documentService from '../../services/document.service';
import notificationService from '../../services/notification.service';
import { useTheme } from '../../app/providers/ThemeProvider';
import useAuthStore from '../../app/store/auth.store';
import { useLang } from '../../app/providers/LanguageProvider';
import OnlyOfficeSkeleton from './OnlyOfficeSkeleton';

const ONLYOFFICE_URL = import.meta.env.VITE_ONLYOFFICE_URL || 'http://localhost:8082';
const PRESENCE_POLL_MS = 20_000; // 20s, hemat request, tetap responsif
const MAX_RECOVER = 3;
const RECOVER_DELAY_MS = 1000;

// Known OnlyOffice errorCode values, anything else maps to the "unknown" dict key.
const ERR_CODES = new Set(['-1', '-2', '-3', '-4', '-5', '-6']);
const getErrKey = (code) => (ERR_CODES.has(String(code)) ? String(code) : 'unknown');

function formatRelative(ts, translate) {
  if (!ts) return '';
  const t = new Date(ts).getTime();
  if (!t) return '';
  const diff = Math.max(0, t - Date.now());
  const m = Math.round(diff / 60_000);
  if (m < 60) return `${m} ${translate('misc.oo.time.minLeft')}`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h} ${translate('misc.oo.time.hour')} ${mm > 0 ? mm + ' ' + translate('misc.oo.time.min') : ''}`.trim();
}

function detectBandwidth() {
  if (typeof navigator === 'undefined' || !navigator.connection) return 'normal';
  const t = navigator.connection.effectiveType;
  if (t === '2g' || t === 'slow-2g') return 'slow';
  return 'normal';
}

export default function OnlyOfficeEditor({
  config: initialConfig,
  onClose,
  documentName,
  documentId,
  onSwitchToEdit,
  lockInfo: initialLockInfo,
  onSaved,
  onRenamed,
}) {
  const editorContainerId = 'onlyoffice-editor';
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const { t } = useLang();

  const [config, setConfig] = useState(initialConfig);
  const [lockInfo, setLockInfo] = useState(initialLockInfo);
  const [loadStage, setLoadStage] = useState('script'); // script | config | init | ready
  const [progressPct, setProgressPct] = useState(15);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(documentName || '');
  const [presence, setPresence] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState({ folders: [], filename: documentName || '' });
  const [toast, setToast] = useState(null); // {type, message}
  const [confirmEject, setConfirmEject] = useState(false);
  const [showLockBlock, setShowLockBlock] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(56);
  const headerEl = useRef(null);
  const [pingRequest, setPingRequest] = useState(null); // {id, senderName, ts}
  const seenPingIds = useRef(new Set());

  const isViewMode = config?.editorConfig?.mode === 'view';
  const mode = config?.editorConfig?.mode || 'view';
  const versionCount = config?.document?.versionCount || 1;
  const lockExpiresAt = lockInfo?.expiresAt || null;
  const lockOwnerName = lockInfo?.lockedByName || null;

  const editorRef = useRef(null);
  const hasChangesRef = useRef(false);
  const versionRef = useRef(versionCount);
  const retryCountRef = useRef(0);
  const sentBeaconRef = useRef(false);

  useEffect(() => { versionRef.current = versionCount; }, [versionCount]);

  // Deklarasi sebelum useEffect yang memakainya.
  const isSlowConn = useMemo(() => detectBandwidth() === 'slow', []);

  const showToast = useCallback((type, message, ms = 3000) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), ms);
  }, []);

  const loadScript = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (window.DocsAPI) return resolve();
      const script = document.createElement('script');
      script.src = `${ONLYOFFICE_URL}/web-apps/apps/api/documents/api.js`;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(t('misc.oo.err.loadLib')));
      document.body.appendChild(script);
    });
  }, [t]);

  const initEditor = useCallback(async (cfg) => {
    if (!cfg) return;
    try {
      setLoadStage('script');
      setProgressPct(25);
      await loadScript();

      setLoadStage('init');
      setProgressPct(70);

      // Tunggu sampai container div ada di DOM
      let attempts = 0;
      while (!document.getElementById(editorContainerId) && attempts < 30) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      if (!document.getElementById(editorContainerId)) {
        throw new Error(t('misc.oo.err.noContainer'));
      }

      if (!window.DocsAPI) throw new Error(t('misc.oo.err.noApi'));

      if (editorRef.current) {
        try { editorRef.current.destroyEditor(); } catch { /* noop */ }
      }

      const editorConfig = {
        ...cfg,
        events: {
          onAppReady: () => {
            console.log('[OnlyOffice] App ready');
          },
          onDocumentReady: () => {
            console.log('[OnlyOffice] Document ready');
            setLoadStage('ready');
            setProgressPct(100);
            setRecovering(false);
            retryCountRef.current = 0;
          },
          onDocumentStateChange: (event) => {
            const changed = !!event?.data;
            setHasChanges(changed);
            hasChangesRef.current = changed;
          },
          onReady: () => {
            setLoadStage('ready');
            setProgressPct(100);
            setRecovering(false);
            retryCountRef.current = 0;
          },
          onWarning: (event) => {
            console.warn('[OnlyOffice warning]', event);
          },
          onInfo: (event) => {
            console.log('[OnlyOffice info]', event);
          },
          onError: async (event) => {
            const code = event?.data?.errorCode;
            console.error('[OnlyOffice]', event);
            // Recoverable: silently re-init up to 3x
            if ([-1, -3, -4].includes(code) && retryCountRef.current < MAX_RECOVER) {
              retryCountRef.current++;
              setRecovering(true);
              showToast('info', `${t('misc.oo.toast.reconnecting')} (${retryCountRef.current}/${MAX_RECOVER})`, 1500);
              await new Promise((r) => setTimeout(r, RECOVER_DELAY_MS));
              try {
                const fresh = await documentService.getOnlyOfficeConfig(documentId, mode, {
                  theme: isDark ? 'dark' : 'light',
                  bandwidth: detectBandwidth(),
                });
                if (fresh?.success) {
                  setConfig(fresh.data.config);
                  setLockInfo(fresh.data.lockInfo || null);
                  await initEditor(fresh.data.config);
                  return;
                }
              } catch { /* fallthrough */ }
            }
            setError(t(`misc.oo.err.${getErrKey(code)}`));
            setRecovering(false);
          },
        },
      };

      const editor = new window.DocsAPI.DocEditor(editorContainerId, editorConfig);
      editorRef.current = editor;
    } catch (err) {
      console.error('Init error:', err);
      setError(err.message || t('misc.oo.err.loadFail'));
      setLoadStage('ready');
    }
  }, [loadScript, documentId, mode, isDark, showToast, t]);

  useEffect(() => {
    if (config) {
      setLoadStage('config');
      setProgressPct(50);
      // Tunggu 100ms supaya layout settle + headerHeight benar sebelum OnlyOffice render
      const t = setTimeout(() => initEditor(config), 100);
      return () => {
        clearTimeout(t);
        if (editorRef.current) {
          try { editorRef.current.destroyEditor(); } catch { /* noop */ }
          editorRef.current = null;
        }
      };
    }
    return () => {
      if (editorRef.current) {
        try { editorRef.current.destroyEditor(); } catch { /* noop */ }
        editorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!documentId || !isAuthenticated) return;
    documentService.getBreadcrumb(documentId)
      .then((res) => res?.success && setBreadcrumb(res.data))
      .catch(() => {});
  }, [documentId, isAuthenticated]);

  // useLayoutEffect, not useEffect: measures synchronously to avoid a race with editor init.
  useLayoutEffect(() => {
    if (!headerEl.current) return;
    setHeaderHeight(headerEl.current.offsetHeight);
    const ro = new ResizeObserver(() => {
      if (headerEl.current) setHeaderHeight(headerEl.current.offsetHeight);
    });
    ro.observe(headerEl.current);
    return () => ro.disconnect();
  }, [lockInfo, isSlowConn, breadcrumb]);

  useEffect(() => {
    if (!documentId || !isAuthenticated) return;
    let active = true;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        // Combine heartbeat + presence dalam 1 batch, tetap 2 request tapi sequential
        await documentService.sendHeartbeat(documentId, mode);
        const res = await documentService.getPresence(documentId);
        if (active && res?.success) setPresence(res.data || []);
      } catch (err) {
        // Stop polling kalau 429 (rate limited) atau 401 (auth issue)
        if (err?.response?.status === 429 || err?.response?.status === 401) {
          stopped = true;
        }
      }
    };

    tick();
    const id = setInterval(tick, PRESENCE_POLL_MS);
    return () => { active = false; stopped = true; clearInterval(id); };
  }, [documentId, mode, isAuthenticated]);

  useEffect(() => {
    if (isViewMode || !isAuthenticated) return;
    let active = true;

    const checkPing = async () => {
      try {
        const res = await notificationService.getNotifications(10, 0);
        const items = res?.data?.data?.notifications || res?.data?.notifications || [];
        for (const n of items) {
          if (n.type === 'edit_access_request' && n.relatedId === documentId && !n.isRead && !seenPingIds.current.has(n.id)) {
            seenPingIds.current.add(n.id);
            // Parse sender name dari title "{name} ingin mengedit ..."
            const sender = (n.title || '').split(' ingin')[0] || t('misc.oo.someone');
            setPingRequest({ id: n.id, senderName: sender, ts: n.createdAt });
            notificationService.markAsRead(n.id).catch(() => {});
            break;
          }
        }
      } catch { /* ignore */ }
    };

    checkPing();
    const id = setInterval(() => active && checkPing(), 15_000);
    return () => { active = false; clearInterval(id); };
  }, [isViewMode, isAuthenticated, documentId]);

  useEffect(() => {
    if (isViewMode || !lockExpiresAt) return;
    const tick = setInterval(() => {
      const remain = new Date(lockExpiresAt).getTime() - Date.now();
      // 5 menit warning
      if (remain > 0 && remain < 5 * 60_000) {
        showToast('warning', t('misc.oo.toast.sessionWarn'), 4000);
      }
      // Habis → force eject
      if (remain <= 0) {
        clearInterval(tick);
        setConfirmEject(true);
      }
    }, 30_000);
    return () => clearInterval(tick);
  }, [isViewMode, lockExpiresAt, showToast, t]);

  // On tab close: release lock + presence via sendBeacon, with a fetch keepalive fallback.
  useEffect(() => {
    if (!documentId) return;
    const handler = () => {
      if (sentBeaconRef.current) return;
      sentBeaconRef.current = true;
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const token = useAuthStore.getState().accessToken;
        const tokenQuery = token ? `?_t=${encodeURIComponent(token)}` : '';
        const data = new Blob([''], { type: 'application/json' });
        // sendBeacon untuk presence + lock release (token via query karena tidak bisa kirim header)
        navigator.sendBeacon?.(`${apiBase}/documents/${documentId}/presence${tokenQuery}`, data);
        if (!isViewMode) {
          navigator.sendBeacon?.(`${apiBase}/documents/${documentId}/edit-lock/release${tokenQuery}`, data);
          // Backup: fetch keepalive juga (sendBeacon kadang silent fail)
          fetch(`${apiBase}/documents/${documentId}/edit-lock/release`, {
            method: 'POST',
            keepalive: true,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).catch(() => {});
        }
      } catch { /* noop */ }
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      handler();
    };
  }, [documentId, isViewMode]);

  const doReload = useCallback(async () => {
    if (hasChangesRef.current) {
      showToast('warning', t('misc.oo.toast.saveBeforeReload'), 3500);
      return;
    }
    setReloading(true);
    try {
      const fresh = await documentService.getOnlyOfficeConfig(documentId, mode, {
        theme: isDark ? 'dark' : 'light',
        bandwidth: detectBandwidth(),
      });
      if (!fresh?.success) throw new Error(fresh?.message || t('misc.oo.err.reloadFail'));

      const newVer = fresh.data.config?.document?.versionCount || 1;
      if (newVer === versionRef.current && !fresh.data.lockInfo) {
        showToast('success', t('misc.oo.toast.latestVersion'));
        setReloading(false);
        return;
      }
      setConfig(fresh.data.config);
      setLockInfo(fresh.data.lockInfo || null);
      setLoadStage('init');
      setProgressPct(60);
      await initEditor(fresh.data.config);
      showToast('success', newVer > versionRef.current ? `${t('misc.oo.toast.loadedVersion')} v${newVer}` : t('misc.oo.toast.refreshed'));
    } catch (err) {
      showToast('error', err.message || t('misc.oo.err.reloadFail'));
    } finally {
      setReloading(false);
    }
  }, [documentId, mode, isDark, initEditor, showToast, t]);

  useEffect(() => {
    if (!editorRef.current || !config) return;
    const currentTheme = config.editorConfig?.customization?.uiTheme;
    const wantTheme = isDark ? 'theme-dark' : 'theme-classic-light';
    if (currentTheme && currentTheme !== wantTheme) {
      doReload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  const handleSaveAndClose = useCallback(async () => {
    // View mode: tidak ada lock atau changes, close langsung
    if (isViewMode) {
      onClose();
      return;
    }
    // Edit mode tanpa perubahan: release lock + close
    if (!documentId || !hasChangesRef.current) {
      try { await documentService.releaseLock(documentId); } catch { /* ignore */ }
      onClose();
      return;
    }
    // Edit mode dengan perubahan: save → poll → release lock → close
    setIsSaving(true);
    try {
      const startVer = versionRef.current || 0;
      await documentService.forceSave(documentId);
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          const res = await documentService.getDocument(documentId);
          const newVer = res?.data?.versionCount ?? res?.data?.document?.versionCount ?? 0;
          if (newVer > startVer) {
            onSaved?.(newVer);
            break;
          }
        } catch { /* retry */ }
      }
    } catch (err) {
      console.error('Save & Close failed:', err);
    }
    // Release lock setelah save, jangan ditunda
    try { await documentService.releaseLock(documentId); } catch { /* ignore */ }
    setIsSaving(false);
    onClose();
  }, [documentId, onClose, isViewMode, onSaved]);

  const handleForceEject = useCallback(async () => {
    setConfirmEject(false);
    try {
      if (hasChangesRef.current) {
        await documentService.forceSave(documentId);
        await new Promise((r) => setTimeout(r, 2000));
      }
      await documentService.releaseLock(documentId);
    } catch { /* ignore */ }
    showToast('warning', t('misc.oo.toast.sessionExpired'), 4000);
    // Reload as view
    setTimeout(() => {
      documentService.getOnlyOfficeConfig(documentId, 'view', {
        theme: isDark ? 'dark' : 'light',
      }).then((fresh) => {
        if (fresh?.success) {
          setConfig(fresh.data.config);
          setLockInfo(fresh.data.lockInfo || null);
          initEditor(fresh.data.config);
        }
      });
    }, 1000);
  }, [documentId, isDark, initEditor, showToast, t]);

  const handleStartEditTitle = () => {
    if (isViewMode) return; // hanya edit mode bisa rename
    setTitleDraft(documentName);
    setEditingTitle(true);
  };
  const handleCommitTitle = async () => {
    const name = titleDraft.trim();
    setEditingTitle(false);
    if (!name || name === documentName) return;
    try {
      const res = await documentService.renameDocument(documentId, name);
      if (res?.success) {
        onRenamed?.(name);
        showToast('success', t('misc.oo.toast.renamed'));
      }
    } catch {
      showToast('error', t('misc.oo.toast.renameFail'));
      setTitleDraft(documentName);
    }
  };
  const handleCancelTitle = () => {
    setTitleDraft(documentName);
    setEditingTitle(false);
  };

  const shellBg = isDark ? 'bg-slate-900' : 'bg-slate-50';
  const headerBg = isDark
    ? 'bg-slate-900/70 backdrop-blur-xl border-slate-800'
    : 'bg-white/80 backdrop-blur-xl border-slate-200';
  const titleColor = isDark ? 'text-white' : 'text-slate-900';
  const subTextColor = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`fixed inset-0 z-50 ${shellBg}`}
      >
        {/* Full-screen, no header offset, keeps the OnlyOffice toolbar visible */}
        <div
          id={editorContainerId}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
          }}
        />

        {/* Sits over OnlyOffice's own logo area */}
        <div className={`absolute top-2 left-2 z-30 flex items-center gap-2`}>
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl backdrop-blur-xl shadow-lg border ${
            isDark ? 'bg-slate-900/70 border-slate-700/60' : 'bg-white/85 border-slate-200/80'
          }`}>
            <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">D</span>
            </div>

            <AnimatePresence mode="wait">
              {isSaving && (
                <motion.div key="saving" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30">
                  <div className="w-2.5 h-2.5 border-[1.5px] border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{t('common.saving')}</span>
                </motion.div>
              )}
              {!isSaving && hasChanges && !isViewMode && (
                <motion.div key="unsaved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                  <span className={`text-[10px] ${subTextColor} font-medium`}>{t('misc.oo.status.unsaved')}</span>
                </motion.div>
              )}
              {recovering && (
                <motion.div key="recover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-500/15 border border-brand-500/30">
                  <div className="w-2.5 h-2.5 border-[1.5px] border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium">{t('misc.oo.status.reconnecting')}</span>
                </motion.div>
              )}
              {lockInfo && !isSaving && !recovering && (
                <motion.div key="lock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30">
                  <svg className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">{lockInfo.lockedByName}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {presence.length > 0 && (
              <div className="flex items-center -space-x-1.5">
                {presence.slice(0, 2).map((p) => (
                  <div key={p.userId}
                    title={`${p.name} (${p.mode === 'edit' ? t('misc.oo.presence.editing') : t('misc.oo.presence.viewing')})`}
                    className={`relative w-5 h-5 rounded-full border-2 ${isDark ? 'border-slate-900' : 'border-white'} bg-brand-600 flex items-center justify-center text-white text-[9px] font-bold`}
                  >
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt={p.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (p.name || '?').charAt(0).toUpperCase()
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${p.mode === 'edit' ? 'bg-emerald-500' : 'bg-brand-500'}`} />
                  </div>
                ))}
                {presence.length > 2 && (
                  <div className={`w-5 h-5 rounded-full border-2 ${isDark ? 'border-slate-900 bg-slate-700 text-slate-300' : 'border-white bg-slate-200 text-slate-700'} flex items-center justify-center text-[9px] font-bold`}>
                    +{presence.length - 2}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5">
          <div className={`flex items-center gap-1 px-1.5 py-1 rounded-xl backdrop-blur-xl shadow-lg border ${
            isDark ? 'bg-slate-900/70 border-slate-700/60' : 'bg-white/85 border-slate-200/80'
          }`}>
            <button
              onClick={doReload}
              disabled={reloading || isSaving}
              title={t('misc.oo.action.reload')}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'} disabled:opacity-50`}
            >
              <svg className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {isViewMode && onSwitchToEdit && (
              <button
                onClick={() => {
                  if (lockInfo) {
                    setShowLockBlock(true);
                    return;
                  }
                  onSwitchToEdit();
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-xs font-semibold active:scale-95 ${
                  lockInfo
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 cursor-pointer'
                    : 'bg-brand-600 hover:bg-brand-500 text-white shadow '
                }`}
                title={lockInfo ? `${t('misc.oo.tooltip.editedBy')} ${lockInfo.lockedByName}` : t('misc.oo.tooltip.openEdit')}
              >
                {lockInfo ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                )}
                {lockInfo ? t('misc.oo.badge.locked') : t('common.edit')}
              </button>
            )}

            <button
              onClick={() => {
                if (!isViewMode && hasChangesRef.current) {
                  handleSaveAndClose();
                } else {
                  onClose();
                }
              }}
              title={t('common.close')}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-slate-300 hover:text-red-300' : 'hover:bg-red-50 text-slate-600 hover:text-red-600'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Header ref placeholder, supaya headerEl + useLayoutEffect tidak crash */}
        <div ref={headerEl} style={{ display: 'none' }} />

        {loadStage !== 'ready' && !error && (
          <OnlyOfficeSkeleton stage={loadStage} progressPct={progressPct} isDark={isDark} />
        )}

        {error && (
          <div className={`absolute inset-0 flex items-center justify-center ${shellBg} z-30`}>
            <div className="text-center max-w-md p-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className={`text-lg font-semibold ${titleColor} mb-2`}>{t('misc.oo.error.title')}</h3>
              <p className={`${subTextColor} mb-6`}>{error}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={doReload} className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium">{t('common.retry')}</button>
                <button onClick={onClose} className={`px-5 py-2 rounded-lg font-medium ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}>{t('common.close')}</button>
              </div>
            </div>
          </div>
        )}

        {!isViewMode && (
          <motion.button
            onClick={handleSaveAndClose}
            disabled={isSaving}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className={`fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm shadow-2xl backdrop-blur-sm transition-colors disabled:opacity-60 disabled:cursor-wait ${
              hasChanges
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white '
                : 'bg-slate-700/90 hover:bg-slate-600 text-white shadow-slate-900/40'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('common.saving')}
              </>
            ) : hasChanges ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                {t('misc.oo.action.saveClose')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                {t('common.close')}
              </>
            )}
          </motion.button>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
            >
              <div className={`px-4 py-2.5 rounded-xl backdrop-blur-xl shadow-2xl border flex items-center gap-2.5 text-sm font-medium max-w-md ${
                toast.type === 'success' ? 'bg-emerald-50/95 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200' :
                toast.type === 'error' ? 'bg-red-50/95 dark:bg-red-500/15 border-red-200 dark:border-red-500/30 text-red-900 dark:text-red-200' :
                toast.type === 'warning' ? 'bg-amber-50/95 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200' :
                'bg-brand-50/95 dark:bg-brand-500/15 border-brand-200 dark:border-brand-500/30 text-brand-900 dark:text-brand-200'
              }`}>
                {toast.type === 'success' && <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                {toast.type === 'error' && <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>}
                {toast.type === 'warning' && <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M5.062 18.938L12 5.062l6.938 13.876H5.062z" /></svg>}
                {toast.type === 'info' && <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01" /></svg>}
                <span>{toast.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pingRequest && !isViewMode && (
            <motion.div
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              style={{ top: 56 }}
              className={`absolute right-6 z-40 max-w-sm w-[22rem] rounded-2xl overflow-hidden shadow-2xl border ${
                isDark ? 'bg-slate-900/95 border-slate-700/60' : 'bg-white border-slate-200'
              } backdrop-blur-xl`}
            >
              <div className="flex items-start gap-3 p-4">
                <div className="shrink-0 w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">
                  {(pingRequest.senderName || '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${titleColor}`}>{pingRequest.senderName}</p>
                  <p className={`text-xs ${subTextColor} mt-0.5`}>{t('misc.oo.ping.wantsEdit')}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={async () => {
                        // Save → release lock → kasih ke pemohon
                        const okSave = !hasChangesRef.current || confirm(t('misc.oo.confirm.saveBeforeRelease'));
                        if (okSave && hasChangesRef.current) {
                          try { await documentService.forceSave(documentId); await new Promise((r) => setTimeout(r, 2000)); } catch { /* ignore */ }
                        }
                        try { await documentService.releaseLock(documentId); } catch { /* ignore */ }
                        showToast('success', t('misc.oo.toast.accessReleased'), 4000);
                        setPingRequest(null);
                        setTimeout(() => doReload(), 600);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors"
                    >
                      {t('misc.oo.ping.release')}
                    </button>
                    <button
                      onClick={() => setPingRequest(null)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {t('misc.oo.ping.later')}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setPingRequest(null)}
                  className={`shrink-0 p-1 rounded-md transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="h-1 bg-brand-500/20 overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: 0 }}
                  transition={{ duration: 15, ease: 'linear' }}
                  onAnimationComplete={() => setPingRequest(null)}
                  className="h-full bg-brand-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showLockBlock && lockInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setShowLockBlock(false)}>
              <motion.div
                initial={{ scale: 0.92, y: 16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                onClick={(e) => e.stopPropagation()}
                className={`relative max-w-md w-full rounded-3xl overflow-hidden shadow-[0_20px_70px_-15px_rgba(0,0,0,0.6)] ${
                  isDark ? 'bg-slate-900/95 ring-1 ring-white/10' : 'bg-white ring-1 ring-slate-200'
                }`}>

                <div className="relative px-7 pt-7 pb-5">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-amber-600 flex items-center justify-center text-white text-xl font-bold">
                        {(lockInfo.lockedByName || '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-[3px] ${isDark ? 'border-slate-900' : 'border-white'} flex items-center justify-center`}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                    </div>

                    <h3 className={`text-xl font-bold ${titleColor} mt-4`}>{lockInfo.lockedByName}</h3>
                    <p className={`text-sm ${subTextColor} mt-0.5`}>{t('misc.oo.lock.editing')}</p>
                  </div>

                  {lockInfo.expiresAt && (
                    <div className={`mt-5 mx-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium w-fit ${
                      isDark ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-100 text-slate-700'
                    } block`}>
                      <span className="inline-flex items-center gap-1.5 mx-auto">
                        <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {t('misc.oo.lock.sessionEnds')} <span className="font-semibold">{formatRelative(lockInfo.expiresAt, t)}</span>
                      </span>
                    </div>
                  )}

                  <p className={`text-sm ${subTextColor} text-center leading-relaxed mt-4`}>
                    {t('misc.oo.lock.explain')}
                  </p>
                </div>

                <div className={`px-5 pb-5 pt-2 ${isDark ? 'bg-slate-900/0' : 'bg-slate-50/0'}`}>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const res = await documentService.pingEditor(documentId);
                          if (res?.success) {
                            showToast('success', `${lockInfo.lockedByName} ${t('misc.oo.toast.pingSent')}`, 4000);
                            setShowLockBlock(false);
                          }
                        } catch (err) {
                          const msg = err?.response?.data?.message || t('misc.oo.toast.pingFail');
                          showToast('error', msg);
                        }
                      }}
                      className="w-full px-4 py-3 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      {t('misc.oo.lock.requestAccess')}
                    </button>

                    {['owner', 'admin'].includes(useAuthStore.getState().user?.role) && (
                      <button
                        onClick={async () => {
                          if (!confirm(`${t('misc.oo.confirm.forceReleasePre')} ${lockInfo.lockedByName}? ${t('misc.oo.confirm.forceReleasePost')}`)) return;
                          try {
                            await documentService.forceReleaseLock(documentId);
                            showToast('success', t('misc.oo.toast.forceReleased'), 4000);
                            setShowLockBlock(false);
                            setTimeout(() => doReload(), 800);
                          } catch {
                            showToast('error', t('misc.oo.toast.forceReleaseFail'));
                          }
                        }}
                        className={`w-full px-4 py-2.5 rounded-2xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                          isDark ? 'bg-red-500/15 hover:bg-red-500/25 text-red-300' : 'bg-red-50 hover:bg-red-100 text-red-700'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                        {t('misc.oo.lock.forceRelease')}
                      </button>
                    )}

                    <button
                      onClick={() => setShowLockBlock(false)}
                      className={`w-full px-4 py-2.5 rounded-2xl font-medium text-sm transition-colors ${
                        isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {t('misc.oo.lock.justView')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmEject && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className={`max-w-sm mx-4 rounded-2xl ${isDark ? 'bg-slate-900' : 'bg-white'} shadow-2xl border ${isDark ? 'border-slate-800' : 'border-slate-200'} overflow-hidden`}>
                <div className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className={`text-lg font-bold ${titleColor} mb-2`}>{t('misc.oo.eject.title')}</h3>
                  <p className={`text-sm ${subTextColor}`}>{t('misc.oo.eject.body')}</p>
                </div>
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={handleForceEject} className="w-full px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm">{t('misc.oo.eject.ok')}</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
