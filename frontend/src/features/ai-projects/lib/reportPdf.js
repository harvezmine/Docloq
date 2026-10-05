// Opens a print-styled window and calls print() so the browser's "Save as PDF" produces a
// clean document. Zero dependencies; the escaping keeps injected markdown text inert.
export function downloadReportPdf(title, markdown) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = (markdown || '').split('\n').map((line) => {
    if (line.startsWith('## ')) return `<h2>${esc(line.slice(3))}</h2>`;
    if (line.startsWith('### ')) return `<h3>${esc(line.slice(4))}</h3>`;
    if (line.startsWith('- ') || line.startsWith('* ')) return `<li>${esc(line.slice(2))}</li>`;
    if (!line.trim()) return '';
    return `<p>${esc(line)}</p>`;
  }).join('\n');

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>body{font:14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:720px;margin:40px auto;padding:0 24px}
    h1{font-size:22px}h2{font-size:17px;margin-top:1.4em}h3{font-size:15px}li{margin:.2em 0}@media print{body{margin:0}}</style>
    </head><body><h1>${esc(title)}</h1>${html}</body></html>`);
  w.document.close();
  w.focus();
  // Give the new window a tick to lay out before printing.
  setTimeout(() => w.print(), 250);
}
