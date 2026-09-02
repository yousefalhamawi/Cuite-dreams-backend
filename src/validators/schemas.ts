import { z } from 'zod';

export const uuidParam = z.object({ id: z.string().uuid() });
export const slugParam = z.object({ id: z.string().min(1).max(200) });

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const customerPatchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(8).max(20).optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  shipping_zone_id: z.string().uuid().nullable().optional(),
});

export const customerRegisterSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  email: z.string().email(),
  password: z.string().min(8),
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  country: z.string().length(2).optional(),
});

export const customerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
  password: z.string().min(8),
});

export const categoryCreateSchema = z.object({
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  parent_id: z.string().uuid().nullable().optional(),
  display_order: z.number().int().min(0).optional(),
  image_url: z.string().url().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const categoryPatchSchema = categoryCreateSchema.partial();

export const productCreateSchema = z.object({
  category_id: z.string().uuid(),
  sku: z.string().min(1).max(64),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  is_active: z.boolean().optional(),
  is_bestseller: z.boolean().optional(),
});

export const productPatchSchema = productCreateSchema.partial();

export const productImageSchema = z.object({
  image_url: z.string().url(),
  display_order: z.number().int().min(0).optional(),
  is_primary: z.boolean().optional(),
});

export const variantSchema = z.object({
  variant_type: z.enum(['size', 'color', 'style']),
  value: z.string().min(1),
  price_modifier: z.number().optional(),
  stock_qty: z.number().int().min(0).optional(),
  sku_suffix: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const customizationSchema = z.object({
  customization_type: z.enum([
    'embroidery_name',
    'frame_text',
    'pacifier_clip',
    'print_design',
  ]),
  is_required: z.boolean().optional(),
  extra_price: z.number().nonnegative().optional(),
  max_characters: z.number().int().positive().nullable().optional(),
  available_colors: z.array(z.string()).optional(),
  available_fonts: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

export const cartAddSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  variant_ids: z.array(z.string().uuid()).optional(),
  packaging_id: z.enum(['p-basic', 'p-classic', 'p-royal']).optional(),
  quantity: z.number().int().positive(),
  session_id: z.string().min(8).optional(),
  customizations: z
    .array(
      z.object({
        customization_id: z.string().uuid(),
        custom_text: z.string().max(500).optional(),
        chosen_color: z.string().optional(),
        chosen_design: z.string().optional(),
        notes: z.string().max(500).optional(),
      }),
    )
    .optional(),
});

export const cartQtySchema = z.object({
  quantity: z.number().int().positive(),
  session_id: z.string().min(8).optional(),
});

export const checkoutSchema = z.object({
  session_id: z.string().min(8).optional(),
  shipping_zone_id: z.string().uuid(),
  payment_method: z.literal('cham_cash').default('cham_cash'),
  coupon_code: z.string().optional(),
  notes: z.string().max(1000).optional(),
  payment_receipt_url: z.string().url().optional(),
  payment_receipt_key: z.string().min(3).max(512).optional(),
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    email: z.string().email().optional(),
    address: z.string().min(5),
    city: z.string().min(2),
    country: z.string().length(2).optional(),
  }),
}).superRefine((data, ctx) => {
  if (data.payment_method === 'cham_cash' && !data.payment_receipt_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Payment receipt is required for Cham Cash',
      path: ['payment_receipt_url'],
    });
  }
});

export const orderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ]),
});

export const shippingRuleSchema = z.object({
  zone_id: z.string().uuid(),
  shipping_fee: z.number().nonnegative(),
  free_shipping_threshold: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).optional(),
  is_active: z.boolean().optional(),
});

export const offerCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  is_active: z.boolean().optional(),
  products: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        offer_rate: z.number().positive().max(100),
      }),
    )
    .optional(),
});

export const couponCreateSchema = z.object({
  code: z.string().min(3).max(32),
  discount_rate: z.number().positive().max(100),
  min_order_value: z.number().nonnegative().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  expires_at: z.string().min(1).nullable().optional(),
  applies_to_offer_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const reviewCreateSchema = z.object({
  product_id: z.string().uuid(),
  order_item_id: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export const moderateReviewSchema = z.object({
  approve: z.boolean(),
});

export const uploadImageQuerySchema = z.object({
  folder: z.enum(['products', 'categories', 'reviews', 'misc', 'receipts']).default('misc'),
});

export const uploadDeleteQuerySchema = z.object({
  key: z.string().min(3).max(512),
});
