/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 status: ok
 *                 service: cutie-baby-api
 *                 timestamp: "2026-08-26T03:00:00.000Z"
 *
 * /auth/admin/login:
 *   post:
 *     tags: [Auth, Admin]
 *     summary: Admin login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLoginRequest'
 *           example:
 *             email: admin@cutiebaby.local
 *             password: ChangeMeStrongPass123!
 *     responses:
 *       200:
 *         description: Access + refresh tokens
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken: dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4...
 *                 admin:
 *                   id: 11111111-1111-1111-1111-111111111111
 *                   name: Store Admin
 *                   email: admin@cutiebaby.local
 *                   role: admin
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error:
 *                 code: UNAUTHORIZED
 *                 message: Invalid credentials
 *       429:
 *         description: Rate limited / account locked
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error:
 *                 code: RATE_LIMITED
 *                 message: Too many authentication attempts
 *
 * /auth/admin/refresh:
 *   post:
 *     tags: [Auth, Admin]
 *     summary: Rotate admin refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             refreshToken: dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4...
 *     responses:
 *       200:
 *         description: New token pair
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken: bmV3LXJlZnJlc2gtdG9rZW4...
 *
 * /auth/admin/logout:
 *   post:
 *     tags: [Auth, Admin]
 *     summary: Revoke admin refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             refreshToken: dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4...
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 ok: true
 *
 * /auth/customer/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerRegisterRequest'
 *           example:
 *             name: سارة أحمد
 *             phone: "0944123456"
 *             email: sara@example.com
 *             password: SaraPass123!
 *             address: المزة، شارع الجلاء، بناء 12
 *             city: دمشق
 *             country: SY
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken: Y3VzdG9tZXItcmVmcmVzaC10b2tlbg...
 *                 customer:
 *                   id: 22222222-2222-2222-2222-222222222222
 *                   name: سارة أحمد
 *                   phone: "0944123456"
 *                   email: sara@example.com
 *
 * /auth/customer/login:
 *   post:
 *     tags: [Auth]
 *     summary: Customer login (phone + password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerLoginRequest'
 *           example:
 *             phone: "0944123456"
 *             password: SaraPass123!
 *     responses:
 *       200:
 *         description: Tokens
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken: Y3VzdG9tZXItcmVmcmVzaC10b2tlbg...
 *                 customer:
 *                   id: 22222222-2222-2222-2222-222222222222
 *                   name: سارة أحمد
 *                   phone: "0944123456"
 *                   email: sara@example.com
 *
 * /catalog/categories:
 *   get:
 *     tags: [Catalog]
 *     summary: List categories (AR/EN)
 *     responses:
 *       200:
 *         description: Category list
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: 33333333-3333-3333-3333-333333333333
 *                   name_ar: التطريز حسب الطلب
 *                   name_en: Custom Embroidery
 *                   parent_id: null
 *                   display_order: 3
 *                   image_url: https://cdn.example.com/categories/embroidery.jpg
 *                   is_active: true
 *                 - id: 33333333-3333-3333-3333-333333333334
 *                   name_ar: البروش
 *                   name_en: Brooches
 *                   parent_id: null
 *                   display_order: 7
 *                   image_url: null
 *                   is_active: true
 *   post:
 *     tags: [Catalog, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Create category
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name_ar: العناية بالطفل
 *             name_en: Baby Care
 *             parent_id: null
 *             display_order: 6
 *             image_url: https://cdn.example.com/categories/baby-care.jpg
 *             is_active: true
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 33333333-3333-3333-3333-333333333335
 *                 name_ar: العناية بالطفل
 *                 name_en: Baby Care
 *                 display_order: 6
 *                 is_active: true
 *
 * /catalog/products:
 *   get:
 *     tags: [Catalog]
 *     summary: List products
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         example: 33333333-3333-3333-3333-333333333333
 *       - in: query
 *         name: bestseller
 *         schema: { type: boolean }
 *         example: true
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         example: بطانية
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *         example: 20
 *     responses:
 *       200:
 *         description: Paginated products
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: 44444444-4444-4444-4444-444444444444
 *                   category_id: 33333333-3333-3333-3333-333333333333
 *                   sku: EMB-BLANKET-01
 *                   name_ar: بطانية مطرزة
 *                   name_en: Embroidered Blanket
 *                   price: "45000.00"
 *                   is_active: true
 *                   is_bestseller: true
 *                   avg_rating: "4.80"
 *                   review_count: 12
 *                   primary_image: https://cdn.example.com/products/blanket-1.jpg
 *               meta:
 *                 page: 1
 *                 limit: 20
 *                 total: 1
 *                 totalPages: 1
 *   post:
 *     tags: [Catalog, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Create product
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             category_id: 33333333-3333-3333-3333-333333333333
 *             sku: EMB-BLANKET-01
 *             name_ar: بطانية مطرزة
 *             name_en: Embroidered Blanket
 *             description: بطانية ناعمة مع إمكانية تطريز اسم المولود
 *             price: 45000
 *             is_active: true
 *             is_bestseller: true
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 44444444-4444-4444-4444-444444444444
 *                 sku: EMB-BLANKET-01
 *                 name_en: Embroidered Blanket
 *                 price: "45000.00"
 *
 * /catalog/products/{id}:
 *   get:
 *     tags: [Catalog]
 *     summary: Product detail with images, variants, customizations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         example: 44444444-4444-4444-4444-444444444444
 *     responses:
 *       200:
 *         description: Product
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 44444444-4444-4444-4444-444444444444
 *                 sku: EMB-BLANKET-01
 *                 name_ar: بطانية مطرزة
 *                 name_en: Embroidered Blanket
 *                 price: "45000.00"
 *                 is_bestseller: true
 *                 images:
 *                   - id: 55555555-5555-5555-5555-555555555551
 *                     image_url: https://cdn.example.com/products/blanket-1.jpg
 *                     display_order: 0
 *                     is_primary: true
 *                 variants:
 *                   - id: 66666666-6666-6666-6666-666666666661
 *                     variant_type: style
 *                     value: royal
 *                     price_modifier: "5000.00"
 *                     stock_qty: 20
 *                     sku_suffix: "-ROY"
 *                   - id: 66666666-6666-6666-6666-666666666662
 *                     variant_type: style
 *                     value: classic
 *                     price_modifier: "0.00"
 *                     stock_qty: 35
 *                     sku_suffix: "-CLS"
 *                 customizations:
 *                   - id: 77777777-7777-7777-7777-777777777771
 *                     customization_type: embroidery_name
 *                     is_required: true
 *                     extra_price: "3000.00"
 *                     max_characters: 20
 *                     available_colors: ["ذهبي", "فضي", "أبيض"]
 *                     available_fonts: ["خط ديواني", "خط نسخ"]
 *
 * /catalog/products/{id}/images:
 *   post:
 *     tags: [Catalog, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Add product image
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             image_url: https://cdn.example.com/products/blanket-2.jpg
 *             display_order: 1
 *             is_primary: false
 *     responses:
 *       201:
 *         description: Image added
 *
 * /catalog/products/{id}/variants:
 *   put:
 *     tags: [Catalog, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Upsert product variant (size/color/style)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           examples:
 *             styleRoyal:
 *               summary: Style — royal
 *               value:
 *                 variant_type: style
 *                 value: royal
 *                 price_modifier: 5000
 *                 stock_qty: 20
 *                 sku_suffix: "-ROY"
 *                 is_active: true
 *             colorGold:
 *               summary: Color — gold
 *               value:
 *                 variant_type: color
 *                 value: gold
 *                 price_modifier: 0
 *                 stock_qty: 50
 *                 sku_suffix: "-GLD"
 *     responses:
 *       200:
 *         description: Variant saved
 *
 * /catalog/products/{id}/customizations:
 *   put:
 *     tags: [Catalog, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Upsert product customization
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             customization_type: embroidery_name
 *             is_required: true
 *             extra_price: 3000
 *             max_characters: 20
 *             available_colors: ["ذهبي", "فضي", "أبيض"]
 *             available_fonts: ["خط ديواني", "خط نسخ"]
 *             is_active: true
 *     responses:
 *       200:
 *         description: Customization saved
 *
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get cart (customer token or X-Session-Id)
 *     parameters:
 *       - in: header
 *         name: X-Session-Id
 *         schema: { type: string }
 *         example: guest-session-abc12345
 *     responses:
 *       200:
 *         description: Cart
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 88888888-8888-8888-8888-888888888888
 *                 subtotal: 53000
 *                 items:
 *                   - id: 99999999-9999-9999-9999-999999999991
 *                     product_id: 44444444-4444-4444-4444-444444444444
 *                     variant_id: 66666666-6666-6666-6666-666666666661
 *                     quantity: 1
 *                     unit_price: "53000.00"
 *                     name_ar: بطانية مطرزة
 *                     name_en: Embroidered Blanket
 *                     customizations:
 *                       - customization_id: 77777777-7777-7777-7777-777777777771
 *                         custom_text: آدم
 *                         chosen_color: ذهبي
 *                         chosen_design: null
 *
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add item with optional customizations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CartAddItemRequest'
 *           example:
 *             session_id: guest-session-abc12345
 *             product_id: 44444444-4444-4444-4444-444444444444
 *             variant_id: 66666666-6666-6666-6666-666666666661
 *             quantity: 1
 *             customizations:
 *               - customization_id: 77777777-7777-7777-7777-777777777771
 *                 custom_text: آدم
 *                 chosen_color: ذهبي
 *                 chosen_design: نجمة
 *                 notes: خط واضح من فضلكم
 *     responses:
 *       200:
 *         description: Updated cart
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 88888888-8888-8888-8888-888888888888
 *                 subtotal: 53000
 *                 items:
 *                   - product_id: 44444444-4444-4444-4444-444444444444
 *                     quantity: 1
 *                     unit_price: "53000.00"
 *
 * /cart/items/{itemId}:
 *   patch:
 *     tags: [Cart]
 *     summary: Update cart item quantity
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             quantity: 2
 *             session_id: guest-session-abc12345
 *     responses:
 *       200:
 *         description: Updated cart
 *   delete:
 *     tags: [Cart]
 *     summary: Remove cart item
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: X-Session-Id
 *         schema: { type: string }
 *         example: guest-session-abc12345
 *     responses:
 *       200:
 *         description: Updated cart
 *
 * /orders/checkout:
 *   post:
 *     tags: [Orders]
 *     summary: Checkout cart (COD / bank / Western Union)
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *         example: checkout-sara-20260826-001
 *         description: Scoped to customer when authenticated
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckoutRequest'
 *           examples:
 *             cashOnDelivery:
 *               summary: Cash on delivery (Syria)
 *               value:
 *                 session_id: guest-session-abc12345
 *                 shipping_zone_id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
 *                 payment_method: cash_on_delivery
 *                 coupon_code: WELCOME10
 *                 notes: الاتصال قبل التوصيل
 *                 customer:
 *                   name: سارة أحمد
 *                   phone: "0944123456"
 *                   email: sara@example.com
 *                   address: المزة، شارع الجلاء، بناء 12
 *                   city: دمشق
 *                   country: SY
 *             westernUnion:
 *               summary: Western Union
 *               value:
 *                 shipping_zone_id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
 *                 payment_method: western_union
 *                 customer:
 *                   name: Sara Ahmad
 *                   phone: "0944123456"
 *                   address: Mazzeh, Jalaa St. Bldg 12
 *                   city: Damascus
 *                   country: SY
 *     responses:
 *       201:
 *         description: Order created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
 *                 order_number: CB260826123456
 *                 status: pending
 *                 payment_method: cash_on_delivery
 *                 subtotal: "53000.00"
 *                 shipping_cost: "1000.00"
 *                 discount_total: "5300.00"
 *                 total: "48700.00"
 *                 currency: SYP
 *                 shipping_city: دمشق
 *                 shipping_country: SY
 *
 * /orders/me:
 *   get:
 *     tags: [Orders]
 *     security: [{ CustomerBearer: [] }]
 *     summary: List my orders
 *     responses:
 *       200:
 *         description: Orders
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
 *                   order_number: CB260826123456
 *                   status: pending
 *                   total: "48700.00"
 *                   currency: SYP
 *                   created_at: "2026-08-26T03:10:00.000Z"
 *
 * /orders/me/{id}:
 *   get:
 *     tags: [Orders]
 *     security: [{ CustomerBearer: [] }]
 *     summary: Get my order detail
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order with items
 *       404:
 *         description: Not found (also used for other customers' orders)
 *
 * /orders/admin:
 *   get:
 *     tags: [Orders, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Admin list orders
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, processing, shipped, delivered, cancelled]
 *         example: pending
 *     responses:
 *       200:
 *         description: Orders
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
 *                   order_number: CB260826123456
 *                   status: pending
 *                   total: "48700.00"
 *                   customer_name: سارة أحمد
 *                   customer_phone: "0944123456"
 *               meta:
 *                 page: 1
 *                 limit: 20
 *                 total: 1
 *                 totalPages: 1
 *
 * /orders/admin/{id}/status:
 *   patch:
 *     tags: [Orders, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Update order status
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             status: processing
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
 *                 status: processing
 *
 * /shipping/zones:
 *   get:
 *     tags: [Shipping]
 *     summary: List shipping zones (Syria active; Gulf ready)
 *     responses:
 *       200:
 *         description: Zones + rules
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
 *                   name: Syria
 *                   code: SY
 *                   is_active: true
 *                   rules:
 *                     - id: cccccccc-cccc-cccc-cccc-cccccccccccc
 *                       shipping_fee: "1000.00"
 *                       free_shipping_threshold: null
 *                       currency: SYP
 *                       is_active: true
 *                 - id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab
 *                   name: Gulf
 *                   code: GULF
 *                   is_active: false
 *                   rules: null
 *
 * /shipping/quote:
 *   post:
 *     tags: [Shipping]
 *     summary: Quote shipping for zone + subtotal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             zone_id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
 *             subtotal: 53000
 *             currency: SYP
 *     responses:
 *       200:
 *         description: Quote
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 zoneId: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
 *                 zoneName: Syria
 *                 zoneCode: SY
 *                 currency: SYP
 *                 shippingFee: 1000
 *                 freeShippingThreshold: null
 *                 shippingCost: 1000
 *
 * /shipping/rules:
 *   post:
 *     tags: [Shipping, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Upsert shipping rule (e.g. set free-shipping threshold)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             zone_id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
 *             shipping_fee: 1000
 *             free_shipping_threshold: 100000
 *             currency: SYP
 *             is_active: true
 *     responses:
 *       201:
 *         description: Rule created
 *
 * /offers:
 *   get:
 *     tags: [Offers]
 *     summary: Active offers / bundles
 *     responses:
 *       200:
 *         description: Offers
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: dddddddd-dddd-dddd-dddd-dddddddddddd
 *                   name: عرض استقبال المولود
 *                   description: خصم على أطقم الأم والبطانيات
 *                   start_date: "2026-08-01T00:00:00.000Z"
 *                   end_date: "2026-09-30T23:59:59.000Z"
 *                   is_active: true
 *                   products:
 *                     - product_id: 44444444-4444-4444-4444-444444444444
 *                       offer_rate: "15.00"
 *                       name_ar: بطانية مطرزة
 *                       name_en: Embroidered Blanket
 *                       price: "45000.00"
 *   post:
 *     tags: [Offers, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Create offer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: عرض استقبال المولود
 *             description: خصم على أطقم الأم والبطانيات
 *             start_date: "2026-08-01T00:00:00.000Z"
 *             end_date: "2026-09-30T23:59:59.000Z"
 *             is_active: true
 *             products:
 *               - product_id: 44444444-4444-4444-4444-444444444444
 *                 offer_rate: 15
 *     responses:
 *       201:
 *         description: Created
 *
 * /offers/coupons:
 *   post:
 *     tags: [Offers, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Create coupon
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             code: WELCOME10
 *             discount_rate: 10
 *             min_order_value: 20000
 *             max_uses: 100
 *             expires_at: "2026-12-31T23:59:59.000Z"
 *             applies_to_offer_id: null
 *             is_active: true
 *     responses:
 *       201:
 *         description: Created
 *
 * /offers/coupons/validate:
 *   post:
 *     tags: [Offers]
 *     summary: Validate coupon against subtotal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             code: WELCOME10
 *             subtotal: 53000
 *     responses:
 *       200:
 *         description: Eligibility + estimated discount
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 code: WELCOME10
 *                 discount_rate: 10
 *                 min_order_value: 20000
 *                 eligible: true
 *                 estimated_discount: 5300
 *
 * /reviews/products/{id}:
 *   get:
 *     tags: [Reviews]
 *     summary: Approved reviews for product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         example: 44444444-4444-4444-4444-444444444444
 *     responses:
 *       200:
 *         description: Reviews
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee
 *                   rating: 5
 *                   comment: التطريز جميل والتوصيل سريع
 *                   created_at: "2026-08-20T12:00:00.000Z"
 *                   customer_name: سارة أحمد
 *
 * /reviews:
 *   post:
 *     tags: [Reviews]
 *     security: [{ CustomerBearer: [] }]
 *     summary: Create review (verified purchase)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             product_id: 44444444-4444-4444-4444-444444444444
 *             order_item_id: ffffffff-ffff-ffff-ffff-ffffffffffff
 *             rating: 5
 *             comment: التطريز جميل والتوصيل سريع
 *     responses:
 *       201:
 *         description: Pending moderation
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee
 *                 rating: 5
 *                 is_approved: false
 *
 * /reviews/admin/pending:
 *   get:
 *     tags: [Reviews, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: List pending reviews
 *     responses:
 *       200:
 *         description: Pending reviews
 *
 * /reviews/admin/{id}:
 *   patch:
 *     tags: [Reviews, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Approve or reject review
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           examples:
 *             approve:
 *               summary: Approve
 *               value:
 *                 approve: true
 *             reject:
 *               summary: Reject / delete
 *               value:
 *                 approve: false
 *     responses:
 *       200:
 *         description: Moderated
 *
 * /uploads/images:
 *   post:
 *     tags: [Uploads, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Upload image to Cloudflare R2
 *     description: |
 *       Upload a product/category/review photo. Returns a public URL to use in
 *       `image_url` fields (e.g. POST /catalog/products/{id}/images).
 *     parameters:
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *           enum: [products, categories, reviews, misc]
 *           default: misc
 *         example: products
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: JPEG, PNG, WebP, or GIF (max 5MB by default)
 *     responses:
 *       201:
 *         description: Uploaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageUploadResponse'
 *             example:
 *               success: true
 *               data:
 *                 key: products/550e8400-e29b-41d4-a716-446655440000.jpg
 *                 url: https://pub-xxxxx.r2.dev/products/550e8400-e29b-41d4-a716-446655440000.jpg
 *                 size: 245760
 *                 contentType: image/jpeg
 *       400:
 *         description: Invalid file or validation error
 *       503:
 *         description: R2 storage not configured
 *   delete:
 *     tags: [Uploads, Admin]
 *     security: [{ AdminBearer: [] }]
 *     summary: Delete image from Cloudflare R2
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         schema: { type: string }
 *         example: products/550e8400-e29b-41d4-a716-446655440000.jpg
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 deleted: true
 *                 key: products/550e8400-e29b-41d4-a716-446655440000.jpg
 */
export {};
