import { Router } from 'express';
import { WalletController } from './controller';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { createWalletSchema, updateWalletSchema } from './validation';

const router = Router();
const ctrl = new WalletController();

router.use(authenticate);

router.get('/', asyncHandler(ctrl.findAll));
router.get('/:id', asyncHandler(ctrl.findById));
router.post('/', validate(createWalletSchema), asyncHandler(ctrl.create));
router.put('/:id', validate(updateWalletSchema), asyncHandler(ctrl.update));
router.delete('/:id', asyncHandler(ctrl.delete));

export default router;
