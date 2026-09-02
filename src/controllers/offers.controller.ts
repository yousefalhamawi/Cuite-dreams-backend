import type { Request, Response } from 'express';
import * as offers from '../services/offers.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/helpers';

export const getOffer = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await offers.getOfferBySlug(req.params.slug as string));
});

export const listOffers = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await offers.listActiveOffers());
});

export const listAllOffers = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await offers.listAllOffers());
});

export const createOffer = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, await offers.createOffer(req.body, req.admin!.id));
});

export const patchOffer = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await offers.patchOffer(req.params.id as string, req.body, req.admin!.id));
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, await offers.createCoupon(req.body, req.admin!.id));
});

export const listCoupons = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await offers.listCouponsAdmin());
});

export const patchCoupon = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await offers.patchCoupon(req.params.id as string, req.body, req.admin!.id));
});

export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    await offers.validateCouponPublic(req.body.code, Number(req.body.subtotal)),
  );
});
