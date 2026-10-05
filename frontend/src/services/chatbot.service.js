// DoKi chatbot API

import api from './api';
import useAuthStore from '@/app/store/auth.store';

const chatbotService = {
  // Returns { reply, intent, suggestions, data }
  async sendMessage(message) {
    const response = await api.post('/chatbot/message', { message });
    return response.data;
  },

  // Streams DoKi's reply over SSE (fetch, axios can't stream in the browser). Calls
  // onData(payload) once (structured cards), onToken(delta) per chunk, onDone({reply,suggestions}).
  // Returns an abort function. onError fires on any transport failure so the caller can fall back.
  streamMessage(message, { onData, onToken, onDone, onError } = {}) {
    const controller = new AbortController();
    (async () => {
      try {
        const token = useAuthStore.getState().accessToken;
        const res = await fetch(`${api.defaults.baseURL}/chatbot/message/stream`, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ message }),
        });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const frames = buf.split('\n\n');
          buf = frames.pop() || '';
          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') return;
            let ev; try { ev = JSON.parse(payload); } catch { continue; }
            if (ev.type === 'data') onData?.(ev.payload);
            else if (ev.type === 'token') onToken?.(ev.value);
            else if (ev.type === 'done') onDone?.({ reply: ev.reply, suggestions: ev.suggestions || [] });
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        onError?.(err);
      }
    })();
    return () => controller.abort();
  },

  // Returns { sessionId, messages[] }
  async getHistory() {
    const response = await api.get('/chatbot/history');
    return response.data;
  },

  async clearHistory() {
    const response = await api.delete('/chatbot/history');
    return response.data;
  },

  // Role-based quick actions; returns [{ label, message }]
  async getSuggestions() {
    const response = await api.get('/chatbot/suggestions');
    return response.data;
  },
};

export default chatbotService;
