// DoKi avatar, the mascot on a white circle with a soft ring so it pops on any surface
// (the mascot itself is mostly white). Falls back to a solid-indigo "D" mark if the image is
// missing. size in px.
import { useState } from 'react';

export default function DokiAvatar({ size = 32, className = '' }) {
  const [broken, setBroken] = useState(false);
  const s = { width: size, height: size };
  if (broken) {
    return (
      <div style={s} className={`rounded-full bg-accent-solid text-white font-bold flex items-center justify-center shrink-0 shadow-sm ${className}`}>
        <span style={{ fontSize: size * 0.5 }}>D</span>
      </div>
    );
  }
  return (
    <div style={s} className={`rounded-full bg-white ring-1 ring-black/5 shadow-sm overflow-hidden shrink-0 flex items-center justify-center ${className}`}>
      <img src="/doki-mascot.png" alt="DoKi" onError={() => setBroken(true)} className="w-full h-full object-cover scale-105" />
    </div>
  );
}
