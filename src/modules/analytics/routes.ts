import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { getTopInsights, getCategoryTrends, getWalletAnalysis } from '../../services/insightsEngine';
import { generateNudges } from '../../services/nudgeEngine';
import { Wallet } from '../wallets/model';
import { Transaction } from '../transactions/model';
import { Category } from '../categories/model';
import { round2 } from '../../common/utils/helpers';

const router = Router();
router.use(authenticate);

// Net worth
router.get('/net-worth', asyncHandler(async (req: Request, res: Response) => {
  const accounts = await Wallet.find({ userId: req.user!.userId }).lean();
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);
  res.json({ success: true, data: { netWorth: round2(netWorth), accounts } });
}));

// Monthly stats
router.get('/monthly-stats', asyncHandler(async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) ?? new Date().getMonth();
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const txns = await Transaction.find({
    userId: req.user!.userId,
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  let income = 0, expense = 0;
  txns.forEach((t) => {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  });

  res.json({ success: true, data: { income: round2(income), expense: round2(expense), balance: round2(income - expense), transactionCount: txns.length } });
}));

// Category breakdown
router.get('/category-breakdown', asyncHandler(async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) ?? new Date().getMonth();
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const expenses = await Transaction.find({
    userId: req.user!.userId, type: 'expense',
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  const cats = await Category.find({ $or: [{ userId: req.user!.userId }, { isDefault: true }] }).lean();
  const catMap: Record<string, any> = {};
  cats.forEach((c) => { catMap[c._id.toString()] = c; });

  const breakdown: Record<string, any> = {};
  expenses.forEach((t) => {
    if (t.categoryId) {
      const cat = catMap[t.categoryId.toString()];
      if (cat) {
        const key = cat._id.toString();
        if (!breakdown[key]) breakdown[key] = { ...cat, total: 0 };
        breakdown[key].total += t.amount;
      }
    }
  });

  res.json({ success: true, data: Object.values(breakdown).sort((a: any, b: any) => b.total - a.total) });
}));

// Trends
router.get('/trends', asyncHandler(async (req: Request, res: Response) => {
  const months = req.query.months ? parseInt(req.query.months as string) : 6;
  const trends = await getCategoryTrends(req.user!.userId, months);
  res.json({ success: true, data: trends });
}));

// Insights
router.get('/insights', asyncHandler(async (req: Request, res: Response) => {
  const insights = await getTopInsights(req.user!.userId);
  res.json({ success: true, data: insights });
}));

// Wallet analysis
router.get('/wallet/:id', asyncHandler(async (req: Request, res: Response) => {
  const analysis = await getWalletAnalysis(req.user!.userId, String(req.params.id));
  res.json({ success: true, data: analysis });
}));

// Nudges
router.get('/nudges', asyncHandler(async (req: Request, res: Response) => {
  const nudges = await generateNudges(req.user!.userId);
  res.json({ success: true, data: nudges });
}));

export default router;
