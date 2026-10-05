// Shows a provenance receipt: what the answer was built from, and whether it still holds.
// The copy is deliberate, a receipt proves lineage, NOT that the answer is correct.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import aiProjectService from '@/services/ai-project.service';
import { useLang } from '@/app/providers/LanguageProvider';

export default function ProvenanceModal({ projectId, subject, open, onClose }) {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !subject) return;
    setLoading(true);
    setData(null);
    setError(null);
    aiProjectService.getProvenance(projectId, subject.type, subject.id)
      .then((r) => { if (r?.success) setData(r.data); })
      .catch((e) => setError(e?.response?.data?.message || t('aiSources.prov.noEvidence')))
      .finally(() => setLoading(false));
  }, [open, subject, projectId]);

  const Row = ({ ok, warn, children }) => (
    <div className="flex items-center gap-2 text-[12.5px]">
      <span className={`shrink-0 w-4 h-4 flex items-center justify-center rounded-full ${ok ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
        {ok ? '✓' : '!'}
      </span>
      <span className={ok ? 'text-slate-700 dark:text-slate-300' : 'text-amber-700 dark:text-amber-400'}>{children}</span>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="prov-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="px-5 pt-5 pb-3">
              <h3 id="prov-title" className="text-base font-semibold text-slate-900 dark:text-white">Bukti Asal Jawaban</h3>
            </div>

            <div className="px-5 pb-3 space-y-3">
              {loading && <p className="text-[12px] text-slate-400 py-4">Memverifikasi...</p>}
              {error && <p className="text-[12px] text-slate-500 dark:text-slate-400 py-2">{error}</p>}

              {data && (
                <>
                  <div className="space-y-1.5">
                    <Row ok={data.answerMatches}>
                      {data.answerMatches ? 'Jawaban belum diubah sejak dibuat' : 'Jawaban sudah berubah sejak bukti dibuat'}
                    </Row>
                    <Row ok={data.chainIntact}>
                      {data.chainIntact ? 'Rantai audit utuh' : 'Rantai audit rusak'}
                    </Row>
                    <Row ok={data.sourcesUnchanged}>
                      {data.sourcesUnchanged ? 'Semua sumber masih sama' : 'Sebagian sumber sudah berubah'}
                    </Row>
                  </div>

                  <div className="pt-1 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sumber</p>
                    {(data.sources || []).map((s) => (
                      <div key={s.sourceId} className="flex items-center gap-2 text-[12px]">
                        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${s.missing ? 'bg-red-500' : s.unchanged ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-300">{s.title}</span>
                        <span className="shrink-0 text-[10.5px] text-slate-400">
                          {s.missing ? 'dihapus' : s.unchanged ? 'sama' : 'berubah'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1 text-[11px] text-slate-400 dark:text-slate-500 space-y-0.5 tabular-nums">
                    <div>ID: {String(data.receiptId).slice(0, 16)}…</div>
                    <div>Model: {data.model}</div>
                    <div>{data.generatedAt ? new Date(data.generatedAt).toLocaleString('id-ID') : ''}</div>
                  </div>

                  <p className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug border-t border-stone-100 dark:border-slate-800/60 mt-2 pt-2">
                    Bukti ini memastikan jawaban dibuat dari sumber tersebut, pada waktu tersebut, dan
                    catatannya belum diubah. Bukti ini <span className="font-semibold">tidak</span> menjamin
                    jawaban AI benar.
                  </p>
                </>
              )}
            </div>

            <div className="px-5 py-4 flex justify-end border-t border-stone-100 dark:border-slate-800/60">
              <button onClick={onClose} className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800">
                Tutup
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
