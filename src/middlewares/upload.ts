import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { badRequest } from '../utils/errors';
import { env } from '../config/env';

const storage = multer.memoryStorage();

export const imageUpload = multer({
  storage,
  limits: { fileSize: env.R2_MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      cb(badRequest('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF'));
      return;
    }
    cb(null, true);
  },
});

export function requireUploadedFile(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file) {
    next(badRequest('No file uploaded. Use multipart field name "file".'));
    return;
  }
  next();
}
