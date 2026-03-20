import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { getRecentEvents, getEventsForEntity } from '../../services/eventService';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const events = await getRecentEvents(req.user!.userId, limit);
  res.json({ success: true, data: events });
}));

router.get('/entity/:entityType/:entityId', asyncHandler(async (req: Request, res: Response) => {
  const events = await getEventsForEntity(req.user!.userId, String(req.params.entityType), String(req.params.entityId));
  res.json({ success: true, data: events });
}));

export default router;
