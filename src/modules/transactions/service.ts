import mongoose from 'mongoose';
import { Transaction } from './model';
import { AppError } from '../../common/utils/AppError';
import { applyTransaction, reverseTransaction } from '../../services/financialEngine';
import { checkDailyLimit, checkBudgetStatus, createAlert } from '../../services/behaviorEngine';
import { logEvent, EVENT_TYPES } from '../../services/eventService';
import { CreateTransactionInput } from './validation';

export class TransactionService {
  async findAll(userId: string, query: { startDate?: string; endDate?: string; accountId?: string; type?: string; page?: number; limit?: number }) {
    const filter: any = { userId };

    if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = new Date(query.startDate);
      if (query.endDate) filter.date.$lte = new Date(query.endDate);
    }
    if (query.accountId) filter.accountId = query.accountId;
    if (query.type) filter.type = query.type;

    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 1000);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(filter),
    ]);

    return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(userId: string, id: string) {
    const txn = await Transaction.findOne({ _id: id, userId }).lean();
    if (!txn) throw new AppError('Transaction not found', 404);
    return txn;
  }

  async create(userId: string, data: CreateTransactionInput) {
    // Validation
    if (data.type === 'transfer' && !data.toAccountId) {
      throw new AppError('Destination account is required for transfers', 400);
    }
    if (data.type === 'transfer' && data.accountId === data.toAccountId) {
      throw new AppError('Cannot transfer to the same account', 400);
    }

    // Daily limit check
    let limitCheck = { allowed: true, isStrict: false, remaining: Infinity };
    try {
      limitCheck = await checkDailyLimit(userId, data.amount, data.date, data.type) as any;
      if (limitCheck.isStrict && !limitCheck.allowed) {
        throw new AppError('Daily limit exceeded (strict mode)', 400);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
    }

    // Duplicate guard
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentDupes = await Transaction.countDocuments({
      userId,
      amount: data.amount,
      type: data.type,
      accountId: data.accountId,
      name: data.name || '',
      createdAt: { $gte: fiveSecondsAgo },
    });
    if (recentDupes > 0) {
      throw new AppError('Duplicate transaction detected. Please wait a moment.', 400);
    }

    // Create transaction + apply effects
    try {
      const txn = await Transaction.create([{
        userId,
        amount: data.amount,
        type: data.type,
        name: data.name || '',
        note: data.note,
        accountId: data.accountId,
        toAccountId: data.type === 'transfer' ? data.toAccountId : undefined,
        categoryId: data.type !== 'transfer' ? data.categoryId : undefined,
        debtId: data.debtId,
        savingsGoalId: data.savingsGoalId,
        date: new Date(data.date),
      }]);

      await applyTransaction(txn[0], userId);
      await logEvent(userId, EVENT_TYPES.TRANSACTION_CREATED, 'transaction', txn[0]._id.toString(), { after: txn[0].toJSON() });

      // Post-transaction budget check (non-critical, outside session)
      if (data.type === 'expense' && data.categoryId) {
        try {
          const budgetStatus = await checkBudgetStatus(userId, data.categoryId, data.date);
          if (budgetStatus.status === 'over') {
            await createAlert(userId, 'budget_exceeded', `Budget exceeded for ${budgetStatus.categoryName}`, 'critical', data.categoryId);
          } else if (budgetStatus.status === 'warning') {
            await createAlert(userId, 'budget_warning', `Near budget limit for ${budgetStatus.categoryName}: ${budgetStatus.pct.toFixed(0)}% used`, 'warning', data.categoryId);
          }
        } catch { /* non-critical */ }
      }

      return { id: txn[0]._id, transaction: txn[0], limitCheck };

    } catch (err) {
      throw err;
    }
  }

  async update(userId: string, id: string, data: CreateTransactionInput) {
    try {
      const oldTxn = await Transaction.findOne({ _id: id, userId });
      if (!oldTxn) throw new AppError('Transaction not found', 404);

      await reverseTransaction(oldTxn);

      oldTxn.amount = data.amount;
      oldTxn.type = data.type as any;
      oldTxn.name = data.name || '';
      oldTxn.note = data.note;
      oldTxn.accountId = data.accountId as any;
      oldTxn.toAccountId = data.type === 'transfer' ? data.toAccountId as any : undefined;
      oldTxn.categoryId = data.type !== 'transfer' ? data.categoryId as any : undefined;
      oldTxn.debtId = data.debtId as any;
      oldTxn.savingsGoalId = data.savingsGoalId as any;
      oldTxn.date = new Date(data.date);
      await oldTxn.save();

      await applyTransaction(oldTxn, userId);
      await logEvent(userId, EVENT_TYPES.TRANSACTION_UPDATED, 'transaction', id, { after: oldTxn.toJSON() });

      return oldTxn;

    } catch (err) {
      throw err;
    }
  }

  async delete(userId: string, id: string) {
    try {
      const txn = await Transaction.findOne({ _id: id, userId });
      if (!txn) throw new AppError('Transaction not found', 404);

      await reverseTransaction(txn);
      await Transaction.deleteOne({ _id: id });
      await logEvent(userId, EVENT_TYPES.TRANSACTION_DELETED, 'transaction', id, { before: txn.toJSON() });

    } catch (err) {
      throw err;
    }
  }
}
