import { motion } from "framer-motion";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  animate = true,
  ...props
}) {
  const baseStyles =
    "rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-accent text-white hover:brightness-110",
    secondary:
      "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300/70 dark:hover:bg-slate-700 border border-slate-300/60 dark:border-white/10",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-500",
    danger:
      "bg-rose-600 text-white hover:bg-rose-500",
    ghost:
      "bg-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300",
    outline:
      "bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const Component = animate ? motion.button : "button";
  const motionProps = animate ? {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.15 }
  } : {};

  return (
    <Component
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
}
