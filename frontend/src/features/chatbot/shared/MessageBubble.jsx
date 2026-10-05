import { motion } from 'framer-motion';
import { doki } from './dokiTheme';
import DokiAvatar from './DokiAvatar';
import { DokiMarkdown } from './DokiMarkdown';
import { DocumentList, UserList, TaskList } from './StructuredCards';
import TypingDots from './TypingDots';

// One message = one bubble. A streaming bot bubble with no content yet shows the thinking dots
// IN the same bubble, then the text streams into it, never a second bubble.
export default function MessageBubble({ msg }) {
  const isUser = msg.type === 'user';
  const thinking = !isUser && msg.streaming && !msg.content;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 24, stiffness: 320 }}
      className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && <DokiAvatar size={30} className="mt-0.5" />}
      <div className={`max-w-[85%] px-4 py-3 ${isUser ? doki.userBubble + ' shadow-md shadow-accent' : doki.botBubble}`}>
        {isUser
          ? <p className="text-[13.5px] leading-relaxed">{msg.content}</p>
          : thinking ? <TypingDots /> : <DokiMarkdown text={msg.content} />}
        {msg.data?.type === 'document_list' && msg.data.items?.length > 0 && <DocumentList items={msg.data.items} />}
        {msg.data?.type === 'user_list' && msg.data.items?.length > 0 && <UserList items={msg.data.items} />}
        {msg.data?.type === 'task_list' && msg.data.items?.length > 0 && <TaskList items={msg.data.items} />}
      </div>
    </motion.div>
  );
}
