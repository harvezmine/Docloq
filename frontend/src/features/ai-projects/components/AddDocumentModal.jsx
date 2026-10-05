// Add document modal, list granted docs, inline grant for non-granted

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import aiProjectService from '@/services/ai-project.service';
import aiAnalysisService from '@/services/ai-analysis.service';
import { useLang } from '@/app/providers/LanguageProvider';
import GrantConsentModal from './GrantConsentModal';

export default function AddDocumentModal({ projectId, existingDocIds = [], onClose, onAdded }) {
  const { t } = useLang();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(null); // documentId being added
  const [granting, setGranting] = useState(null);
  const [consentDoc, setConsentDoc] = useState(null); // document awaiting the consent choice
  const [error, setError] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await aiAnalysisService.getDocuments(search);
      // aiAnalysisService returns axios response → use res.data
      if (res?.data?.success) setDocs(res.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiSources.doc.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(refresh, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search]);

  const handleAdd = async (doc) => {
    setAdding(doc.id);
    setError(null);
    try {
      await aiProjectService.addDocumentSource(projectId, doc.id);
      onAdded?.();
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.message;
      if (code === 'REQUIRES_CONSENT') {
        setError(`${t('aiSources.doc.notGrantedPrefix')}"${doc.originalFilename || doc.filename}"${t('aiSources.doc.notGrantedSuffix')}`);
      } else if (code === 'SOURCE_LIMIT') {
        setError(msg);
      } else if (code === 'SOURCE_EXTRACTION_FAILED') {
        setError(`${t('aiSources.doc.extractFailPrefix')}${doc.originalFilename || doc.filename}": ${msg}${t('aiSources.doc.extractFailSuffix')}`);
        onAdded?.(); // refresh supaya user lihat row 'failed'
      } else {
        setError(msg || t('aiSources.addFailed'));
      }
    } finally {
      setAdding(null);
    }
  };

  // Grant is a consent decision, so it always goes through the modal, the user picks whether
  // identities are censored before anything reaches OpenAI.
  const handleGrant = (doc) => {
    setError(null);
    setConsentDoc(doc);
  };

  const handleConsentChoice = async (redactionMode) => {
    const doc = consentDoc;
    setConsentDoc(null);
    if (!doc) return;
    setGranting(doc.id);
    try {
      await aiAnalysisService.grantAccess(doc.id, redactionMode);
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || t('aiSources.doc.grantError'));
    } finally {
      setGranting(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800 overflow-hidden flex flex-col"
        >
          <div className="px-6 pt-6 pb-3 border-b border-stone-100 dark:border-slate-800">
            <h2 className="text-2xl text-slate-900 dark:text-white">{t('aiSources.doc.title')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('aiSources.doc.subtitle')}
            </p>
          </div>

          <div className="px-6 py-3 border-b border-stone-100 dark:border-slate-800">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('aiSources.doc.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {error && <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300">{error}</div>}

            {loading && <div className="py-12 text-center text-sm text-slate-500">{t('common.loading')}</div>}

            {!loading && docs.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-500">{t('aiSources.doc.empty')}</div>
            )}

            <div className="space-y-0.5">
              {docs.map((doc) => {
                const alreadyAdded = existingDocIds.includes(doc.id);
                const granted = !!doc.aiAccessGranted;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <svg className="shrink-0 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{doc.originalFilename || doc.filename}</p>
                      <p className="text-[10px] text-slate-400 tabular-nums">{(doc.fileSize / 1024).toFixed(1)} KB</p>
                    </div>
                    {alreadyAdded ? (
                      <span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        {t('aiSources.doc.alreadyAdded')}
                      </span>
                    ) : !granted ? (
                      <button
                        onClick={() => handleGrant(doc)}
                        disabled={granting === doc.id}
                        className="shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-md border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/15 disabled:opacity-50 transition-colors"
                      >
                        {granting === doc.id ? t('aiSources.doc.granting') : t('aiSources.doc.grant')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAdd(doc)}
                        disabled={adding === doc.id}
                        className="shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-accent-gradient hover:brightness-110 text-white disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {adding === doc.id ? '...' : t('common.add')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-3 bg-stone-50/50 dark:bg-slate-900/50 border-t border-stone-100 dark:border-slate-800 flex justify-end">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">{t('common.close')}</button>
          </div>
        </motion.div>

        <GrantConsentModal
          open={!!consentDoc}
          documentName={consentDoc?.originalFilename || consentDoc?.filename || ''}
          onChoose={handleConsentChoice}
          onCancel={() => setConsentDoc(null)}
        />
      </motion.div>
    </AnimatePresence>
  );
}
