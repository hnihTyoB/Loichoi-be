import { openapiRegistry, PaginationMetaSchema } from '../../config/openapi/openapi.registry';
import {
  createColorSchema,
  updateColorSchema,
  colorIdParamSchema,
  colorQuerySchema,
} from './color.validation';
import { z } from 'zod';

export function registerColorOpenApi(): void {
  openapiRegistry.register('CreateColorRequest', createColorSchema);
  openapiRegistry.register('UpdateColorRequest', updateColorSchema);

  // 1. GET /colors (Public)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/colors',
    tags: ['Keyboard Colors'],
    summary: 'Danh sách màu sắc công khai',
    description: 'Trả về danh sách màu sắc kèm số lượng theme đã phát hành tương ứng phục vụ bộ lọc swatch màu trên FE.',
    responses: {
      200: {
        description: 'Lấy danh sách màu thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string().openapi({ example: 'Pink' }),
                  slug: z.string().openapi({ example: 'pink' }),
                  hex: z.string().openapi({ example: '#FFB7C5' }),
                  themeCount: z.number().int().openapi({ example: 15 }),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // 2. GET /colors/manage (Management)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/colors/manage',
    tags: ['Keyboard Colors'],
    summary: 'Danh sách màu sắc quản trị (Yêu cầu quyền COLOR_READ)',
    security: [{ BearerAuth: [] }],
    request: { query: colorQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách màu quản trị thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string().openapi({ example: 'Pink' }),
                  slug: z.string().openapi({ example: 'pink' }),
                  hex: z.string().openapi({ example: '#FFB7C5' }),
                  themeCount: z.number().int().openapi({ example: 15 }),
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

  // 3. GET /colors/manage/{id}
  openapiRegistry.registerPath({
    method: 'get',
    path: '/colors/manage/{id}',
    tags: ['Keyboard Colors'],
    summary: 'Chi tiết màu sắc quản trị (Yêu cầu quyền COLOR_READ)',
    security: [{ BearerAuth: [] }],
    request: { params: colorIdParamSchema },
    responses: {
      200: {
        description: 'Chi tiết màu sắc',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string().openapi({ example: 'Pink' }),
                slug: z.string().openapi({ example: 'pink' }),
                hex: z.string().openapi({ example: '#FFB7C5' }),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 4. POST /colors
  openapiRegistry.registerPath({
    method: 'post',
    path: '/colors',
    tags: ['Keyboard Colors'],
    summary: 'Tạo mới màu sắc (Yêu cầu quyền COLOR_CREATE)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: createColorSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Tạo màu sắc thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string().openapi({ example: 'Pink' }),
                slug: z.string().openapi({ example: 'pink' }),
                hex: z.string().openapi({ example: '#FFB7C5' }),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 5. PATCH /colors/{id}
  openapiRegistry.registerPath({
    method: 'patch',
    path: '/colors/{id}',
    tags: ['Keyboard Colors'],
    summary: 'Cập nhật màu sắc (Yêu cầu quyền COLOR_UPDATE)',
    security: [{ BearerAuth: [] }],
    request: {
      params: colorIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: updateColorSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật màu sắc thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                hex: z.string(),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 6. DELETE /colors/{id}
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/colors/{id}',
    tags: ['Keyboard Colors'],
    summary: 'Xóa màu sắc (Yêu cầu quyền COLOR_DELETE)',
    security: [{ BearerAuth: [] }],
    request: { params: colorIdParamSchema },
    responses: {
      200: {
        description: 'Xóa màu sắc thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Color deleted successfully' }),
            }),
          },
        },
      },
    },
  });
}
