import { Router } from 'express';
import * as rates from '../controllers/exchange-rate.controller';
import { requireAdmin } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate';
import { exchangeRateUpdateSchema } from '../validators/schemas';

const router = Router();

router.get('/', rates.getExchangeRate);
router.get('/history', requireAdmin(), rates.listHistory);
router.put('/', requireAdmin(), writeLimiter, validate(exchangeRateUpdateSchema), rates.updateExchangeRate);

export default router;
