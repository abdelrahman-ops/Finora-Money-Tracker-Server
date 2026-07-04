import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { Budget } from './model';
import { Transaction } from '../transactions/model';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const budgetSchema = z.object({
  name: z.string().optional(),
  type: z.enum(['category', 'total']).default('category'),
  categoryId: z.string().optional().nullable(),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  limit: z.number().min(0),
  rollover: z.boolean().default(false),
  alertThreshold: z.number().min(0).max(100).default(80),
  isRecurring: z.boolean().default(true),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const budgets = await Budget.find({ userId: req.user!.userId }).lean();
  res.json({ success: true, data: budgets });
}));

router.get('/month/:monthKey', asyncHandler(async (req: Request, res: Response) => {
  const budgets = await Budget.find({ userId: req.user!.userId, monthKey: req.params.monthKey }).lean();
  res.json({ success: true, data: budgets });
}));

// GET /summary/:monthKey - budget vs actual spending summary
router.get('/summary/:monthKey', asyncHandler(async (req: Request, res: Response) => {
  const { monthKey } = req.params;
  const userId = req.user!.userId;

  const [yearStr, monthStr] = String(monthKey).split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;

  const startDate = new Date(year, month, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  // Fetch all expense transactions for the month
  const expenses = await Transaction.find({
    userId,
    type: 'expense',
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);

  const categorySpentMap: Record<string, number> = {};
  expenses.forEach((t) => {
    if (t.categoryId) {
      const cid = t.categoryId.toString();
      categorySpentMap[cid] = (categorySpentMap[cid] || 0) + t.amount;
    }
  });

  // Fetch all budgets for the month
  const budgets = await Budget.find({ userId, monthKey }).lean();

  // Map spent and percentages
  const data = budgets.map((b) => {
    let spent = 0;
    if (b.type === 'total') {
      spent = totalSpent;
    } else if (b.categoryId) {
      spent = categorySpentMap[b.categoryId.toString()] || 0;
    }
    return {
      ...b,
      spent,
      pct: b.limit > 0 ? (spent / b.limit) * 100 : 0,
    };
  });

  res.json({
    success: true,
    data: {
      monthKey,
      totalSpent,
      budgets: data,
    },
  });
}));

router.post('/', validate(budgetSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, type, categoryId, monthKey, limit, rollover, alertThreshold, isRecurring } = req.body;
  const targetCategoryId = type === 'category' ? categoryId : null;

  const budget = await Budget.findOneAndUpdate(
    {
      userId: req.user!.userId,
      monthKey,
      type,
      categoryId: targetCategoryId,
    },
    {
      $set: {
        name,
        limit,
        rollover,
        alertThreshold,
        isRecurring,
      },
    },
    { upsert: true, new: true, runValidators: true },
  );
  res.status(201).json({ success: true, data: budget });
}));

// POST /copy-forward - Copy budgets from one month to another
router.post('/copy-forward', validate(z.object({
  fromMonthKey: z.string().regex(/^\d{4}-\d{2}$/),
  toMonthKey: z.string().regex(/^\d{4}-\d{2}$/),
})), asyncHandler(async (req: Request, res: Response) => {
  const { fromMonthKey, toMonthKey } = req.body;
  const userId = req.user!.userId;

  const sourceBudgets = await Budget.find({ userId, monthKey: fromMonthKey }).lean();
  if (sourceBudgets.length === 0) {
    return res.json({ success: true, message: 'No budgets found to copy', copiedCount: 0 });
  }

  let copiedCount = 0;
  for (const b of sourceBudgets) {
    const exists = await Budget.findOne({
      userId,
      monthKey: toMonthKey,
      type: b.type,
      categoryId: b.categoryId,
    });

    if (!exists) {
      await Budget.create({
        userId,
        monthKey: toMonthKey,
        type: b.type,
        categoryId: b.categoryId,
        name: b.name,
        limit: b.limit,
        rollover: b.rollover,
        alertThreshold: b.alertThreshold,
        isRecurring: b.isRecurring,
      });
      copiedCount++;
    }
  }

  res.json({ success: true, copiedCount });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await Budget.deleteOne({ _id: req.params.id, userId: req.user!.userId });
  if (result.deletedCount === 0) throw new AppError('Budget not found', 404);
  res.status(204).send();
}));

export default router;
