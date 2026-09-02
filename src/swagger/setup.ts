import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '../config/env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Cutie Baby API',
      version: '1.0.0',
      description:
        'E-commerce API for newborn essentials — Syria-first, Gulf-ready.\n\n' +
        '**Payments:** cash_on_delivery · bank_transfer · western_union · cham_cash\n\n' +
        'Customer tokens are stored in httpOnly cookies (`cd_access`, `cd_refresh`). ' +
        'Send requests with credentials. Guest cart uses `cd_session`.\n\n' +
        'Use **Try it out** with the JSON examples below. Admin and customer tokens use different JWT audiences.',
    },
    servers: [{ url: `http://localhost:${env.PORT}/api/v1`, description: 'Local' }],
    components: {
      securitySchemes: {
        AdminBearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Admin access token from POST /auth/admin/login',
        },
        CustomerBearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Customer access token from POST /auth/customer/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'BAD_REQUEST' },
                message: { type: 'string', example: 'Validation failed' },
                details: {},
              },
            },
          },
          example: {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
          },
        },
        AdminLoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@cutiebaby.local' },
            password: { type: 'string', example: 'ChangeMeStrongPass123!' },
          },
        },
        CustomerRegisterRequest: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name: { type: 'string', example: 'سارة أحمد' },
            phone: { type: 'string', example: '0944123456' },
            email: { type: 'string', example: 'sara@example.com' },
            password: { type: 'string', example: 'SaraPass123!' },
            address: { type: 'string', example: 'المزة، شارع الجلاء، بناء 12' },
            city: { type: 'string', example: 'دمشق' },
            country: { type: 'string', example: 'SY' },
          },
        },
        CustomerLoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', example: 'sara@example.com' },
            password: { type: 'string', example: 'SaraPass123!' },
          },
        },
        CartAddItemRequest: {
          type: 'object',
          required: ['product_id', 'quantity'],
          properties: {
            session_id: { type: 'string', example: 'guest-session-abc12345' },
            product_id: {
              type: 'string',
              format: 'uuid',
              example: '44444444-4444-4444-4444-444444444444',
            },
            variant_id: {
              type: 'string',
              format: 'uuid',
              example: '66666666-6666-6666-6666-666666666661',
            },
            quantity: { type: 'integer', example: 1 },
            customizations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  customization_id: {
                    type: 'string',
                    example: '77777777-7777-7777-7777-777777777771',
                  },
                  custom_text: { type: 'string', example: 'آدم' },
                  chosen_color: { type: 'string', example: 'ذهبي' },
                  chosen_design: { type: 'string', example: 'نجمة' },
                  notes: { type: 'string', example: 'خط واضح من فضلكم' },
                },
              },
            },
          },
        },
        CheckoutRequest: {
          type: 'object',
          required: ['shipping_zone_id', 'payment_method', 'customer'],
          properties: {
            session_id: { type: 'string', example: 'guest-session-abc12345' },
            shipping_zone_id: {
              type: 'string',
              format: 'uuid',
              example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            },
            payment_method: {
              type: 'string',
              enum: ['cash_on_delivery', 'bank_transfer', 'western_union'],
              example: 'cash_on_delivery',
            },
            coupon_code: { type: 'string', example: 'WELCOME10' },
            notes: { type: 'string', example: 'الاتصال قبل التوصيل' },
            customer: {
              type: 'object',
              required: ['name', 'phone', 'address', 'city'],
              properties: {
                name: { type: 'string', example: 'سارة أحمد' },
                phone: { type: 'string', example: '0944123456' },
                email: { type: 'string', example: 'sara@example.com' },
                address: { type: 'string', example: 'المزة، شارع الجلاء، بناء 12' },
                city: { type: 'string', example: 'دمشق' },
                country: { type: 'string', example: 'SY' },
              },
            },
          },
        },
        ImageUploadResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                key: { type: 'string', example: 'products/550e8400-e29b-41d4-a716-446655440000.jpg' },
                url: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://pub-xxxxx.r2.dev/products/550e8400-e29b-41d4-a716-446655440000.jpg',
                },
                size: { type: 'integer', example: 245760 },
                contentType: { type: 'string', example: 'image/jpeg' },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Health' },
      { name: 'Auth' },
      { name: 'Catalog' },
      { name: 'Cart' },
      { name: 'Orders' },
      { name: 'Shipping' },
      { name: 'Offers' },
      { name: 'Reviews' },
      { name: 'Uploads' },
      { name: 'Admin' },
    ],
  },
  apis: ['./src/swagger/*.ts', './src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
