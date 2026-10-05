// Structured result cards for DoKi (documents / users / tasks). Rendered frontend-side from the
// tool `data` payload, the LLM never tabulates these. Flat indigo accents.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useLang } from '@/app/providers/LanguageProvider';

const MIME_ICONS = {
  pdf: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', label: 'PDF' },
  docx: { bg: 'bg-brand-50 dark:bg-brand-900/30', text: 'text-brand-600 dark:text-brand-400', label: 'DOCX' },
  doc: { bg: 'bg-brand-50 dark:bg-brand-900/30', text: 'text-brand-600 dark:text-brand-400', label: 'DOC' },
  xlsx: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', label: 'XLSX' },
  xls: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', label: 'XLS' },
  pptx: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', label: 'PPTX' },
  png: { bg: 'bg-brand-50 dark:bg-brand-900/30', text: 'text-brand-600 dark:text-brand-400', label: 'PNG' },
  jpg: { bg: 'bg-brand-50 dark:bg-brand-900/30', text: 'text-brand-600 dark:text-brand-400', label: 'JPG' },
};
const getFileStyle = (filename) => {
  const ext = filename?.split('.').pop()?.toLowerCase() || '';
  return MIME_ICONS[ext] || { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400', label: ext.toUpperCase() || 'FILE' };
};
const formatSize = (bytes) => {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
};
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const daysUntil = (dateStr) => (dateStr ? Math.ceil((new Date(dateStr) - new Date()) / 864e5) : null);

const ROLE_COLORS = {
  owner: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  user: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};
const PRIORITY_STYLES = {
  urgent: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
  high: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
  medium: { bg: 'bg-brand-100 dark:bg-brand-900/30', text: 'text-brand-600 dark:text-brand-400' },
  low: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400' },
};
const STATUS_STYLES = {
  pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  in_progress: { bg: 'bg-brand-100 dark:bg-brand-900/30', text: 'text-brand-700 dark:text-brand-400' },
  completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  cancelled: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400' },
};

function MoreButton({ expanded, setExpanded, hidden }) {
  const { t } = useLang();
  return (
    <button onClick={() => setExpanded(!expanded)}
      className="w-full flex items-center justify-center gap-1 text-xs text-accent hover:brightness-110 py-1.5 rounded-lg hover:bg-accent-soft transition-colors font-medium">
      {expanded ? <>{t('chatbot.cards.showLess')}<ChevronUp className="w-3.5 h-3.5" strokeWidth={1.8} /></> : <>{`${t('chatbot.cards.showMorePrefix')} ${hidden} ${t('chatbot.cards.showMoreSuffix')}`}<ChevronDown className="w-3.5 h-3.5" strokeWidth={1.8} /></>}
    </button>
  );
}

export function DocumentList({ items }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);
  return (
    <div className="mt-3 space-y-1.5">
      {visible.map((doc, idx) => {
        const style = getFileStyle(doc.originalFilename);
        return (
          <motion.div key={doc.id || idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-stone-100 dark:border-slate-700/60 hover:border-accent-soft transition-colors">
            <div className={`w-9 h-9 rounded-lg ${style.bg} flex items-center justify-center shrink-0`}><span className={`text-[10px] font-bold ${style.text}`}>{style.label}</span></div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-200 truncate">{doc.originalFilename}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10.5px] text-slate-400">{formatSize(doc.fileSize)}</span>
                <span className="text-[10.5px] text-slate-300 dark:text-slate-600">•</span>
                <span className="text-[10.5px] text-slate-400">{formatDate(doc.createdAt)}</span>
              </div>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${doc.status === 'active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>{doc.status === 'active' ? t('chatbot.cards.docActive') : doc.status}</span>
          </motion.div>
        );
      })}
      {items.length > 5 && <MoreButton expanded={expanded} setExpanded={setExpanded} hidden={items.length - 5} />}
    </div>
  );
}

export function UserList({ items }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);
  return (
    <div className="mt-3 space-y-1.5">
      {visible.map((u, idx) => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
        const roleColor = ROLE_COLORS[u.role] || ROLE_COLORS.user;
        return (
          <motion.div key={u.id || idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-stone-100 dark:border-slate-700/60 hover:border-accent-soft transition-colors">
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0 text-white text-xs font-bold">{name.charAt(0).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-200 truncate">{name}</p>
              <p className="text-[10.5px] text-slate-400 truncate">{u.email}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${roleColor}`}>{u.role}</span>
          </motion.div>
        );
      })}
      {items.length > 5 && <MoreButton expanded={expanded} setExpanded={setExpanded} hidden={items.length - 5} />}
    </div>
  );
}

export function TaskList({ items }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);
  return (
    <div className="mt-3 space-y-1.5">
      {visible.map((task, idx) => {
        const prioKey = PRIORITY_STYLES[task.priority] ? task.priority : 'medium';
        const statKey = STATUS_STYLES[task.status] ? task.status : 'pending';
        const prio = PRIORITY_STYLES[prioKey];
        const stat = STATUS_STYLES[statKey];
        const days = daysUntil(task.dueDate);
        const isOverdue = days !== null && days < 0;
        const isNear = days !== null && days >= 0 && days <= 3;
        return (
          <motion.div key={task.id || idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
            className={`p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border transition-colors ${isOverdue ? 'border-red-200 dark:border-red-800/60' : isNear ? 'border-amber-200 dark:border-amber-800/60' : 'border-stone-100 dark:border-slate-700/60 hover:border-accent-soft'}`}>
            <div className="flex items-start gap-2.5">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${task.priority === 'urgent' ? 'bg-red-500' : task.priority === 'high' ? 'bg-orange-500' : task.priority === 'medium' ? 'bg-brand-500' : 'bg-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-200 leading-snug">{task.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${prio.bg} ${prio.text}`}>{t(`chatbot.cards.priority.${prioKey}`)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${stat.bg} ${stat.text}`}>{t(`chatbot.cards.status.${statKey}`)}</span>
                  {task.dueDate && (
                    <span className={`text-[10px] font-medium flex items-center gap-1 ${isOverdue ? 'text-red-500 dark:text-red-400' : isNear ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {isOverdue ? `${t('chatbot.cards.due.overduePre')}${Math.abs(days)}${t('chatbot.cards.due.overduePost')}` : days === 0 ? t('chatbot.cards.due.today') : days === 1 ? t('chatbot.cards.due.tomorrow') : `${days} ${t('chatbot.cards.due.daysLeft')}`}
                    </span>
                  )}
                </div>
                {task.assignee && <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5"><ArrowRight className="w-3 h-3 shrink-0" strokeWidth={1.8} />{task.assignee}</p>}
              </div>
            </div>
          </motion.div>
        );
      })}
      {items.length > 5 && <MoreButton expanded={expanded} setExpanded={setExpanded} hidden={items.length - 5} />}
    </div>
  );
}
