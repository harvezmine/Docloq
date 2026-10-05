import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';
import { list, unreadCount, read, readAll, remove } from '../controllers/notification.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.get('/unread-count', unreadCount);
router.patch('/read-all', readAll);
router.patch('/:id/read', validateUUID('id'), read);
router.delete('/:id', validateUUID('id'), remove);

export default router;
