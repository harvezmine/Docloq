// The Studio body, NotebookLM-style: a generator grid over a unified list of outputs + notes.
// Clicking a row opens its content in place; onFocusChange lets the workspace widen this panel.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import aiProjectService from '@/services/ai-project.service';
import { useLang } from '@/app/providers/LanguageProvider';
import usePolling from '../hooks/usePolling';
import { RENDERERS } from './outputs';
import GenerateOutputModal from './GenerateOutputModal';
import ConfirmModal from '@/components/ui/ConfirmModal';

// Grid, in display order. Note + Audio are actions, not backend kinds.
const GENERATORS = [
  { key: 'slides', icon: 'M4 5h16v10H4zM8 19h8', popup: true },
  { key: 'mindmap', icon: 'M12 3v4m0 0a2 2 0 100 4 2 2 0 000-4zM6 21v-2a2 2 0 012-2h8a2 2 0 012 2v2', popup: true },
  { key: 'report', icon: 'M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM9 8h6M9 12h6M9 16h4', popup: false },
  { key: 'infographic', icon: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z', popup: true },
  { key: 'note', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21z', action: 'note' },
  { key: 'audio', icon: 'M9 19V6l8-2v11M9 19a2 2 0 11-4 0 2 2 0 014 0zm8-2a2 2 0 11-4 0 2 2 0 014 0z', disabled: true },
];

const KIND_KEYS = new Set(['report', 'slides', 'mindmap', 'infographic', 'note', 'audio']);
const STATUS_DOT = { generating: 'bg-amber-400 animate-pulse', ready: 'bg-emerald-500', failed: 'bg-red-500', revoked: 'bg-slate-400' };
const POLL_MS = 400_000; // image generation can take a couple of minutes

function relative(d, t) {
  const ms = Date.now() - new Date(d).getTime();
  const ago = t('aiStudio.time.ago');
  if (ms < 3.6e6) return `${Math.max(1, Math.floor(ms / 6e4))}${t('aiStudio.time.minuteShort')} ${ago}`;
  if (ms < 8.64e7) return `${Math.floor(ms / 3.6e6)}${t('aiStudio.time.hourShort')} ${ago}`;
  return `${Math.floor(ms / 8.64e7)}${t('aiStudio.time.dayShort')} ${ago}`;
}

export default function OutputsStudio({ project, onCitationClick, selectedSourceIds, notesVersion, onNoteChange, onFocusChange, focused }) {
  const { t } = useLang();
  const kindLabel = (k) => (KIND_KEYS.has(k) ? t('aiStudio.kinds.' + k) : k);
  const [outputs, setOutputs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [openId, setOpenId] = useState(null);      // `${type}:${id}`
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(null);
  const [popupKind, setPopupKind] = useState(null);
  const [noteDraft, setNoteDraft] = useState(null); // { title, content } while composing
  const [pendingDelete, setPendingDelete] = useState(null); // item awaiting confirm
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [o, n] = await Promise.all([aiProjectService.listOutputs(project.id), aiProjectService.listNotes(project.id)]);
      if (o?.success) setOutputs(o.data || []);
      if (n?.success) setNotes(n.data || []);
    } catch (err) { setError(err?.response?.data?.message || t('aiStudio.outputs.loadFailed')); }
  }, [project.id]);

  useEffect(() => { refresh(); }, [refresh, notesVersion]);
  usePolling(outputs.some((o) => o.status === 'generating'), refresh, { timeoutMs: POLL_MS, onTimeout: () => setError(t('aiStudio.outputs.tooLong')) });

  // One list, newest first: outputs + notes.
  const items = useMemo(() => {
    const a = outputs.map((o) => ({ type: 'output', id: o.id, kind: o.kind, title: o.title, status: o.status, isImage: o.isImage, at: o.createdAt, errorMessage: o.errorMessage }));
    const b = notes.map((n) => ({ type: 'note', id: n.id, kind: 'note', title: n.title, status: 'ready', at: n.createdAt, content: n.content }));
    return [...a, ...b].sort((x, y) => new Date(y.at) - new Date(x.at));
  }, [outputs, notes]);

  const startGenerate = (g) => {
    if (g.disabled) return;
    if (g.action === 'note') { setNoteDraft({ title: '', content: '' }); return; }
    if (g.popup) { setPopupKind(g.key); return; }
    doGenerate(g.key, '');
  };

  const doGenerate = async (kind, instructions) => {
    setPopupKind(null);
    setCreating(kind);
    setError(null);
    try {
      await aiProjectService.createOutput(project.id, kind, { instructions: instructions || undefined, sourceIds: selectedSourceIds || undefined });
      await refresh();
    } catch (err) {
      const d = err?.response?.data;
      setError(d?.code === 'ORG_QUOTA_EXCEEDED' ? `${t('aiStudio.outputs.quotaPre')} (${d.used}/${d.limit}).` : d?.code === 'NO_SOURCES' ? t('aiStudio.outputs.addSourceFirst') : d?.message || t('aiStudio.outputs.generateFailed'));
    } finally { setCreating(null); }
  };

  const saveNote = async () => {
    if (!noteDraft?.title.trim() || !noteDraft?.content.trim()) return;
    await aiProjectService.createNote(project.id, { title: noteDraft.title.trim(), content: noteDraft.content.trim() });
    setNoteDraft(null);
    onNoteChange?.();
    await refresh();
  };

  const open = async (it) => {
    const key = `${it.type}:${it.id}`;
    if (openId === key) { setOpenId(null); setDetail(null); onFocusChange?.(false); return; }
    setOpenId(key); setDetail(null);
    if (it.type === 'note') { setDetail({ note: it }); return; }
    if (it.status !== 'ready') return;
    setLoadingDetail(true);
    try {
      const res = await aiProjectService.getOutput(project.id, it.id);
      if (res?.success) setDetail({ output: res.data, kind: it.kind });
    } catch (err) { setError(err?.response?.data?.message || t('aiStudio.outputs.openFailed')); }
    finally { setLoadingDetail(false); }
  };

  const confirmRemove = async () => {
    const it = pendingDelete;
    if (!it) return;
    setDeleting(true);
    try {
      if (it.type === 'note') await aiProjectService.deleteNote(project.id, it.id);
      else await aiProjectService.deleteOutput(project.id, it.id);
      if (openId === `${it.type}:${it.id}`) { setOpenId(null); setDetail(null); onFocusChange?.(false); }
      onNoteChange?.();
      await refresh();
      setPendingDelete(null);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiStudio.outputs.deleteFailed'));
      setPendingDelete(null);
    } finally { setDeleting(false); }
  };

  return (
    <div className="p-4">
      {error && (
        <div role="alert" className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-[12px] text-red-700 dark:text-red-300 flex items-start justify-between gap-2">
          <span className="leading-snug">{error}</span>
          <button onClick={() => setError(null)} aria-label={t('common.close')} className="shrink-0 opacity-70 hover:opacity-100">×</button>
        </div>
      )}

      {/* Generator grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-4">
        {GENERATORS.map((g) => (
          <button key={g.key} onClick={() => startGenerate(g)} disabled={g.disabled || !!creating}
            title={g.disabled ? t('common.comingSoon') : kindLabel(g.key)}
            className={`min-h-[60px] px-2 py-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors ${g.disabled ? 'border-stone-200/60 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'border-stone-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500/40 text-slate-700 dark:text-slate-200'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={g.icon} /></svg>
            <span className="text-[10.5px] font-medium text-center leading-tight">
              {creating === g.key ? '…' : kindLabel(g.key)}
              {g.disabled && <span className="block text-[8px] uppercase">{t('aiStudio.outputs.comingSoonShort')}</span>}
            </span>
          </button>
        ))}
      </div>

      {/* Note composer */}
      {noteDraft && (
        <div className="mb-3 p-3 rounded-xl border border-brand-300 dark:border-brand-500/40 space-y-2">
          <input autoFocus value={noteDraft.title} onChange={(e) => setNoteDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Judul catatan"
            className="w-full min-h-[36px] px-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold" />
          <textarea rows={3} value={noteDraft.content} onChange={(e) => setNoteDraft((d) => ({ ...d, content: e.target.value }))} placeholder="Isi…"
            className="w-full px-2 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[12.5px] resize-y" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setNoteDraft(null)} className="min-h-[32px] px-2.5 rounded-lg text-[12px] text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800">Batal</button>
            <button onClick={saveNote} disabled={!noteDraft.title.trim() || !noteDraft.content.trim()} className="min-h-[32px] px-2.5 rounded-lg text-[12px] font-medium bg-accent hover:brightness-110 disabled:bg-stone-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white">Simpan</button>
          </div>
        </div>
      )}

      {items.length === 0 && !noteDraft && (
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400 text-center py-6 leading-relaxed">Belum ada apa-apa. Pilih generator di atas, atau tulis catatan.</p>
      )}

      {/* Unified list */}
      <div className="space-y-1.5">
        {items.map((it) => {
          const openThis = openId === `${it.type}:${it.id}`;
          return (
            <div key={`${it.type}:${it.id}`} className="rounded-xl border border-stone-200 dark:border-slate-700 overflow-hidden">
              <div className="group flex items-center gap-2 p-2.5">
                <span className={`shrink-0 w-2 h-2 rounded-full ${STATUS_DOT[it.status] || 'bg-slate-300'}`} role="status" aria-label={it.status} />
                <button onClick={() => open(it)} disabled={it.status !== 'ready'} className="flex-1 min-w-0 text-left disabled:cursor-default focus-visible:outline-none">
                  <span className="block text-[12.5px] font-medium text-slate-800 dark:text-slate-100 truncate">
                    <span className="text-slate-400">{kindLabel(it.kind)}:</span> {it.title}
                  </span>
                  <span className="block text-[10px] text-slate-400 truncate">
                    {it.status === 'generating' && 'Sedang dibuat…'}
                    {it.status === 'failed' && (it.errorMessage || 'Gagal')}
                    {it.status === 'revoked' && 'Konten dihapus'}
                    {it.status === 'ready' && relative(it.at, t)}
                  </span>
                </button>
                {openThis && (
                  <button onClick={() => onFocusChange?.(!focused)} title={focused ? 'Perkecil' : 'Perbesar'} className="shrink-0 p-1 rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-300">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={focused ? 'M9 9L4 4m0 0v4m0-4h4m11 11l-5-5m5 5v-4m0 4h-4' : 'M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4'} /></svg>
                  </button>
                )}
                <button onClick={() => setPendingDelete(it)} className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded text-slate-400 hover:text-red-600 transition-opacity" aria-label={`${t('common.delete')} ${it.title}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>

              <AnimatePresence>
                {openThis && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16 }} className="border-t border-stone-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-3">
                      {loadingDetail && <p className="text-[12px] text-slate-400">Memuat…</p>}
                      {detail?.note && <p className="text-[12.5px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{detail.note.content}</p>}
                      {detail?.output?.isImage && RENDERERS[detail.kind] && (
                        <ImageOutput projectId={project.id} outputId={detail.output.id} kind={detail.kind} title={detail.output.title} />
                      )}
                      {detail?.output && !detail.output.isImage && detail.output.payload && RENDERERS[detail.kind] && (
                        <TextOutput kind={detail.kind} output={detail.output} onCitationClick={onCitationClick} />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <GenerateOutputModal
        open={!!popupKind} kind={popupKind}
        title={popupKind ? kindLabel(popupKind) : ''}
        onGenerate={(text) => doGenerate(popupKind, text)}
        onClose={() => setPopupKind(null)}
      />

      <ConfirmModal
        open={!!pendingDelete}
        variant="danger"
        title={t('aiStudio.outputs.confirmDeleteItem')}
        message={pendingDelete ? `"${pendingDelete.title}" — ${t('aiStudio.outputs.confirmDeleteMessage')}` : ''}
        confirmLabel={t('common.delete')}
        loading={deleting}
        onConfirm={confirmRemove}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </div>
  );
}

// Image kinds render via ImageView with projectId/outputId (it fetches the blob).
function ImageOutput({ projectId, outputId, kind, title }) {
  const R = RENDERERS[kind];
  return <R projectId={projectId} outputId={outputId} title={title} />;
}

// Text kinds render via their renderer with the decrypted payload.
function TextOutput({ kind, output, onCitationClick }) {
  const R = RENDERERS[kind];
  return <R payload={output.payload} onCitationClick={onCitationClick} title={output.title} />;
}
