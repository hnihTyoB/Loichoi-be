import { openapiRegistry, PaginationMetaSchema } from '../../config/openapi/openapi.registry';
import {
  createCollectionSchema,
  updateCollectionSchema,
  collectionIdParamSchema,
  collectionSlugParamSchema,
  collectionThemeParamSchema,
  addCollectionThemeSchema,
  collectionQuerySchema,
} from './collection.validation';
import { z } from 'zod';

const CreatorSummarySchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().nullable().openapi({ example: 'Kuro Themes' }),
  username: z.string().nullable().openapi({ example: 'kurothemes' }),
  avatarUrl: z.string().url().nullable().openapi({ example: 'https://example.com/avatar.jpg' }),
});

export function registerCollectionOpenApi(): void {
  openapiRegistry.register('CreateCollectionRequest', createCollectionSchema);
  openapiRegistry.register('UpdateCollectionRequest', updateCollectionSchema);
  openapiRegistry.register('AddCollectionThemeRequest', addCollectionThemeSchema);

  // 1. GET /collections (Public list)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/collections',
    tags: ['Collections'],
    summary: 'Danh sách các bộ sưu tập theme bàn phím (Public)',
    description: 'Tìm kiếm, lọc nổi bật (featured) và phân trang cho các bộ sưu tập ở chế độ công khai.',
    request: { query: collectionQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách bộ sưu tập thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string().openapi({ example: 'Sakura & Pastel Aesthetics' }),
                  slug: z.string().openapi({ example: 'sakura-pastel-aesthetics' }),
                  description: z.string().nullable(),
                  coverUrl: z.string().url().nullable(),
                  isPublic: z.boolean(),
                  isFeatured: z.boolean(),
                  creator: CreatorSummarySchema,
                  itemsCount: z.number().int().openapi({ example: 8 }),
                  previewThemes: z.array(
                    z.object({
                      id: z.string().uuid(),
                      name: z.string(),
                      slug: z.string(),
                      coverUrl: z.string().url(),
                    }),
                  ),
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

  // 2. GET /collections/{slug} (Public detail)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/collections/{slug}',
    tags: ['Collections'],
    summary: 'Xem chi tiết bộ sưu tập kèm danh sách theme (Public)',
    request: { params: collectionSlugParamSchema },
    responses: {
      200: {
        description: 'Lấy chi tiết bộ sưu tập thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string().openapi({ example: 'Sakura & Pastel Aesthetics' }),
                slug: z.string().openapi({ example: 'sakura-pastel-aesthetics' }),
                description: z.string().nullable(),
                coverUrl: z.string().url().nullable(),
                isPublic: z.boolean(),
                isFeatured: z.boolean(),
                creator: CreatorSummarySchema,
                itemsCount: z.number().int(),
                items: z.array(
                  z.object({
                    id: z.string().uuid(),
                    position: z.number().int(),
                    addedAt: z.string().datetime(),
                    theme: z.object({
                      id: z.string().uuid(),
                      name: z.string(),
                      slug: z.string(),
                      coverUrl: z.string().url(),
                      platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                      accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                      downloadCount: z.number().int(),
                      likeCount: z.number().int(),
                      isFeatured: z.boolean(),
                      publishedAt: z.string().datetime().nullable(),
                      author: CreatorSummarySchema.nullable(),
                      categories: z.array(
                        z.object({
                          id: z.string().uuid(),
                          name: z.string(),
                          slug: z.string(),
                        }),
                      ),
                    }),
                  }),
                ),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
      404: {
        description: 'Bộ sưu tập không tồn tại hoặc ở chế độ riêng tư',
      },
    },
  });

  // 3. POST /collections (Create collection)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/collections',
    tags: ['Collections'],
    summary: 'Tạo mới bộ sưu tập theme (Yêu cầu đăng nhập)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: createCollectionSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Tạo bộ sưu tập thành công',
      },
    },
  });

  // 4. PATCH /collections/{id} (Update collection)
  openapiRegistry.registerPath({
    method: 'patch',
    path: '/collections/{id}',
    tags: ['Collections'],
    summary: 'Chỉnh sửa bộ sưu tập (Chủ sở hữu hoặc Admin)',
    security: [{ BearerAuth: [] }],
    request: {
      params: collectionIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: updateCollectionSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật bộ sưu tập thành công',
      },
      403: {
        description: 'Không có quyền chỉnh sửa bộ sưu tập này',
      },
    },
  });

  // 5. DELETE /collections/{id} (Delete collection)
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/collections/{id}',
    tags: ['Collections'],
    summary: 'Xóa bộ sưu tập (Chủ sở hữu hoặc Admin)',
    security: [{ BearerAuth: [] }],
    request: { params: collectionIdParamSchema },
    responses: {
      200: {
        description: 'Xóa bộ sưu tập thành công',
      },
      403: {
        description: 'Không có quyền xóa bộ sưu tập này',
      },
    },
  });

  // 6. POST /collections/{id}/themes (Add theme to collection)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/collections/{id}/themes',
    tags: ['Collections'],
    summary: 'Thêm theme vào bộ sưu tập (Chủ sở hữu hoặc Admin)',
    security: [{ BearerAuth: [] }],
    request: {
      params: collectionIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: addCollectionThemeSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Thêm theme vào bộ sưu tập thành công',
      },
      409: {
        description: 'Theme đã có trong bộ sưu tập',
      },
    },
  });

  // 7. DELETE /collections/{id}/themes/{themeId} (Remove theme from collection)
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/collections/{id}/themes/{themeId}',
    tags: ['Collections'],
    summary: 'Xóa theme khỏi bộ sưu tập (Chủ sở hữu hoặc Admin)',
    security: [{ BearerAuth: [] }],
    request: { params: collectionThemeParamSchema },
    responses: {
      200: {
        description: 'Xóa theme khỏi bộ sưu tập thành công',
      },
      404: {
        description: 'Theme không tồn tại trong bộ sưu tập',
      },
    },
  });
}
