export default function GlassIcon({
  icon: Icon,
  size = 20,
  tone = "text-slate-200",
  className = "",
  containerClassName = "",
}) {
  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-lg " +
        "backdrop-blur-md border border-white/15 bg-white/10 " +
        containerClassName
      }
    >
      <Icon className={`${tone} ${className}`} size={size} strokeWidth={1.8} />
    </span>
  );
}
