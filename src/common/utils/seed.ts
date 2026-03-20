import { Category } from '../../modules/categories/model';

const DEFAULT_CATEGORIES = [
  { name: 'Food', type: 'expense' as const, color: '#f97316', icon: 'utensils' },
  { name: 'Transport', type: 'expense' as const, color: '#8b5cf6', icon: 'car' },
  { name: 'Shopping', type: 'expense' as const, color: '#ec4899', icon: 'shopping-bag' },
  { name: 'Bills', type: 'expense' as const, color: '#3b82f6', icon: 'zap' },
  { name: 'Entertainment', type: 'expense' as const, color: '#f43f5e', icon: 'gamepad-2' },
  { name: 'Health', type: 'expense' as const, color: '#10b981', icon: 'heart-pulse' },
  { name: 'Education', type: 'expense' as const, color: '#06b6d4', icon: 'graduation-cap' },
  { name: 'Groceries', type: 'expense' as const, color: '#84cc16', icon: 'shopping-cart' },
  { name: 'Rent', type: 'expense' as const, color: '#d946ef', icon: 'home' },
  { name: 'Other', type: 'expense' as const, color: '#64748b', icon: 'package' },
  { name: 'Salary', type: 'income' as const, color: '#22c55e', icon: 'banknote' },
  { name: 'Freelance', type: 'income' as const, color: '#3b82f6', icon: 'laptop' },
  { name: 'Investment', type: 'income' as const, color: '#8b5cf6', icon: 'trending-up' },
  { name: 'Gift', type: 'income' as const, color: '#ec4899', icon: 'gift' },
  { name: 'Other Income', type: 'income' as const, color: '#64748b', icon: 'plus-circle' },
  { name: 'None', type: 'expense' as const, color: '#94a3b8', icon: 'slash' },
];

export async function seedDefaultCategories(userId?: string): Promise<void> {
  // Check if defaults already exist
  const existingDefaults = await Category.countDocuments({ isDefault: true });
  if (existingDefaults > 0) return;

  await Category.insertMany(
    DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      isDefault: true,
      userId: userId || undefined,
    })),
  );
}
