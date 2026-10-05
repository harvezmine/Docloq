import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';

/* Corner tick, blueprint-style L mark */
function Ticks() {
  return (
    <>
      <span aria-hidden="true" className="absolute top-2 left-2 w-3 h-3 border-t border-l border-slate-600 group-hover:border-slate-400 transition-colors" />
      <span aria-hidden="true" className="absolute top-2 right-2 w-3 h-3 border-t border-r border-slate-600 group-hover:border-slate-400 transition-colors" />
      <span aria-hidden="true" className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-slate-600 group-hover:border-slate-400 transition-colors" />
      <span aria-hidden="true" className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-slate-600 group-hover:border-slate-400 transition-colors" />
    </>
  );
}

function BentoCard({ tag, tagColor, title, description, hoverBorder, className = '', children, index = 0, parallaxY }) {
  return (
    <motion.div
      style={parallaxY ? { y: parallaxY } : undefined}
      className={className}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.08 }}
        viewport={{ once: true, margin: '-40px' }}
        className={`group relative h-full flex flex-col rounded-2xl border border-white/[0.08] bg-slate-900/50 backdrop-blur-sm p-6 overflow-hidden transition-colors duration-300 ${hoverBorder}`}
      >
        <Ticks />
        <div className="flex items-center justify-between mb-4">
          <span className={`font-mono text-[10px] tracking-[0.2em] uppercase ${tagColor}`}>{tag}</span>
          <span className="font-mono text-[10px] text-slate-600">0{index + 1}</span>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed mb-5">{description}</p>
        <div className="mt-auto">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function AIVisual() {
  const { t } = useLang();
  const insights = [
    { label: t('landing.bento.insightRevenue'), color: 'text-emerald-400 border-emerald-500/30' },
    { label: t('landing.bento.insightRisk'), color: 'text-cyan-400 border-cyan-500/30' },
    { label: t('landing.bento.insightActions'), color: 'text-violet-400 border-violet-500/30' },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 items-center">
      {/* Source doc, lines light up as if being read */}
      <div className="rounded-xl border border-white/5 bg-slate-950/60 p-4 space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            animate={{ backgroundColor: ['rgba(51,65,85,0.6)', 'rgba(139,92,246,0.55)', 'rgba(51,65,85,0.6)'] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.5 }}
            className="h-1.5 rounded-full"
            style={{ width: `${[92, 100, 68, 84, 55][i]}%` }}
          />
        ))}
      </div>
      <div className="space-y-2">
        {insights.map((ins, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.8 + i * 0.5 }}
            className={`px-3 py-1.5 rounded-lg border bg-slate-950/60 font-mono text-[11px] ${ins.color}`}
          >
            {ins.label}
          </motion.div>
        ))}
        <div className="flex items-end gap-1 h-10 pt-1" aria-hidden="true">
          {[35, 55, 45, 70, 60, 85].map((h, i) => (
            <motion.div
              key={i}
              animate={{ height: [`${h * 0.55}%`, `${h}%`, `${h * 0.55}%`] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
              className="flex-1 rounded-t bg-gradient-to-t from-violet-600/80 to-fuchsia-500/80"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatVisual() {
  const { t } = useLang();
  return (
    <div className="space-y-2">
      <div className="ml-auto max-w-[85%] px-3 py-2 rounded-xl rounded-br-sm bg-slate-800 text-[11px] text-slate-300 w-fit">
        {t('landing.bento.chatPrompt')}
      </div>
      <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-bl-sm bg-cyan-500/10 border border-cyan-500/20 w-fit">
        <div className="flex gap-1 items-center h-3">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
              className="w-1.5 h-1.5 rounded-full bg-cyan-400"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChainVisual() {
  const { t } = useLang();
  const blocks = ['0x7a3f…e21c', '0x9b2e…a4d8', '0xc4d1…f90b'];
  return (
    <div className="flex flex-col items-stretch">
      {blocks.map((h, i) => (
        <div key={i}>
          {i > 0 && (
            <div className="flex justify-center py-1">
              <motion.span
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4 }}
                className="w-px h-4 bg-emerald-400"
              />
            </div>
          )}
          <motion.div
            animate={i === blocks.length - 1 ? { borderColor: ['rgba(52,211,153,0.2)', 'rgba(52,211,153,0.7)', 'rgba(52,211,153,0.2)'] } : undefined}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center justify-between px-3 py-2 rounded-lg border border-emerald-500/20 bg-slate-950/60"
          >
            <span className="font-mono text-[10px] text-slate-400">{h}</span>
            <span className="font-mono text-[9px] text-emerald-400 tracking-widest">{t('landing.bento.sealed')}</span>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

function RadarVisual() {
  return (
    <div className="relative w-24 h-24 mx-auto rounded-full border border-amber-500/20">
      <div aria-hidden="true" className="absolute inset-3 rounded-full border border-amber-500/15" />
      <div aria-hidden="true" className="absolute inset-6 rounded-full border border-amber-500/10" />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-0 rounded-full"
        style={{ background: 'conic-gradient(from 0deg, rgba(251,191,36,0.28), transparent 70deg)' }}
      />
      {[{ t: '22%', l: '62%' }, { t: '58%', l: '28%' }].map((p, i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.3, 0.6] }}
          transition={{ duration: 3.2, repeat: Infinity, delay: i * 1.4 }}
          className="absolute w-1.5 h-1.5 rounded-full bg-amber-400"
          style={{ top: p.t, left: p.l }}
        />
      ))}
    </div>
  );
}

function RolesVisual() {
  const rows = [
    { name: 'Admin', on: true },
    { name: 'Editor', on: true },
    { name: 'Viewer', on: false },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/60 border border-white/5">
          <span className="font-mono text-[10px] text-slate-400">{r.name}</span>
          <div className={`relative w-7 h-3.5 rounded-full ${r.on ? 'bg-pink-500/40' : 'bg-slate-700'}`}>
            <motion.span
              animate={i === 2 ? { x: [0, 14, 14, 0], backgroundColor: ['#64748b', '#ec4899', '#ec4899', '#64748b'] } : undefined}
              transition={{ duration: 4, repeat: Infinity, times: [0, 0.25, 0.75, 1] }}
              className={`absolute top-0.5 w-2.5 h-2.5 rounded-full ${r.on ? 'bg-pink-400 right-0.5' : 'bg-slate-500 left-0.5'}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkflowVisual() {
  const steps = ['Upload', 'Analyze', 'Sign', 'Anchor'];
  return (
    <div className="relative flex items-center justify-between px-2 sm:px-6">
      <div aria-hidden="true" className="absolute left-8 right-8 top-[13px] h-px bg-slate-700" />
      <motion.div
        aria-hidden="true"
        animate={{ left: ['8%', '88%'], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[10px] w-2 h-2 rounded-full bg-indigo-400 [box-shadow:0_0_12px_rgba(129,140,248,0.8)]"
      />
      {steps.map((s, i) => (
        <div key={i} className="relative flex flex-col items-center gap-2">
          <motion.div
            animate={{ borderColor: ['rgba(129,140,248,0.25)', 'rgba(129,140,248,0.9)', 'rgba(129,140,248,0.25)'] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.7 }}
            className="w-7 h-7 rounded-lg border bg-slate-950 flex items-center justify-center font-mono text-[10px] text-indigo-300"
          >
            {i + 1}
          </motion.div>
          <span className="font-mono text-[9px] tracking-widest uppercase text-slate-500">{s}</span>
        </div>
      ))}
    </div>
  );
}

// Asymmetric bento grid; cards carry live mini-visuals and drift at different parallax speeds.
export default function FeatureBento() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const ySlow = useTransform(scrollYProgress, [0, 1], [24, -24]);
  const yFast = useTransform(scrollYProgress, [0, 1], [56, -56]);

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <BentoCard
        index={0}
        tag="ai engine"
        tagColor="text-violet-400"
        hoverBorder="hover:border-violet-500/40"
        title="AI Document Analysis"
        description="Reads, extracts, and cross-references every clause. Insights and visual analytics surface in seconds, no manual digging."
        className="md:col-span-2 lg:col-span-2 lg:row-span-2"
      >
        <AIVisual />
      </BentoCard>

      <BentoCard
        index={1}
        tag="on-chain proof"
        tagColor="text-emerald-400"
        hoverBorder="hover:border-emerald-500/40"
        title="Blockchain Verification"
        description="Every file gets a cryptographic fingerprint sealed on-chain. Tampering is mathematically impossible to hide."
        className="lg:row-span-2"
        parallaxY={ySlow}
      >
        <ChainVisual />
      </BentoCard>

      <BentoCard
        index={2}
        tag="doki"
        tagColor="text-cyan-400"
        hoverBorder="hover:border-cyan-500/40"
        title="Smart Chatbot Assistant"
        description="Ask your documents anything in plain language, DoKi answers with sources."
        parallaxY={yFast}
      >
        <ChatVisual />
      </BentoCard>

      <BentoCard
        index={3}
        tag="threat intel"
        tagColor="text-amber-400"
        hoverBorder="hover:border-amber-500/40"
        title="OSINT Tracker"
        description="Sweeps the open web for leaked copies of your files, around the clock."
        parallaxY={ySlow}
      >
        <RadarVisual />
      </BentoCard>

      <BentoCard
        index={4}
        tag="access control"
        tagColor="text-pink-400"
        hoverBorder="hover:border-pink-500/40"
        title="Role Management"
        description="Granular permissions decide exactly who sees, edits, or signs what."
        parallaxY={yFast}
      >
        <RolesVisual />
      </BentoCard>

      <BentoCard
        index={5}
        tag="pipeline"
        tagColor="text-indigo-400"
        hoverBorder="hover:border-indigo-500/40"
        title="Task & Workflow"
        description="Documents move themselves, assign, review, sign, and archive on rails."
        className="md:col-span-2 lg:col-span-3"
      >
        <WorkflowVisual />
      </BentoCard>
    </div>
  );
}
