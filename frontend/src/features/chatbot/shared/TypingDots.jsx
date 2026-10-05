export default function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center" aria-label="DoKi sedang mengetik">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-accent-solid animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}
