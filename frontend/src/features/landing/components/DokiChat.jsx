// DoKi chat mock for the "everyday work" section. Plain markup, no motion.
import { SendHorizontal } from 'lucide-react';
import { useLang } from '@/app/providers/LanguageProvider';
import DocLoqMark from '@/components/brand/DocLoqMark';

const WINDOW = 'overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/40';

export default function DokiChat() {
  const { t } = useLang();
  const points = [
    [t('landing.doki.point1'), 4],
    [t('landing.doki.point2'), 4],
    [t('landing.doki.point3'), 7],
  ];

  return (
    <div className={WINDOW}>
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-3.5">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-700 text-white">
          <DocLoqMark variant="current" className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">DoKi</p>
          <p className="truncate text-xs text-slate-400">{t('landing.doki.file')}</p>
        </div>
      </div>

      <div className="space-y-5 px-5 py-6">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-2.5 text-sm leading-relaxed text-white">
          {t('landing.doki.question')}
        </p>
        <div className="max-w-[94%] text-sm leading-relaxed text-slate-300">
          <p>{t('landing.doki.answerIntro')}</p>
          <ol className="mt-3 space-y-2.5">
            {points.map(([text, page], i) => (
              <li key={i} className="flex gap-2.5">
                <span className="tabular-nums text-slate-500">{i + 1}.</span>
                <span>
                  {text}{' '}
                  <cite className="ml-0.5 inline-block rounded bg-brand-500/15 px-1.5 py-px align-baseline text-[11px] font-medium not-italic text-brand-300">
                    {t('landing.doki.page')} {page}
                  </cite>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="border-t border-slate-800 px-5 py-3.5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-800/50 px-3.5 py-2.5 text-sm text-slate-500">
          <span className="truncate">{t('landing.doki.placeholder')}</span>
          <SendHorizontal aria-hidden="true" className="size-4 shrink-0" />
        </div>
      </div>
    </div>
  );
}

