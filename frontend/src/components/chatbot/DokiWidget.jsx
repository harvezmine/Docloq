// Floating DoKi assistant, flat indigo, mascot avatar, streaming replies, ID-first copy.
// Behaviour + rendering live in shared components so the widget and the /chatbot page match.

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '@/app/store/auth.store';
import useDokiChat from '@/features/chatbot/shared/useDokiChat';
import MessageBubble from '@/features/chatbot/shared/MessageBubble';
import DokiAvatar from '@/features/chatbot/shared/DokiAvatar';
import { doki } from '@/features/chatbot/shared/dokiTheme';
import { useLang } from '@/app/providers/LanguageProvider';

export default function DokiWidget() {
  const { t } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [initialized, setInitialized] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const { user, isAuthenticated } = useAuthStore();
  const { messages, suggestions, isStreaming, load, send, clear } = useDokiChat();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'; else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (isOpen && !initialized) { load(); setInitialized(true); } if (isOpen) inputRef.current?.focus(); }, [isOpen, initialized, load]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Guard after all hooks, returning earlier crashes React #300 on logout.
  if (!isAuthenticated) return null;

  const submit = (e) => { e?.preventDefault(); const t = input.trim(); if (!t) return; setInput(''); send(t); };

  return (
    <>
      <AnimatePresence>
        {isOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" />}
      </AnimatePresence>

      <motion.button onClick={() => setIsOpen(!isOpen)} aria-label={isOpen ? t('chatbot.closeWidget') : t('chatbot.openWidget')} whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }}
        className={`fixed z-50 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bottom-4 right-4 w-12 h-12 md:bottom-6 md:right-6 bg-slate-700 hover:bg-slate-600 shadow-lg' : 'bottom-6 right-6 w-14 h-14 p-1 bg-accent-gradient-br shadow-xl shadow-accent'}`}>
        {!isOpen && <span className="absolute inset-0 rounded-full ring-2 ring-accent animate-ping opacity-60 pointer-events-none" />}
        {isOpen
          ? <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          : <DokiAvatar size={48} className="relative" />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div role="dialog" aria-modal="true" aria-label="DoKi"
            initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="fixed z-50 inset-0 md:inset-auto md:bottom-24 md:right-6 md:w-[420px] md:h-[600px] bg-white dark:bg-slate-900 md:rounded-2xl shadow-2xl md:border border-stone-200 dark:border-slate-700/60 flex flex-col overflow-hidden">

            <div className={`shrink-0 px-4 py-3.5 flex items-center gap-3 ${doki.headerGradient}`}>
              <button onClick={() => setIsOpen(false)} className="md:hidden p-1 -ml-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10" aria-label={t('common.back')}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
              <DokiAvatar size={38} className="ring-2 ring-white/40 shadow-md" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[15px] text-white tracking-tight">DoKi</h3>
                <p className="text-[11px] text-white/70 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />{t('chatbot.tagline')}</p>
              </div>
              {messages.length > 0 && (
                <button onClick={clear} title={t('chatbot.clearHistory')} aria-label={t('chatbot.clearHistory')} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>

            <div className={`flex-1 overflow-y-auto px-4 py-4 space-y-4 ${doki.surface}`}>
              {messages.length === 0 && !isStreaming && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center px-4 max-w-sm">
                    <div className="relative mx-auto mb-4 w-16 h-16">
                      <div className="absolute inset-0 rounded-full bg-accent-soft blur-2xl" />
                      <DokiAvatar size={64} className="relative" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{t('chatbot.greeting')}{user?.firstName ? `, ${user.firstName}` : ''}!</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">{t('chatbot.introWidget')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {suggestions.map((s, i) => (
                        <button key={i} onClick={() => send(s.message || s.label)} className={`text-left text-[12px] px-3.5 py-3 rounded-xl font-medium leading-snug shadow-sm transition-colors ${doki.chip}`}>{s.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}

              {messages.length > 0 && !isStreaming && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {suggestions.slice(0, 4).map((s, i) => <button key={i} onClick={() => send(s.message || s.label || s)} className={`text-[11px] px-3 py-1.5 rounded-full font-medium shadow-sm transition-colors ${doki.chip}`}>{s.label || s}</button>)}
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={submit} className="p-3 bg-white dark:bg-slate-900 border-t border-stone-200 dark:border-slate-800 shrink-0">
              <div className="flex gap-2 items-center">
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('chatbot.inputPlaceholder')} disabled={isStreaming} maxLength={2000}
                  className="flex-1 px-4 py-3 text-[13.5px] rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:bg-white dark:focus:bg-slate-800 border border-transparent focus:border-accent transition-all" />
                <button type="submit" disabled={!input.trim() || isStreaming} aria-label={t('common.send')} className={`w-11 h-11 rounded-xl text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${doki.accent}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
