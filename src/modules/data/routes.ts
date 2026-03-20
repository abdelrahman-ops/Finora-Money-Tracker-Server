import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { Wallet } from '../wallets/model';
import { Transaction } from '../transactions/model';
import { Category } from '../categories/model';
import { Template } from '../templates/model';
import { Budget } from '../budgets/model';
import { SavingsGoal } from '../savings-goals/model';
import { Debt } from '../debts/model';
import { Setting } from '../settings/model';
import { Alert } from '../alerts/model';
import { Event } from '../events/model';
import { seedDefaultCategories } from '../../common/utils/seed';

const router = Router();
router.use(authenticate);

// Full JSON export
router.get('/export', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const [accounts, categories, transactions, templates, budgets, savingsGoals, debts, settings] = await Promise.all([
    Wallet.find({ userId }).lean(),
    Category.find({ $or: [{ userId }, { isDefault: true }] }).lean(),
    Transaction.find({ userId }).lean(),
    Template.find({ userId }).lean(),
    Budget.find({ userId }).lean(),
    SavingsGoal.find({ userId }).lean(),
    Debt.find({ userId }).lean(),
    Setting.find({ userId }).lean(),
  ]);

  res.json({
    success: true,
    data: {
      version: 3,
      exportDate: new Date().toISOString(),
      accounts, categories, transactions, templates, budgets, savingsGoals, debts, settings,
    },
  });
}));

// CSV export (transactions only)
router.get('/export-csv', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const [transactions, accounts, categories] = await Promise.all([
    Transaction.find({ userId }).sort({ date: -1 }).lean(),
    Wallet.find({ userId }).lean(),
    Category.find({ $or: [{ userId }, { isDefault: true }] }).lean(),
  ]);

  const accMap: Record<string, string> = {};
  accounts.forEach((a) => { accMap[a._id.toString()] = a.name; });
  const catMap: Record<string, string> = {};
  categories.forEach((c) => { catMap[c._id.toString()] = c.name; });

  const esc = (val: string) => {
    if (val.includes('"') || val.includes(',') || val.includes('\n')) return `"${val.replace(/"/g, '""')}"`;
    return val;
  };

  const headers = 'Date,Type,Amount,Name,Category,Account';
  const rows = transactions.map((t) => [
    new Date(t.date).toISOString().slice(0, 10),
    t.type,
    t.amount.toFixed(2),
    esc(t.name || ''),
    esc(catMap[t.categoryId?.toString() || ''] || ''),
    esc(accMap[t.accountId.toString()] || ''),
  ].join(','));

  const csv = '\uFEFF' + [headers, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=finora-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csv);
}));

// Import (merge)
router.post('/import', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const data = req.body;

  if (!data.accounts && !data.transactions && !data.categories) {
    res.status(400).json({ success: false, error: 'Invalid import data' });
    return;
  }

  let importedCount = 0;

  if (data.accounts?.length) {
    const cleaned = data.accounts.map(({ _id, id, userId: _, ...rest }: any) => ({ ...rest, userId }));
    await Wallet.insertMany(cleaned, { ordered: false }).catch(() => {});
    importedCount += cleaned.length;
  }
  if (data.categories?.length) {
    const cleaned = data.categories.map(({ _id, id, ...rest }: any) => ({ ...rest, userId }));
    await Category.insertMany(cleaned, { ordered: false }).catch(() => {});
    importedCount += cleaned.length;
  }
  if (data.transactions?.length) {
    const cleaned = data.transactions.map(({ _id, id, userId: _, ...rest }: any) => ({ ...rest, userId }));
    await Transaction.insertMany(cleaned, { ordered: false }).catch(() => {});
    importedCount += cleaned.length;
  }
  if (data.templates?.length) {
    const cleaned = data.templates.map(({ _id, id, userId: _, ...rest }: any) => ({ ...rest, userId }));
    await Template.insertMany(cleaned, { ordered: false }).catch(() => {});
    importedCount += cleaned.length;
  }
  if (data.budgets?.length) {
    const cleaned = data.budgets.map(({ _id, id, userId: _, ...rest }: any) => ({ ...rest, userId }));
    await Budget.insertMany(cleaned, { ordered: false }).catch(() => {});
    importedCount += cleaned.length;
  }
  if (data.savingsGoals?.length) {
    const cleaned = data.savingsGoals.map(({ _id, id, userId: _, ...rest }: any) => ({ ...rest, userId }));
    await SavingsGoal.insertMany(cleaned, { ordered: false }).catch(() => {});
    importedCount += cleaned.length;
  }
  if (data.debts?.length) {
    const cleaned = data.debts.map(({ _id, id, userId: _, ...rest }: any) => ({ ...rest, userId }));
    await Debt.insertMany(cleaned, { ordered: false }).catch(() => {});
    importedCount += cleaned.length;
  }

  res.json({ success: true, message: `Merged ${importedCount} records` });
}));

// Clear all user data
router.delete('/clear', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await Promise.all([
    Transaction.deleteMany({ userId }),
    Wallet.deleteMany({ userId }),
    Category.deleteMany({ userId, isDefault: false }),
    Template.deleteMany({ userId }),
    Budget.deleteMany({ userId }),
    SavingsGoal.deleteMany({ userId }),
    Debt.deleteMany({ userId }),
    Setting.deleteMany({ userId }),
    Alert.deleteMany({ userId }),
    Event.deleteMany({ userId }),
  ]);
  res.json({ success: true, message: 'All data cleared' });
}));

// Seed defaults
router.post('/seed', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await seedDefaultCategories(userId);

  // Seed default wallets
  const walletCount = await Wallet.countDocuments({ userId });
  if (walletCount === 0) {
    await Wallet.insertMany([
      { userId, name: 'Cash', type: 'cash', balance: 0, color: '#22c55e', icon: 'wallet' },
      { userId, name: 'Bank', type: 'bank', balance: 0, color: '#007AFF', icon: 'landmark' },
    ]);
  }

  res.json({ success: true, message: 'Defaults seeded' });
}));

export default router;
