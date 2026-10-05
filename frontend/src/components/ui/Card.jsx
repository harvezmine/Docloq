import { motion } from "framer-motion";

export default function Card({ children, className = "", hover = false, animate = true, onClick, onDoubleClick }) {
  const Component = animate ? motion.div : "div";
  
  const motionProps = animate ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  } : {};

  return (
    <Component
      {...motionProps}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 ${
        hover ? "hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700" : ""
      } ${className}`}
    >
      {children}
    </Component>
  );
}
