// Renderers for the six Studio output kinds. Each takes { payload, onCitationClick } where
// payload = { data, citations } exactly as the backend encrypted it.

import { useMemo, useState, useEffect } from 'react';
import { useLang } from '@/app/providers/LanguageProvider';
import api from '@/services/api';
import CitationMarker from '../CitationMarker';
import { downloadReportPdf } from '../../lib/reportPdf';

// Same [N]-with-**bold** contract as ChatPanel, including the recursion that keeps a citation
// inside a bold span clickable, the alternation's bold branch would otherwise swallow it.
export function inlineCite(text, citations, onCitationClick, keyPrefix = 'c') {
  if (text === null || text === undefined) return null;
  return String(text).split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    const m = part.match(/^\[(\d+)\]$/);
    if (m) {
      const n = parseInt(m[1], 10);
      return (
        <CitationMarker key={key} n={n} citation={citations?.find((c) => c.n === n)} onClick={onCitationClick} />
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold">
          {inlineCite(part.slice(2, -2), citations, onCitationClick, key)}
        </strong>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

const Empty = ({ children }) => (
  <p className="text-[12.5px] text-slate-500 dark:text-slate-400 py-6 text-center leading-relaxed">{children}</p>
);

export function SummaryView({ payload, onCitationClick }) {
  const { t } = useLang();
  const { data, citations } = payload;
  if (!data?.markdown) return <Empty>{t('aiStudio.render.summaryEmpty')}</Empty>;
  const lines = data.markdown.split('\n');
  return (
    <div className="space-y-1 text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
      {lines.map((line, i) => {
        const cite = (t) => inlineCite(t, citations, onCitationClick, `sm${i}`);
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold mt-3">{cite(line.slice(4))}</h4>;
        if (line.startsWith('## ')) return <h3 key={i} className="font-bold mt-3">{cite(line.slice(3))}</h3>;
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <p key={i} className="ml-3 before:content-['•'] before:mr-1.5 before:text-indigo-400">
              {cite(line.slice(2))}
            </p>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        return <p key={i}>{cite(line)}</p>;
      })}
    </div>
  );
}

export function FaqView({ payload, onCitationClick }) {
  const { t } = useLang();
  const { data, citations } = payload;
  if (!data?.items?.length) return <Empty>{t('aiStudio.render.faqEmpty')}</Empty>;
  return (
    <div className="space-y-2.5">
      {data.items.map((it, i) => (
        <div key={i} className="p-3 rounded-xl bg-stone-50/60 dark:bg-slate-800/40">
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{it.question}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
            {inlineCite(it.answer, citations, onCitationClick, `f${i}`)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function TimelineView({ payload, onCitationClick }) {
  const { t } = useLang();
  const { data, citations } = payload;
  if (!data?.events?.length) return <Empty>{t('aiStudio.render.timelineEmpty')}</Empty>;
  return (
    <ol className="relative border-l border-stone-200 dark:border-slate-700 ml-2 space-y-4">
      {data.events.map((ev, i) => (
        <li key={i} className="ml-4">
          <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900" aria-hidden="true" />
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300 tabular-nums">
            {ev.date}
          </span>
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white mt-0.5">{ev.title}</p>
          <p className="text-[12.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {inlineCite(ev.description, citations, onCitationClick, `t${i}`)}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Force every row to exactly columns.length cells.
 *
 * The JSON schema cannot express "cells.length must equal columns.length", strict mode has no
 * way to tie one array's length to another field. So the model can and does return short or
 * long rows. Unnormalised, a short row silently shifts every later column in the CSV (Excel
 * shows values under the wrong heading), and the HTML table renders ragged.
 */
function normalizeRows(columns, rows) {
  const width = columns.length;
  return (rows || []).map((r) => {
    const cells = Array.isArray(r?.cells) ? r.cells : [];
    return Array.from({ length: width }, (_, i) => cells[i] ?? '');
  });
}

/** Quote every field and double embedded quotes, cells routinely contain commas and quotes. */
function toCsv(columns, normalized) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    columns.map((c) => esc(c.label)).join(','),
    ...normalized.map((cells) => cells.map(esc).join(',')),
  ].join('\r\n');
}

export function DataTableView({ payload, onCitationClick, title = 'tabel' }) {
  const { t } = useLang();
  const { data, citations } = payload;
  const normalized = useMemo(
    () => (data?.columns?.length ? normalizeRows(data.columns, data.rows) : []),
    [data],
  );
  const csv = useMemo(
    () => (data?.columns?.length ? toCsv(data.columns, normalized) : ''),
    [data, normalized],
  );
  if (!data?.columns?.length) return <Empty>{t('aiStudio.render.tableEmpty')}</Empty>;

  const download = () => {
    // Leading BOM so Excel reads it as UTF-8 (Rp, é) instead of mojibake.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w-]+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={download} className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1">
          {t('aiStudio.render.exportCsv')}
        </button>
      </div>
      {/* Wide tables scroll inside their own container, the panel must never scroll sideways. */}
      <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-slate-700">
        <table className="w-full text-[12px] border-collapse">
          <thead className="bg-stone-50 dark:bg-slate-800/60">
            <tr>
              {data.columns.map((c) => (
                <th key={c.key} scope="col" className="text-left font-semibold px-2.5 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {normalized.map((cells, i) => (
              <tr key={i} className="border-t border-stone-100 dark:border-slate-800">
                {cells.map((cell, j) => (
                  <td key={j} className="px-2.5 py-1.5 align-top text-slate-700 dark:text-slate-300">
                    {inlineCite(cell, citations, onCitationClick, `d${i}-${j}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MindMapView({ payload }) {
  const { t } = useLang();
  const { data } = payload;
  if (!data?.root) return <Empty>{t('aiStudio.render.mindmapEmpty')}</Empty>;
  const branches = data.root.children || [];
  return (
    <div className="space-y-2">
      <div className="inline-block px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[12.5px] font-semibold">
        {data.root.label}
      </div>
      <div className="pl-3 border-l-2 border-indigo-200 dark:border-indigo-500/30 space-y-2 ml-2">
        {branches.map((b, i) => (
          <div key={i}>
            <div className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">{b.label}</div>
            {b.children?.length > 0 && (
              <div className="pl-3 border-l border-stone-200 dark:border-slate-700 ml-1 mt-1 space-y-0.5">
                {b.children.map((c, j) => (
                  <div key={j} className="text-[12px] text-slate-600 dark:text-slate-400">{c.label}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SlidesView({ payload, onCitationClick, title = 'deck' }) {
  const { t } = useLang();
  const { data, citations } = payload;
  if (!data?.slides?.length) return <Empty>{t('aiStudio.render.deckEmpty')}</Empty>;
  const accent = data.theme?.accent || '#4f46e5';

  const exportPptx = async () => {
    // Loaded on demand: pptxgenjs is ~1MB and most sessions never export.
    const { default: PptxGenJS } = await import('pptxgenjs');
    const pptx = new PptxGenJS();
    const dark = !!data.theme?.dark;
    const bg = dark ? '0f172a' : 'ffffff';
    const fg = dark ? 'f8fafc' : '0f172a';
    const acc = accent.replace('#', '');
    for (const s of data.slides) {
      const slide = pptx.addSlide();
      slide.background = { color: bg };
      if (s.layout === 'section' || s.layout === 'title') {
        slide.addText(s.title, { x: 0.5, y: 2.2, w: 9, h: 1.2, fontSize: s.layout === 'title' ? 32 : 26, bold: true, color: acc });
      } else {
        slide.addText(s.title, { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 22, bold: true, color: fg });
        // [N] markers are meaningless in PowerPoint, strip them. This costs traceability:
        // an exported deck cannot be traced back to its sources.
        const bullets = (s.bullets || [])
          .map((b) => String(b).replace(/\[\d+\]/g, '').trim())
          .filter(Boolean)
          .map((text) => ({ text, options: { bullet: true, color: fg } }));
        if (bullets.length) slide.addText(bullets, { x: 0.7, y: 1.4, w: 8.6, h: 3.6, fontSize: 14 });
      }
      if (s.notes) slide.addNotes(s.notes);
    }
    await pptx.writeFile({ fileName: `${title.replace(/[^\w-]+/g, '-').toLowerCase()}.pptx` });
  };

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={exportPptx} className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1">
          {t('aiStudio.render.exportPptx')}
        </button>
      </div>
      <div className="space-y-2">
        {data.slides.map((s, i) => (
          <div key={i} className="p-3 rounded-xl border" style={{ borderColor: `${accent}40` }}>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] tabular-nums text-slate-400">{i + 1}</span>
              {s.layout && <span className="text-[9px] uppercase tracking-wide" style={{ color: accent }}>{s.layout}</span>}
              <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{s.title}</p>
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {(s.bullets || []).map((b, j) => (
                <li key={j} className="text-[12.5px] text-slate-600 dark:text-slate-300 ml-3 before:content-['•'] before:mr-1.5 before:text-indigo-400">
                  {inlineCite(b, citations, onCitationClick, `s${i}-${j}`)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// Image kinds (mindmap/infographic): fetch the encrypted PNG via the axios client (so the auth
// interceptor applies), show it as an object URL, and download it. Never a bare <img src> to a URL.
export function ImageView({ projectId, outputId, title }) {
  const { t } = useLang();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let revoked = false; let objUrl = null;
    api.get(`/ai-projects/${projectId}/outputs/${outputId}/image`, { responseType: 'blob' })
      .then((res) => { if (revoked) return; objUrl = URL.createObjectURL(res.data); setUrl(objUrl); })
      .catch(() => setError(true));
    return () => { revoked = true; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [projectId, outputId]);

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = `${(title || 'image').replace(/[^\w-]+/g, '-').toLowerCase()}.png`; a.click();
  };

  if (error) return <p className="text-[12px] text-red-600 dark:text-red-400 py-6 text-center">{t('aiStudio.render.imageLoadFailed')}</p>;
  if (!url) return <p className="text-[12px] text-slate-400 py-6 text-center">{t('aiStudio.render.imageLoading')}</p>;
  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={download} className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300 hover:underline">{t('aiStudio.render.downloadPng')}</button>
      </div>
      <img src={url} alt={title} className="w-full rounded-xl border border-stone-200 dark:border-slate-700" />
    </div>
  );
}

// Reports = the markdown summary renderer + a Download PDF button.
export function ReportView({ payload, onCitationClick, title = 'Laporan' }) {
  const { t } = useLang();
  const { data } = payload;
  if (!data?.markdown) return <Empty>{t('aiStudio.render.reportEmpty')}</Empty>;
  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={() => downloadReportPdf(title, data.markdown)} className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300 hover:underline">{t('aiStudio.render.downloadPdf')}</button>
      </div>
      <SummaryView payload={payload} onCitationClick={onCitationClick} />
    </div>
  );
}

const SEVERITY = {
  tinggi: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
  sedang: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  rendah: 'bg-slate-400/10 text-slate-600 dark:text-slate-300 border-stone-200 dark:border-slate-700',
};
export function ComplianceView({ payload, onCitationClick }) {
  const { t } = useLang();
  const { data, citations } = payload;
  const findings = data?.identityFindings || [];
  const risks = data?.risks || [];
  const idLabel = (k) => t(`aiStudio.render.idLabels.${k}`, k);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{t('aiStudio.render.identitiesDetected')}</p>
        {/* Computed locally, the whole reason this feature can exist without leaking. */}
        <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mb-2 leading-snug">
          {t('aiStudio.render.identitiesLocalNote')}
        </p>
        {findings.length === 0 ? (
          <p className="text-[12px] text-emerald-600 dark:text-emerald-400">{t('aiStudio.render.noIdentities')}</p>
        ) : (
          <div className="space-y-1.5">
            {findings.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-stone-50/60 dark:bg-slate-800/40">
                <span className="flex-1 min-w-0 text-[12px] font-medium text-slate-800 dark:text-slate-100 truncate">{f.title}</span>
                <span className="flex gap-1 shrink-0">
                  {Object.entries(f.counts).filter(([, n]) => n > 0).map(([k, n]) => (
                    <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-300 tabular-nums">
                      {idLabel(k)} {n}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{t('aiStudio.render.complianceRisks')}</p>
        {risks.length === 0 ? (
          <Empty>{t('aiStudio.render.noRisks')}</Empty>
        ) : (
          <div className="space-y-2">
            {risks.map((r, i) => (
              <div key={i} className={`p-3 rounded-xl border ${SEVERITY[r.severity] || SEVERITY.rendah}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/60 dark:bg-black/20">{r.severity}</span>
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-white">{r.title}</span>
                </div>
                <p className="mt-1 text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {inlineCite(r.description, citations, onCitationClick, `r${i}`)}
                </p>
                <p className="mt-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
                  <span className="font-medium">{t('aiStudio.render.recommendation')}</span> {r.recommendation}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const RENDERERS = {
  summary: SummaryView,
  report: ReportView,
  faq: FaqView,
  timeline: TimelineView,
  datatable: DataTableView,
  mindmap: ImageView,       // Tier 4: mind map is now an AI-generated image
  infographic: ImageView,
  slides: SlidesView,
  compliance: ComplianceView,
};
