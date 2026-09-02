import type { Request, Response } from 'express';
import * as orderService from '../services/order.service';
import { sendCreated, sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/helpers';

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const idempotencyKey = req.header('Idempotency-Key') ?? undefined;
  const order = await orderService.checkout({
    customerId: req.customer?.id,
    sessionId: req.sessionId ?? req.body.session_id,
    shipping_zone_id: req.body.shipping_zone_id,
    payment_method: req.body.payment_method,
    coupon_code: req.body.coupon_code,
    notes: req.body.notes,
    idempotency_key: idempotencyKey,
    payment_receipt_url: req.body.payment_receipt_url,
    payment_receipt_key: req.body.payment_receipt_key,
    customer: req.body.customer,
  });
  sendCreated(res, order);
});

export const myOrders = asyncHandler(async (req: Request, res: Response) => {
  const rows = await orderService.listOrdersForCustomer(req.customer!.id);
  sendSuccess(res, rows);
});

export const myOrder = asyncHandler(async (req: Request, res: Response) => {
  const row = await orderService.getOrderForCustomer(
    req.params.id as string,
    req.customer!.id,
  );
  sendSuccess(res, row);
});

export const adminList = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.listOrdersAdmin({
    status: req.query.status as never,
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

export const adminGet = asyncHandler(async (req: Request, res: Response) => {
  const row = await orderService.getOrderAdmin(req.params.id as string);
  sendSuccess(res, row);
});

export const adminStatus = asyncHandler(async (req: Request, res: Response) => {
  const row = await orderService.updateOrderStatus(
    req.params.id as string,
    req.body.status,
    req.admin!.id,
  );
  sendSuccess(res, row);
});
