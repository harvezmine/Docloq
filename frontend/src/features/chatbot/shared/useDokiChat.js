// Owns DoKi's chat state + streaming. Both surfaces (widget + page) call this so behaviour
// can't drift. Streams tokens live; falls back to the non-streaming endpoint on transport error.
import { useState, useRef, useCallback } from 'react';
import chatbotService from '@/services/chatbot.service';

export default function useDokiChat() {
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([chatbotService.getHistory(), chatbotService.getSuggestions()]);
      if (h?.data?.messages?.length) setMessages(h.data.messages.map((m) => ({ id: m.id, type: m.role === 'user' ? 'user' : 'bot', content: m.content })));
      if (s?.data) setSuggestions(s.data);
    } catch { /* ignore */ }
  }, []);

  const send = useCallback((text) => {
    const t = (text || '').trim();
    if (!t || isStreaming) return;
    const botId = `b-${Date.now()}`;
    setMessages((p) => [...p, { id: `u-${Date.now()}`, type: 'user', content: t }, { id: botId, type: 'bot', content: '', streaming: true }]);
    setIsStreaming(true);
    const patch = (fn) => setMessages((p) => p.map((m) => (m.id === botId ? fn(m) : m)));
    abortRef.current = chatbotService.streamMessage(t, {
      onData: (payload) => patch((m) => ({ ...m, data: payload })),
      onToken: (delta) => patch((m) => ({ ...m, content: m.content + delta })),
      onDone: ({ reply, suggestions: sug }) => { patch((m) => ({ ...m, content: reply || m.content, streaming: false })); if (sug?.length) setSuggestions(sug); setIsStreaming(false); },
      onError: async () => {
        try {
          const res = await chatbotService.sendMessage(t);
          patch((m) => ({ ...m, content: res?.data?.reply || 'Maaf, terjadi kesalahan.', data: res?.data?.data || null, streaming: false }));
          if (res?.data?.suggestions?.length) setSuggestions(res.data.suggestions);
        } catch {
          patch((m) => ({ ...m, content: 'Maaf, DoKi mengalami kesalahan. Coba lagi ya!', streaming: false }));
        }
        setIsStreaming(false);
      },
    });
  }, [isStreaming]);

  const clear = useCallback(async () => { try { await chatbotService.clearHistory(); } catch { /* ignore */ } setMessages([]); }, []);

  return { messages, suggestions, isStreaming, load, send, clear, setMessages };
}
