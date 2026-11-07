import { Router } from 'express';
import * as shipping from '../controllers/shipping.controller';
import { validate } from '../middlewares/validate';
import { requireAdmin, optionalAdmin } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimit';
import { shippingRuleSchema, uuidParam } from '../validators/schemas';
import { z } from 'zod';

const router = Router();

router.get('/zones', optionalAdmin, shipping.listZones);
const neighborhoodName = z.string().trim().min(2).max(120);
const neighborhoodsSchema = z.array(neighborhoodName).max(100).refine(
  (names) => new Set(names.map((name) => name.toLocaleLowerCase())).size === names.length,
  'Neighborhood names must be unique',
);
router.post(
  '/zones',
  requireAdmin(),
  writeLimiter,
  validate(z.object({
    name: z.string().trim().min(2).max(120),
    shipping_fee: z.number().nonnegative(),
    free_shipping_threshold: z.number().nonnegative().nullable().optional(),
    neighborhoods: neighborhoodsSchema.optional(),
  })),
  shipping.createZone,
);
router.put(
  '/zones/:id/neighborhoods',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  validate(z.object({ neighborhoods: neighborhoodsSchema })),
  shipping.updateZoneNeighborhoods,
);
router.post(
  '/quote',
  validate(
    z.object({
      zone_id: z.string().uuid(),
      subtotal: z.number().nonnegative(),
      currency: z.string().length(3).optional(),
    }),
  ),
  shipping.quote,
);

router.post(
  '/rules',
  requireAdmin(),
  writeLimiter,
  validate(shippingRuleSchema),
  shipping.upsertRule,
);
router.patch(
  '/zones/:id',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  validate(z.object({ is_active: z.boolean() })),
  shipping.setZoneActive,
);

export default router;
