import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { Debt } from './model';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const debtSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['owed_to_me', 'i_owe']),
  personName: z.string().min(1).max(100),
  totalAmount: z.number().min(0),
  paidAmount: z.number().min(0).optional(),
  dueDate: z.string().optional(),
  status: z.enum(['active', 'settled']).optional(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const debts = await Debt.find({ userId: req.user!.userId }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: debts });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const debt = await Debt.findOne({ _id: req.params.id, userId: req.user!.userId }).lean();
  if (!debt) throw new AppError('Debt not found', 404);
  res.json({ success: true, data: debt });
}));

router.post('/', validate(debtSchema), asyncHandler(async (req: Request, res: Response) => {
  const debt = await Debt.create({ ...req.body, userId: req.user!.userId, dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined });
  res.status(201).json({ success: true, data: debt });
}));

router.put('/:id', validate(debtSchema.partial()), asyncHandler(async (req: Request, res: Response) => {
  const update = { ...req.body };
  if (update.dueDate) update.dueDate = new Date(update.dueDate);
  const debt = await Debt.findOneAndUpdate({ _id: req.params.id, userId: req.user!.userId }, { $set: update }, { new: true }).lean();
  if (!debt) throw new AppError('Debt not found', 404);
  res.json({ success: true, data: debt });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await Debt.deleteOne({ _id: req.params.id, userId: req.user!.userId });
  if (result.deletedCount === 0) throw new AppError('Debt not found', 404);
  res.status(204).send();
}));

export default router;
