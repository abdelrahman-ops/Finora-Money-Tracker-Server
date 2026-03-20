import { Transaction } from '../modules/transactions/model';
import { Wallet } from '../modules/wallets/model';
import { Budget } from '../modules/budgets/model';
import { Debt } from '../modules/debts/model';
import { Category } from '../modules/categories/model';
import { round2 } from '../common/utils/helpers';

export async function calculateHealthScore(userId: string) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const monthTxns = await Transaction.find({ userId, date: { $gte: startOfMonth, $lte: endOfMonth } }).lean();
  const prevTxns = await Transaction.find({ userId, date: { $gte: prevStart, $lte: prevEnd } }).lean();
  const accounts = await Wallet.find({ userId }).lean();
  const debts = await Debt.find({ userId }).lean();
  const budgets = await Budget.find({ userId, monthKey }).lean();

  const monthIncome = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const prevIncome = prevTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const prevExpense = prevTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const dimensions: any[] = [];
  const tips: string[] = [];

  // Savings Rate (0-20)
  let savingsScore = 10;
  if (monthIncome > 0) {
    const savingsRate = (monthIncome - monthExpense) / monthIncome;
    if (savingsRate >= 0.3) savingsScore = 20;
    else if (savingsRate >= 0.2) savingsScore = 16;
    else if (savingsRate >= 0.1) savingsScore = 12;
    else if (savingsRate >= 0) savingsScore = 8;
    else savingsScore = 0;
    dimensions.push({ name: 'Savings Rate', score: savingsScore, max: 20, detail: `${(savingsRate * 100).toFixed(0)}% saved`, icon: 'piggy-bank', color: savingsScore >= 12 ? '#22c55e' : savingsScore >= 8 ? '#f59e0b' : '#ef4444' });
    if (savingsRate < 0.1) tips.push('Try to save at least 10% of income each month');
  } else {
    dimensions.push({ name: 'Savings Rate', score: 10, max: 20, detail: 'No income recorded', icon: 'piggy-bank', color: '#94a3b8' });
  }

  // Budget Adherence (0-20)
  let budgetScore = 10;
  if (budgets.length > 0) {
    let overCount = 0;
    for (const budget of budgets) {
      const catSpent = monthTxns.filter((t) => t.type === 'expense' && t.categoryId?.toString() === budget.categoryId.toString()).reduce((s, t) => s + t.amount, 0);
      if (catSpent > budget.limit) overCount++;
    }
    budgetScore = Math.round((1 - overCount / budgets.length) * 20);
    dimensions.push({ name: 'Budget Adherence', score: budgetScore, max: 20, detail: overCount === 0 ? 'All on track' : `${overCount} exceeded`, icon: 'target', color: budgetScore >= 14 ? '#22c55e' : budgetScore >= 8 ? '#f59e0b' : '#ef4444' });
  } else {
    dimensions.push({ name: 'Budget Adherence', score: 10, max: 20, detail: 'No budgets set', icon: 'target', color: '#94a3b8' });
    tips.push('Set budgets to improve control');
  }

  // Balance Stability (0-20)
  let stabilityScore = 10;
  const thisNet = monthIncome - monthExpense;
  if (prevIncome > 0 || prevExpense > 0) {
    const prevNet = prevIncome - prevExpense;
    if (thisNet > 0 && prevNet > 0) stabilityScore = 18;
    else if (thisNet > 0) stabilityScore = 16;
    else if (thisNet >= -100) stabilityScore = 10;
    else stabilityScore = 4;
  }
  dimensions.push({ name: 'Balance Stability', score: stabilityScore, max: 20, detail: thisNet >= 0 ? 'Growing' : 'Declining', icon: thisNet >= 0 ? 'trending-up' : 'trending-down', color: stabilityScore >= 14 ? '#22c55e' : '#f59e0b' });

  // Debt Health (0-20)
  let debtScore = 18;
  const activeDebts = debts.filter((d) => d.status === 'active');
  if (activeDebts.length > 0) {
    const totalDebt = activeDebts.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);
    const dti = monthIncome > 0 ? totalDebt / monthIncome : 5;
    if (dti <= 0.3) debtScore = 18;
    else if (dti <= 0.5) debtScore = 14;
    else if (dti <= 1) debtScore = 8;
    else debtScore = 4;
    dimensions.push({ name: 'Debt Health', score: debtScore, max: 20, detail: `${activeDebts.length} active`, icon: 'credit-card', color: debtScore >= 14 ? '#22c55e' : debtScore >= 8 ? '#f59e0b' : '#ef4444' });
    if (dti > 0.5) tips.push('Debt-to-income ratio is high — prioritize paying down debts');
  } else {
    dimensions.push({ name: 'Debt Health', score: 18, max: 20, detail: 'Debt-free', icon: 'check-circle', color: '#22c55e' });
  }

  // Spending Consistency (0-20)
  let consistencyScore = 10;
  const dailySpending: Record<string, number> = {};
  monthTxns.filter((t) => t.type === 'expense').forEach((t) => {
    const dayKey = new Date(t.date).toISOString().slice(0, 10);
    dailySpending[dayKey] = (dailySpending[dayKey] || 0) + t.amount;
  });
  const dailyAmounts = Object.values(dailySpending);
  if (dailyAmounts.length >= 5) {
    const mean = dailyAmounts.reduce((s, v) => s + v, 0) / dailyAmounts.length;
    const variance = dailyAmounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dailyAmounts.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    if (cv <= 0.3) consistencyScore = 18;
    else if (cv <= 0.5) consistencyScore = 14;
    else if (cv <= 0.8) consistencyScore = 10;
    else consistencyScore = 6;
  }
  dimensions.push({ name: 'Spending Consistency', score: consistencyScore, max: 20, detail: consistencyScore >= 14 ? 'Consistent' : 'Irregular', icon: 'activity', color: consistencyScore >= 14 ? '#22c55e' : '#f59e0b' });

  const totalScore = savingsScore + budgetScore + stabilityScore + debtScore + consistencyScore;
  let grade = 'F';
  if (totalScore >= 90) grade = 'A+';
  else if (totalScore >= 80) grade = 'A';
  else if (totalScore >= 70) grade = 'B+';
  else if (totalScore >= 60) grade = 'B';
  else if (totalScore >= 50) grade = 'C';
  else if (totalScore >= 40) grade = 'D';

  return { score: totalScore, grade, dimensions, tips: tips.slice(0, 3), totalBalance: round2(totalBalance) };
}

