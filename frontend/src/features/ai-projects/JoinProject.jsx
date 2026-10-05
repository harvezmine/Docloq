// Lands here from a share link. Joins, then redirects into the project, or explains why not.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLang } from '@/app/providers/LanguageProvider';
import DashboardLayout from '@/components/layout/DashboardLayout';
import aiProjectService from '@/services/ai-project.service';

export default function JoinProject() {
  const { t } = useLang();
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    aiProjectService.joinViaLink(token)
      .then((r) => {
        if (cancelled) return;
        if (r?.success && r.data?.projectId) navigate(`/ai-projects/${r.data.projectId}`, { replace: true });
        else setError(t('aiProjects.join.invalidLink'));
      })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.message || t('aiProjects.join.invalidLinkOrg')); });
    return () => { cancelled = true; };
  }, [token, navigate, t]);

  return (
    <DashboardLayout>
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          {!error ? (
            <>
              <div className="w-8 h-8 mx-auto mb-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('aiProjects.join.opening')}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">{t('aiProjects.join.cannotOpen')}</p>
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400 leading-relaxed">{error}</p>
              <button
                onClick={() => navigate('/ai-projects')}
                className="mt-4 min-h-[40px] px-4 rounded-xl bg-accent-gradient hover:brightness-110 text-white text-sm font-medium"
              >
                {t('aiProjects.join.goToProjects')}
              </button>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
