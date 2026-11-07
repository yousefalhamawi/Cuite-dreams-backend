import type { Request, Response } from 'express';
import * as shipping from '../services/shipping.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/helpers';

export const listZones = asyncHandler(async (req: Request, res: Response) => {
  const admin = Boolean(req.admin);
  const rows = await shipping.listZones(!admin);
  sendSuccess(res, rows);
});

export const quote = asyncHandler(async (req: Request, res: Response) => {
  const result = await shipping.quoteShipping(
    req.body.zone_id,
    Number(req.body.subtotal),
    req.body.currency ?? 'SAR',
  );
  sendSuccess(res, result);
});

export const createZone = asyncHandler(async (req: Request, res: Response) => {
  const row = await shipping.createZone(req.body, req.admin!.id);
  sendCreated(res, row);
});

export const updateZoneNeighborhoods = asyncHandler(async (req: Request, res: Response) => {
  const row = await shipping.updateZoneNeighborhoods(req.params.id as string, req.body.neighborhoods, req.admin!.id);
  sendSuccess(res, row);
});

export const upsertRule = asyncHandler(async (req: Request, res: Response) => {
  const row = await shipping.upsertShippingRule(req.body, req.admin!.id);
  sendCreated(res, row);
});

export const setZoneActive = asyncHandler(async (req: Request, res: Response) => {
  const row = await shipping.setZoneActive(
    req.params.id as string,
    Boolean(req.body.is_active),
    req.admin!.id,
  );
  sendSuccess(res, row);
});
