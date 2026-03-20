import { Transaction } from '../modules/transactions/model';
import { Budget } from '../modules/budgets/model';
import { Alert } from '../modules/alerts/model';
import { Setting } from '../modules/settings/model';
import { Category } from '../modules/categories/model';
import { round2 } from '../common/utils/helpers';

export async function checkDailyLimit(userId: string, amount: number, date: string, type: string) {
  if (type !== 'expense') return { allowed: true, isStrict: false, remaining: Infinity };

  const setting = await Setting.findOne({ userId, key: 'dailyLimit' }).lean();
  if (!setting || !setting.value || setting.value.amount <= 0) {
    return { allowed: true, isStrict: false, remaining: Infinity };
  }

  const { amount: limitAmount, isStrictMode } = setting.value;
  const dateStr = new Date(date).toISOString().slice(0, 10);
  const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
  const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

  const todayExpenses = await Transaction.find({
    userId,
    type: 'expense',
    date: { $gte: startOfDay, $lte: endOfDay },
  }).lean();

  const todayTotal = todayExpenses.reduce((sum, t) => sum + t.amount, 0);
  const remaining = limitAmount - todayTotal;
  const wouldExceed = (todayTotal + amount) > limitAmount;

  return {
    allowed: !wouldExceed,
    isStrict: isStrictMode,
    remaining: Math.max(0, remaining),
    todayTotal,
    limit: limitAmount,
    pct: Math.min((todayTotal / limitAmount) * 100, 100),
  };
}

export async function checkBudgetStatus(userId: string, categoryId: string, date: string) {
  const d = new Date(date);
  const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const budget = await Budget.findOne({ userId, monthKey, categoryId }).lean();
  if (!budget) return { status: 'none' as const, pct: 0 };

  const cat = await Category.findById(categoryId).lean();
  const startDate = new Date(d.getFullYear(), d.getMonth(), 1);
  const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  const expenses = await Transaction.find({
    userId,
    type: 'expense',
    categoryId,
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  const spent = expenses.reduce((sum, t) => sum + t.amount, 0);
  const pct = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;

  let status: 'good' | 'warning' | 'over' = 'good';
  if (spent > budget.limit) status = 'over';
  else if (pct > 70) status = 'warning';

  return {
    status,
    pct,
    spent: round2(spent),
    limit: budget.limit,
    remaining: round2(budget.limit - spent),
    categoryName: cat?.name || 'Unknown',
    categoryId,
  };
}

export async function createAlert(
  userId: string,
  type: string,
  message: string,
  severity: 'info' | 'warning' | 'critical' = 'info',
  relatedId?: string,
) {
  // Avoid duplicate alerts within the last hour
  const oneHourAgo = new Date(Date.now() - 3600000);
  const existing = await Alert.countDocuments({
    userId,
    type,
    relatedId,
    date: { $gte: oneHourAgo },
  });
  if (existing > 0) return null;

  return Alert.create({ userId, type, message, severity, relatedId });
}

export async function setDailyLimit(userId: string, amount: number, isStrictMode = false) {
  await Setting.findOneAndUpdate(
    { userId, key: 'dailyLimit' },
    { value: { amount, isStrictMode } },
    { upsert: true },
  );
}

export async function getDailyLimit(userId: string) {
  const setting = await Setting.findOne({ userId, key: 'dailyLimit' }).lean();
  return setting?.value || { amount: 0, isStrictMode: false };
}