export async function getProjectedEndOfMonth(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthTxns = await Transaction.find({ userId, date: { $gte: startOfMonth, $lte: endOfMonth } }).lean();
  const accounts = await Wallet.find({ userId }).lean();

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const daysLeft = daysInMonth - daysPassed;

  const monthIncome = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const dailyIncome = daysPassed > 0 ? monthIncome / daysPassed : 0;
  const dailyExpense = daysPassed > 0 ? monthExpense / daysPassed : 0;
  const dailyNet = dailyIncome - dailyExpense;

  return {
    currentBalance: round2(totalBalance),
    projectedBalance: round2(totalBalance + dailyNet * daysLeft),
    projectedIncome: round2(monthIncome + dailyIncome * daysLeft),
    projectedExpense: round2(monthExpense + dailyExpense * daysLeft),
    dailyNet: round2(dailyNet),
    daysLeft,
    trend: dailyNet >= 0 ? 'positive' : 'negative',
  };
}

export async function generateSummary(userId: string, period: 'week' | 'month' = 'month') {
  const now = new Date();
  let startDate: Date, endDate: Date, label: string;

  if (period === 'week') {
    const dow = now.getDay() || 7;
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + 1);
    endDate = now;
    label = 'This Week';
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now);
  }

  const txns = await Transaction.find({ userId, date: { $gte: startDate, $lte: endDate } }).lean();
  const categories = await Category.find({ $or: [{ userId }, { isDefault: true }] }).lean();
  const catMap: Record<string, any> = {};
  categories.forEach((c) => { catMap[c._id.toString()] = c; });

  const income = txns.filter((t) => t.type === 'income');
  const expenses = txns.filter((t) => t.type === 'expense');
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);

  const catTotals: Record<string, any> = {};
  expenses.forEach((t) => {
    if (t.categoryId && catMap[t.categoryId.toString()]) {
      const cat = catMap[t.categoryId.toString()];
      const key = cat._id.toString();
      if (!catTotals[key]) catTotals[key] = { name: cat.name, icon: cat.icon, color: cat.color, total: 0, count: 0 };
      catTotals[key].total += t.amount;
      catTotals[key].count++;
    }
  });

  const biggestExpense = expenses.length > 0 ? expenses.reduce((max, t) => t.amount > max.amount ? t : max, expenses[0]) : null;

  return {
    period, label,
    overview: { totalIncome: round2(totalIncome), totalExpense: round2(totalExpense), netFlow: round2(totalIncome - totalExpense), transactionCount: txns.length },
    topCategories: Object.values(catTotals).sort((a: any, b: any) => b.total - a.total).slice(0, 5),
    highlights: {
      biggestExpense: biggestExpense ? { name: biggestExpense.name, amount: biggestExpense.amount } : null,
      savingsRate: totalIncome > 0 ? round2(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
    },
  };
}
