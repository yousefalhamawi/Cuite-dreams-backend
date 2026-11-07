import type { Request, Response } from 'express';
import * as rates from '../services/exchange-rate.service';
import { asyncHandler } from '../utils/helpers';
import { sendSuccess } from '../utils/response';

export const getExchangeRate = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await rates.getExchangeRate());
});

export const listHistory = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await rates.listExchangeRateHistory());
});

export const updateExchangeRate = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await rates.updateExchangeRate(req.body.syp_per_usd, req.body.note ?? null, req.admin!.id));
});
