import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useLang } from '@/app/providers/LanguageProvider';
import DocLoqMark from '@/components/brand/DocLoqMark';
import { BTN_PRIMARY_SM, CONTAINER, LINK, demoHref, jumpTo } from './ui';

function LanguageSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <div role="group" aria-label={t('landing.nav.language')} className="inline-flex items-center gap-0.5 rounded-lg bg-slate-800/60 p-0.5">
      {['id', 'en'].map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-bold focus-visible:outline-2 focus-visible:outline-brand-400 ${
            lang === code ? 'bg-brand-700 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function LandingNav() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Transparent over the hero, solid once the page moves.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const solid = scrolled || open;

  const anchors = [
    ['#use-cases', t('landing.nav.useCases')],
    ['#compare', t('landing.nav.compare')],
    ['#how', t('landing.nav.how')],
    ['#ai', t('landing.nav.ai')],
    ['#faq', t('landing.nav.faq')],
  ];

  const go = (event, hash) => {
    setOpen(false);
    jumpTo(event, hash);
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b ${
        solid ? 'border-slate-800 bg-slate-950/95' : 'border-transparent bg-transparent'
      }`}
    >
      <div className={`${CONTAINER} flex h-16 items-center justify-between gap-6`}>
        <Link to="/" aria-label={t('landing.nav.home')} className={`flex items-center gap-2 ${LINK}`}>
          <span className="grid size-8 place-items-center rounded-lg bg-brand-700 text-white">
            <DocLoqMark variant="current" className="size-5" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-white">DocLoq</span>
        </Link>

        <nav aria-label={t('landing.nav.primary')} className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          {anchors.map(([hash, label]) => (
            <a key={hash} href={hash} onClick={(e) => go(e, hash)} className={LINK}>{label}</a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitch />
          <Link to="/login" className={`px-3 py-2 text-sm font-medium text-slate-300 ${LINK}`}>
            {t('landing.nav.signIn')}
          </Link>
          <a href={demoHref(t)} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY_SM}>
            {t('landing.nav.bookDemo')}
          </a>
        </div>

        <button
          type="button"
          className="-mr-2 rounded-md p-2 text-slate-300 hover:bg-slate-800/50 md:hidden"
          aria-expanded={open}
          aria-controls="lp-mobile-menu"
          aria-label={open ? t('landing.nav.closeMenu') : t('landing.nav.openMenu')}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        </button>
      </div>

      {open && (
        <div id="lp-mobile-menu" className="border-t border-slate-800 bg-slate-950 md:hidden">
          <nav aria-label={t('landing.nav.primary')} className={`${CONTAINER} flex flex-col py-3 text-[15px] text-slate-300`}>
            {anchors.map(([hash, label]) => (
              <a key={hash} href={hash} onClick={(e) => go(e, hash)} className="py-3">{label}</a>
            ))}
          </nav>
          <div className={`${CONTAINER} flex items-center gap-3 border-t border-slate-800 py-4`}>
            <LanguageSwitch />
            <Link to="/login" className="ml-auto px-3 py-2 text-sm font-medium text-slate-300">{t('landing.nav.signIn')}</Link>
            <a href={demoHref(t)} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY_SM}>{t('landing.nav.bookDemo')}</a>
          </div>
        </div>
      )}
    </header>
  );
}
