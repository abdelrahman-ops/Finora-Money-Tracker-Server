import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { Template } from './model';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const templateSchema = z.object({
  title: z.string().min(1).max(100),
  amount: z.number().positive(),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().optional(),
  defaultAccountId: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringDate: z.number().min(1).max(31).optional(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const templates = await Template.find({ userId: req.user!.userId }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: templates });
}));

router.post('/', validate(templateSchema), asyncHandler(async (req: Request, res: Response) => {
  const template = await Template.create({ ...req.body, userId: req.user!.userId });
  res.status(201).json({ success: true, data: template });
}));

router.put('/:id', validate(templateSchema.partial()), asyncHandler(async (req: Request, res: Response) => {
  const template = await Template.findOneAndUpdate({ _id: req.params.id, userId: req.user!.userId }, { $set: req.body }, { new: true }).lean();
  if (!template) throw new AppError('Template not found', 404);
  res.json({ success: true, data: template });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await Template.deleteOne({ _id: req.params.id, userId: req.user!.userId });
  if (result.deletedCount === 0) throw new AppError('Template not found', 404);
  res.status(204).send();
}));

export default router;
