// Full-page DoKi, same brains + look as the floating widget, via shared components. Flat
// indigo, mascot, streaming, ID-first copy.

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import useAuthStore from '@/app/store/auth.store';
import useDokiChat from '@/features/chatbot/shared/useDokiChat';
import MessageBubble from '@/features/chatbot/shared/MessageBubble';
import DokiAvatar from '@/features/chatbot/shared/DokiAvatar';
import { doki } from '@/features/chatbot/shared/dokiTheme';
import { useLang } from '@/app/providers/LanguageProvider';

export default function Chatbot() {
  const { t } = useLang();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const { user } = useAuthStore();
  const { messages, suggestions, isStreaming, load, send, clear } = useDokiChat();

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (!loading) inputRef.current?.focus(); }, [loading]);

  const submit = (e) => { e?.preventDefault(); const t = input.trim(); if (!t) return; setInput(''); send(t); };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-100px)] flex flex-col fixed inset-0 md:static md:inset-auto bg-stone-50 dark:bg-slate-950 z-40 md:z-auto pt-16 md:pt-0">
        <div className="px-4 md:px-0 py-3 md:mb-4 bg-white dark:bg-slate-900 md:bg-transparent border-b border-stone-200 dark:border-slate-800 md:border-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DokiAvatar size={40} />
              <div>
                <h1 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">DoKi</h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs">{t('chatbot.tagline')}</p>
              </div>
            </div>
            {messages.length > 0 && (
              <button onClick={clear} className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800">{t('chatbot.clearHistory')}</button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-4 md:px-0 pb-4">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${doki.surface}`}>
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <DokiAvatar size={44} className="mx-auto mb-3 animate-pulse" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('chatbot.loadingDoki')}</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-6 px-2">
                  <div className="text-center mb-8">
                    <DokiAvatar size={72} className="mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{t('chatbot.greeting')}{user?.firstName ? `, ${user.firstName}` : ''}!</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">{t('chatbot.intro.pre')}<strong className="text-slate-700 dark:text-slate-200">DoKi</strong>{t('chatbot.intro.post')}</p>
                  </div>
                  <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {suggestions.map((s, i) => (
                      <motion.button key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        onClick={() => send(s.message || s.label)}
                        className={`p-3.5 rounded-2xl text-left text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm transition-colors ${doki.chip}`}>
                        {s.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
                  {messages.length > 0 && !isStreaming && suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 ml-1">
                      {suggestions.slice(0, 4).map((s, i) => (
                        <button key={i} onClick={() => send(s.message || s.label || s)} className={`px-3 py-1.5 rounded-full text-xs font-medium shadow-sm transition-colors ${doki.chip}`}>{s.label || s}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={submit} className="p-3 border-t border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex gap-2">
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('chatbot.inputPlaceholder')} disabled={isStreaming} maxLength={2000}
                  className="flex-1 px-4 py-3 md:py-2.5 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent disabled:opacity-50 transition-all" />
                <button type="submit" disabled={!input.trim() || isStreaming} aria-label={t('common.send')} className={`px-4 rounded-xl text-white flex items-center justify-center disabled:opacity-30 transition-colors ${doki.accent}`}>
                  <span className="hidden md:inline text-sm font-medium">{t('common.send')}</span>
                  <svg className="w-5 h-5 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">{t('chatbot.footer')}</p>
            </form>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
