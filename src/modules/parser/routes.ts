import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { parseTransactionInput, resolveCategory, resolveAccount } from '../../services/aiParser';
import { z } from 'zod';

const router = Router();

const parseSchema = z.object({ text: z.string().min(1) });

router.post('/', authenticate, validate(parseSchema), asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseTransactionInput(req.body.text);
  if (!parsed) {
    res.json({ success: true, data: null });
    return;
  }

  // Resolve hints to actual records
  const [category, account] = await Promise.all([
    parsed.categoryHint ? resolveCategory(req.user!.userId, parsed.categoryHint) : null,
    parsed.accountHint ? resolveAccount(req.user!.userId, parsed.accountHint) : null,
  ]);

  res.json({ success: true, data: { ...parsed, resolvedCategory: category, resolvedAccount: account } });
}));

export default router;
