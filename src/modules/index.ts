import { Express } from 'express';

import authRoutes from './auth/routes';
import walletRoutes from './wallets/routes';
import transactionRoutes from './transactions/routes';
import categoryRoutes from './categories/routes';
import budgetRoutes from './budgets/routes';
import savingsGoalRoutes from './savings-goals/routes';
import debtRoutes from './debts/routes';
import alertRoutes from './alerts/routes';
import settingRoutes from './settings/routes';
import templateRoutes from './templates/routes';
import eventRoutes from './events/routes';
import analyticsRoutes from './analytics/routes';
import intelligenceRoutes from './intelligence/routes';
import parserRoutes from './parser/routes';
import dataRoutes from './data/routes';
import notificationRoutes from './notifications/routes';

/**
 * Register all API route modules under /api prefix.
 * Keeps app.ts clean and makes adding/removing modules trivial.
 */
export function registerRoutes(app: Express): void {
  const routes: [string, any][] = [
    ['/api/auth',          authRoutes],
    ['/api/wallets',       walletRoutes],
    ['/api/transactions',  transactionRoutes],
    ['/api/categories',    categoryRoutes],
    ['/api/budgets',       budgetRoutes],
    ['/api/savings-goals', savingsGoalRoutes],
    ['/api/debts',         debtRoutes],
    ['/api/alerts',        alertRoutes],
    ['/api/settings',      settingRoutes],
    ['/api/templates',     templateRoutes],
    ['/api/events',        eventRoutes],
    ['/api/analytics',     analyticsRoutes],
    ['/api/intelligence',  intelligenceRoutes],
    ['/api/parse',         parserRoutes],
    ['/api/data',          dataRoutes],
    ['/api/notifications', notificationRoutes],
  ];

  for (const [path, router] of routes) {
    app.use(path, router);
  }
}
