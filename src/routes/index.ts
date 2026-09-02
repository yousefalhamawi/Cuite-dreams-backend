import { Router } from 'express';
import authRoutes from './auth.routes';
import catalogRoutes from './catalog.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import shippingRoutes from './shipping.routes';
import offersRoutes from './offers.routes';
import reviewRoutes from './review.routes';
import uploadRoutes from './upload.routes';
import { publicReadLimiter } from '../middlewares/rateLimit';

const router = Router();

router.use(publicReadLimiter);

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', service: 'cutie-baby-api', timestamp: new Date().toISOString() },
  });
});

router.use('/auth', authRoutes);
router.use('/catalog', catalogRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/shipping', shippingRoutes);
router.use('/offers', offersRoutes);
router.use('/reviews', reviewRoutes);
router.use('/uploads', uploadRoutes);

export default router;
