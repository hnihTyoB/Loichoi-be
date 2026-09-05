import { openapiRegistry, PaginationMetaSchema } from '../../config/openapi/openapi.registry';
import {
  studioUpdateProfileSchema,
  studioApplySchema,
  studioThemeQuerySchema,
  studioCreateThemeSchema,
  studioUpdateThemeSchema,
} from './studio.validation';
import { keyboardIdParamSchema, getThemeImageUploadUrlSchema } from '../keyboard/keyboard.validation';
import { z } from 'zod';

export function registerStudioOpenApi(): void {
  openapiRegistry.register('StudioUpdateProfileRequest', studioUpdateProfileSchema);
  openapiRegistry.register('StudioApplyRequest', studioApplySchema);
  openapiRegistry.register('StudioCreateThemeRequest', studioCreateThemeSchema);
  openapiRegistry.register('StudioUpdateThemeRequest', studioUpdateThemeSchema);

  // 1. GET /studio/stats
  openapiRegistry.registerPath({
    method: 'get',
    path: '/studio/stats',
    tags: ['Creator Studio'],
    summary: 'Bảng thống kê số liệu tổng quan của Creator (Yêu cầu đăng nhập & quyền Creator)',
    description: 'Tổng hợp số lượng theme, tổng lượt tải, tổng lượt like, follower, biểu đồ tải 30 ngày và top theme.',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'Lấy dữ liệu thống kê thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                totalThemes: z.number().int().openapi({ example: 18 }),
                publishedThemesCount: z.number().int().openapi({ example: 16 }),
                draftThemesCount: z.number().int().openapi({ example: 2 }),
                totalDownloads: z.number().int().openapi({ example: 126000 }),
                totalLikes: z.number().int().openapi({ example: 3400 }),
                totalFollowers: z.number().int().openapi({ example: 12000 }),
                recentDownloadsTrend: z.array(
                  z.object({
                    date: z.string().openapi({ example: '2026-08-25' }),
                    downloads: z.number().int().openapi({ example: 450 }),
                  }),
                ),
                topThemes: z.array(
                  z.object({
                    id: z.string().uuid(),
                    name: z.string().openapi({ example: 'Sakura Dream' }),
                    slug: z.string().openapi({ example: 'sakura-dream' }),
                    coverUrl: z.string().url(),
                    downloadCount: z.number().int().openapi({ example: 45000 }),
                    likeCount: z.number().int().openapi({ example: 1200 }),
                    status: z.string().openapi({ example: 'PUBLISHED' }),
                  }),
                ),
              }),
            }),
          },
        },
      },
      403: {
        description: 'Chưa có quyền Creator',
      },
    },
  });

  // 2. GET /studio/themes
  openapiRegistry.registerPath({
    method: 'get',
    path: '/studio/themes',
    tags: ['Creator Studio'],
    summary: 'Danh sách các theme do Creator tạo (Yêu cầu đăng nhập & quyền Creator)',
    security: [{ BearerAuth: [] }],
    request: { query: studioThemeQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách theme của creator thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  slug: z.string(),
                  coverUrl: z.string().url(),
                  driveUrl: z.string().url(),
                  platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']),
                  accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                  downloadCount: z.number().int(),
                  likeCount: z.number().int(),
                  isFeatured: z.boolean(),
                  publishedAt: z.string().datetime().nullable(),
                  categoryNames: z.array(z.string()),
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

  // 3. POST /studio/themes
  openapiRegistry.registerPath({
    method: 'post',
    path: '/studio/themes',
    tags: ['Creator Studio'],
    summary: 'Tạo mới theme với tư cách Creator (Yêu cầu đăng nhập & quyền Creator)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: studioCreateThemeSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Tạo theme thành công',
      },
    },
  });

  // 4. PATCH /studio/themes/{id}
  openapiRegistry.registerPath({
    method: 'patch',
    path: '/studio/themes/{id}',
    tags: ['Creator Studio'],
    summary: 'Chỉnh sửa theme của chính mình (Yêu cầu đăng nhập & quyền Creator)',
    security: [{ BearerAuth: [] }],
    request: {
      params: keyboardIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: studioUpdateThemeSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật theme thành công',
      },
      404: {
        description: 'Theme không tồn tại hoặc bạn không phải tác giả',
      },
    },
  });

  // 5. DELETE /studio/themes/{id}
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/studio/themes/{id}',
    tags: ['Creator Studio'],
    summary: 'Xóa hoặc Lưu trữ theme của chính mình (Yêu cầu đăng nhập & quyền Creator)',
    security: [{ BearerAuth: [] }],
    request: { params: keyboardIdParamSchema },
    responses: {
      200: {
        description: 'Xóa theme thành công',
      },
    },
  });

  // 6. PUT /studio/profile
  openapiRegistry.registerPath({
    method: 'put',
    path: '/studio/profile',
    tags: ['Creator Studio'],
    summary: 'Cập nhật thông tin hồ sơ Creator (bio, avatar, banner, mạng xã hội)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: studioUpdateProfileSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật hồ sơ thành công',
      },
      409: {
        description: 'Username đã có người sử dụng',
      },
    },
  });

  // 7. POST /studio/apply
  openapiRegistry.registerPath({
    method: 'post',
    path: '/studio/apply',
    tags: ['Creator Studio'],
    summary: 'Đăng ký trở thành Người sáng tạo (Creator) trên nền tảng',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: studioApplySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Đăng ký trở thành Creator thành công',
      },
      400: {
        description: 'Người dùng đã là Creator',
      },
      409: {
        description: 'Username đã có người sử dụng',
      },
    },
  });

  // 8. POST /studio/upload-url
  openapiRegistry.registerPath({
    method: 'post',
    path: '/studio/upload-url',
    tags: ['Creator Studio'],
    summary: 'Lấy presigned URL tải ảnh theme trực tiếp lên R2 dành cho Creator Studio',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: getThemeImageUploadUrlSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Lấy presigned URL thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                uploadUrl: z.string().url(),
                publicUrl: z.string().url(),
                key: z.string(),
                expiresIn: z.number().int(),
              }),
            }),
          },
        },
      },
    },
  });
}
