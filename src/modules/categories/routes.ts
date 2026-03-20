import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { Category } from './model';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const categorySchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['expense', 'income']),
  color: z.string().optional(),
  icon: z.string().optional(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const categories = await Category.find({ $or: [{ userId: req.user!.userId }, { isDefault: true }] }).sort({ isDefault: -1, name: 1 }).lean();
  res.json({ success: true, data: categories });
}));

router.post('/', validate(categorySchema), asyncHandler(async (req: Request, res: Response) => {
  const cat = await Category.create({ ...req.body, userId: req.user!.userId });
  res.status(201).json({ success: true, data: cat });
}));

router.put('/:id', validate(categorySchema.partial()), asyncHandler(async (req: Request, res: Response) => {
  const cat = await Category.findOneAndUpdate({ _id: req.params.id, userId: req.user!.userId }, { $set: req.body }, { new: true }).lean();
  if (!cat) throw new AppError('Category not found', 404);
  res.json({ success: true, data: cat });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await Category.deleteOne({ _id: req.params.id, userId: req.user!.userId, isDefault: false });
  if (result.deletedCount === 0) throw new AppError('Category not found or is a default', 404);
  res.status(204).send();
}));

export default router;
