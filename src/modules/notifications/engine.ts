import { Transaction } from '../transactions/model';
import { Budget } from '../budgets/model';
import { SavingsGoal } from '../savings-goals/model';
import { Category } from '../categories/model';
import { Debt } from '../debts/model';
import { Wallet } from '../wallets/model';

interface GeneratedNotification {
  id: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * Deterministic notification engine.
 * Analyses real user financial data and generates contextual notifications.
 * No DB writes — notifications are computed on-the-fly per request.
 */
export async function generateNotifications(userId: string): Promise<GeneratedNotification[]> {
  const now = new Date();
  const notifications: GeneratedNotification[] = [];

  // ─── Time boundaries ───
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ─── Fetch all data in parallel ───
  const [
    todayTxns,
    monthTxns,
    weekTxns,
    budgets,
    savingsGoals,
    debts,
    categories,
    wallets,
  ] = await Promise.all([
    Transaction.find({ userId, date: { $gte: startOfDay, $lte: endOfDay } }).lean(),
    Transaction.find({ userId, date: { $gte: startOfMonth, $lte: endOfDay } }).lean(),
    Transaction.find({ userId, date: { $gte: startOfWeek, $lte: endOfDay } }).lean(),
    Budget.find({ userId, monthKey }).lean(),
    SavingsGoal.find({ userId, status: 'active' }).lean(),
    Debt.find({ userId, status: 'active' }).lean(),
    Category.find({ $or: [{ userId }, { isDefault: true }] }).lean(),
    Wallet.find({ userId }).lean(),
  ]);

  const catMap: Record<string, any> = {};
  categories.forEach((c) => { catMap[c._id.toString()] = c; });

  const todayExpenses = todayTxns.filter((t) => t.type === 'expense');
  const todaySpent = todayExpenses.reduce((s, t) => s + t.amount, 0);
  const monthExpenses = monthTxns.filter((t) => t.type === 'expense');
  const monthSpent = monthExpenses.reduce((s, t) => s + t.amount, 0);
  const monthIncome = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  let idCounter = 0;
  const makeId = () => `notif_${Date.now()}_${idCounter++}`;

  // ═══════════════════════════════════════════
  // 1. BUDGET NOTIFICATIONS
  // ═══════════════════════════════════════════
  for (const budget of budgets) {
    const catExpenses = monthExpenses
      .filter((t) => t.categoryId?.toString() === budget.categoryId.toString())
      .reduce((s, t) => s + t.amount, 0);

    const pct = budget.limit > 0 ? Math.round((catExpenses / budget.limit) * 100) : 0;
    const cat = catMap[budget.categoryId.toString()];
    const catName = cat?.name || 'Unknown';

    if (pct >= 100) {
      notifications.push({
        id: makeId(),
        title: '🚨 Budget Exceeded',
        message: `You've exceeded your ${catName} budget by ${(catExpenses - budget.limit).toFixed(2)}. Consider reducing spending in this category.`,
        icon: 'alert-triangle',
        color: '#ef4444',
        priority: 'high',
        category: 'budget',
        isRead: false,
        createdAt: now.toISOString(),
      });
    } else if (pct >= 80) {
      notifications.push({
        id: makeId(),
        title: '⚠️ Budget Warning',
        message: `You've used ${pct}% of your ${catName} budget. ${(budget.limit - catExpenses).toFixed(2)} remaining.`,
        icon: 'trending-up',
        color: '#f59e0b',
        priority: 'medium',
        category: 'budget',
        isRead: false,
        createdAt: now.toISOString(),
      });
    } else if (pct >= 50) {
      notifications.push({
        id: makeId(),
        title: '📊 Budget Update',
        message: `${catName}: ${pct}% used. You're on track with ${(budget.limit - catExpenses).toFixed(2)} remaining.`,
        icon: 'pie-chart',
        color: '#3b82f6',
        priority: 'low',
        category: 'budget',
        isRead: false,
        createdAt: now.toISOString(),
      });
    }
  }

  // ═══════════════════════════════════════════
  // 2. SAVINGS GOAL NOTIFICATIONS
  // ═══════════════════════════════════════════
  for (const goal of savingsGoals) {
    const pct = goal.targetAmount > 0
      ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
      : 0;

    if (pct >= 100) {
      notifications.push({
        id: makeId(),
        title: '🎉 Goal Achieved!',
        message: `Congratulations! You've reached your "${goal.name}" savings goal of ${goal.targetAmount.toFixed(2)}.`,
        icon: 'trophy',
        color: '#22c55e',
        priority: 'high',
        category: 'savings',
        isRead: false,
        createdAt: now.toISOString(),
      });
    } else if (pct >= 75) {
      notifications.push({
        id: makeId(),
        title: '🔥 Almost There!',
        message: `"${goal.name}" is ${pct}% funded. Only ${(goal.targetAmount - goal.currentAmount).toFixed(2)} to go!`,
        icon: 'target',
        color: '#f59e0b',
        priority: 'medium',
        category: 'savings',
        isRead: false,
        createdAt: now.toISOString(),
      });
    } else if (pct >= 50) {
      notifications.push({
        id: makeId(),
        title: '💪 Halfway There',
        message: `"${goal.name}" is ${pct}% funded. Keep going!`,
        icon: 'trending-up',
        color: '#3b82f6',
        priority: 'low',
        category: 'savings',
        isRead: false,
        createdAt: now.toISOString(),
      });
    }

    // Deadline approaching
    if (goal.deadline) {
      const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0 && daysLeft <= 7 && pct < 100) {
        notifications.push({
          id: makeId(),
          title: '⏳ Deadline Approaching',
          message: `"${goal.name}" deadline is in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. ${pct}% funded so far.`,
          icon: 'clock',
          color: '#ef4444',
          priority: 'high',
          category: 'savings',
          isRead: false,
          createdAt: now.toISOString(),
        });
      }
    }
  }

