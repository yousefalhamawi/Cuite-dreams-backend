import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { authLimiter } from '../middlewares/rateLimit';
import { customerOrGuest, requireAdmin, requireCustomer } from '../middlewares/auth';
import {
  adminLoginSchema,
  customerRegisterSchema,
  customerLoginSchema,
  customerPatchSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} from '../validators/schemas';

const router = Router();

router.post('/admin/login', authLimiter, validate(adminLoginSchema), auth.adminLogin);
router.post('/admin/refresh', authLimiter, auth.adminRefresh);
router.post('/admin/logout', auth.adminLogout);
router.get('/admin/me', requireAdmin('super_admin', 'delivery'), auth.adminMe);

router.post(
  '/customer/register',
  authLimiter,
  validate(customerRegisterSchema),
  auth.customerRegister,
);
router.post(
  '/customer/login',
  authLimiter,
  validate(customerLoginSchema),
  auth.customerLogin,
);
router.post('/customer/refresh', authLimiter, auth.customerRefresh);
router.post('/customer/logout', auth.customerLogout);
router.get('/customer/me', customerOrGuest, auth.customerMe);
router.patch(
  '/customer/me',
  requireCustomer,
  validate(customerPatchSchema),
  auth.customerPatch,
);

router.post(
  '/customer/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  auth.forgotPassword,
);
router.post(
  '/customer/verify-otp',
  authLimiter,
  validate(verifyOtpSchema),
  auth.verifyOtp,
);
router.post(
  '/customer/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  auth.resetPassword,
);

export default router;
