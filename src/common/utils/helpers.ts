export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function getMonthDateRange(year: number, month: number) {
  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
  return { startDate, endDate };
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [yearStr, monthStr] = monthKey.split('-');
  return { year: parseInt(yearStr), month: parseInt(monthStr) - 1 };
}
