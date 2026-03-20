import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { Alert } from './model';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const alerts = await Alert.find({ userId: req.user!.userId }).sort({ date: -1 }).limit(50).lean();
  const unread = alerts.filter((a) => !a.isRead).length;
  res.json({ success: true, data: { alerts, unreadCount: unread } });
}));

router.put('/:id/read', asyncHandler(async (req: Request, res: Response) => {
  await Alert.updateOne({ _id: req.params.id, userId: req.user!.userId }, { isRead: true });
  res.json({ success: true });
}));

router.put('/read-all', asyncHandler(async (req: Request, res: Response) => {
  await Alert.updateMany({ userId: req.user!.userId, isRead: false }, { isRead: true });
  res.json({ success: true });
}));

router.delete('/', asyncHandler(async (req: Request, res: Response) => {
  await Alert.deleteMany({ userId: req.user!.userId });
  res.status(204).send();
}));

export default router;
