import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { Budget } from './model';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const budgetSchema = z.object({
  categoryId: z.string().min(1),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  limit: z.number().min(0),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const budgets = await Budget.find({ userId: req.user!.userId }).lean();
  res.json({ success: true, data: budgets });
}));

router.get('/month/:monthKey', asyncHandler(async (req: Request, res: Response) => {
  const budgets = await Budget.find({ userId: req.user!.userId, monthKey: req.params.monthKey }).lean();
  res.json({ success: true, data: budgets });
}));

router.post('/', validate(budgetSchema), asyncHandler(async (req: Request, res: Response) => {
  const budget = await Budget.findOneAndUpdate(
    { userId: req.user!.userId, monthKey: req.body.monthKey, categoryId: req.body.categoryId },
    { $set: { limit: req.body.limit } },
    { upsert: true, new: true, runValidators: true },
  );
  res.status(201).json({ success: true, data: budget });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await Budget.deleteOne({ _id: req.params.id, userId: req.user!.userId });
  if (result.deletedCount === 0) throw new AppError('Budget not found', 404);
  res.status(204).send();
}));

export default router;
