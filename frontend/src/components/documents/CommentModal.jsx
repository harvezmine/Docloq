// Threaded document comments with @mention typeahead

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import documentService from '../../services/document.service';
import useAuthStore from '../../app/store/auth.store';
import ConfirmModal from '../ui/ConfirmModal';
import { useLang } from '@/app/providers/LanguageProvider';

const MODERATOR_ROLES = ['owner', 'admin'];

function formatTimeAgo(ts, t) {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  const m = Math.round(diff / 60_000);
  if (m < 1) return t('comments.justNow');
  if (m < 60) return `${m} ${t('comments.minutesAgo')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t('comments.hoursAgo')}`;
  return `${Math.floor(h / 24)} ${t('comments.daysAgo')}`;
}

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function CommentModal({ documentId, documentName, onClose }) {
  const { t } = useLang();
  const currentUser = useAuthStore((s) => s.user);
  const currentRole = currentUser?.role;
  const isModerator = MODERATOR_ROLES.includes(currentRole);

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState([]); // userId list
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // parent comment id
  const [error, setError] = useState(null);

  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const textareaRef = useRef(null);
  const debounceRef = useRef(null);

  const refreshComments = useCallback(async () => {
    try {
      const res = await documentService.listComments(documentId);
      if (res?.success) setComments(res.data || []);
    } catch {
      setError(t('comments.loadError'));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => { refreshComments(); }, [refreshComments]);

  const handleTextChange = (e) => {
    const value = e.target.value;
    setContent(value);

    const caret = e.target.selectionStart;
    const before = value.slice(0, caret);
    const match = before.match(/@(\w*)$/);

    if (match) {
      const query = match[1];
      setMentionQuery(query);
      setShowMention(true);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setMentionLoading(true);
        try {
          const res = await documentService.searchMentionableUsers(documentId, query);
          if (res?.success) setMentionResults(res.data || []);
        } catch { /* ignore */ }
        setMentionLoading(false);
      }, 200);
    } else {
      setShowMention(false);
    }
  };

  const pickMention = (user) => {
    if (!textareaRef.current) return;
    const caret = textareaRef.current.selectionStart;
    const before = content.slice(0, caret);
    const after = content.slice(caret);
    const replaced = before.replace(/@\w*$/, `@${user.name} `);
    setContent(replaced + after);
    setMentions((prev) => Array.from(new Set([...prev, user.id])));
    setShowMention(false);
    textareaRef.current.focus();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await documentService.createComment(documentId, {
        content: content.trim(),
        mentions,
        parentCommentId: replyTo,
      });
      setContent('');
      setMentions([]);
      setReplyTo(null);
      await refreshComments();
    } catch {
      setError(t('comments.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = (commentId) => setConfirmDeleteId(commentId);
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await documentService.deleteComment(confirmDeleteId);
      await refreshComments();
      setConfirmDeleteId(null);
    } catch {
      setError(t('comments.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (comment) => comment.authorId === currentUser?.id || isModerator;

  const renderComment = (c, isReply = false) => (
    <div key={c.id} className={`flex gap-3 ${isReply ? 'ml-12 mt-3' : ''}`}>
      <div className="shrink-0">
        {c.authorAvatar ? (
          <img src={c.authorAvatar} alt={c.authorName} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {initials(c.authorName)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl rounded-tl-md px-4 py-2.5 inline-block max-w-full">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{c.authorName}</span>
            <span className="text-[11px] text-slate-400">{formatTimeAgo(c.createdAt, t)}</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{c.content}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 ml-1 text-xs">
          {!isReply && (
            <button
              onClick={() => { setReplyTo(c.id); textareaRef.current?.focus(); }}
              className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            >
              {t('comments.reply')}
            </button>
          )}
          {canDelete(c) && (
            <button
              onClick={() => handleDelete(c.id)}
              className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 font-medium transition-colors"
            >
              {t('comments.delete')}
            </button>
          )}
        </div>

        {/* Replies */}
        {!isReply && c.replies?.length > 0 && (
          <div>{c.replies.map((r) => renderComment(r, true))}</div>
        )}
      </div>
    </div>
  );

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('comments.title')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{documentName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {loading ? (
              <div className="text-center py-10 text-slate-500">{t('comments.loading')}</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('comments.empty')}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('comments.emptyHint')}</p>
              </div>
            ) : (
              comments.map((c) => renderComment(c))
            )}
            {error && (
              <div className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-500/15 text-sm text-red-700 dark:text-red-300">{error}</div>
            )}
          </div>

          {/* Input area */}
          <form onSubmit={handleSubmit} className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 relative">
            {replyTo && (
              <div className="flex items-center justify-between gap-2 mb-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                <span>{t('comments.replyingTo')}</span>
                <button type="button" onClick={() => setReplyTo(null)} className="hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded p-0.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            <div className="flex gap-2 items-end relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
                }}
                placeholder={t('comments.inputPlaceholder')}
                rows={2}
                className="flex-1 resize-none px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-all"
              />
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:shadow-none"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                )}
                {t('comments.send')}
              </button>

              {/* Mention dropdown */}
              <AnimatePresence>
                {showMention && (mentionResults.length > 0 || mentionLoading) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-64 overflow-y-auto"
                  >
                    {mentionLoading && (
                      <div className="px-4 py-3 text-xs text-slate-500">{t('comments.searching')}</div>
                    )}
                    {mentionResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => pickMention(u)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left"
                      >
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                            {initials(u.name)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{u.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                        </div>
                        {u.hasExplicitPermission && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">{t('comments.accessBadge')}</span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 px-1">{t('comments.quickSendHint')}</p>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>

    <ConfirmModal
      open={!!confirmDeleteId}
      title={t('comments.confirmDeleteTitle')}
      message={t('comments.confirmDeleteMessage')}
      confirmLabel={t('comments.confirmDeleteConfirm')}
      variant="danger"
      loading={deleting}
      onConfirm={confirmDelete}
      onCancel={() => !deleting && setConfirmDeleteId(null)}
    />
    </>
  );
}
