import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Atom, BadgeCheck, BellRing, CalendarClock, ChartPie, CircleHelp, Eraser, Eye, EyeOff, FileDiff,
  FileQuestion, FileText, Fingerprint, Globe, History, Languages, Lock, LockKeyhole, MapPin, MessageCircleQuestion,
  Network, Plus, Presentation, ScrollText, Server, ShieldCheck, Table,
} from 'lucide-react';
import '@fontsource-variable/archivo';
import './landing.css';
import { useLang } from '@/app/providers/LanguageProvider';
import DocLoqMark from '@/components/brand/DocLoqMark';
import LandingNav from './LandingNav';
import GuillocheCanvas from './components/GuillocheCanvas';
import DokiChat from './components/DokiChat';
import {
  AccessStage, ChangedValue, ContractPage, IntactLog, ReadOnlyShare, StoreStage, TracedCopy, WatchStage,
} from './components/Illustrations';
import {
  BTN_PRIMARY, BTN_SECONDARY, BTN_SECONDARY_SM, CONTAINER, H2, LINK, NAVY, WHATSAPP_URL, demoHref, jumpTo,
} from './ui';

// Ribbon sets for the two navy bands (see guilloche.js for the fields).
const HERO_RIBBONS = [
  { bottom: 262, swing: 26, drift: 1.15, width: 26, twist: 8, strands: 22, alpha: 0.13, phase: 4.4, lineWidth: 0.5 },
  { bottom: 215, swing: 50, drift: 0.85, width: 44, twist: 6, strands: 30, alpha: 0.24, phase: 0.6 },
  { bottom: 150, swing: 64, drift: 0.65, width: 62, twist: 4.5, strands: 36, alpha: 0.17, phase: 2.6 },
];

const CTA_RIBBONS = [
  { bottom: 190, swing: 30, drift: 0.95, width: 30, twist: 7, strands: 24, alpha: 0.12, phase: 1.9, lineWidth: 0.5 },
  { bottom: 130, swing: 56, drift: 0.7, width: 50, twist: 5, strands: 32, alpha: 0.2, phase: 3.3 },
];

// Keeps the headline readable over the line work and melts the band into the page.
const HERO_SCRIM = {
  backgroundImage: `radial-gradient(ellipse 55% 42% at 50% 38%, ${NAVY}e6, ${NAVY}00 72%), linear-gradient(to bottom, #02061700 74%, #020617 100%)`,
};
const CTA_SCRIM = {
  backgroundImage: `radial-gradient(ellipse 50% 45% at 50% 35%, ${NAVY}e6, ${NAVY}00 72%)`,
};

const LEAD = 'mt-5 text-lg leading-[1.7] text-slate-300';

const TRUST_ICONS = [MapPin, Server, Atom, History];

// Scroll reveal via AOS (initialised in App.jsx); landing.css keeps the travel short.
const reveal = (delay = 0, effect = 'fade-up') => ({
  'data-aos': effect,
  'data-aos-duration': '700',
  ...(delay ? { 'data-aos-delay': String(delay) } : {}),
});

// True once the first-visit splash in index.html has left, or right away if it never showed.
function useSplashDone() {
  const [done, setDone] = useState(
    () => window.__docloqSplashDone === true || !document.getElementById('dl-splash'),
  );
  useEffect(() => {
    if (done) return undefined;
    const onDone = () => setDone(true);
    window.addEventListener('docloq:splash-done', onDone);
    // The splash may have left between render and this effect.
    const frame = requestAnimationFrame(() => {
      if (window.__docloqSplashDone) onDone();
    });
    return () => {
      window.removeEventListener('docloq:splash-done', onDone);
      cancelAnimationFrame(frame);
    };
  }, [done]);
  return done;
}

const RISE = 'transition duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none';

function WhatsAppIcon({ className }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.16c-.25.69-1.44 1.32-1.98 1.36-.53.05-1.02.24-3.45-.72-2.9-1.14-4.76-4.1-4.9-4.29-.14-.19-1.18-1.57-1.18-2.99s.74-2.12 1.01-2.41c.26-.29.58-.36.77-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.25.59.84 2.04.91 2.19.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.74 1.22 1.59 1.98 1.1.98 2.02 1.28 2.31 1.42.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.39-.24.66-.14.27.1 1.7.8 1.99.95.29.14.48.21.55.33.07.12.07.69-.18 1.38z" />
    </svg>
  );
}

