import { Transaction } from '../modules/transactions/model';
import { Wallet } from '../modules/wallets/model';
import { Category } from '../modules/categories/model';
import { round2 } from '../common/utils/helpers';

export async function calculateBurnRate(userId: string, monthKey: string) {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const expenses = await Transaction.find({
    userId, type: 'expense', date: { $gte: startDate, $lte: endDate },
  }).lean();

  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const now = new Date();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let daysPassed: number;
  if (now.getFullYear() === year && now.getMonth() === month) daysPassed = now.getDate();
  else if (endDate < now) daysPassed = daysInMonth;
  else daysPassed = 1;

  const dailyBurnRate = daysPassed > 0 ? totalExpense / daysPassed : 0;

  return {
    dailyBurnRate: round2(dailyBurnRate),
    totalExpense: round2(totalExpense),
    daysPassed,
    daysRemaining: Math.max(0, daysInMonth - daysPassed),
    daysInMonth,
    projectedMonthTotal: round2(dailyBurnRate * daysInMonth),
  };
}

export async function predictRemainingDays(userId: string, accountId?: string) {
  let balance: number;
  if (accountId) {
    const account = await Wallet.findOne({ _id: accountId, userId }).lean();
    balance = account?.balance ?? 0;
  } else {
    const accounts = await Wallet.find({ userId }).lean();
    balance = accounts.reduce((s, a) => s + a.balance, 0);
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const recentExpenses = await Transaction.find({
    userId, type: 'expense', date: { $gte: thirtyDaysAgo },
  }).lean();
  const totalSpent = recentExpenses.reduce((s, t) => s + t.amount, 0);
  const avgDaily = totalSpent / 30;
  const remainingDays = avgDaily > 0 ? Math.floor(balance / avgDaily) : 999;

  return {
    balance: round2(balance),
    avgDailySpend: round2(avgDaily),
    remainingDays,
    isInfinite: avgDaily === 0,
  };
}

export async function getCategoryTrends(userId: string, months = 6) {
  const now = new Date();
  const categories = await Category.find({ $or: [{ userId }, { isDefault: true }] }).lean();
  const catMap: Record<string, any> = {};
  categories.forEach((c) => { catMap[c._id.toString()] = c; });

  const trends: any[] = [];
  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startDate = date;
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);

    const txns = await Transaction.find({
      userId, date: { $gte: startDate, $lte: endDate },
    }).lean();

    const expenses = txns.filter((t) => t.type === 'expense');
    const catTotals: Record<string, number> = {};
    expenses.forEach((t) => {
      if (t.categoryId) catTotals[t.categoryId.toString()] = (catTotals[t.categoryId.toString()] || 0) + t.amount;
    });

    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
    const totalIncome = txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    trends.push({
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      monthLabel,
      totalExpense: round2(totalExpense),
      totalIncome: round2(totalIncome),
      netFlow: round2(totalIncome - totalExpense),
      categoryBreakdown: catTotals,
      transactionCount: expenses.length,
    });
  }

  return trends.reverse();
}

export async function getTopInsights(userId: string) {
  const insights: any[] = [];
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    const burnRate = await calculateBurnRate(userId, monthKey);
    if (burnRate.dailyBurnRate > 0) {
      insights.push({
        icon: 'flame', title: 'Daily Burn Rate', value: burnRate.dailyBurnRate,
        type: 'currency', subtitle: `${burnRate.daysRemaining} days left this month`, color: '#f97316',
      });
    }

    const prediction = await predictRemainingDays(userId);
    if (!prediction.isInfinite && prediction.remainingDays < 60) {
      insights.push({
        icon: 'clock', title: 'Money Lasts', value: prediction.remainingDays,
        type: 'days', subtitle: `At ${prediction.avgDailySpend.toFixed(0)}/day spending`,
        color: prediction.remainingDays < 14 ? '#ef4444' : prediction.remainingDays < 30 ? '#f59e0b' : '#22c55e',
      });
    }

    if (burnRate.projectedMonthTotal > 0) {
      insights.push({
        icon: 'target', title: 'Projected Total', value: burnRate.projectedMonthTotal,
        type: 'currency', subtitle: `Based on ${burnRate.daysPassed} days of spending`, color: '#8b5cf6',
      });
    }
  } catch (e) { /* swallow */ }

  return insights;
}

export async function getWalletAnalysis(userId: string, accountId: string) {
  const account = await Wallet.findOne({ _id: accountId, userId }).lean();
  if (!account) return null;

  const transactions = await Transaction.find({ userId, accountId }).lean();
  const categories = await Category.find({ $or: [{ userId }, { isDefault: true }] }).lean();
  const catMap: Record<string, any> = {};
  categories.forEach((c) => { catMap[c._id.toString()] = c; });

  let totalIncome = 0, totalExpense = 0;
  const catTotals: Record<string, { name: string; color: string; icon: string; total: number; count: number }> = {};

  transactions.forEach((t) => {
    if (t.type === 'income') totalIncome += t.amount;
    else if (t.type === 'expense') totalExpense += t.amount;

    if (t.type === 'expense' && t.categoryId) {
      const cat = catMap[t.categoryId.toString()];
      if (cat) {
        const key = cat._id.toString();
        if (!catTotals[key]) catTotals[key] = { name: cat.name, color: cat.color, icon: cat.icon, total: 0, count: 0 };
        catTotals[key].total += t.amount;
        catTotals[key].count++;
      }
    }
  });

  return {
    account,
    totalIncome: round2(totalIncome),
    totalExpense: round2(totalExpense),
    netFlow: round2(totalIncome - totalExpense),
    transactionCount: transactions.length,
    topCategories: Object.values(catTotals).sort((a, b) => b.total - a.total).slice(0, 5),
  };
}
