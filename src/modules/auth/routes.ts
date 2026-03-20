import { Router } from 'express';
import { AuthController } from './controller';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { authLimiter } from '../../common/middleware/rateLimiter';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { registerSchema, loginSchema, refreshSchema } from './validation';

const router = Router();
const ctrl = new AuthController();

router.use(authLimiter);

router.post('/register', validate(registerSchema), asyncHandler(ctrl.register));
router.post('/login', validate(loginSchema), asyncHandler(ctrl.login));
router.post('/refresh', validate(refreshSchema), asyncHandler(ctrl.refresh));
router.post('/logout', authenticate, asyncHandler(ctrl.logout));

export default router;
