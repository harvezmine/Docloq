// AI Project routes — NotebookLM-style workspace

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireFeature } from '../middlewares/superadmin.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';
import {
  backfillHandler,
  getUsageHandler,
  listProjectsHandler,
  createProjectHandler,
  getProjectHandler,
  updateProjectHandler,
  archiveProjectHandler,
  unarchiveProjectHandler,
  deleteProjectHandler,
  listSourcesHandler,
  addDocumentSourceHandler,
  addUrlSourceHandler,
  addTextSourceHandler,
  addNoteSourceHandler,
  addYouTubeSourceHandler,
  addFolderSourcesHandler,
  removeSourceHandler,
  retrySourceHandler,
  listChatsHandler,
  postChatHandler,
  clearChatsHandler,
  listNotesHandler,
  createNoteHandler,
  updateNoteHandler,
  deleteNoteHandler,
  listOutputsHandler,
  createOutputHandler,
  getOutputHandler,
  getOutputImageHandler,
  deleteOutputHandler,
  listMembersHandler,
  inviteMembersHandler,
  removeMemberHandler,
  respondInviteHandler,
  listPendingInvitesHandler,
  exposedDocumentsHandler,
  enableShareLinkHandler,
  disableShareLinkHandler,
  joinViaLinkHandler,
  getProvenanceHandler,
} from '../controllers/ai-project.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireFeature('aiAnalysis'));

router.post('/_backfill-sources', backfillHandler);
router.get('/usage', getUsageHandler);

// Literal paths MUST precede '/:id' — Express would otherwise match 'join'/'invites' as an
// :id and validateUUID would 400 them.
router.post('/join/:token', joinViaLinkHandler);
router.get('/invites/pending', listPendingInvitesHandler);

router.get('/', listProjectsHandler);
router.post('/', createProjectHandler);
router.get('/:id', validateUUID('id'), getProjectHandler);
router.patch('/:id', validateUUID('id'), updateProjectHandler);
router.post('/:id/archive', validateUUID('id'), archiveProjectHandler);
router.post('/:id/unarchive', validateUUID('id'), unarchiveProjectHandler);
router.delete('/:id', validateUUID('id'), deleteProjectHandler);

router.get('/:id/sources', validateUUID('id'), listSourcesHandler);
router.post('/:id/sources/document', validateUUID('id'), addDocumentSourceHandler);
router.post('/:id/sources/url', validateUUID('id'), addUrlSourceHandler);
router.post('/:id/sources/text', validateUUID('id'), addTextSourceHandler);
router.post('/:id/sources/note', validateUUID('id'), addNoteSourceHandler);
router.post('/:id/sources/youtube', validateUUID('id'), addYouTubeSourceHandler);
router.post('/:id/sources/folder', validateUUID('id'), addFolderSourcesHandler);
router.delete('/:id/sources/:sourceId', validateUUID('id'), validateUUID('sourceId'), removeSourceHandler);
router.post('/:id/sources/:sourceId/retry', validateUUID('id'), validateUUID('sourceId'), retrySourceHandler);

router.get('/:id/chats', validateUUID('id'), listChatsHandler);
router.post('/:id/chats', validateUUID('id'), postChatHandler);
router.delete('/:id/chats', validateUUID('id'), clearChatsHandler);

router.get('/:id/notes', validateUUID('id'), listNotesHandler);
router.post('/:id/notes', validateUUID('id'), createNoteHandler);
router.patch('/:id/notes/:noteId', validateUUID('id'), validateUUID('noteId'), updateNoteHandler);
router.delete('/:id/notes/:noteId', validateUUID('id'), validateUUID('noteId'), deleteNoteHandler);

router.get('/:id/outputs', validateUUID('id'), listOutputsHandler);
router.post('/:id/outputs', validateUUID('id'), createOutputHandler);
router.get('/:id/outputs/:outputId', validateUUID('id'), validateUUID('outputId'), getOutputHandler);
router.get('/:id/outputs/:outputId/image', validateUUID('id'), validateUUID('outputId'), getOutputImageHandler);
router.delete('/:id/outputs/:outputId', validateUUID('id'), validateUUID('outputId'), deleteOutputHandler);

router.get('/:id/members', validateUUID('id'), listMembersHandler);
router.post('/:id/members', validateUUID('id'), inviteMembersHandler);
router.delete('/:id/members/:userId', validateUUID('id'), validateUUID('userId'), removeMemberHandler);
router.post('/:id/members/respond', validateUUID('id'), respondInviteHandler);
router.get('/:id/exposed-documents', validateUUID('id'), exposedDocumentsHandler);
router.post('/:id/share-link', validateUUID('id'), enableShareLinkHandler);
router.delete('/:id/share-link', validateUUID('id'), disableShareLinkHandler);

router.get('/:id/provenance/:subjectType/:subjectId', validateUUID('id'), validateUUID('subjectId'), getProvenanceHandler);

export default router;
