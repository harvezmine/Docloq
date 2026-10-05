// OpenAI function tools for DoKi. Each tool returns { summary, data }:
//   summary → a compact string the MODEL sees (counts, not rows, no emails)
//   data    → the full structured rows the FRONTEND renders (never sent back to the model)

import { getDocumentsForUser, getTasksForUser, getUsersForRole } from './doki-data.service.js';
import { retrieveKnowledge } from './doki-retrieval.service.js';

export const DOKI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_documents',
      description: 'Ambil daftar dokumen milik/di-organisasi user. Pakai untuk pertanyaan seperti "dokumen saya", "cari dokumen X".',
      parameters: {
        type: 'object', additionalProperties: false, required: ['search'],
        properties: { search: { type: 'string', description: 'Kata kunci nama file, atau string kosong untuk semua.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'Ambil daftar tugas user. Pakai untuk "tugas saya", "deadline terdekat", "apa yang harus dikerjakan".',
      parameters: {
        type: 'object', additionalProperties: false, required: ['search', 'urgentOnly', 'includeDone'],
        properties: {
          search: { type: 'string' },
          urgentOnly: { type: 'boolean', description: 'true kalau user tanya yang mendesak/deadline dekat.' },
          includeDone: { type: 'boolean', description: 'true kalau user minta yang sudah selesai juga.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_users',
      description: 'Ambil daftar user organisasi. Hanya owner/admin. Pakai untuk "list user", "siapa saja anggota".',
      parameters: { type: 'object', additionalProperties: false, required: [], properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_knowledge',
      description: 'Cari penjelasan fitur/role/FAQ DocLoq dari knowledge base. Pakai untuk "apa itu X", "cara Y", pertanyaan cara-pakai.',
      parameters: {
        type: 'object', additionalProperties: false, required: ['query'],
        properties: { query: { type: 'string', description: 'Pertanyaan/topik user apa adanya.' } },
      },
    },
  },
];

export async function runTool(name, args, ctx) {
  const { userId, userRole, organizationId } = ctx;
  if (name === 'list_documents') {
    const docs = await getDocumentsForUser(userId, userRole, organizationId, (args?.search || '').slice(0, 100));
    return {
      summary: docs.length ? `Ditemukan ${docs.length} dokumen.` : 'Tidak ada dokumen yang cocok.',
      data: docs.length ? { type: 'document_list', items: docs } : null,
    };
  }
  if (name === 'list_tasks') {
    let items = await getTasksForUser(userId, userRole, organizationId, (args?.search || '').slice(0, 100), {
      activeOnly: !args?.includeDone, urgentOnly: !!args?.urgentOnly, daysAhead: 7,
    });
    if (args?.urgentOnly && items.length === 0) {
      items = await getTasksForUser(userId, userRole, organizationId, '', { activeOnly: !args?.includeDone });
    }
    const urgent = items.filter((t) => t.priority === 'urgent' || t.priority === 'high').length;
    const near = items.filter((t) => t.dueDate && (new Date(t.dueDate) - new Date()) > 0 && (new Date(t.dueDate) - new Date()) < 3 * 864e5).length;
    return {
      summary: items.length ? `${items.length} tugas aktif; ${urgent} prioritas tinggi; ${near} deadline < 3 hari.` : 'Tidak ada tugas aktif.',
      data: items.length ? { type: 'task_list', items } : null,
    };
  }
  if (name === 'list_users') {
    const res = await getUsersForRole(userRole, organizationId);
    if (!res.allowed) return { summary: 'User ini tidak diizinkan melihat daftar user.', data: null };
    // The COUNT goes to the model; the rows (with emails) go frontend-only.
    return {
      summary: res.data.length ? `${res.data.length} user dalam organisasi.` : 'Belum ada user.',
      data: res.data.length ? { type: 'user_list', items: res.data } : null,
    };
  }
  if (name === 'get_knowledge') {
    const hits = await retrieveKnowledge((args?.query || '').slice(0, 300), 4);
    return {
      summary: hits.length ? hits.map((h) => `## ${h.title}\n${h.body}`).join('\n\n') : 'Tidak ada entri KB yang relevan.',
      data: null,
    };
  }
  throw new Error(`tool tidak dikenal: ${name}`);
}
