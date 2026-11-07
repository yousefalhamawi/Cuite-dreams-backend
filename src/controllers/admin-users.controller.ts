import type { Request, Response } from 'express';
import * as users from '../services/admin-users.service';
import { asyncHandler } from '../utils/helpers';
import { sendCreated, sendSuccess } from '../utils/response';

export const listDeliveryUsers = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await users.listDeliveryUsers());
});

export const createDeliveryUser = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, await users.createDeliveryUser(req.body, req.admin!.id));
});

export const updateDeliveryUser = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await users.updateDeliveryUser(req.params.id as string, req.body, req.admin!.id));
});
