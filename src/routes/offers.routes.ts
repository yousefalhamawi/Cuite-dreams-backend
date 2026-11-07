import { Router } from 'express';
import * as offers from '../controllers/offers.controller';
import { validate } from '../middlewares/validate';
import { requireAdmin } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimit';
import {
  offerCreateSchema,
  offerPatchSchema,
  couponCreateSchema,
  paginationSchema,
  uuidParam,
} from '../validators/schemas';
import { z } from 'zod';

const router = Router();

router.get('/', offers.listOffers);
router.get(
  '/admin',
  requireAdmin(),
  validate(paginationSchema, 'query'),
  offers.listAllOffers,
);
router.get(
  '/coupons/admin',
  requireAdmin(),
  validate(paginationSchema, 'query'),
  offers.listCoupons,
);
router.post(
  '/',
  requireAdmin(),
  writeLimiter,
  validate(offerCreateSchema),
  offers.createOffer,
);

router.post(
  '/coupons/validate',
  validate(
    z.object({
      code: z.string().min(3),
      subtotal: z.number().nonnegative(),
    }),
  ),
  offers.validateCoupon,
);
router.post(
  '/coupons',
  requireAdmin(),
  writeLimiter,
  validate(couponCreateSchema),
  offers.createCoupon,
);
router.patch(
  '/coupons/:id',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  offers.patchCoupon,
);
router.delete(
  '/coupons/:id',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  offers.deleteCoupon,
);

router.get('/:slug', offers.getOffer);

router.patch(
  '/:id',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  validate(offerPatchSchema),
  offers.patchOffer,
);
router.delete(
  '/:id',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  offers.deleteOffer,
);

export default router;
