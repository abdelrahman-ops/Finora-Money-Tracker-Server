import { Router } from 'express';
import { TransactionController } from './controller';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { createTransactionSchema, updateTransactionSchema } from './validation';

const router = Router();
const ctrl = new TransactionController();

router.use(authenticate);

router.get('/', asyncHandler(ctrl.findAll));
router.get('/:id', asyncHandler(ctrl.findById));
router.post('/', validate(createTransactionSchema), asyncHandler(ctrl.create));
router.put('/:id', validate(updateTransactionSchema), asyncHandler(ctrl.update));
router.delete('/:id', asyncHandler(ctrl.delete));

export default router;
