import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AIService } from '../../services/aiService';
import { AppError } from '../../common/utils/AppError';
import { User } from '../users/model';
import { env } from '../../common/config/env';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

// Verify admin password and upgrade user role
router.post('/verify-admin', asyncHandler(async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    throw new AppError('Password is required', 400);
  }

  const isMatch = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
  if (!isMatch) {
    throw new AppError('Invalid admin passcode', 400);
  }

  const userId = req.user!.userId;
  await User.findByIdAndUpdate(userId, { role: 'admin' });

  res.json({ success: true, message: 'Admin verified successfully' });
}));

// Parse natural language transaction (requires Admin)
router.post('/parse-transaction', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    throw new AppError('Text input is required', 400);
  }

  const userId = req.user!.userId;
  const result = await AIService.parseNaturalLanguageTransaction(userId, text);
  res.json({ success: true, data: result });
}));

// Generate recommended budget plan (requires Admin)
router.get('/budget-plan', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await AIService.generateBudgetPlan(userId);
  res.json({ success: true, data: result });
}));

// Conversational financial advice (requires Admin)
router.post('/advice', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { question } = req.body;
  const userId = req.user!.userId;
  const result = await AIService.getFinancialAdvice(userId, question);
  res.json({ success: true, data: result });
}));

export default router;
