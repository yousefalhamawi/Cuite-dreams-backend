import { Router } from 'express';
import * as shipping from '../controllers/shipping.controller';
import { validate } from '../middlewares/validate';
import { requireAdmin, optionalAdmin } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimit';
import { shippingRuleSchema, uuidParam } from '../validators/schemas';
import { z } from 'zod';

const router = Router();

router.get('/zones', optionalAdmin, shipping.listZones);
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
