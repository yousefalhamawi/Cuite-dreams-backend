import { Router } from 'express';
import * as upload from '../controllers/upload.controller';
import { requireAdmin, optionalCustomer } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimit';
import { imageUpload, requireUploadedFile } from '../middlewares/upload';
import { validate } from '../middlewares/validate';
import { uploadDeleteQuerySchema, uploadImageQuerySchema } from '../validators/schemas';

const router = Router();

router.post(
  '/images',
  requireAdmin(),
  writeLimiter,
  validate(uploadImageQuerySchema, 'query'),
  imageUpload.single('file'),
  requireUploadedFile,
  upload.uploadImage,
);

router.delete(
  '/images',
  requireAdmin(),
  writeLimiter,
  validate(uploadDeleteQuerySchema, 'query'),
  upload.deleteImage,
);

/** Guest + customer checkout receipts (Cham Cash). */
router.post(
  '/receipts',
  optionalCustomer,
  writeLimiter,
  imageUpload.single('file'),
  requireUploadedFile,
  upload.uploadReceipt,
);

export default router;
