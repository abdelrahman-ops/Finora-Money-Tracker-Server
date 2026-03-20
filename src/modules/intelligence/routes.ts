import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { calculateHealthScore, getProjectedEndOfMonth, generateSummary } from '../../services/financialIntelligence';

const router = Router();
router.use(authenticate);

router.get('/health-score', asyncHandler(async (req: Request, res: Response) => {
  const score = await calculateHealthScore(req.user!.userId);
  res.json({ success: true, data: score });
}));

router.get('/projection', asyncHandler(async (req: Request, res: Response) => {
  const projection = await getProjectedEndOfMonth(req.user!.userId);
  res.json({ success: true, data: projection });
}));

router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const period = (req.query.period as 'week' | 'month') || 'month';
  const summary = await generateSummary(req.user!.userId, period);
  res.json({ success: true, data: summary });
}));

export default router;
