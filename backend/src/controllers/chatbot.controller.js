import {
  processMessage,
  streamMessage,
  sanitizeInput,
  checkRateLimit,
  getSuggestionsForRole,
  logChatInteraction,
  getOrCreateSession,
  getSessionHistory,
} from '../services/chatbot.service.js';
import { db } from '../db/index.js';
import { chatSessions, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// POST /api/chatbot/message
export const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const user = req.user;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // DoKi is org-scoped
    if (!user?.organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Akun belum terhubung ke organisasi. Hubungi admin Anda.',
      });
    }

    const sanitized = sanitizeInput(message);
    if (!sanitized || sanitized.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message content',
      });
    }

    if (sanitized.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message too long (max 2000 characters)',
      });
    }

    if (!checkRateLimit(user.userId)) {
      return res.status(429).json({
        success: false,
        message: 'Terlalu banyak pesan. Tunggu sebentar ya!',
      });
    }

    const [dbUser] = await db
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);
    const userName = dbUser?.firstName || user.email?.split('@')[0] || 'User';

    const response = await processMessage({
      message: sanitized,
      userId: user.userId,
      userRole: user.role,
      organizationId: user.organizationId,
      userName,
    });

    // Audit log (non-blocking)
    logChatInteraction(user.userId, user.organizationId, response.intent).catch(() => {});

    return res.json({
      success: true,
      data: {
        reply: response.reply,
        intent: response.intent,
        suggestions: response.suggestions || [],
        data: response.data || null,
      },
    });
  } catch (error) {
    console.error('DoKi sendMessage error:', error);
    return res.status(500).json({
      success: false,
      message: 'DoKi mengalami kesalahan. Coba lagi ya!',
    });
  }
};

// POST /api/chatbot/message/stream  → Server-Sent Events
export const streamMessageHandler = async (req, res) => {
  try {
    const { message } = req.body;
    const user = req.user;
    if (!message || typeof message !== 'string') return res.status(400).json({ success: false, message: 'Message is required' });
    if (!user?.organizationId) return res.status(400).json({ success: false, message: 'Akun belum terhubung ke organisasi.' });
    const sanitized = sanitizeInput(message);
    if (!sanitized) return res.status(400).json({ success: false, message: 'Invalid message content' });
    if (!checkRateLimit(user.userId)) return res.status(429).json({ success: false, message: 'Terlalu banyak pesan. Tunggu sebentar ya!' });

    const [dbUser] = await db.select({ firstName: users.firstName }).from(users).where(eq(users.id, user.userId)).limit(1);
    const userName = dbUser?.firstName || user.email?.split('@')[0] || 'User';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // don't let nginx/proxy buffer SSE
    res.flushHeaders?.();
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    for await (const ev of streamMessage({ message: sanitized, userId: user.userId, userRole: user.role, organizationId: user.organizationId, userName })) {
      send(ev);
    }
    logChatInteraction(user.userId, user.organizationId, 'llm_response').catch(() => {});
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('DoKi streamMessage error:', error);
    if (res.headersSent) { res.write(`data: ${JSON.stringify({ type: 'done', reply: 'DoKi mengalami kesalahan.' })}\n\n`); res.end(); }
    else res.status(500).json({ success: false, message: 'DoKi mengalami kesalahan. Coba lagi ya!' });
  }
};

// GET /api/chatbot/history
export const getHistory = async (req, res) => {
  try {
    const user = req.user;

    const session = await getOrCreateSession(user.userId, user.organizationId);
    const messages = await getSessionHistory(session.id, 50);

    return res.json({
      success: true,
      data: {
        sessionId: session.id,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('DoKi getHistory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil riwayat chat',
    });
  }
};

// DELETE /api/chatbot/history
export const clearHistory = async (req, res) => {
  try {
    const user = req.user;

    await db
      .update(chatSessions)
      .set({ isActive: false })
      .where(
        and(
          eq(chatSessions.userId, user.userId),
          eq(chatSessions.isActive, true),
        )
      );

    return res.json({
      success: true,
      message: 'Riwayat chat berhasil dihapus',
    });
  } catch (error) {
    console.error('DoKi clearHistory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus riwayat chat',
    });
  }
};

// GET /api/chatbot/suggestions
export const getSuggestions = async (req, res) => {
  try {
    const user = req.user;
    const suggestions = getSuggestionsForRole(user.role);

    return res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('DoKi getSuggestions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil suggestions',
    });
  }
};

export default {
  sendMessage,
  streamMessageHandler,
  getHistory,
  clearHistory,
  getSuggestions,
};
