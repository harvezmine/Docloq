import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';
import aiProjectService from '@/services/ai-project.service';
import CitationMarker from './CitationMarker';
import AIAssistantAvatar from './AIAssistantAvatar';
import ConfirmModal from '@/components/ui/ConfirmModal';

// Inline markdown (**bold**) interleaved with [N] citation markers.
//
// The alternation tries the bold branch first and `[^*]+` will happily swallow a `[1]`
// inside it, so a bold span must RECURSE rather than render its inner text raw, otherwise
// "**Total Rp5M [2]**" prints the citation as literal text with no marker, which is exactly
// where the model puts its most important claims. Recursion terminates because `[^*]+`
// cannot match `*`, so the inner text can never contain another `**` span.
function inlineMdWithCitations(text, citations, onCitationClick, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    const cite = part.match(/^\[(\d+)\]$/);
    if (cite) {
      const n = parseInt(cite[1], 10);
      return (
        <CitationMarker
          key={key}
          n={n}
          citation={citations?.find((c) => c.n === n)}
          onClick={onCitationClick}
        />
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold">
          {inlineMdWithCitations(part.slice(2, -2), citations, onCitationClick, key)}
        </strong>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

// Block-level markdown, mirroring DokiWidget's MdBlock so both assistants render alike.
function renderContentWithCitations(content, citations, onCitationClick) {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const inline = (t) => inlineMdWithCitations(t, citations, onCitationClick, i);
        if (line.startsWith('### ')) {
          return <h4 key={i} className="font-semibold text-[13.5px] mt-2">{inline(line.slice(4))}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={i} className="font-bold text-sm mt-2">{inline(line.slice(3))}</h3>;
        }
        if (/^\d+\.\s/.test(line)) {
          return <p key={i} className="ml-3">{inline(line)}</p>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <p key={i} className="ml-3 before:content-['•'] before:mr-1.5 before:text-brand-400">
              {inline(line.slice(2))}
            </p>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

function AssistantAvatar() {
  return <AIAssistantAvatar size={32} />;
}

export default function ChatPanel({
  project,
  onCitationClick,
  onProjectUpdate,
  selectedSourceIds = null,
  onNoteSaved,
  onShowProvenance,
}) {
  const { t } = useLang();
  const [messages, setMessages] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [savedNoteFor, setSavedNoteFor] = useState(null); // messageId of the last saved reply
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const res = await aiProjectService.listChats(project.id);
      if (res?.success) {
        setMessages(res.data || []);
        setUsage(res.usage);
      }
    } catch (err) {
      setError(err?.response?.data?.message || t('aiStudio.chat.errors.loadChat'));
    } finally {
      setLoading(false);
    }
  }, [project.id, t]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);


  const activeSources = useMemo(
    () => (project.sources || []).filter((s) => s.status === 'active'),
    [project.sources],
  );
  const hasSources = activeSources.length > 0;
  // An explicit [] scope means the user deselected everything, the backend honours that and
  // would answer from nothing, so block the send rather than burn a request.
  const noneSelected = Array.isArray(selectedSourceIds) && selectedSourceIds.length === 0;

  // Dynamic suggestions derived from actual source titles (max 3).
  const dynamicSuggestions = useMemo(() => {
    if (activeSources.length === 0) {
      return [
        t('aiStudio.chat.suggestions.s1'),
        t('aiStudio.chat.suggestions.s2'),
        t('aiStudio.chat.suggestions.s3'),
      ];
    }
    const first = activeSources[0]?.title || t('aiStudio.chat.thisSource');
    const list = [
      `${t('aiStudio.chat.suggestions.summarizePre')} "${first}" ${t('aiStudio.chat.suggestions.summarizePost')}`,
      activeSources.length >= 2
        ? `${t('aiStudio.chat.suggestions.comparePre')} "${activeSources[0].title}" ${t('aiStudio.chat.suggestions.compareMid')} "${activeSources[1].title}"`
        : `${t('aiStudio.chat.suggestions.importantPre')} "${first}"?`,
      t('aiStudio.chat.suggestions.faq'),
    ];
    return list;
  }, [activeSources, t]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!prompt.trim() || sending) return;
    const text = prompt.trim();
    setPrompt('');
    setSending(true);
    setError(null);

    const tempUser = { id: 'temp-' + Date.now(), role: 'user', content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, tempUser]);

    try {
      const res = await aiProjectService.sendChat(project.id, text, selectedSourceIds);
      if (res?.success) {
        await refresh();
        onProjectUpdate?.();
      }
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === 'CHAT_LIMIT') {
        setError(`${t('aiStudio.chat.errors.limitPre')} (${data.used}/${data.max}). ${t('aiStudio.chat.errors.reset')} ${new Date(data.resetAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`);
      } else if (data?.code === 'NO_SOURCES') {
        setError(t('aiStudio.chat.errors.noSources'));
      } else if (data?.code === 'SOURCES_EMPTY') {
        const failedTitles = (data.sources || []).map((s) => s.title).filter(Boolean).slice(0, 2).join(', ');
        setError(
          `${t('aiStudio.chat.errors.sourcesEmptyPre')}${failedTitles ? ` (${failedTitles})` : ''}${t('aiStudio.chat.errors.sourcesEmptyPost')}`
        );
      } else if (data?.code === 'NO_RELEVANT_CHUNKS') {
        // Sources are fine, the search just matched nothing. Do NOT suggest re-uploading.
        setError(t('aiStudio.chat.errors.noRelevantChunks'));
      } else if (data?.code === 'SOURCES_NOT_INDEXED') {
        setError(data.message || t('aiStudio.chat.errors.notIndexed'));
      } else if (data?.code === 'ORG_QUOTA_EXCEEDED') {
        setError(t('aiStudio.chat.errors.orgQuota'));
      } else {
        setError(data?.message || t('aiStudio.chat.errors.sendChat'));
      }
      setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
      // Give the question back, it was cleared optimistically before the request. Losing a
      // long prompt to a rate limit or a no-match is worse than a stale textarea.
      setPrompt((cur) => (cur ? cur : text));
    } finally {
      setSending(false);
    }
  };

  // Save an AI reply as a note. sourceChatId links it back to the message it came from.
  const handleSaveToNote = async (msg) => {
    try {
      const firstLine = (msg.content || '').split('\n').find((l) => l.trim()) || t('aiStudio.chat.defaultNoteTitle');
      await aiProjectService.createNote(project.id, {
        title: firstLine.replace(/[#*]/g, '').trim().slice(0, 120),
        content: msg.content,
        sourceChatId: msg.id,
      });
      setSavedNoteFor(msg.id);
      setTimeout(() => setSavedNoteFor((cur) => (cur === msg.id ? null : cur)), 2000);
      onNoteSaved?.();
    } catch (err) {
      setError(err?.response?.data?.message || t('aiStudio.chat.errors.saveNote'));
    }
  };

  const confirmClear = async () => {
    setClearing(true);
    try {
      await aiProjectService.clearChats(project.id);
      setMessages([]);
      onProjectUpdate?.();
      setShowClearConfirm(false);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiStudio.chat.errors.clear'));
      setShowClearConfirm(false);
    } finally { setClearing(false); }
  };

  const limitReached = usage && usage.used >= usage.max;

  return (
    <div className="h-full flex flex-col bg-stone-50/30 dark:bg-slate-950/40">
      <div className="shrink-0 px-5 py-3 border-b border-stone-200/70 dark:border-slate-800/70 flex items-center justify-between bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{t('aiStudio.chat.header')}</h2>
        {messages.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-[11px] font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 focus-visible:outline-none focus-visible:underline transition-colors"
          >
            {t('aiStudio.chat.clearChat')}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6" role="log" aria-live="polite" aria-label={t('aiStudio.chat.historyAria')}>
        {loading && <div className="text-center py-12 text-sm text-slate-500">{t('aiStudio.chat.loading')}</div>}

        {!loading && messages.length === 0 && (
          <div className="max-w-md mx-auto text-center py-12">
            <AIAssistantAvatar size={56} className="mx-auto mb-4" />

            <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white mb-2">
              {hasSources ? t('aiStudio.chat.startAsking') : t('aiStudio.chat.cannotChat')}
            </h3>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mb-6 max-w-sm mx-auto">
              {hasSources
                ? t('aiStudio.chat.introWithSources')
                : t('aiStudio.chat.introNoSources')}
            </p>
            {hasSources && (
              <div className="space-y-2 max-w-sm mx-auto" aria-label={t('aiStudio.chat.suggestionsAria')}>
                {dynamicSuggestions.map((s, idx) => (
                  <button
                    key={`${idx}-${s.slice(0, 30)}`}
                    onClick={() => { setPrompt(s); textareaRef.current?.focus(); }}
                    className="w-full text-left text-[13px] px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-300 dark:hover:border-brand-500/40 hover:bg-white dark:hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-stone-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={msg.role === 'user' ? 'flex justify-end' : 'flex items-start gap-3'}
            >
              {msg.role === 'user' ? (
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-brand-600 dark:bg-brand-500/90 text-white text-[14px] leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              ) : (
                <>
                  <AssistantAvatar />
                  <div className="flex-1 min-w-0">
                    {/* No whitespace-pre-wrap, the markdown renderer owns line breaks now,
                        and pre-wrap would double every one of them. */}
                    <div className="text-[15.5px] text-slate-900 dark:text-slate-100 leading-[1.7]">
                      {renderContentWithCitations(msg.content, msg.citations, onCitationClick)}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      {!msg.metadata?.error && (
                        <button
                          onClick={() => handleSaveToNote(msg)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 -mx-1 py-0.5 transition-colors"
                          title={t('aiStudio.chat.saveNoteTitle')}
                        >
                          {savedNoteFor === msg.id ? (
                            <>
                              <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-emerald-600 dark:text-emerald-400">{t('aiStudio.chat.saved')}</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                              {t('aiStudio.chat.saveToNote')}
                            </>
                          )}
                        </button>
                      )}
                      {!msg.metadata?.error && !String(msg.id).startsWith('temp-') && (
                        <button
                          onClick={() => onShowProvenance?.(msg)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 -mx-1 py-0.5 transition-colors"
                          title={t('aiStudio.chat.provenanceTitle')}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          {t('aiStudio.chat.provenance')}
                        </button>
                      )}
                      {msg.metadata?.latencyMs && (
                        <span className="text-[10.5px] text-slate-400 dark:text-slate-500 tabular-nums">
                          {msg.metadata.model} · {msg.metadata.latencyMs}ms
                          {msg.metadata.promptTokens != null && (
                            <> · {msg.metadata.promptTokens + (msg.metadata.completionTokens || 0)} {t('aiStudio.chat.tokensUnit')}</>
                          )}
                          {msg.metadata.contextMode && <> · {msg.metadata.contextMode}</>}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ))}

          {sending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-start gap-3"
              role="status"
              aria-label={t('aiStudio.chat.generatingAria')}
            >
              <AssistantAvatar />
              <div className="flex items-center gap-2 pt-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '240ms' }} />
                </div>
                <span className="text-[13px] text-slate-500 dark:text-slate-400 italic">{t('aiStudio.chat.reading')}</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={showClearConfirm}
        variant="danger"
        title={t('aiStudio.chat.confirmClear')}
        confirmLabel={t('aiStudio.chat.clearChat')}
        loading={clearing}
        onConfirm={confirmClear}
        onCancel={() => !clearing && setShowClearConfirm(false)}
      />

      <div className="shrink-0 border-t border-stone-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 px-4 py-3">
        {error && (
          <div
            role="alert"
            className="mb-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-[12.5px] text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-500/20 max-w-3xl mx-auto flex items-start gap-2"
          >
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
            <span className="flex-1 leading-snug">{error}</span>
            <button onClick={() => setError(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label={t('aiStudio.chat.closeErrorAria')}>×</button>
          </div>
        )}

        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(e);
            }}
            placeholder={
              !hasSources
                ? t('aiStudio.chat.inputPlaceholderNoSources')
                : noneSelected
                  ? t('aiStudio.chat.inputPlaceholderNoneSelected')
                  : t('aiStudio.chat.inputPlaceholder')
            }
            disabled={!hasSources || noneSelected || limitReached || sending}
            rows={2}
            aria-label={t('aiStudio.chat.inputAria')}
            className="flex-1 resize-none px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-[14px] leading-relaxed text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || sending || !hasSources || noneSelected || limitReached}
            className="px-4 min-h-[44px] bg-accent hover:brightness-110 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-all flex items-center justify-center gap-2"
            aria-label={t('aiStudio.chat.sendAria')}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            )}
          </button>
        </form>

        <div className="max-w-3xl mx-auto mt-1.5 flex items-center justify-between gap-2 text-[10.5px] text-slate-400 dark:text-slate-500">
          {/* Scope is invisible otherwise, the user needs to know the AI is not reading everything. */}
          <span>
            {Array.isArray(selectedSourceIds) && selectedSourceIds.length > 0 && (
              <span className="text-brand-600 dark:text-brand-400 font-medium">
                {t('aiStudio.chat.scopeOnly')} {selectedSourceIds.length} {t('aiStudio.chat.scopeOf')} {activeSources.length} {t('aiStudio.chat.scopeSources')}
              </span>
            )}
          </span>
          {usage && (
            <span className="tabular-nums">{usage.used}/{usage.max} {t('aiStudio.chat.chatUnit')} · 24 {t('aiStudio.chat.hours')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
