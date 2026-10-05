// OnlyOffice loading skeleton, staged progress + glassmorphism
import { useLang } from '@/app/providers/LanguageProvider';

export default function OnlyOfficeSkeleton({ stage = 'script', progressPct = 15, isDark = false }) {
  const { t } = useLang();
  const stageLabel = t(`misc.stage.${stage}`, t('misc.stage.default'));
  const bg = isDark ? 'bg-slate-900' : 'bg-slate-50';
  const surface = isDark ? 'bg-slate-800/60' : 'bg-white';
  const shimmer = isDark ? 'bg-slate-700/60' : 'bg-slate-200';
  const text = isDark ? 'text-slate-400' : 'text-slate-500';
  const subtle = isDark ? 'bg-slate-800' : 'bg-slate-100';

  return (
    <div className={`absolute inset-0 ${bg} z-20 pt-14 overflow-hidden`}>
      {/* Toolbar mock */}
      <div className={`h-12 ${subtle} border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} flex items-center px-6 gap-2`}>
        {[...Array(7)].map((_, i) => (
          <div key={i} className={`h-6 rounded ${shimmer} animate-pulse`} style={{ width: 50 + i * 8 }} />
        ))}
      </div>

      {/* Page mock, centered card */}
      <div className="flex justify-center pt-12">
        <div className={`w-full max-w-3xl ${surface} rounded-md shadow-xl p-12 space-y-4 border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {/* Title bar */}
          <div className={`h-7 rounded ${shimmer} animate-pulse w-3/5`} />
          <div className={`h-4 rounded ${shimmer} animate-pulse w-2/5`} />
          <div className="h-4" />
          {/* Paragraph lines */}
          {[100, 95, 90, 92, 88, 100, 85, 90, 60].map((w, i) => (
            <div key={i} className={`h-4 rounded ${shimmer} animate-pulse`} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>

      {/* Progress + label, fixed bottom-center */}
      <div className="absolute bottom-12 inset-x-0 flex flex-col items-center gap-3">
        <div className={`w-64 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
          <div
            className="h-full bg-brand-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.max(15, Math.min(100, progressPct))}%` }}
          />
        </div>
        <p className={`text-sm ${text} font-medium`}>{stageLabel}</p>
      </div>
    </div>
  );
}
