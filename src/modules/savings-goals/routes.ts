import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { SavingsGoal } from './model';
import { TransactionService } from '../transactions/service';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const transactionService = new TransactionService();

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

const contributeSchema = z.object({
  amount: z.number().gt(0),
  walletId: z.string().optional().nullable(),
  note: z.string().optional(),
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

// POST /:id/contribute or /:id/deposit
const handleDepositRoute = async (req: Request, res: Response) => {
  const { amount, walletId, accountId, note } = req.body;
  const targetWalletId = walletId || accountId;
  const userId = req.user!.userId;

  // Verify goal exists
  const initialGoal = await SavingsGoal.findOne({ _id: req.params.id, userId });
  if (!initialGoal) throw new AppError('Savings goal not found', 404);

  let transactionId: any = undefined;

  if (targetWalletId) {
    // Create transaction (ACID updates goal currentAmount automatically via financialEngine)
    const result = await transactionService.create(userId, {
      amount,
      type: 'expense',
      name: `Savings: ${initialGoal.name}`,
      note: note || `Contribution to savings goal: ${initialGoal.name}`,
      accountId: targetWalletId,
      savingsGoalId: initialGoal._id.toString(),
      date: new Date().toISOString(),
    });
    transactionId = result.id;
  }

  // Refetch to sync state
  const goal = await SavingsGoal.findOne({ _id: req.params.id, userId });
  if (!goal) throw new AppError('Savings goal not found', 404);

  if (!targetWalletId) {
    goal.currentAmount = (goal.currentAmount || 0) + amount;
  }

  goal.contributions.push({
    amount,
    date: new Date(),
    note: note || (targetWalletId ? 'Wallet contribution' : 'Manual contribution'),
    transactionId,
  });

  if (goal.currentAmount >= goal.targetAmount) {
    goal.status = 'completed';
  }

  await goal.save();
  res.json({ success: true, data: goal });
};

router.post('/:id/contribute', validate(contributeSchema), asyncHandler(handleDepositRoute));
router.post('/:id/deposit', validate(contributeSchema), asyncHandler(handleDepositRoute));

// POST /:id/withdraw
router.post('/:id/withdraw', validate(contributeSchema), asyncHandler(async (req: Request, res: Response) => {
  const { amount, walletId, accountId, note } = req.body;
  const targetWalletId = walletId || accountId;
  const userId = req.user!.userId;

  const initialGoal = await SavingsGoal.findOne({ _id: req.params.id, userId });
  if (!initialGoal) throw new AppError('Savings goal not found', 404);

  let transactionId: any = undefined;

  if (targetWalletId) {
    // Create transaction of type 'income' to refund the wallet (and decrement savings goal in financialEngine)
    const result = await transactionService.create(userId, {
      amount,
      type: 'income',
      name: `Savings refund: ${initialGoal.name}`,
      note: note || `Withdrawal from savings goal: ${initialGoal.name}`,
      accountId: targetWalletId,
      savingsGoalId: initialGoal._id.toString(),
      date: new Date().toISOString(),
    });
    transactionId = result.id;
  }

  // Refetch to sync state
  const goal = await SavingsGoal.findOne({ _id: req.params.id, userId });
  if (!goal) throw new AppError('Savings goal not found', 404);

  if (!targetWalletId) {
    goal.currentAmount = Math.max(0, (goal.currentAmount || 0) - amount);
  }

  goal.contributions.push({
    amount: -amount,
    date: new Date(),
    note: note || (targetWalletId ? 'Wallet withdrawal' : 'Manual withdrawal'),
    transactionId,
  });

  if (goal.currentAmount < goal.targetAmount && goal.status === 'completed') {
    goal.status = 'active';
  }

  await goal.save();
  res.json({ success: true, data: goal });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await SavingsGoal.deleteOne({ _id: req.params.id, userId: req.user!.userId });
  if (result.deletedCount === 0) throw new AppError('Savings goal not found', 404);
  res.status(204).send();
}));

export default router;
