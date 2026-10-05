import { motion } from "framer-motion";

function DisplayCard({
  className = "",
  icon,
  title = "Featured",
  description = "Discover amazing content",
  date = "Just now",
  iconClassName = "text-brand-500",
  titleClassName = "text-brand-500",
  iconBg = "bg-brand-800",
  gradient = "from-brand-500 to-brand-500",
  index = 0,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className={`group relative select-none rounded-2xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-sm p-6 transition-all duration-500 hover:border-white/20 hover:bg-slate-800/80 hover:-translate-y-2 ${className}`}
    >
      {/* Hover glow */}
      
      <div className="relative">
        {/* Icon */}
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-linear-to-r ${gradient} mb-5 text-white shadow-lg`}>
          {icon}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>

        {/* Description */}
        <p className="text-slate-400 text-sm leading-relaxed mb-4">{description}</p>

        {/* Footer tag */}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${titleClassName}`}>{date}</span>
          <svg className="w-4 h-4 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

export default function DisplayCards({ cards = [] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {cards.map((cardProps, index) => (
        <DisplayCard key={index} index={index} {...cardProps} />
      ))}
    </div>
  );
}

export { DisplayCard };
