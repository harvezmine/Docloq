import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireFeature } from '../middlewares/superadmin.middleware.js';
import {
  sendMessage,
  streamMessageHandler,
  getHistory,
  clearHistory,
  getSuggestions,
} from '../controllers/chatbot.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireFeature('doki'));

router.post('/message', sendMessage);
router.post('/message/stream', streamMessageHandler);
router.get('/history', getHistory);
router.delete('/history', clearHistory);
router.get('/suggestions', getSuggestions);

export default router;
