import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AIService } from '../../services/aiService';
import { AppError } from '../../common/utils/AppError';

const router = Router();
router.use(authenticate);

// Parse natural language transaction
router.post('/parse-transaction', asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    throw new AppError('Text input is required', 400);
  }

  const userId = req.user!.userId;
  const result = await AIService.parseNaturalLanguageTransaction(userId, text);
  res.json({ success: true, data: result });
}));

// Generate recommended budget plan
router.get('/budget-plan', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await AIService.generateBudgetPlan(userId);
  res.json({ success: true, data: result });
}));

// Conversational financial advice
router.post('/advice', asyncHandler(async (req: Request, res: Response) => {
  const { question } = req.body;
  const userId = req.user!.userId;
  const result = await AIService.getFinancialAdvice(userId, question);
  res.json({ success: true, data: result });
}));

export default router;
