// AI Project workspace, 3-panel NotebookLM-style (Sources | Chat | Studio)
// C1 typography polish, C2 header bar dengan breadcrumb + actions, shared
// prefill state untuk Studio quick-action → Chat input.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLang } from '@/app/providers/LanguageProvider';
import DashboardLayout from '@/components/layout/DashboardLayout';
import aiProjectService from '@/services/ai-project.service';
import useAuthStore from '@/app/store/auth.store';
import SourcesPanel from './components/SourcesPanel';
import ChatPanel from './components/ChatPanel';
import StudioPanel from './components/StudioPanel';
import ShareProjectModal from './components/ShareProjectModal';
import ProvenanceModal from './components/ProvenanceModal';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function AIProjectWorkspace() {
  const { t } = useLang();
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMobilePanel, setActiveMobilePanel] = useState('chat');
  // Focus mode: widen the Studio panel and narrow Chat when an output is opened for reading.
  const [studioFocused, setStudioFocused] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState(null);
  const [notesVersion, setNotesVersion] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [provSubject, setProvSubject] = useState(null); // { type, id } of a message/output
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState(null);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const refresh = useCallback(async () => {
    try {
      const res = await aiProjectService.getProject(id);
      if (res?.success) setProject(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiProjects.workspace.loadError'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

 
  useEffect(() => {
    setSelectedSourceIds((prev) => {
      if (prev === null) return null;
      const active = new Set((project?.sources || []).filter((s) => s.status === 'active').map((s) => s.id));
      const next = prev.filter((id) => active.has(id));
      if (next.length === active.size) return null;
      if (next.length === prev.length) return prev;
      return next;
    });
  }, [project?.sources]);

  const handleCitationClick = (citation) => {
    // Scroll the cited source card into view + flash it (SourcesPanel renders data-source-id).
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-source-id="${citation.sourceId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('hf-source-flash');
        setTimeout(() => el.classList.remove('hf-source-flash'), 1200);
      }
    });
  };


  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await aiProjectService.deleteProject(id);
      navigate('/ai-projects');
    } catch (err) {
      setDeleteErr(err?.response?.data?.message || t('aiProjects.workspace.deleteError'));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout fullBleed>
        <div className="h-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout fullBleed>
        <div className="h-full flex items-center justify-center">
          <div className="text-center max-w-sm">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white mb-2">{t('aiProjects.workspace.cannotOpen')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error || t('aiProjects.workspace.notFound')}</p>
            <Link to="/ai-projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              <ArrowLeft className="w-4 h-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              {t('aiProjects.workspace.backToList')}
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout fullBleed>
      <style>{`
        .ai-project-surface { font-family: inherit; font-feature-settings: 'cv11', 'ss01'; }
        .ai-project-surface, .ai-project-surface * { -webkit-font-smoothing: antialiased; }
        @keyframes hfSourceFlash {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
          30% { box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.35); }
        }
        .hf-source-flash { animation: hfSourceFlash 1.2s ease-out; }
      `}</style>
      <div className="h-full flex flex-col ai-project-surface text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
        {/* Workspace header, breadcrumb + project meta + actions */}
        <header className="shrink-0 h-14 px-4 lg:px-6 bg-white/85 dark:bg-slate-950/80 backdrop-blur border-b border-stone-200/70 dark:border-slate-800/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate('/ai-projects')}
              className="shrink-0 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
              title={t('aiProjects.workspace.back')}
              aria-label={t('aiProjects.workspace.backAria')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400 min-w-0">
              <Link to="/ai-projects" className="hover:text-slate-900 dark:hover:text-white transition-colors">{t('aiProjects.workspace.breadcrumb')}</Link>
              <span aria-hidden="true">/</span>
            </nav>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{project.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {project.chatUsage && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-stone-100/80 dark:bg-slate-800/60 text-[11px] font-medium text-slate-600 dark:text-slate-300 tabular-nums"
                title={`${t('aiProjects.workspace.usagePrefix')} ${project.chatUsage.used} ${t('aiProjects.workspace.usageMid')} ${project.chatUsage.max} ${t('aiProjects.workspace.usageSuffix')}`}
              >
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {project.chatUsage.used}/{project.chatUsage.max}
              </div>
            )}
            <button
              onClick={() => setShowShare(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
              title={t('aiProjects.workspace.share')}
              aria-label={t('aiProjects.workspace.share')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            {/* Only the creator may delete, a member gets 403, so hide it for them. */}
            {project.createdBy === currentUserId && (
              <button
                onClick={() => { setDeleteErr(null); setShowDeleteConfirm(true); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
                title={t('aiProjects.workspace.delete')}
                aria-label={t('aiProjects.workspace.delete')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </header>

        <ShareProjectModal project={project} open={showShare} onClose={() => setShowShare(false)} />
        <ConfirmModal
          open={showDeleteConfirm}
          variant="danger"
          title={`${t('aiProjects.workspace.confirmDeletePrefix')} "${project.name}"?`}
          message={deleteErr || t('aiProjects.workspace.confirmDeleteSuffix').replace(/^\?\s*/, '')}
          confirmLabel={t('aiProjects.workspace.delete')}
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) { setShowDeleteConfirm(false); setDeleteErr(null); } }}
        />
        <ProvenanceModal
          projectId={id}
          subject={provSubject}
          open={!!provSubject}
          onClose={() => setProvSubject(null)}
        />

        {/* 3-panel layout */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className={`shrink-0 lg:w-64 xl:w-72 border-r border-stone-200/70 dark:border-slate-800/70 ${activeMobilePanel === 'sources' ? 'flex' : 'hidden lg:flex'} flex-col h-full`}>
            <SourcesPanel
              project={project}
              onChanged={refresh}
              selectedIds={selectedSourceIds}
              onSelectionChange={setSelectedSourceIds}
            />
          </div>

          <div className={`min-w-0 ${activeMobilePanel === 'chat' ? 'flex' : 'hidden lg:flex'} flex-col h-full ${studioFocused ? 'lg:w-[360px] lg:flex-none' : 'flex-1'}`}>
            <ChatPanel
              project={project}
              onCitationClick={handleCitationClick}
              onProjectUpdate={refresh}
              selectedSourceIds={selectedSourceIds}
              onNoteSaved={() => setNotesVersion((v) => v + 1)}
              onShowProvenance={(msg) => setProvSubject({ type: 'chat', id: msg.id })}
            />
          </div>

          <div className={`border-l border-stone-200/70 dark:border-slate-800/70 ${activeMobilePanel === 'studio' ? 'flex' : 'hidden lg:flex'} flex-col h-full ${studioFocused ? 'flex-1' : 'shrink-0 lg:w-72 xl:w-80'}`}>
            <StudioPanel
              project={project}
              onProjectUpdate={refresh}
              notesVersion={notesVersion}
              onCitationClick={handleCitationClick}
              selectedSourceIds={selectedSourceIds}
              onFocusChange={setStudioFocused}
              focused={studioFocused}
            />
          </div>
        </div>

        {/* Mobile bottom tab bar */}
        <div className="lg:hidden shrink-0 grid grid-cols-3 border-t border-stone-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900">
          {[
            { key: 'sources', label: t('aiProjects.workspace.tabs.sources'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { key: 'chat', label: t('aiProjects.workspace.tabs.chat'), icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
            { key: 'studio', label: t('aiProjects.workspace.tabs.studio'), icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveMobilePanel(t.key)}
              className={`py-3 min-h-[44px] flex flex-col items-center gap-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset transition-colors ${
                activeMobilePanel === t.key
                  ? 'text-indigo-600 dark:text-indigo-400 border-t-2 border-indigo-600 -mt-px'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
              aria-current={activeMobilePanel === t.key ? 'page' : undefined}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
