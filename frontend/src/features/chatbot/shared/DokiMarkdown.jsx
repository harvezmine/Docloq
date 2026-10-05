// Lightweight markdown for DoKi replies: bold, headings, numbered/bulleted lists. Skips raw
// markdown table rows (structured data renders as cards instead).

export function inlineMd(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
      : p
  );
}

export function DokiMarkdown({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1 text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('|') || /^[\s\-:|]+$/.test(line)) return null; // skip table rows
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-2">{inlineMd(line.slice(4))}</h4>;
        if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-sm mt-2">{inlineMd(line.slice(3))}</h3>;
        if (/^\d+\.\s/.test(line)) return <p key={i} className="ml-3">{inlineMd(line)}</p>;
        if (line.startsWith('- ')) return <p key={i} className="ml-3 before:content-['•'] before:mr-1.5 before:text-accent">{inlineMd(line.slice(2))}</p>;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{inlineMd(line)}</p>;
      })}
    </div>
  );
}
