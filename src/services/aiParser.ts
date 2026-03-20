import { Category } from '../modules/categories/model';
import { Wallet } from '../modules/wallets/model';

const EXPENSE_KEYWORDS = [
  'spent', 'paid', 'bought', 'cost', 'expense', 'pay', 'buy',
  'purchase', 'charge', 'fee', 'bill',
];
const INCOME_KEYWORDS = [
  'earned', 'received', 'salary', 'income', 'got', 'freelance',
  'payment', 'wage', 'bonus', 'refund', 'cashback',
];
const TRANSFER_KEYWORDS = [
  'transfer', 'moved', 'sent', 'to bank', 'to cash', 'from bank', 'from cash',
];
const CATEGORY_HINTS: Record<string, string> = {
  food: 'Food', coffee: 'Food', lunch: 'Food', dinner: 'Food', breakfast: 'Food',
  restaurant: 'Food', meal: 'Food', snack: 'Food', pizza: 'Food', burger: 'Food',
  uber: 'Transport', taxi: 'Transport', bus: 'Transport', metro: 'Transport',
  gas: 'Transport', fuel: 'Transport', parking: 'Transport', train: 'Transport',
  clothes: 'Shopping', shoes: 'Shopping', amazon: 'Shopping', shopping: 'Shopping',
  electricity: 'Bills', water: 'Bills', internet: 'Bills', phone: 'Bills',
  rent: 'Rent', wifi: 'Bills', bill: 'Bills', netflix: 'Bills', spotify: 'Bills',
  movie: 'Entertainment', cinema: 'Entertainment', game: 'Entertainment',
  medicine: 'Health', doctor: 'Health', pharmacy: 'Health', gym: 'Health',
  book: 'Education', course: 'Education', school: 'Education',
  grocery: 'Groceries', groceries: 'Groceries', supermarket: 'Groceries',
  salary: 'Salary', freelance: 'Freelance', investment: 'Investment', gift: 'Gift',
};

export interface ParsedTransaction {
  amount: number | null;
  name: string;
  type: 'income' | 'expense' | 'transfer';
  categoryHint: string | null;
  accountHint: string | null;
  confidence: number;
  raw: string;
}

export function parseTransactionInput(text: string): ParsedTransaction | null {
  if (!text || text.trim().length === 0) return null;

  const input = text.trim().toLowerCase();
  const tokens = input.split(/\s+/);
  let amount: number | null = null;
  let type: 'income' | 'expense' | 'transfer' = 'expense';
  let categoryHint: string | null = null;
  let accountHint: string | null = null;
  const nameTokens: string[] = [];

  for (const token of tokens) {
    const num = parseFloat(token.replace(/[,$]/g, ''));
    if (!isNaN(num) && num > 0 && amount === null) {
      amount = num;
    } else {
      nameTokens.push(token);
    }
  }

  const fullText = nameTokens.join(' ');
  if (INCOME_KEYWORDS.some((k) => fullText.includes(k))) type = 'income';
  else if (TRANSFER_KEYWORDS.some((k) => fullText.includes(k))) type = 'transfer';

  for (const token of nameTokens) {
    const clean = token.replace(/[^a-z]/g, '');
    if (CATEGORY_HINTS[clean]) { categoryHint = CATEGORY_HINTS[clean]; break; }
  }

  const accountWords = ['cash', 'bank', 'card', 'wallet', 'savings'];
  for (const token of nameTokens) {
    if (accountWords.includes(token)) accountHint = token;
  }

  const name = nameTokens
    .filter((t) => !accountWords.includes(t))
    .filter((t) => ![...EXPENSE_KEYWORDS, ...INCOME_KEYWORDS, ...TRANSFER_KEYWORDS].includes(t))
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(' ');

  return {
    amount,
    name: name || categoryHint || 'Transaction',
    type,
    categoryHint,
    accountHint,
    confidence: amount !== null ? (categoryHint ? 0.9 : 0.7) : 0.3,
    raw: text,
  };
}

export async function resolveCategory(userId: string, hint: string) {
  if (!hint) return null;
  return Category.findOne({
    $or: [{ userId }, { isDefault: true }],
    name: { $regex: new RegExp(`^${hint}$`, 'i') },
  }).lean();
}

export async function resolveAccount(userId: string, hint: string) {
  if (!hint) return null;
  return Wallet.findOne({
    userId,
    $or: [
      { name: { $regex: new RegExp(hint, 'i') } },
      { type: hint.toLowerCase() },
    ],
  }).lean();
}
