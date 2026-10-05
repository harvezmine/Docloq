import { motion, useTransform } from 'framer-motion';
import { BarChart3, Bot, FileText, Gavel, GitFork, ShieldCheck, Vault } from 'lucide-react';
import { useLang } from '@/app/providers/LanguageProvider';
import { PILLAR_BEATS, beatLocal, subPhase, clamp01 } from './heroStages';

const lerp = (a, b, t) => a + (b - a) * t;

const CARDS = [
  { pileX: -10, pileY: 6, pileR: 4, scatX: -150, scatY: 62, scatR: -13, orgX: -115, border: 'border-violet-500/50', glow: 'shadow-[0_0_40px_rgba(139,92,246,0.15)]' },
  { pileX: 8, pileY: -4, pileR: -3, scatX: 148, scatY: -70, scatR: 11, orgX: 0, border: 'border-cyan-400/50', glow: 'shadow-[0_0_40px_rgba(34,211,238,0.12)]' },
  { pileX: -2, pileY: -10, pileR: 2, scatX: -30, scatY: -128, scatR: 7, orgX: 115, border: 'border-violet-400/40', glow: 'shadow-[0_0_40px_rgba(139,92,246,0.12)]' },
];

function useStory(prog, index) {
  const B = PILLAR_BEATS[index];
  const t = useTransform(() => beatLocal(clamp01(prog.get()), B.story));
  const visible = useTransform(() => {
    const pr = clamp01(prog.get());
    return beatLocal(pr, B.in) * (1 - beatLocal(pr, B.park));
  });
  return { t, visible };
}

function DocChip({ t, fadeAt = 0.3 }) {

  const opacity = useTransform(() => {
    const v = t.get();
    return subPhase(v, 0, 0.08) * (1 - subPhase(v, fadeAt, fadeAt + 0.1));
  });
  const x = useTransform(() => lerp(-90, 0, subPhase(t.get(), 0, 0.3)));
  return (
    <motion.span style={{ opacity, x }} className="absolute -left-2 text-slate-300">
      <FileText className="w-8 h-8" strokeWidth={1.4} />
    </motion.span>
  );
}

function SecurityStory({ prog }) {
  const { t, visible } = useStory(prog, 0);
  const lockScale = useTransform(() => 0.6 + 0.4 * subPhase(t.get(), 0.3, 0.52));
  const lockOpacity = useTransform(() => subPhase(t.get(), 0.3, 0.5));
  const chipOpacity = useTransform(() => subPhase(t.get(), 0.5, 0.65));
  return (
    <motion.div style={{ opacity: visible }} className="absolute flex items-center justify-center">
      <DocChip t={t} />
      <motion.span
        style={{ scale: lockScale, opacity: lockOpacity }}
        className="w-16 h-16 rounded-full border border-indigo-400/50 bg-slate-950/70 flex items-center justify-center text-indigo-300 shadow-[0_0_40px_rgba(99,102,241,0.25)]"
      >
        <Vault className="w-7 h-7" strokeWidth={1.5} />
      </motion.span>
      {['AES-256', 'ML-KEM'].map((label, i) => (
        <motion.span
          key={label}
          style={{ opacity: chipOpacity, animationDelay: i === 1 ? '-4s' : '0s' }}
          className="absolute left-1/2 top-1/2 -ml-10 -mt-3 animate-[lp-orbit_8s_linear_infinite] px-2.5 py-1 rounded-full border border-indigo-400/40 bg-slate-950/80 font-mono text-[10px] tracking-widest text-indigo-300"
        >
          {label}
        </motion.span>
      ))}
    </motion.div>
  );
}

function OutputChip({ t, index, icon, label }) {

  const pop = useTransform(() => subPhase(t.get(), 0.4 + index * 0.08, 0.6 + index * 0.08));
  const y = useTransform(() => (1 - pop.get()) * 18);
  return (
    <motion.span
      style={{ opacity: pop, y }}
      className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border border-violet-400/30 bg-slate-950/85 text-violet-300"
    >
      {icon}
      <span className="font-mono text-[8px] tracking-widest uppercase text-slate-400">{label}</span>
    </motion.span>
  );
}

function AiStory({ prog }) {
  const { t: tr } = useLang();
  const { t, visible } = useStory(prog, 1);
  const outputs = [
    { icon: <FileText className="w-5 h-5" strokeWidth={1.5} />, label: tr('landing.fallback.outputReport') },
    { icon: <GitFork className="w-5 h-5" strokeWidth={1.5} />, label: tr('landing.fallback.outputMindmap') },
    { icon: <BarChart3 className="w-5 h-5" strokeWidth={1.5} />, label: tr('landing.fallback.outputInfographic') },
  ];
  return (
    <motion.div style={{ opacity: visible }} className="absolute flex flex-col items-center gap-6">
      <div className="relative flex items-center justify-center">
        <DocChip t={t} />
        <span className="w-16 h-16 rounded-2xl border border-violet-400/50 bg-slate-950/70 flex items-center justify-center text-violet-300 shadow-[0_0_40px_rgba(139,92,246,0.25)]">
          <Bot className="w-8 h-8" strokeWidth={1.5} />
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        {outputs.map(({ icon, label }, i) => (
          <OutputChip key={label} t={t} index={i} icon={icon} label={label} />
        ))}
      </div>
    </motion.div>
  );
}

