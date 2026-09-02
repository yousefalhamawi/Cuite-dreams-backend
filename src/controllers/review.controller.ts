import type { Request, Response } from 'express';
import * as reviews from '../services/review.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/helpers';

export const listForProduct = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await reviews.listApprovedReviews(req.params.id as string));
});

export const eligibility = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    await reviews.reviewEligibility(req.customer!.id, req.params.id as string),
  );
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, await reviews.createReview(req.customer!.id, req.body));
});

export const listAdmin = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as 'pending' | 'approved' | 'all' | undefined;
  sendSuccess(res, await reviews.listReviewsAdmin(status));
});

export const moderate = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    await reviews.moderateReview(
      req.params.id as string,
      req.body.approve,
      req.admin!.id,
    ),
  );
});
