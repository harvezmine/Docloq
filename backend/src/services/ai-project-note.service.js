// AI Project notes — save snippets from chat / standalone

import { db } from '../db/index.js';
import { aiProjectNotes } from '../db/schema.js';
import { and, eq, desc } from 'drizzle-orm';
import { ValidationError } from './ai-project.service.js';

const MAX_NOTE_CONTENT = 20_000;

export async function createNote({ projectId, title, content, sourceChatId, userId }) {
  if (!title?.trim()) throw new ValidationError('Judul note wajib');
  if (!content?.trim()) throw new ValidationError('Isi note wajib');
  if (title.length > 200) throw new ValidationError('Judul maks 200 char');
  if (content.length > MAX_NOTE_CONTENT) throw new ValidationError(`Isi note maks ${MAX_NOTE_CONTENT} char`);

  const [note] = await db.insert(aiProjectNotes).values({
    projectId,
    title: title.trim(),
    content: content.trim(),
    sourceChatId: sourceChatId || null,
    createdBy: userId,
  }).returning();
  return note;
}

export async function listNotes(projectId) {
  return db.select().from(aiProjectNotes)
    .where(eq(aiProjectNotes.projectId, projectId))
    .orderBy(desc(aiProjectNotes.createdAt));
}

export async function updateNote(noteId, projectId, partial) {
  // Same caps as createNote — without these an update could write a 250K-char note that the
  // create path would have rejected.
  if (partial.title !== undefined) {
    if (!partial.title?.trim()) throw new ValidationError('Judul note wajib');
    if (partial.title.length > 200) throw new ValidationError('Judul maks 200 char');
  }
  if (partial.content !== undefined) {
    if (!partial.content?.trim()) throw new ValidationError('Isi note wajib');
    if (partial.content.length > MAX_NOTE_CONTENT) {
      throw new ValidationError(`Isi note maks ${MAX_NOTE_CONTENT} char`);
    }
  }

  const allowed = ['title', 'content'];
  const update = {};
  for (const k of allowed) if (partial[k] !== undefined) update[k] = partial[k];
  const [note] = await db.update(aiProjectNotes)
    .set(update)
    .where(and(eq(aiProjectNotes.id, noteId), eq(aiProjectNotes.projectId, projectId)))
    .returning();
  return note;
}

export async function deleteNote(noteId, projectId) {
  await db.delete(aiProjectNotes)
    .where(and(eq(aiProjectNotes.id, noteId), eq(aiProjectNotes.projectId, projectId)));
}
