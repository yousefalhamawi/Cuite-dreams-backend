import type { Request, Response } from 'express';
import * as cartService from '../services/cart.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/helpers';

function owner(req: Request) {
  return {
    customerId: req.customer?.id,
    sessionId: req.sessionId,
  };
}

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.getCart(owner(req));
  sendSuccess(res, cart);
});

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.addCartItem(owner(req), req.body);
  sendSuccess(res, cart);
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.updateCartItemQuantity(
    owner(req),
    req.params.itemId as string,
    req.body.quantity,
  );
  sendSuccess(res, cart);
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeCartItem(owner(req), req.params.itemId as string);
  sendSuccess(res, cart);
});
