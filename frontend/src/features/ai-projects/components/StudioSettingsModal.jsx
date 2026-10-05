// Studio settings, behind the header gear: custom Instructions (added to every chat's system
// prompt) and Insights (token/usage charts). Lifted out of the old StudioPanel tab strip.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import aiProjectService from '@/services/ai-project.service';
import { useLang } from '@/app/providers/LanguageProvider';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const MAX_INSTRUCTION = 2000;
const PRESET_KEYS = ['formal', 'bullet', 'step', 'indonesian', 'english'];

function ComplianceBadge() {
  const { t } = useLang();
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 text-[10px] font-medium border border-amber-200/70 dark:border-amber-500/30"
      title={t('aiStudio.settings.complianceBadgeTitle')}
    >
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
      {t('aiStudio.settings.complianceBadgeText')}
    </span>
  );
}

export default function StudioSettingsModal({ project, tab, onClose, onProjectUpdate }) {
  const { t } = useLang();
  const open = tab === 'instructions' || tab === 'insights';
  const PRESETS = PRESET_KEYS.map((k) => ({
    key: k,
    label: t(`aiStudio.settings.presets.${k}.label`),
    text: t(`aiStudio.settings.presets.${k}.text`),
  }));

  const [instructions, setInstructions] = useState(project.customInstructions || '');
  const [savedInstructionsLabel, setSavedInstructionsLabel] = useState(null);
  const [showPresets, setShowPresets] = useState(false);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => { setInstructions(project.customInstructions || ''); }, [project.customInstructions]);

  const refreshUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const res = await aiProjectService.fetchUsage({ days: 30 });
      if (res?.success) setUsage(res.data);
    } catch (err) {
      setUsageError(err?.response?.data?.message || t('aiStudio.settings.loadUsageFailed'));
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'insights' && !usage && !usageLoading) refreshUsage();
  }, [tab, usage, usageLoading, refreshUsage]);

  const persist = (next, delay) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await aiProjectService.updateProject(project.id, { customInstructions: next });
        setSavedInstructionsLabel(t('aiStudio.settings.saved'));
        onProjectUpdate?.();
        setTimeout(() => setSavedInstructionsLabel(null), 1500);
      } catch {
        setSavedInstructionsLabel(t('aiStudio.settings.saveFailed'));
      }
    }, delay);
  };

  const handleInstructionsChange = (e) => {
    const v = e.target.value;
    setInstructions(v);
    persist(v, 1000);
  };

  const applyPreset = (preset) => {
    const next = (instructions.trim() ? `${preset.text}\n\n${instructions.trim()}` : preset.text).slice(0, MAX_INSTRUCTION);
    setInstructions(next);
    persist(next, 600);
    setShowPresets(false);
  };

  const chartTextColor = '#94a3b8';
  const dailyChartData = useMemo(() => {
    if (!usage?.daily) return null;
    return {
      labels: usage.daily.map((d) => d.date.slice(5)),
      datasets: [{ label: t('aiStudio.settings.tokenPerDay'), data: usage.daily.map((d) => d.totalTokens), backgroundColor: 'rgba(99, 102, 241, 0.65)', borderRadius: 6, maxBarThickness: 18 }],
    };
  }, [usage]);
  const sourceTypeChartData = useMemo(() => {
    if (!usage?.bySourceType?.length) return null;
    const colors = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#06b6d4'];
    return {
      labels: usage.bySourceType.map((s) => s.type),
      datasets: [{ data: usage.bySourceType.map((s) => s.count), backgroundColor: usage.bySourceType.map((_, i) => colors[i % colors.length]), borderWidth: 0 }],
    };
  }, [usage]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose} role="dialog" aria-modal="true" aria-label={tab === 'instructions' ? t('aiStudio.settings.instructionsTitle') : t('aiStudio.settings.insightTitle')}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-slate-800"
          >
            <div className="sticky top-0 z-10 px-5 py-3 flex items-center justify-between border-b border-stone-100 dark:border-slate-800/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{tab === 'instructions' ? t('aiStudio.settings.instructionsTitle') : t('aiStudio.settings.insightTitle')}</h3>
              <button onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {tab === 'instructions' && (
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed flex-1 pr-3">{t('aiStudio.settings.addedToPrompt')}</p>
                  <div className="relative shrink-0">
                    <button onClick={() => setShowPresets((v) => !v)} aria-expanded={showPresets} className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                      {t('aiStudio.settings.preset')}
                      <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${showPresets ? 'rotate-180' : ''}`} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                    <AnimatePresence>
                      {showPresets && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                          className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                          {PRESETS.map((p) => (
                            <button key={p.key} onClick={() => applyPreset(p)} className="w-full text-left px-3 py-2 text-[12px] text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700/60 transition-colors">{p.label}</button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <textarea
                  value={instructions} onChange={handleInstructionsChange} maxLength={MAX_INSTRUCTION} rows={10}
                  placeholder={t('aiStudio.settings.placeholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/40 dark:bg-slate-800/40 text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums">
                  <span className={`${savedInstructionsLabel ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} font-medium`}>
                    {savedInstructionsLabel || t('aiStudio.settings.autoSaveHint')}
                  </span>
                  <span className="text-slate-400">{instructions.length}/{MAX_INSTRUCTION}</span>
                </div>
              </div>
            )}

            {tab === 'insights' && (
              <div className="p-5 space-y-4">
                {usageLoading && <div className="text-center py-12 text-sm text-slate-500">{t('aiStudio.settings.loadingUsage')}</div>}
                {usageError && <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300">{usageError}</div>}
                {!usageLoading && !usageError && usage && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/60 dark:bg-slate-800/40">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{t('aiStudio.settings.totalToken')}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{usage.totals.totalTokens.toLocaleString('id-ID')}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{usage.rangeDays} {t('aiStudio.settings.days')}</p>
                      </div>
                      <div className="p-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/60 dark:bg-slate-800/40">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{t('aiStudio.settings.aiResponses')}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{usage.totals.responses.toLocaleString('id-ID')}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{usage.projectCount} {t('aiStudio.settings.activeProjects')}</p>
                      </div>
                    </div>
                    {dailyChartData ? (
                      <div className="p-3 rounded-xl border border-stone-200 dark:border-slate-700">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">{t('aiStudio.settings.dailyToken')} ({usage.rangeDays}h)</p>
                        <div className="h-36" role="img" aria-label={`${t('aiStudio.settings.dailyChartAria')}: ${usage.totals.totalTokens}`}>
                          <Bar data={dailyChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: chartTextColor, font: { size: 9 } }, grid: { display: false } }, y: { ticks: { color: chartTextColor, font: { size: 9 } }, grid: { color: 'rgba(148,163,184,0.15)' } } } }} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-[12px] text-slate-500 text-center py-4">{t('aiStudio.settings.noActivity')}</p>
                    )}
                    {sourceTypeChartData && (
                      <div className="p-3 rounded-xl border border-stone-200 dark:border-slate-700">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">{t('aiStudio.settings.sourceDistribution')}</p>
                        <div className="h-32" role="img" aria-label={t('aiStudio.settings.sourceDistributionAria')}>
                          <Doughnut data={sourceTypeChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: chartTextColor, font: { size: 11 }, boxWidth: 10, padding: 8 } } } }} />
                        </div>
                      </div>
                    )}
                    <ComplianceBadge />
                    <button onClick={refreshUsage} className="w-full text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline">{t('common.refresh')}</button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
