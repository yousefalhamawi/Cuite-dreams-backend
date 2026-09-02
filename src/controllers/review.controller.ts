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
  const result = await reviews.listReviewsAdmin(status, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  sendSuccess(res, result.items, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  });
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

export const remove = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await reviews.deleteReview(req.params.id as string, req.admin!.id));
});
