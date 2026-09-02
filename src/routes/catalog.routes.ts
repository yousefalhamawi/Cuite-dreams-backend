import { Router } from 'express';
import * as catalog from '../controllers/catalog.controller';
import { validate } from '../middlewares/validate';
import { requireAdmin, optionalCustomer, optionalAdmin } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimit';
import {
  uuidParam,
  slugParam,
  categoryCreateSchema,
  categoryPatchSchema,
  productCreateSchema,
  productPatchSchema,
  productImageSchema,
  variantSchema,
  customizationSchema,
} from '../validators/schemas';

const router = Router();

router.get('/categories', optionalAdmin, catalog.listCategories);
router.get('/categories/:id', validate(slugParam, 'params'), catalog.getCategory);

router.post(
  '/categories',
  requireAdmin(),
  writeLimiter,
  validate(categoryCreateSchema),
  catalog.createCategory,
);
router.patch(
  '/categories/:id',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  validate(categoryPatchSchema),
  catalog.patchCategory,
);

router.get('/products', optionalAdmin, optionalCustomer, catalog.listProducts);
router.get('/products/:id', optionalAdmin, validate(slugParam, 'params'), catalog.getProduct);

router.post(
  '/products',
  requireAdmin(),
  writeLimiter,
  validate(productCreateSchema),
  catalog.createProduct,
);
router.patch(
  '/products/:id',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  validate(productPatchSchema),
  catalog.patchProduct,
);
router.post(
  '/products/:id/images',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  validate(productImageSchema),
  catalog.addImage,
);
router.put(
  '/products/:id/variants',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  validate(variantSchema),
  catalog.upsertVariant,
);
router.put(
  '/products/:id/customizations',
  requireAdmin(),
  writeLimiter,
  validate(uuidParam, 'params'),
  validate(customizationSchema),
  catalog.upsertCustomization,
);

export default router;
