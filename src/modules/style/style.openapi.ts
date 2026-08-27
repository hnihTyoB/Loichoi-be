import { openapiRegistry, PaginationMetaSchema } from '../../config/openapi/openapi.registry';
import {
  createStyleSchema,
  updateStyleSchema,
  styleIdParamSchema,
  styleQuerySchema,
} from './style.validation';
import { z } from 'zod';

export function registerStyleOpenApi(): void {
  openapiRegistry.register('CreateStyleRequest', createStyleSchema);
  openapiRegistry.register('UpdateStyleRequest', updateStyleSchema);

  // 1. GET /styles (Public)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/styles',
    tags: ['Keyboard Styles'],
    summary: 'Danh sách phong cách (style) công khai',
    description: 'Trả về danh sách phong cách kèm số lượng theme đã phát hành tương ứng phục vụ bộ lọc style chips trên FE.',
    responses: {
      200: {
        description: 'Lấy danh sách phong cách thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string().openapi({ example: 'Cyberpunk' }),
                  slug: z.string().openapi({ example: 'cyberpunk' }),
                  description: z.string().nullable().openapi({ example: 'Futuristic neon-inspired visual style' }),
                  themeCount: z.number().int().openapi({ example: 8 }),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // 2. GET /styles/manage (Management)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/styles/manage',
    tags: ['Keyboard Styles'],
    summary: 'Danh sách phong cách quản trị (Yêu cầu quyền STYLE_READ)',
    security: [{ BearerAuth: [] }],
    request: { query: styleQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách phong cách quản trị thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string().openapi({ example: 'Cyberpunk' }),
                  slug: z.string().openapi({ example: 'cyberpunk' }),
                  description: z.string().nullable().openapi({ example: 'Futuristic neon-inspired visual style' }),
                  themeCount: z.number().int().openapi({ example: 8 }),
                  createdAt: z.string().datetime(),
                  updatedAt: z.string().datetime(),
                }),
              ),
              meta: PaginationMetaSchema,
            }),
          },
        },
      },
    },
  });

  // 3. GET /styles/manage/{id}
  openapiRegistry.registerPath({
    method: 'get',
    path: '/styles/manage/{id}',
    tags: ['Keyboard Styles'],
    summary: 'Chi tiết phong cách quản trị (Yêu cầu quyền STYLE_READ)',
    security: [{ BearerAuth: [] }],
    request: { params: styleIdParamSchema },
    responses: {
      200: {
        description: 'Chi tiết phong cách',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string().openapi({ example: 'Cyberpunk' }),
                slug: z.string().openapi({ example: 'cyberpunk' }),
                description: z.string().nullable().openapi({ example: 'Futuristic neon-inspired visual style' }),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 4. POST /styles
  openapiRegistry.registerPath({
    method: 'post',
    path: '/styles',
    tags: ['Keyboard Styles'],
    summary: 'Tạo mới phong cách (Yêu cầu quyền STYLE_CREATE)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: createStyleSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Tạo phong cách thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string().openapi({ example: 'Cyberpunk' }),
                slug: z.string().openapi({ example: 'cyberpunk' }),
                description: z.string().nullable().openapi({ example: 'Futuristic neon-inspired visual style' }),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 5. PATCH /styles/{id}
  openapiRegistry.registerPath({
    method: 'patch',
    path: '/styles/{id}',
    tags: ['Keyboard Styles'],
    summary: 'Cập nhật phong cách (Yêu cầu quyền STYLE_UPDATE)',
    security: [{ BearerAuth: [] }],
    request: {
      params: styleIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: updateStyleSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật phong cách thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                description: z.string().nullable(),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 6. DELETE /styles/{id}
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/styles/{id}',
    tags: ['Keyboard Styles'],
    summary: 'Xóa phong cách (Yêu cầu quyền STYLE_DELETE)',
    security: [{ BearerAuth: [] }],
    request: { params: styleIdParamSchema },
    responses: {
      200: {
        description: 'Xóa phong cách thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Style deleted successfully' }),
            }),
          },
        },
      },
    },
  });
}