function AuditStory({ prog }) {
  const { t: tr } = useLang();
  const { t, visible } = useStory(prog, 2);

  const swing = useTransform(() => {
    const v = t.get();
    return -18 * subPhase(v, 0.4, 0.54) + 26 * subPhase(v, 0.55, 0.62) * (1 - 0.6 * subPhase(v, 0.64, 0.78));
  });
  const gdprPop = useTransform(() => subPhase(t.get(), 0.62, 0.72));
  const pdpPop = useTransform(() => subPhase(t.get(), 0.68, 0.78));
  const sealPop = useTransform(() => subPhase(t.get(), 0.8, 0.94));
  return (
    <motion.div style={{ opacity: visible }} className="absolute flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        {[[gdprPop, 'GDPR'], [pdpPop, 'UU PDP']].map(([pop, label]) => (
          <motion.span
            key={label}
            style={{ opacity: pop, scale: pop }}
            className="px-2.5 py-1 rounded-full border border-cyan-400/40 bg-slate-950/80 font-mono text-[10px] tracking-widest text-cyan-300"
          >
            {label}
          </motion.span>
        ))}
      </div>
      <div className="relative flex items-center justify-center">
        <DocChip t={t} />
        <motion.span
          style={{ rotate: swing }}
          className="w-16 h-16 rounded-full border border-cyan-400/50 bg-slate-950/70 flex items-center justify-center text-cyan-300 shadow-[0_0_40px_rgba(34,211,238,0.2)]"
        >
          <Gavel className="w-7 h-7" strokeWidth={1.5} />
        </motion.span>
      </div>
      <motion.span
        style={{ opacity: sealPop, scale: sealPop }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-violet-400/50 bg-slate-950/80 text-violet-300 font-mono text-[10px] tracking-widest"
      >
        <ShieldCheck className="w-4 h-4" strokeWidth={1.6} />
        {tr('landing.fallback.secureCompliant')}
      </motion.span>
    </motion.div>
  );
}

function FallbackCard({ card, index, materialize, spread, gather, condense }) {
  const opacity = useTransform(() => {
    const mi = clamp01(materialize.get() * 1.6 - index * 0.2);
    return mi * (1 - clamp01(condense.get()));
  });
  const x = useTransform(() => {
    const s = clamp01(spread.get());
    const g = clamp01(gather.get());
    return lerp(lerp(lerp(card.pileX, card.scatX, s), card.orgX, g), 0, clamp01(condense.get()));
  });
  const y = useTransform(() => {
    const s = clamp01(spread.get());
    const g = clamp01(gather.get());
    const mi = clamp01(materialize.get() * 1.6 - index * 0.2);
    return lerp(lerp(lerp(card.pileY, card.scatY, s), 0, g), 60, clamp01(condense.get())) + (1 - mi) * 40;
  });
  const rotate = useTransform(() => {
    const s = clamp01(spread.get());
    const g = clamp01(gather.get());
    return lerp(lerp(card.pileR, card.scatR, s), 0, Math.max(g, clamp01(condense.get())));
  });
  const scale = useTransform(() => lerp(1, 0.78, clamp01(gather.get())));

  return (
    <motion.div
      style={{ x, y, rotate, scale, opacity, zIndex: index }}
      className={`absolute w-40 h-56 sm:w-48 sm:h-64 rounded-lg border ${card.border} ${card.glow} bg-slate-900/80 p-4 flex flex-col gap-2`}
    >
      <div className="h-2 w-2/3 rounded-full bg-violet-500/40" />
      <div className="h-1.5 w-full rounded-full bg-slate-800" />
      <div className="h-1.5 w-11/12 rounded-full bg-slate-800" />
      <div className="h-1.5 w-full rounded-full bg-violet-500/40" />
      <div className="h-1.5 w-4/5 rounded-full bg-slate-800" />
      <div className="h-1.5 w-full rounded-full bg-slate-800" />
      <div className="mt-auto h-1.5 w-1/2 rounded-full bg-slate-800" />
    </motion.div>
  );
}

export default function Hero3DFallback({ materialize, spread, gather, condense, prog }) {
  const pedestalOpacity = useTransform(() => {
    const base = clamp01(condense.get());
    if (!prog) return base;

    const fade = beatLocal(clamp01(prog.get()), [PILLAR_BEATS[0].in[0], PILLAR_BEATS[0].story[0]]);
    return base * (1 - fade);
  });

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
      {CARDS.map((card, i) => (
        <FallbackCard
          key={i}
          card={card}
          index={i}
          materialize={materialize}
          spread={spread}
          gather={gather}
          condense={condense}
        />
      ))}

      <motion.div
        style={{ opacity: pedestalOpacity }}
        className="absolute translate-y-15 w-36 h-48 rounded-lg border border-violet-400/60 bg-slate-900/90 shadow-[0_0_50px_rgba(139,92,246,0.3)] p-3 flex flex-col gap-2"
      >
        <div className="h-2 w-2/3 rounded-full bg-violet-500/50" />
        <div className="h-1.5 w-full rounded-full bg-slate-800" />
        <div className="h-1.5 w-4/5 rounded-full bg-slate-800" />
        <div className="h-1.5 w-full rounded-full bg-cyan-500/40" />
      </motion.div>

      {prog && (
        <div className="absolute -translate-y-10 flex items-center justify-center">
          <SecurityStory prog={prog} />
          <AiStory prog={prog} />
          <AuditStory prog={prog} />
        </div>
      )}
    </div>
  );
}
