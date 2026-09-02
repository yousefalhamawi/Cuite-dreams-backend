import { Router } from 'express';
import * as reviews from '../controllers/review.controller';
import { validate } from '../middlewares/validate';
import { requireAdmin, requireCustomer } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimit';
import {
  reviewCreateSchema,
  moderateReviewSchema,
  uuidParam,
} from '../validators/schemas';

const router = Router();

router.get('/products/:id', validate(uuidParam, 'params'), reviews.listForProduct);
router.get('/eligible/:id', requireCustomer, validate(uuidParam, 'params'), reviews.eligibility);
router.post(
  '/',
  requireCustomer,
  writeLimiter,
  validate(reviewCreateSchema),
  reviews.create,
);
router.get('/admin', requireAdmin(), reviews.listAdmin);
router.patch(
  '/admin/:id',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  validate(moderateReviewSchema),
  reviews.moderate,
);

export default router;