  // ═══════════════════════════════════════════
  // 3. SPENDING PATTERN NOTIFICATIONS
  // ═══════════════════════════════════════════

  // No expenses today
  if (todayExpenses.length === 0 && now.getHours() >= 18) {
    notifications.push({
      id: makeId(),
      title: '✨ Zero Spend Day',
      message: "You haven't logged any expenses today. Great discipline — or maybe you forgot to log something?",
      icon: 'sparkles',
      color: '#22c55e',
      priority: 'low',
      category: 'activity',
      isRead: false,
      createdAt: now.toISOString(),
    });
  }

  // High spending day
  const avgDailySpend = monthSpent / Math.max(now.getDate(), 1);
  if (todaySpent > avgDailySpend * 2 && todaySpent > 0) {
    notifications.push({
      id: makeId(),
      title: '📈 High Spending Today',
      message: `Today's spending (${todaySpent.toFixed(2)}) is ${Math.round(todaySpent / avgDailySpend)}x your daily average. Review your transactions.`,
      icon: 'alert-circle',
      color: '#ef4444',
      priority: 'high',
      category: 'spending',
      isRead: false,
      createdAt: now.toISOString(),
    });
  }

  // Top category this week
  const weekExpenses = weekTxns.filter((t) => t.type === 'expense');
  if (weekExpenses.length >= 3) {
    const catSpend: Record<string, number> = {};
    weekExpenses.forEach((t) => {
      const cid = t.categoryId?.toString() || 'uncategorized';
      catSpend[cid] = (catSpend[cid] || 0) + t.amount;
    });
    const topCatId = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];
    if (topCatId) {
      const topCat = catMap[topCatId[0]];
      notifications.push({
        id: makeId(),
        title: '🏆 Top Category This Week',
        message: `${topCat?.name || 'Uncategorized'} is your biggest spend this week at ${topCatId[1].toFixed(2)}.`,
        icon: 'bar-chart-3',
        color: '#8b5cf6',
        priority: 'low',
        category: 'insight',
        isRead: false,
        createdAt: now.toISOString(),
      });
    }
  }

  // Income vs expense ratio warning
  if (monthIncome > 0 && monthSpent > monthIncome * 0.9) {
    notifications.push({
      id: makeId(),
      title: '⚠️ Spending Near Income',
      message: `You've spent ${Math.round((monthSpent / monthIncome) * 100)}% of this month's income. Consider slowing down.`,
      icon: 'alert-triangle',
      color: '#f59e0b',
      priority: 'high',
      category: 'spending',
      isRead: false,
      createdAt: now.toISOString(),
    });
  }

  // ═══════════════════════════════════════════
  // 4. DEBT NOTIFICATIONS
  // ═══════════════════════════════════════════
  for (const debt of debts) {
    // Due date approaching
    if (debt.dueDate) {
      const daysLeft = Math.ceil((new Date(debt.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0 && daysLeft <= 3) {
        const label = debt.type === 'i_owe' ? `You owe ${debt.personName}` : `${debt.personName} owes you`;
        notifications.push({
          id: makeId(),
          title: '📅 Debt Due Soon',
          message: `${label} ${(debt.totalAmount - debt.paidAmount).toFixed(2)} — due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`,
          icon: 'calendar',
          color: '#ef4444',
          priority: 'high',
          category: 'debt',
          isRead: false,
          createdAt: now.toISOString(),
        });
      }
    }

    // Overdue
    if (debt.dueDate && new Date(debt.dueDate) < now) {
      notifications.push({
        id: makeId(),
        title: '🔴 Overdue Debt',
        message: `"${debt.name}" with ${debt.personName} is overdue. ${(debt.totalAmount - debt.paidAmount).toFixed(2)} remaining.`,
        icon: 'alert-octagon',
        color: '#dc2626',
        priority: 'high',
        category: 'debt',
        isRead: false,
        createdAt: now.toISOString(),
      });
    }
  }

  // ═══════════════════════════════════════════
  // 5. ACTIVITY NOTIFICATIONS
  // ═══════════════════════════════════════════

  // Monthly summary nudge (after 15th of month)
  if (now.getDate() >= 15) {
    const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    if (totalBudget > 0) {
      const remaining = totalBudget - monthSpent;
      const dailyAllowance = remaining > 0 ? (remaining / Math.max(daysLeft, 1)).toFixed(2) : '0.00';
      notifications.push({
        id: makeId(),
        title: '📋 Mid-Month Summary',
        message: `${daysLeft} days left. You can spend ~${dailyAllowance}/day to stay within budget.`,
        icon: 'calendar',
        color: '#6366f1',
        priority: 'medium',
        category: 'summary',
        isRead: false,
        createdAt: now.toISOString(),
      });
    }
  }

  // Sort: high priority first, then medium, then low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  notifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return notifications;
}
