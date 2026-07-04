import { Router } from 'express';
import { auth } from '../../common/config/auth';
import { toNodeHandler } from 'better-auth/node';

const router = Router();

// Route all requests to Better Auth node/Express handler
router.all('/*', toNodeHandler(auth));

export default router;

