import { Transaction } from '../modules/transactions/model';
import { Wallet } from '../modules/wallets/model';
import { Budget } from '../modules/budgets/model';
import { SavingsGoal } from '../modules/savings-goals/model';
import { Debt } from '../modules/debts/model';
import { Category } from '../modules/categories/model';
import { round2 } from '../common/utils/helpers';

export async function generateNudges(userId: string) {
  const nudges: any[] = [];
  const now = new Date();
  const accounts = await Wallet.find({ userId }).lean();
  const categories = await Category.find({ $or: [{ userId }, { isDefault: true }] }).lean();
  const catMap: Record<string, any> = {};
  categories.forEach((c) => { catMap[c._id.toString()] = c; });

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthTxns = await Transaction.find({ userId, date: { $gte: startOfMonth, $lte: endOfMonth } }).lean();
  const monthExpenses = monthTxns.filter((t) => t.type === 'expense');
  const monthIncome = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpenseTotal = monthExpenses.reduce((s, t) => s + t.amount, 0);

  // Budget suggestions for unbudgeted categories
  const budgets = await Budget.find({ userId, monthKey }).lean();
  const budgetedCats = new Set(budgets.map((b) => b.categoryId.toString()));
  const monthCatTotals: Record<string, number> = {};
  monthExpenses.forEach((t) => {
    if (t.categoryId) monthCatTotals[t.categoryId.toString()] = (monthCatTotals[t.categoryId.toString()] || 0) + t.amount;
  });

  const topUnbudgeted = Object.entries(monthCatTotals)
    .filter(([catId]) => !budgetedCats.has(catId))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);

  for (const [catId, total] of topUnbudgeted) {
    const cat = catMap[catId];
    if (!cat || total < 20) continue;
    nudges.push({
      id: `budget_suggest_${catId}`, type: 'budget_suggestion', icon: 'target', color: '#3b82f6',
      title: `Set a budget for ${cat.name}`,
      message: `You've spent ${round2(total)} on ${cat.name} this month. Set a budget to stay in control.`,
      priority: 'medium',
    });
  }

  // Savings goal reminders
  const savingsGoals = await SavingsGoal.find({ userId, status: 'active' }).lean();
  for (const goal of savingsGoals) {
    const remaining = goal.targetAmount - goal.currentAmount;
    if (goal.deadline) {
      const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - now.getTime()) / 86400000);
      if (daysLeft > 0 && daysLeft <= 30 && remaining > 0) {
        nudges.push({
          id: `savings_${goal._id}`, type: 'savings_prompt', icon: 'piggy-bank', color: '#22c55e',
          title: `${goal.name}: ${daysLeft} days left`,
          message: `Save ${round2(remaining / daysLeft)}/day to reach your goal.`,
          priority: daysLeft <= 7 ? 'high' : 'medium',
        });
      }
    }
  }

  // Debt reminders
  const activeDebts = await Debt.find({ userId, status: 'active' }).lean();
  for (const debt of activeDebts) {
    if (debt.dueDate) {
      const daysUntilDue = Math.ceil((new Date(debt.dueDate).getTime() - now.getTime()) / 86400000);
      if (daysUntilDue <= 7 && daysUntilDue >= 0) {
        nudges.push({
          id: `debt_due_${debt._id}`, type: 'debt_reminder', icon: 'alert-circle', color: '#ef4444',
          title: `${debt.name} due ${daysUntilDue === 0 ? 'today' : `in ${daysUntilDue} days`}`,
          message: `You still owe ${round2(debt.totalAmount - debt.paidAmount)}.`,
          priority: daysUntilDue <= 2 ? 'high' : 'medium',
        });
      } else if (daysUntilDue < 0) {
        nudges.push({
          id: `debt_overdue_${debt._id}`, type: 'debt_reminder', icon: 'alert-triangle', color: '#ef4444',
          title: `${debt.name} is overdue`,
          message: `Overdue by ${Math.abs(daysUntilDue)} days. Pay ${round2(debt.totalAmount - debt.paidAmount)} ASAP.`,
          priority: 'high',
        });
      }
    }
  }

  // Low balance warning
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const avgDailySpend = now.getDate() > 0 ? monthExpenseTotal / now.getDate() : 0;
  const daysOfFundsLeft = avgDailySpend > 0 ? Math.floor(totalBalance / avgDailySpend) : 999;
  if (daysOfFundsLeft < 14 && daysOfFundsLeft > 0) {
    nudges.push({
      id: 'low_balance', type: 'low_balance', icon: 'alert-triangle',
      color: daysOfFundsLeft < 7 ? '#ef4444' : '#f59e0b',
      title: daysOfFundsLeft < 7 ? 'Funds running low' : 'Watch your balance',
      message: `At your current rate, funds last ~${daysOfFundsLeft} days.`,
      priority: daysOfFundsLeft < 7 ? 'high' : 'medium',
    });
  }

  // Savings rate
  if (monthIncome > 0) {
    const savingsRate = ((monthIncome - monthExpenseTotal) / monthIncome) * 100;
    if (savingsRate > 20) {
      nudges.push({
        id: 'savings_rate_good', type: 'habit', icon: 'sparkles', color: '#22c55e',
        title: 'Great savings rate!', message: `Saving ${savingsRate.toFixed(0)}% of income. Keep it up!`,
        priority: 'low',
      });
    }
  }

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return nudges.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
}
