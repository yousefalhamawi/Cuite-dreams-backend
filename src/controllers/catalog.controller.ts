import type { Request, Response } from 'express';
import * as catalog from '../services/catalog.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/helpers';

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === '') return undefined;
  const list = Array.isArray(value) ? value.map(String) : [String(value)];
  return list.length ? list : undefined;
}

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const admin = Boolean(req.admin);
  const rows = await catalog.listCategories(!admin);
  sendSuccess(res, rows);
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const row = await catalog.getCategory(req.params.id as string);
  sendSuccess(res, row);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const row = await catalog.createCategory(req.body, req.admin!.id);
  sendCreated(res, row);
});

export const patchCategory = asyncHandler(async (req: Request, res: Response) => {
  const row = await catalog.patchCategory(req.params.id as string, req.body, req.admin!.id);
  sendSuccess(res, row);
});

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const admin = Boolean(req.admin);
  const stockStatus = admin && (req.query.stockStatus === 'low' || req.query.stockStatus === 'out')
    ? req.query.stockStatus
    : undefined;
  const result = await catalog.listProducts({
    categoryId: req.query.categoryId as string | undefined,
    categorySlug: (req.query.category as string | undefined) ?? undefined,
    bestseller: req.query.bestseller === 'true',
    q: req.query.q as string | undefined,
    sort: req.query.sort as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit
      ? Number(req.query.limit)
      : req.query.perPage
        ? Number(req.query.perPage)
        : undefined,
    activeOnly: !admin,
    excludeId: req.query.excludeId as string | undefined,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    colors: asStringArray(req.query.color),
    sizes: asStringArray(req.query.size),
    stockStatus,
    includeStock: admin,
  });
  sendSuccess(res, result.items, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    facets: result.facets,
    priceRange: result.priceRange,
    stockFilterApplied: Boolean(stockStatus),
    stockDataAvailable: admin,
  });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const admin = Boolean(req.admin);
  const row = await catalog.getProductDetail(req.params.id as string, !admin);
  sendSuccess(res, row);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const row = await catalog.createProduct(req.body, req.admin!.id);
  sendCreated(res, row);
});

export const patchProduct = asyncHandler(async (req: Request, res: Response) => {
  const row = await catalog.patchProduct(req.params.id as string, req.body, req.admin!.id);
  sendSuccess(res, row);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const row = await catalog.deleteProduct(req.params.id as string, req.admin!.id);
  sendSuccess(res, row);
});

export const addImage = asyncHandler(async (req: Request, res: Response) => {
  const row = await catalog.addProductImage(req.params.id as string, req.body);
  sendCreated(res, row);
});

export const upsertVariant = asyncHandler(async (req: Request, res: Response) => {
  const row = await catalog.upsertVariant(req.params.id as string, req.body);
  sendSuccess(res, row);
});

export const upsertCustomization = asyncHandler(async (req: Request, res: Response) => {
  const row = await catalog.upsertCustomization(req.params.id as string, req.body);
  sendSuccess(res, row);
});
