import { openapiRegistry, PaginationMetaSchema } from '../../config/openapi/openapi.registry';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  categoryQuerySchema,
} from './category.validation';
import { z } from 'zod';

export function registerCategoryOpenApi(): void {
  openapiRegistry.register('CreateCategoryRequest', createCategorySchema);
  openapiRegistry.register('UpdateCategoryRequest', updateCategorySchema);

  // 1. GET /categories (Public)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/categories',
    tags: ['Keyboard Categories'],
    summary: 'Danh sách danh mục công khai đang hoạt động',
    description: 'Trả về các danh mục có isActive = true kèm số lượng theme đã phát hành tương ứng.',
    responses: {
      200: {
        description: 'Lấy danh sách danh mục thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string().openapi({ example: 'Anime' }),
                  slug: z.string().openapi({ example: 'anime' }),
                  themeCount: z.number().int().openapi({ example: 12 }),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // 2. GET /categories/manage (Management)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/categories/manage',
    tags: ['Keyboard Categories'],
    summary: 'Danh sách danh mục quản trị (Yêu cầu quyền CATEGORY_READ)',
    security: [{ BearerAuth: [] }],
    request: { query: categoryQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách danh mục quản trị thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  slug: z.string(),
                  isActive: z.boolean(),
                  themeCount: z.number().int(),
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

  // 3. GET /categories/manage/{id}
  openapiRegistry.registerPath({
    method: 'get',
    path: '/categories/manage/{id}',
    tags: ['Keyboard Categories'],
    summary: 'Chi tiết danh mục quản trị (Yêu cầu quyền CATEGORY_READ)',
    security: [{ BearerAuth: [] }],
    request: { params: categoryIdParamSchema },
    responses: {
      200: {
        description: 'Chi tiết danh mục',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                isActive: z.boolean(),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 4. POST /categories
  openapiRegistry.registerPath({
    method: 'post',
    path: '/categories',
    tags: ['Keyboard Categories'],
    summary: 'Tạo mới danh mục (Yêu cầu quyền CATEGORY_CREATE)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: createCategorySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Tạo danh mục thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                isActive: z.boolean(),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 5. PATCH /categories/{id}
  openapiRegistry.registerPath({
    method: 'patch',
    path: '/categories/{id}',
    tags: ['Keyboard Categories'],
    summary: 'Cập nhật danh mục (Yêu cầu quyền CATEGORY_UPDATE)',
    security: [{ BearerAuth: [] }],
    request: {
      params: categoryIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: updateCategorySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật danh mục thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                isActive: z.boolean(),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 6. DELETE /categories/{id}
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/categories/{id}',
    tags: ['Keyboard Categories'],
    summary: 'Xóa danh mục chưa sử dụng (Yêu cầu quyền CATEGORY_DELETE)',
    security: [{ BearerAuth: [] }],
    request: { params: categoryIdParamSchema },
    responses: {
      200: {
        description: 'Xóa danh mục thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Category deleted successfully' }),
            }),
          },
        },
      },
    },
  });
}
