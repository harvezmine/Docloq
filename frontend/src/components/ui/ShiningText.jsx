import { motion } from "framer-motion";

export function ShiningText({ text, className = "" }) {
  return (
    <motion.span
      className={`bg-[linear-gradient(110deg,#94a3b8,35%,#e2e8f0,50%,#94a3b8,75%,#94a3b8)] dark:bg-[linear-gradient(110deg,#404040,35%,#fff,50%,#404040,75%,#404040)] bg-[length:200%_100%] bg-clip-text text-sm font-medium text-transparent ${className}`}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{
        repeat: Infinity,
        duration: 2,
        ease: "linear",
      }}
    >
      {text}
    </motion.span>
  );
}

export default ShiningText;
