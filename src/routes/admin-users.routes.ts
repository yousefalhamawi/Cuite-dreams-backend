import { Router } from 'express';
import * as users from '../controllers/admin-users.controller';
import { requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { writeLimiter } from '../middlewares/rateLimit';
import { deliveryUserCreateSchema, deliveryUserPatchSchema, uuidParam } from '../validators/schemas';

const router = Router();

router.use(requireAdmin());
router.get('/delivery', users.listDeliveryUsers);
router.post('/delivery', writeLimiter, validate(deliveryUserCreateSchema), users.createDeliveryUser);
router.patch('/delivery/:id', writeLimiter, validate(uuidParam, 'params'), validate(deliveryUserPatchSchema), users.updateDeliveryUser);

export default router;
