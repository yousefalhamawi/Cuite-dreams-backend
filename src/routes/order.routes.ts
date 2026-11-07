import { Router } from 'express';
import * as orders from '../controllers/order.controller';
import { validate } from '../middlewares/validate';
import { requireAdmin, requireCustomer, optionalCustomer } from '../middlewares/auth';
import { guestSession } from '../middlewares/session';
import { writeLimiter } from '../middlewares/rateLimit';
import {
  checkoutSchema,
  orderStatusSchema,
  paginationSchema,
  uuidParam,
} from '../validators/schemas';

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

router.get(
  '/admin',
  requireAdmin('super_admin', 'delivery'),
  validate(paginationSchema, 'query'),
  orders.adminList,
);
router.post(
  '/admin/:id/cancel',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  orders.adminCancel,
);
router.get(
  '/admin/:id',
  requireAdmin('super_admin', 'delivery'),
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
router.delete(
  '/admin/:id',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  orders.adminDelete,
);

export default router;
