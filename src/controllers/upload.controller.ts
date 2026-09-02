import type { Request, Response } from 'express';
import * as storage from '../services/storage.service';
import { sendCreated, sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/helpers';

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  const folder = (req.query.folder as string | undefined) ?? 'misc';
  const result = await storage.uploadImage(req.file!, folder);
  sendCreated(res, result);
});

export const uploadReceipt = asyncHandler(async (req: Request, res: Response) => {
  const result = await storage.uploadImage(req.file!, 'receipts');
  sendCreated(res, result);
});

export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const key = req.query.key as string;
  await storage.deleteImage(key);
  sendSuccess(res, { deleted: true, key });
});
