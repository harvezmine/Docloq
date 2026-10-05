// Shared class strings and helpers for the landing page.

export const CONTAINER = 'mx-auto w-full max-w-6xl px-5 sm:px-8';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400';

const BTN = `inline-flex items-center justify-center gap-2 rounded-xl font-medium ${FOCUS}`;

export const BTN_PRIMARY = `${BTN} bg-brand-700 px-5 py-3 text-[15px] text-white hover:bg-brand-600`;

export const BTN_PRIMARY_SM = `${BTN} bg-brand-700 px-4 py-2 text-sm text-white hover:bg-brand-600`;

export const BTN_SECONDARY = `${BTN} border border-slate-700/50 bg-slate-800/50 px-5 py-3 text-[15px] text-white hover:bg-slate-700/50`;

export const BTN_SECONDARY_SM = `${BTN} border border-slate-700/50 bg-slate-800/50 px-4 py-2.5 text-sm text-white hover:bg-slate-700/50`;

export const LINK = `rounded-sm hover:text-white ${FOCUS}`;

export const H2 = 'text-balance text-[clamp(2rem,3.6vw,3rem)] font-medium leading-[1.08] tracking-[-0.03em]';

export const WHATSAPP_URL = 'https://wa.me/6289636458562';

// In-page anchor jump. The sticky nav is offset with scroll-mt-* on each section.
export function jumpTo(event, hash) {
  const target = document.querySelector(hash);
  if (!target) return;
  event.preventDefault();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  window.history.replaceState(null, '', hash);
}

// Deep navy for the hero and closing bands; a shade bluer than the slate-950 page.
export const NAVY = '#041029';

// "Book a demo" opens WhatsApp with a prefilled message in the visitor's language.
export const demoHref = (t) => `${WHATSAPP_URL}?text=${encodeURIComponent(t('landing.cta.waMessage'))}`;
