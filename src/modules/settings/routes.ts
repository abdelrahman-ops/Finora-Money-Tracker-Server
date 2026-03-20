import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { Setting } from './model';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const settings = await Setting.find({ userId: req.user!.userId }).lean();
  res.json({ success: true, data: settings });
}));

router.get('/:key', asyncHandler(async (req: Request, res: Response) => {
  const setting = await Setting.findOne({ userId: req.user!.userId, key: req.params.key }).lean();
  res.json({ success: true, data: setting?.value ?? null });
}));

router.put('/:key', asyncHandler(async (req: Request, res: Response) => {
  const setting = await Setting.findOneAndUpdate(
    { userId: req.user!.userId, key: req.params.key },
    { value: req.body.value },
    { upsert: true, new: true },
  );
  res.json({ success: true, data: setting });
}));

export default router;
