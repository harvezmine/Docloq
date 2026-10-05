import { motion } from 'framer-motion';

// Editorial monospace section marker, e.g. "▧ 02 / POWERFUL FEATURES --------".
export default function SectionLabel({ index = '01', title = '', accent = 'text-violet-400', align = 'left' }) {
  const centered = align === 'center';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className={`flex items-center gap-3 font-mono text-[11px] sm:text-xs tracking-[0.25em] uppercase mb-6 ${centered ? 'justify-center' : ''}`}
    >
      <span className={`inline-block w-2 h-2 ${accent} border border-current`} aria-hidden="true" />
      <span className="text-slate-500">{index}</span>
      <span className="text-slate-600">/</span>
      <span className={accent}>{title}</span>
      {!centered && <span className="hidden sm:block h-px w-16 bg-gradient-to-r from-slate-700 to-transparent" aria-hidden="true" />}
    </motion.div>
  );
}
