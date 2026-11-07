export type AdminRole = 'super_admin' | 'delivery';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod =
  | 'cash_on_delivery'
  | 'bank_transfer'
  | 'western_union'
  | 'cham_cash';

export type VariantType = 'size' | 'color' | 'style';

export type CustomizationType =
  | 'embroidery_name'
  | 'frame_text'
  | 'pacifier_clip'
  | 'print_design';

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