function DemoButton({ className = BTN_PRIMARY }) {
  const { t } = useLang();
  return (
    <a href={demoHref(t)} target="_blank" rel="noopener noreferrer" className={className}>
      {t('landing.nav.bookDemo')}
      <ArrowRight aria-hidden="true" className="size-4" />
    </a>
  );
}

function Hero() {
  const { t } = useLang();
  const trust = [1, 2, 3, 4].map((n) => t(`landing.hero.trust${n}`));
  const ready = useSplashDone();
  const state = ready ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0';
  const at = (ms) => ({ transitionDelay: ready ? `${ms}ms` : '0ms' });

  return (
    <section className="relative -mt-16 overflow-hidden" style={{ backgroundColor: NAVY }}>
      <GuillocheCanvas ribbons={HERO_RIBBONS} />
      <div aria-hidden="true" style={HERO_SCRIM} className="absolute inset-0" />

      <div className={`${CONTAINER} relative flex min-h-[max(46rem,min(100svh,60rem))] flex-col items-center pb-48 pt-36 text-center sm:pb-72 sm:pt-44`}>
        <h1 style={at(0)} className={`${RISE} ${state} max-w-4xl text-balance text-[clamp(2.6rem,6vw,5rem)] font-medium leading-[1.04] tracking-[-0.035em] text-white`}>
          {t('landing.hero.title')}
        </h1>
        <p style={at(120)} className={`${RISE} ${state} mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-slate-300 sm:text-xl sm:leading-relaxed`}>
          {t('landing.hero.sub')}
        </p>
        <div style={at(240)} className={`${RISE} ${state} mt-10 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row`}>
          <DemoButton />
          <Link to="/login" className={BTN_SECONDARY}>{t('landing.nav.signIn')}</Link>
        </div>
        <p style={at(320)} className={`${RISE} ${state} mt-5 text-sm text-slate-400`}>{t('landing.hero.note')}</p>
      </div>

      <ul
        aria-label={t('landing.hero.trustLabel')}
        style={at(420)}
        className={`${RISE} ${state} ${CONTAINER} absolute inset-x-0 bottom-0 hidden flex-wrap items-center justify-center gap-x-9 gap-y-3 pb-10 text-sm text-slate-300 sm:flex`}
      >
        {trust.map((item, i) => {
          const Icon = TRUST_ICONS[i];
          return (
            <li key={item} className="flex items-center gap-2.5 whitespace-nowrap">
              <Icon aria-hidden="true" className="size-4 text-brand-300" />
              {item}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* App-style notification: what DocLoq shows when the story plays out. */
function Toast({ icon, title, meta, className = '' }) {
  const Icon = icon;
  return (
    <div className={`flex w-fit max-w-full items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/95 py-2.5 pl-2.5 pr-5 shadow-xl shadow-black/40 ${className}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
        <Icon aria-hidden="true" className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="block truncate text-xs text-slate-400">{meta}</span>
      </span>
    </div>
  );
}

const STORY_ICONS = [Fingerprint, FileDiff, Eye, ShieldCheck];

/* One lead story (the leak traced to a person), then three supporting ones. */
function UseCases() {
  const { t } = useLang();
  const u = (k) => t(`landing.useCases.${k}`);
  const art = [
    <TracedCopy key="traced" />,
    <ChangedValue key="changed" before={t('landing.illus.amountOld')} after={t('landing.illus.amountNew')} />,
    <ReadOnlyShare key="share" stamp={t('landing.illus.stamp')} />,
    <IntactLog key="log" />,
  ];
  const toast = (i, className) => (
    <Toast icon={STORY_ICONS[i]} title={u(`toast${i + 1}`)} meta={u(`toastMeta${i + 1}`)} className={className} />
  );

  return (
    <section id="use-cases" className="scroll-mt-16 py-24 lg:py-32">
      <div className={CONTAINER}>
        <h2 {...reveal()} className={`${H2} max-w-3xl text-white`}>{u('heading')}</h2>

        <article className="mt-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <div {...reveal(0, 'zoom-in')} className="relative lg:col-span-7">
            {art[0]}
            {toast(0, 'relative -mt-6 ml-auto mr-2 sm:absolute sm:bottom-4 sm:right-2 sm:mt-0')}
          </div>
          <div {...reveal(150)} className="lg:col-span-5">
            <h3 className="text-balance text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-[1.12] tracking-[-0.025em] text-white">
              {u('title1')}
            </h3>
            <p className="mt-4 text-lg text-slate-400">{u('body1')}</p>
          </div>
        </article>

        <div className="mt-20 grid grid-cols-1 gap-x-10 gap-y-16 border-t border-slate-800 pt-16 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <article key={i} {...reveal((i - 1) * 120)}>
              {art[i]}
              {toast(i, 'relative -mt-4 ml-3')}
              <h3 className="mt-7 text-balance text-xl font-medium leading-snug tracking-tight text-white">{u(`title${i + 1}`)}</h3>
              <p className="mt-2 text-slate-400">{u(`body${i + 1}`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const COMPARE_ICONS = [
  [FileQuestion, Fingerprint],
  [CircleHelp, BadgeCheck],
  [Eraser, LockKeyhole],
  [EyeOff, BellRing],
  [Globe, Server],
  [Lock, Atom],
];

function VsCell({ icon, text, brand = false, label }) {
  const Icon = icon;
  return (
    <div className={`flex items-center gap-3 py-4 md:px-6 md:py-5 ${brand ? 'rounded-xl bg-brand-500/8 px-3 md:rounded-none md:bg-transparent' : 'pr-3'}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${brand ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className={`text-[15px] font-medium leading-snug ${brand ? 'text-white' : 'text-slate-500'}`}>
        <span className="sr-only">{label}: </span>
        {text}
      </span>
    </div>
  );
}

/* Ordinary cloud vs DocLoq, read at a glance: grey and failing vs blue and handled. */
function Compare() {
  const { t } = useLang();
  const k = (key) => t(`landing.compare.${key}`);
  const cols = 'grid grid-cols-2 md:grid-cols-[28%_36%_36%]';

  return (
    <section id="compare" className="scroll-mt-16 border-y border-slate-800 bg-slate-900/40 py-24 lg:py-32">
      <div className={CONTAINER}>
        <div {...reveal()} className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end">
          <h2 className={`${H2} text-white lg:col-span-7`}>{k('heading')}</h2>
          <p className="text-lg leading-relaxed text-slate-300 lg:col-span-5">{k('intro')}</p>
        </div>

        <div {...reveal(120)} className="relative mt-14">
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[36%] rounded-3xl border border-brand-400/30 bg-brand-500/7 md:block" />

          <div className={`relative ${cols} items-end gap-x-3 pb-3 md:gap-x-0`}>
            <span className="hidden md:block" />
            <p className="text-sm text-slate-500 md:px-6">{k('colOther')}</p>
            <p className="flex items-center gap-2.5 font-semibold text-white md:px-6 md:pt-7">
              <span className="grid size-7 place-items-center rounded-lg bg-brand-700 text-white">
                <DocLoqMark variant="current" className="size-4.5" />
              </span>
              {k('colDocloq')}
            </p>
          </div>

          {COMPARE_ICONS.map(([OtherIcon, DocloqIcon], i) => {
            const n = i + 1;
            return (
              <div key={n} className={`relative ${cols} gap-x-3 border-t border-slate-800 md:gap-x-0 md:border-t-0`}>
                <p className="col-span-2 pt-5 text-lg font-medium text-white md:col-span-1 md:border-t md:border-slate-800 md:py-5 md:pr-6 md:leading-10">
                  {k(`row${n}`)}
                </p>
                <div className="md:border-t md:border-slate-800">
                  <VsCell icon={OtherIcon} text={k(`row${n}Other`)} label={k('colOther')} />
                </div>
                <div className="md:border-t md:border-brand-400/15">
                  <VsCell icon={DocloqIcon} text={k(`row${n}Docloq`)} label={k('colDocloq')} brand />
                </div>
              </div>
            );
          })}
          <div className="h-2 md:h-5" />
        </div>

        <div {...reveal()} className="mt-20 grid grid-cols-1 items-center gap-6 md:grid-cols-12 md:gap-10">
          <p className="text-[clamp(6rem,15vw,11rem)] font-medium leading-[0.85] tracking-[-0.06em] text-white md:col-span-5 lg:col-span-4">
            2%
          </p>
          <div className="md:col-span-7 lg:col-span-8">
            <p className="text-balance text-2xl font-medium leading-snug text-white sm:text-3xl">{k('stakes')}</p>
            <p className="mt-3 text-lg text-slate-400">{k('stakesSub')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Three pictures joined by one line: store, set access, monitor. */
function HowItWorks() {
  const { t } = useLang();
  const art = [<StoreStage key="s" />, <AccessStage key="a" />, <WatchStage key="w" />];
  return (
    <section id="how" className="scroll-mt-16 py-24 lg:py-32">
      <div className={CONTAINER}>
        <h2 {...reveal()} className={`${H2} mx-auto max-w-3xl text-center text-white`}>{t('landing.how.heading')}</h2>
        <ol className="relative mt-16 grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-8">
          <span aria-hidden="true" className="absolute inset-x-[17%] top-23 hidden border-t border-dashed border-brand-400/40 md:block" />
          {art.map((picture, i) => (
            <li key={i} {...reveal(i * 150)} className="relative text-center">
              <div className="mx-auto w-full max-w-65">{picture}</div>
              <p className="mt-5 inline-flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-full bg-brand-700 text-sm font-semibold text-white">{i + 1}</span>
                <span className="text-xl font-medium text-white">{t(`landing.how.step${i + 1}Title`)}</span>
              </p>
              <p className="mt-2 text-[17px] text-slate-400">{t(`landing.how.step${i + 1}Desc`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const AI_POINT_ICONS = [FileText, Languages, Server];
const AI_OUTPUT_ICONS = [ScrollText, FileText, MessageCircleQuestion, CalendarClock, Table, Network, ShieldCheck, Presentation, ChartPie];

/* The selling point: an AI that reads the archive and can live on the company's own servers. */
function DocloqAi() {
  const { t } = useLang();
  const a = (k) => t(`landing.ai.${k}`);
  return (
    <section id="ai" className="scroll-mt-16 border-y border-slate-800 py-24 lg:py-32" style={{ backgroundColor: NAVY }}>
      <div className={CONTAINER}>
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-12">
          <div {...reveal()} className="lg:col-span-5">
            <h2 className={`${H2} text-white`}>{a('heading')}</h2>
            <p className={LEAD}>{a('intro')}</p>
            <ul className="mt-9 space-y-3.5">
              {AI_POINT_ICONS.map((Icon, i) => (
                <li key={i} className="flex items-center gap-3.5 text-[17px] text-white">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
                    <Icon aria-hidden="true" className="size-4.5" />
                  </span>
                  {a(`point${i + 1}`)}
                </li>
              ))}
            </ul>
          </div>

          <div {...reveal(150, 'zoom-in')} className="relative lg:col-span-7">
            <div className="relative sm:pb-10">
              <div className="hidden w-[62%] sm:block">
                <ContractPage />
              </div>
              <div className="sm:absolute sm:bottom-0 sm:right-0 sm:w-[70%]">
                <DokiChat />
              </div>
              <span className="absolute bottom-0 left-4 hidden items-center gap-2 rounded-full border border-brand-400/30 bg-slate-950/90 px-3 py-1.5 text-xs font-medium text-brand-200 sm:inline-flex">
                <Server aria-hidden="true" className="size-3.5" />
                {a('onPrem')}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 items-center gap-8 border-t border-white/10 pt-12 lg:grid-cols-12 lg:gap-12">
          <p {...reveal()} className="text-2xl font-medium tracking-tight text-white sm:text-3xl lg:col-span-4">{a('outputsTitle')}</p>
          <ul {...reveal(120)} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-8">
            {AI_OUTPUT_ICONS.map((Icon, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-[15px] text-white">
                <Icon aria-hidden="true" className="size-4.5 shrink-0 text-brand-300" />
                {a(`out${i + 1}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const { t } = useLang();
  const faqs = [1, 2, 3, 4, 5].map((n) => [t(`landing.faq.q${n}`), t(`landing.faq.a${n}`)]);
  return (
    <section id="faq" className="scroll-mt-16 py-24 lg:py-32">
      <div className={`${CONTAINER} grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16`}>
        <div {...reveal()} className="lg:col-span-4">
          <h2 className={`${H2} text-white`}>{t('landing.faq.heading')}</h2>
          <p className="mt-5 text-[17px] text-slate-400">
            {t('landing.faq.more')}{' '}
            <a href={demoHref(t)} target="_blank" rel="noopener noreferrer" className={`text-brand-300 underline-offset-4 hover:underline ${LINK}`}>
              {t('landing.faq.moreLink')}
            </a>
          </p>
        </div>
        <div {...reveal(120)} className="divide-y divide-slate-800 border-y border-slate-800 lg:col-span-8">
          {faqs.map(([q, ans], i) => (
            <details key={q} className="group" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium text-white focus-visible:outline-2 focus-visible:outline-brand-400 [&::-webkit-details-marker]:hidden">
                {q}
                <Plus aria-hidden="true" className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-45" />
              </summary>
              <p className="pb-5 pr-10 text-[17px] leading-relaxed text-slate-300">{ans}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  const { t } = useLang();
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: NAVY }}>
      <GuillocheCanvas ribbons={CTA_RIBBONS} />
      <div aria-hidden="true" style={CTA_SCRIM} className="absolute inset-0" />
      <div className={`${CONTAINER} relative flex flex-col items-center pb-60 pt-28 text-center lg:pt-36`}>
        <h2 {...reveal()} className="max-w-3xl text-balance text-[clamp(2.5rem,5.4vw,4.5rem)] font-medium leading-[1.04] tracking-[-0.035em] text-white">
          {t('landing.cta.heading')}
        </h2>
        <p {...reveal(100)} className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-slate-300">{t('landing.cta.intro')}</p>
        <div {...reveal(200)} className="mt-10 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <DemoButton />
          <Link to="/login" className={BTN_SECONDARY}>{t('landing.nav.signIn')}</Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useLang();
  const f = (k) => t(`landing.footer.${k}`);
  const heading = 'text-sm font-medium text-white';
  const item = `text-[15px] text-slate-400 ${LINK}`;
  const product = ['use-cases', 'compare', 'how', 'ai', 'faq'].map((id) => [`#${id}`, t(`landing.nav.${id === 'use-cases' ? 'useCases' : id}`)]);

  return (
    <footer className="relative overflow-hidden border-t border-slate-800">
      <div className={`${CONTAINER} grid grid-cols-1 gap-12 pb-16 pt-20 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8`}>
        <div className="sm:col-span-2 lg:col-span-6">
          <Link to="/" aria-label={t('landing.nav.home')} className={`inline-flex items-center gap-2 ${LINK}`}>
            <span className="grid size-8 place-items-center rounded-lg bg-brand-700 text-white">
              <DocLoqMark variant="current" className="size-5" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-white">DocLoq</span>
          </Link>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-slate-400">{f('tagline')}</p>

          <div className="mt-10 max-w-sm border-t border-slate-800 pt-6">
            <p className={heading}>{f('contactTitle')}</p>
            <p className="mt-1.5 text-[15px] text-slate-400">{f('contactDesc')}</p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={`${BTN_SECONDARY_SM} mt-5`}>
              <WhatsAppIcon className="size-4 text-emerald-400" />
              +62 896-3645-8562
            </a>
          </div>
        </div>

        <nav aria-label={f('product')} className="lg:col-span-3">
          <p className={heading}>{f('product')}</p>
          <ul className="mt-5 space-y-3">
            {product.map(([hash, label]) => (
              <li key={hash}>
                <a href={hash} onClick={(e) => jumpTo(e, hash)} className={item}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={f('company')} className="lg:col-span-3">
          <p className={heading}>{f('company')}</p>
          <ul className="mt-5 space-y-3">
            <li><a href={demoHref(t)} target="_blank" rel="noopener noreferrer" className={item}>{t('landing.nav.bookDemo')}</a></li>
            <li><Link to="/contact" className={item}>{t('landing.nav.contact')}</Link></li>
            <li><Link to="/login" className={item}>{t('landing.nav.signIn')}</Link></li>
          </ul>
        </nav>
      </div>

      <div className={`${CONTAINER} flex flex-col gap-2 border-t border-slate-800 py-6 text-sm text-slate-500 sm:flex-row sm:justify-between`}>
        <p>{f('copyright')}</p>
        <p>{f('motto')}</p>
      </div>

      <p
        aria-hidden="true"
        className="pointer-events-none -mb-[0.22em] select-none text-center text-[clamp(5rem,22vw,20rem)] font-semibold leading-none tracking-[-0.06em] text-slate-900"
      >
        DocLoq
      </p>
    </footer>
  );
}

// Archivo is the landing page's own voice; the app shell keeps the system stack.
const ROOT_STYLE = {
  fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, sans-serif",
  colorScheme: 'dark',
};
const PAGE_BG = '#020617'; // slate-950

export default function LandingPage() {
  // Paint the canvas dark too, so overscroll never flashes the light app background.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.backgroundColor;
    root.style.backgroundColor = PAGE_BG;
    return () => { root.style.backgroundColor = previous; };
  }, []);

  return (
    <div style={ROOT_STYLE} className="lp-root min-h-dvh overflow-x-clip bg-slate-950 text-slate-300 antialiased">
      <LandingNav />
      <main>
        <Hero />
        <UseCases />
        <Compare />
        <HowItWorks />
        <DocloqAi />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}
