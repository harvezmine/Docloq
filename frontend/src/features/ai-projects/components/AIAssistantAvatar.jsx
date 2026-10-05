import { useState } from 'react';

export default function AIAssistantAvatar({ size = 32, className = '' }) {
  const [broken, setBroken] = useState(false);
  const s = { width: size, height: size };
  if (broken) {
    return (
      <div
        style={s}
        className={`rounded-full bg-accent-gradient-br flex items-center justify-center text-white shadow-sm shadow-accent shrink-0 ${className}`}
        aria-hidden="true"
      >
        <svg style={{ width: size * 0.5, height: size * 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="6" cy="6.5" r="2.3" strokeWidth={2} />
          <circle cx="18" cy="7" r="2.3" strokeWidth={2} />
          <circle cx="12" cy="17.5" r="2.6" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.9 8.2l2.9 7M16.2 8.7l-2.9 6.6M8.2 6.8l7.6.4" />
        </svg>
      </div>
    );
  }
  return (
    <div style={s} className={`rounded-full bg-white ring-1 ring-black/5 shadow-sm overflow-hidden shrink-0 flex items-center justify-center ${className}`}>
      <img src="/ai-project-mascot.png" alt="AI" onError={() => setBroken(true)} className="w-full h-full object-cover scale-105" />
    </div>
  );
}
