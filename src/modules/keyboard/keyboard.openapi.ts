import { openapiRegistry, PaginationMetaSchema } from '../../config/openapi/openapi.registry';
import {
  createKeyboardSchema,
  updateKeyboardSchema,
  keyboardIdParamSchema,
  keyboardSlugParamSchema,
  keyboardPublicQuerySchema,
  keyboardManagementQuerySchema,
} from './keyboard.validation';
import { z } from 'zod';

export function registerKeyboardOpenApi(): void {
  openapiRegistry.register('CreateKeyboardRequest', createKeyboardSchema);
  openapiRegistry.register('UpdateKeyboardRequest', updateKeyboardSchema);

  // 1. GET /keyboards (Public list)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/keyboards',
    tags: ['Keyboard Themes'],
    summary: 'Danh sách giao diện bàn phím đã phát hành (Public)',
    description: 'Tìm kiếm, lọc theo danh mục / nền tảng và phân trang cho các theme PUBLISHED.',
    request: { query: keyboardPublicQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách theme thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string().openapi({ example: 'Sakura Night' }),
                  slug: z.string().openapi({ example: 'sakura-night' }),
                  coverUrl: z.string().url(),
                  platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                  accessLevel: z.enum(['FREE', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                  requiredDiscordRoleIds: z.array(z.string()).openapi({ example: ['123456789012345678'] }),
                  downloadCount: z.number().int().openapi({ example: 1250 }),
                  publishedAt: z.string().datetime().nullable(),
                  categories: z.array(
                    z.object({
                      id: z.string().uuid(),
                      name: z.string(),
                      slug: z.string(),
                    }),
                  ),
                }),
              ),
              meta: PaginationMetaSchema,
            }),
          },
        },
      },
    },
  });

  // 2. GET /keyboards/{slug} (Public detail)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/keyboards/{slug}',
    tags: ['Keyboard Themes'],
    summary: 'Xem chi tiết giao diện bàn phím theo slug (Public)',
    description: 'Lấy thông tin chi tiết của theme PUBLISHED kèm cover, preview images và cấp độ phân quyền accessLevel.',
    request: { params: keyboardSlugParamSchema },
    responses: {
      200: {
        description: 'Lấy chi tiết theme thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string().openapi({ example: 'Sakura Night' }),
                slug: z.string().openapi({ example: 'sakura-night' }),
                description: z.string().nullable(),
                coverUrl: z.string().url(),
                platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                accessLevel: z.enum(['FREE', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                requiredDiscordRoleIds: z.array(z.string()).openapi({ example: ['123456789012345678'] }),
                downloadCount: z.number().int().openapi({ example: 1250 }),
                publishedAt: z.string().datetime().nullable(),
                categories: z.array(
                  z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    slug: z.string(),
                  }),
                ),
                previewImages: z.array(
                  z.object({
                    id: z.string().uuid(),
                    url: z.string().url(),
                    altText: z.string().nullable(),
                    position: z.number().int(),
                  }),
                ),
              }),
            }),
          },
        },
      },
      404: {
        description: 'Không tìm thấy theme hoặc chưa phát hành',
      },
    },
  });

  // 3. POST /keyboards/{slug}/download (Authenticated download)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/keyboards/{slug}/download',
    tags: ['Keyboard Themes'],
    summary: 'Yêu cầu tải theme bàn phím (Yêu cầu đăng nhập, Discord Gated, Redirect 302 sang Google Drive)',
    description:
      'Xác thực tài khoản người dùng, kiểm tra điều kiện Discord Server Member / Role (nếu theme yêu cầu), ghi nhận lịch sử Download, tăng bộ đếm lượt tải và phản hồi HTTP 302 Found chuyển hướng tới Google Drive.',
    security: [{ BearerAuth: [] }],
    request: { params: keyboardSlugParamSchema },
    responses: {
      302: {
        description: 'Chuyển hướng thành công tới Google Drive URL (Header Location: https://drive.google.com/...)',
      },
      401: {
        description: 'Chưa đăng nhập hoặc token không hợp lệ',
      },
      403: {
        description: 'Tài khoản chưa thỏa mãn điều kiện tải (DISCORD_NOT_LINKED, DISCORD_GUILD_REQUIRED, hoặc DISCORD_ROLE_REQUIRED)',
      },
      404: {
        description: 'Theme không tồn tại hoặc chưa được phát hành',
      },
      429: {
        description: 'Vượt quá giới hạn tần suất tải file (Rate limit exceeded: 5 req/phút)',
      },
    },
  });

  // 4. GET /keyboards/manage (Management list)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/keyboards/manage',
    tags: ['Keyboard Themes'],
    summary: 'Danh sách theme cho quản trị viên (Yêu cầu quyền KEYBOARD_READ)',
    security: [{ BearerAuth: [] }],
    request: { query: keyboardManagementQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách quản trị thành công',
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
                  accessLevel: z.enum(['FREE', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                  requiredDiscordRoleIds: z.array(z.string()).openapi({ example: ['123456789012345678'] }),
                  downloadCount: z.number().int(),
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

  // 5. GET /keyboards/manage/{id} (Management detail)
  openapiRegistry.registerPath({
    method: 'get',
    path: '/keyboards/manage/{id}',
    tags: ['Keyboard Themes'],
    summary: 'Xem chi tiết theme cho quản trị viên (Yêu cầu quyền KEYBOARD_READ)',
    security: [{ BearerAuth: [] }],
    request: { params: keyboardIdParamSchema },
    responses: {
      200: {
        description: 'Lấy chi tiết quản trị thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                description: z.string().nullable(),
                coverUrl: z.string().url(),
                driveUrl: z.string().url(),
                platform: z.enum(['IOS', 'ANDROID', 'BOTH']),
                status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']),
                accessLevel: z.enum(['FREE', 'DISCORD_MEMBER', 'DISCORD_ROLE']),
                requiredDiscordRoleIds: z.array(z.string()).openapi({ example: ['123456789012345678'] }),
                downloadCount: z.number().int(),
                publishedAt: z.string().datetime().nullable(),
                categories: z.array(
                  z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    slug: z.string(),
                    isActive: z.boolean(),
                  }),
                ),
                previewImages: z.array(
                  z.object({
                    id: z.string().uuid(),
                    url: z.string().url(),
                    altText: z.string().nullable(),
                    position: z.number().int(),
                    createdAt: z.string().datetime(),
                  }),
                ),
                createdBy: z.string().uuid().nullable(),
                updatedBy: z.string().uuid().nullable(),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // 6. POST /keyboards (Create theme)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/keyboards',
    tags: ['Keyboard Themes'],
    summary: 'Tạo mới theme bàn phím (Yêu cầu quyền KEYBOARD_CREATE)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: createKeyboardSchema,
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

  // 7. PATCH /keyboards/{id} (Update theme)
  openapiRegistry.registerPath({
    method: 'patch',
    path: '/keyboards/{id}',
    tags: ['Keyboard Themes'],
    summary: 'Cập nhật theme bàn phím (Yêu cầu quyền KEYBOARD_UPDATE)',
    security: [{ BearerAuth: [] }],
    request: {
      params: keyboardIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: updateKeyboardSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật theme thành công',
      },
    },
  });

  // 8. DELETE /keyboards/{id} (Delete / Archive theme)
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/keyboards/{id}',
    tags: ['Keyboard Themes'],
    summary: 'Xóa hoặc Lưu trữ (Archive) theme (Yêu cầu quyền KEYBOARD_DELETE)',
    security: [{ BearerAuth: [] }],
    request: { params: keyboardIdParamSchema },
    responses: {
      200: {
        description: 'Xóa hoặc chuyển sang trạng thái HIDDEN thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
              archived: z.boolean().optional(),
            }),
          },
        },
      },
    },
  });

  // 9. POST /keyboards/manage/users/{userId}/reset-quota (Admin reset user quota)
  openapiRegistry.registerPath({
    method: 'post',
    path: '/keyboards/manage/users/{userId}/reset-quota',
    tags: ['Keyboard Themes'],
    summary: 'Reset hạn mức số lượt tải cho người dùng (Yêu cầu quyền KEYBOARD_UPDATE)',
    description: 'Cập nhật mốc reset tải về của người dùng và ghi nhận Audit Log.',
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({
        userId: z.string().uuid().openapi({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }),
      }),
    },
    responses: {
      200: {
        description: 'Reset hạn mức thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              userId: z.string().uuid(),
              resetAt: z.string().datetime(),
              message: z.string().openapi({ example: 'Đã reset hạn mức tải về của người dùng thành công' }),
            }),
          },
        },
      },
    },
  });
}
