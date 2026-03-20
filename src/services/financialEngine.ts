import mongoose from 'mongoose';
import { Wallet } from '../modules/wallets/model';
import { Transaction } from '../modules/transactions/model';
import { SavingsGoal } from '../modules/savings-goals/model';
import { Debt } from '../modules/debts/model';
import { logEvent, EVENT_TYPES } from './eventService';
import { round2 } from '../common/utils/helpers';

/**
 * Financial Engine — ACID-safe balance operations using MongoDB sessions.
 */

function getBalanceDelta(type: string, amount: number, accountId: string, txnAccountId: string, toAccountId?: string): number | null {
  if (type === 'adjustment') return null;

  if (accountId === txnAccountId) {
    switch (type) {
      case 'income': return amount;
      case 'expense':
      case 'debt': return -amount;
      case 'transfer': return -amount;
      default: return type === 'income' ? amount : -amount;
    }
  }

  if (type === 'transfer' && accountId === toAccountId) {
    return amount;
  }

  return 0;
}

export async function applyTransaction(
  txn: {
    _id?: any;
    type: string;
    amount: number;
    accountId: any;
    toAccountId?: any;
    savingsGoalId?: any;
    debtId?: any;
  },
  userId: string,
  session?: mongoose.ClientSession,
): Promise<void> {
  const opts = session ? { session } : {};

  const account = await Wallet.findById(txn.accountId).session(session || null);
  if (!account) throw new Error('Account not found: ' + txn.accountId);

  if (txn.type === 'adjustment') {
    await Wallet.updateOne({ _id: account._id }, { balance: round2(txn.amount) }, opts);
  } else {
    const delta = getBalanceDelta(txn.type, txn.amount, account._id.toString(), txn.accountId.toString(), txn.toAccountId?.toString());
    if (delta !== null) {
      await Wallet.updateOne({ _id: account._id }, { $inc: { balance: round2(delta) } }, opts);
    }
  }

  // Transfer destination
  if (txn.type === 'transfer' && txn.toAccountId) {
    if (txn.toAccountId.toString() === txn.accountId.toString()) {
      throw new Error('Cannot transfer to the same account');
    }
    await Wallet.updateOne({ _id: txn.toAccountId }, { $inc: { balance: round2(txn.amount) } }, opts);
  }

  // Savings goal update
  if (txn.savingsGoalId) {
    const goal = await SavingsGoal.findById(txn.savingsGoalId).session(session || null);
    if (goal) {
      const goalDelta = txn.type === 'income' ? -txn.amount : txn.amount;
      const newAmount = Math.max(0, round2(goal.currentAmount + goalDelta));
      await SavingsGoal.updateOne({ _id: goal._id }, { currentAmount: newAmount }, opts);

      await logEvent(userId, EVENT_TYPES.SAVINGS_UPDATED, 'savingsGoal', goal._id.toString(), {
        before: { currentAmount: goal.currentAmount },
        after: { currentAmount: newAmount },
        transactionId: txn._id?.toString(),
      });
    }
  }

  // Debt payment
  if (txn.debtId) {
    const debt = await Debt.findById(txn.debtId).session(session || null);
    if (debt) {
      const newPaid = round2(debt.paidAmount + txn.amount);
      const newStatus = newPaid >= debt.totalAmount ? 'settled' : 'active';
      await Debt.updateOne({ _id: debt._id }, { paidAmount: newPaid, status: newStatus }, opts);

      const eventType = newStatus === 'settled' && debt.status !== 'settled'
        ? EVENT_TYPES.DEBT_SETTLED
        : EVENT_TYPES.DEBT_PAYMENT;
      await logEvent(userId, eventType, 'debt', debt._id.toString(), {
        before: { paidAmount: debt.paidAmount, status: debt.status },
        after: { paidAmount: newPaid, status: newStatus },
      });
    }
  }
}

export async function reverseTransaction(
  txn: {
    type: string;
    amount: number;
    accountId: any;
    toAccountId?: any;
    savingsGoalId?: any;
    debtId?: any;
  },
  session?: mongoose.ClientSession,
): Promise<void> {
  const opts = session ? { session } : {};

  if (txn.type !== 'adjustment') {
    const delta = getBalanceDelta(txn.type, txn.amount, txn.accountId.toString(), txn.accountId.toString(), txn.toAccountId?.toString());
    if (delta !== null) {
      await Wallet.updateOne({ _id: txn.accountId }, { $inc: { balance: round2(-delta) } }, opts);
    }
  }

  if (txn.type === 'transfer' && txn.toAccountId) {
    await Wallet.updateOne({ _id: txn.toAccountId }, { $inc: { balance: round2(-txn.amount) } }, opts);
  }

  if (txn.savingsGoalId) {
    const goal = await SavingsGoal.findById(txn.savingsGoalId).session(session || null);
    if (goal) {
      const reverseDelta = txn.type === 'income' ? txn.amount : -txn.amount;
      await SavingsGoal.updateOne(
        { _id: goal._id },
        { currentAmount: Math.max(0, round2(goal.currentAmount + reverseDelta)) },
        opts,
      );
    }
  }

  if (txn.debtId) {
    const debt = await Debt.findById(txn.debtId).session(session || null);
    if (debt) {
      const newPaid = Math.max(0, round2(debt.paidAmount - txn.amount));
      await Debt.updateOne(
        { _id: debt._id },
        { paidAmount: newPaid, status: newPaid >= debt.totalAmount ? 'settled' : 'active' },
        opts,
      );
    }
  }
}

export async function recomputeAccountBalance(accountId: string): Promise<number> {
  const transactions = await Transaction.find({
    $or: [{ accountId }, { toAccountId: accountId }],
  })
    .sort({ date: 1 })
    .lean();

  let computedBalance = 0;
  for (const txn of transactions) {
    if (txn.type === 'adjustment' && txn.accountId.toString() === accountId) {
      computedBalance = txn.amount;
    } else {
      const delta = getBalanceDelta(
        txn.type,
        txn.amount,
        accountId,
        txn.accountId.toString(),
        txn.toAccountId?.toString(),
      );
      if (delta !== null) computedBalance += delta;
    }
  }

  return round2(computedBalance);
}

export async function validateAllBalances(userId: string) {
  const accounts = await Wallet.find({ userId }).lean();
  const drifts: any[] = [];

  for (const account of accounts) {
    const computed = await recomputeAccountBalance(account._id.toString());
    const stored = account.balance;

    if (computed !== stored) {
      drifts.push({
        accountId: account._id,
        accountName: account.name,
        stored,
        computed,
        drift: round2(computed - stored),
      });

      await Wallet.updateOne({ _id: account._id }, { balance: computed });
      await logEvent(userId, EVENT_TYPES.BALANCE_DRIFT_FIXED, 'account', account._id.toString(), {
        before: { balance: stored },
        after: { balance: computed },
        drift: round2(computed - stored),
      });
    }
  }

  return { valid: drifts.length === 0, drifts };
}
