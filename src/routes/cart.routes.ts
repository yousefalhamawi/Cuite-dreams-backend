import { Router } from 'express';
import * as cart from '../controllers/cart.controller';
import { validate } from '../middlewares/validate';
import { optionalCustomer } from '../middlewares/auth';
import { guestSession } from '../middlewares/session';
import { writeLimiter } from '../middlewares/rateLimit';
import { cartAddSchema, cartQtySchema } from '../validators/schemas';
import { z } from 'zod';

const router = Router();

router.use(optionalCustomer, guestSession);

router.get('/', cart.getCart);
router.post('/items', writeLimiter, validate(cartAddSchema), cart.addItem);
router.patch(
  '/items/:itemId',
  writeLimiter,
  validate(z.object({ itemId: z.string().uuid() }), 'params'),
  validate(cartQtySchema),
  cart.updateItem,
);
router.delete(
  '/items/:itemId',
  writeLimiter,
  validate(z.object({ itemId: z.string().uuid() }), 'params'),
  cart.removeItem,
);

export default router;
