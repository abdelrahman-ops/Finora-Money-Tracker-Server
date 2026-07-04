import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { getTopInsights, getCategoryTrends, getWalletAnalysis } from '../../services/insightsEngine';
import { generateNudges } from '../../services/nudgeEngine';
import { Wallet } from '../wallets/model';
import { Transaction } from '../transactions/model';
import { Category } from '../categories/model';
import { round2 } from '../../common/utils/helpers';
import { getCacheKey, getCache, setCache } from '../../common/utils/cache';

const router = Router();
router.use(authenticate);

// Net worth
router.get('/net-worth', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const cacheKey = getCacheKey(userId, '/analytics/net-worth');
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const accounts = await Wallet.find({ userId }).lean();
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);
  const data = { netWorth: round2(netWorth), accounts };
  
  setCache(cacheKey, data, 10); // Cache net worth for 10s
  res.json({ success: true, data });
}));

// Monthly stats
router.get('/monthly-stats', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) ?? new Date().getMonth();
  
  const cacheKey = getCacheKey(userId, `/analytics/monthly-stats-${year}-${month}`);
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const txns = await Transaction.find({
    userId,
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  let income = 0, expense = 0;
  txns.forEach((t) => {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  });

  const data = {
    income: round2(income),
    expense: round2(expense),
    balance: round2(income - expense),
    transactionCount: txns.length
  };

  setCache(cacheKey, data, 10); // Cache monthly stats for 10s
  res.json({ success: true, data });
}));

// Category breakdown
router.get('/category-breakdown', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) ?? new Date().getMonth();

  const cacheKey = getCacheKey(userId, `/analytics/category-breakdown-${year}-${month}`);
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const expenses = await Transaction.find({
    userId,
    type: 'expense',
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  const cats = await Category.find({ $or: [{ userId }, { isDefault: true }] }).lean();
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

  const data = Object.values(breakdown).sort((a: any, b: any) => b.total - a.total);
  setCache(cacheKey, data, 10); // Cache category breakdown for 10s
  res.json({ success: true, data });
}));

// Trends
router.get('/trends', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const months = req.query.months ? parseInt(req.query.months as string) : 6;

  const cacheKey = getCacheKey(userId, `/analytics/trends-${months}`);
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const trends = await getCategoryTrends(userId, months);
  setCache(cacheKey, trends, 30); // Cache trends for 30s
  res.json({ success: true, data: trends });
}));

// Insights
router.get('/insights', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const cacheKey = getCacheKey(userId, '/analytics/insights');
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const insights = await getTopInsights(userId);
  setCache(cacheKey, insights, 30); // Cache insights for 30s
  res.json({ success: true, data: insights });
}));

// Wallet analysis
router.get('/wallet/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const walletId = String(req.params.id);

  const cacheKey = getCacheKey(userId, `/analytics/wallet-${walletId}`);
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const analysis = await getWalletAnalysis(userId, walletId);
  setCache(cacheKey, analysis, 30); // Cache wallet analysis for 30s
  res.json({ success: true, data: analysis });
}));

// Nudges
router.get('/nudges', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const cacheKey = getCacheKey(userId, '/analytics/nudges');
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const nudges = await generateNudges(userId);
  setCache(cacheKey, nudges, 30); // Cache nudges for 30s
  res.json({ success: true, data: nudges });
}));

export default router;
