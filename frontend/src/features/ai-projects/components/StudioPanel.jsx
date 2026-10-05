// Studio panel, NotebookLM-style: a header (with a gear for Instruksi/Insight) over the
// OutputsStudio body (generator grid + unified list of outputs & notes). Tabs are gone;
// notes moved into the list, and Instruksi/Insight moved behind the gear.

import { useState } from 'react';
import { useLang } from '@/app/providers/LanguageProvider';
import OutputsStudio from './OutputsStudio';
import StudioSettingsModal from './StudioSettingsModal';

export default function StudioPanel({
  project,
  onProjectUpdate,
  notesVersion = 0,
  onCitationClick,
  selectedSourceIds = null,
  onFocusChange,
  focused,
}) {
  const { t } = useLang();
  const [settingsTab, setSettingsTab] = useState(null); // 'instructions' | 'insights' | null

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      <div className="shrink-0 h-12 px-4 flex items-center justify-between border-b border-stone-200/70 dark:border-slate-800/70">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{t('aiStudio.panel.studio')}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setSettingsTab('insights')} title={t('aiStudio.panel.insight')} aria-label={t('aiStudio.panel.insight')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6m4 6V5m4 14v-9" /></svg>
          </button>
          <button onClick={() => setSettingsTab('instructions')} title={t('aiStudio.panel.instructions')} aria-label={t('aiStudio.panel.instructions')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <OutputsStudio
          project={project}
          onCitationClick={onCitationClick}
          selectedSourceIds={selectedSourceIds}
          notesVersion={notesVersion}
          onNoteChange={onProjectUpdate}
          onFocusChange={onFocusChange}
          focused={focused}
        />
      </div>

      <StudioSettingsModal project={project} tab={settingsTab} onClose={() => setSettingsTab(null)} onProjectUpdate={onProjectUpdate} />
    </div>
  );
}
