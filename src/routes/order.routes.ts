import { Router } from 'express';
import * as orders from '../controllers/order.controller';
import { validate } from '../middlewares/validate';
import { requireAdmin, requireCustomer, optionalCustomer } from '../middlewares/auth';
import { guestSession } from '../middlewares/session';
import { writeLimiter } from '../middlewares/rateLimit';
import { checkoutSchema, orderStatusSchema, uuidParam } from '../validators/schemas';

const router = Router();

router.post(
  '/checkout',
  optionalCustomer,
  guestSession,
  writeLimiter,
  validate(checkoutSchema),
  orders.checkout,
);

router.get('/me', requireCustomer, orders.myOrders);
router.get('/me/:id', requireCustomer, validate(uuidParam, 'params'), orders.myOrder);

router.get('/admin', requireAdmin(), orders.adminList);
router.get(
  '/admin/:id',
  requireAdmin(),
  validate(uuidParam, 'params'),
  orders.adminGet,
);
router.patch(
  '/admin/:id/status',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  validate(orderStatusSchema),
  orders.adminStatus,
);

export default router;
