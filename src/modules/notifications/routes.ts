import { Router } from 'express';
import { NotificationController } from './controller';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';

const router = Router();
const ctrl = new NotificationController();

router.use(authenticate);
router.get('/', asyncHandler(ctrl.findAll));
router.put('/read-all', asyncHandler(ctrl.markAllRead));
router.put('/:id/read', asyncHandler(ctrl.markRead));

export default router;
