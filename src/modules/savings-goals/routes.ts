import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { SavingsGoal } from './model';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const goalSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: z.number().min(0),
  currentAmount: z.number().min(0).optional(),
  deadline: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  walletId: z.string().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const goals = await SavingsGoal.find({ userId: req.user!.userId }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: goals });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const goal = await SavingsGoal.findOne({ _id: req.params.id, userId: req.user!.userId }).lean();
  if (!goal) throw new AppError('Savings goal not found', 404);
  res.json({ success: true, data: goal });
}));

router.post('/', validate(goalSchema), asyncHandler(async (req: Request, res: Response) => {
  const goal = await SavingsGoal.create({ ...req.body, userId: req.user!.userId, deadline: req.body.deadline ? new Date(req.body.deadline) : undefined });
  res.status(201).json({ success: true, data: goal });
}));

router.put('/:id', validate(goalSchema.partial()), asyncHandler(async (req: Request, res: Response) => {
  const update = { ...req.body };
  if (update.deadline) update.deadline = new Date(update.deadline);
  const goal = await SavingsGoal.findOneAndUpdate({ _id: req.params.id, userId: req.user!.userId }, { $set: update }, { new: true }).lean();
  if (!goal) throw new AppError('Savings goal not found', 404);
  res.json({ success: true, data: goal });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await SavingsGoal.deleteOne({ _id: req.params.id, userId: req.user!.userId });
  if (result.deletedCount === 0) throw new AppError('Savings goal not found', 404);
  res.status(204).send();
}));

export default router;
