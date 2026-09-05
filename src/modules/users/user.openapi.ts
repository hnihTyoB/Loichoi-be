import { openapiRegistry } from '../../config/openapi/openapi.registry';
import {
  findAllUserSchema,
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  userSessionParamsSchema,
  userDeviceParamsSchema,
} from './user.validation';
import { z } from 'zod';

export function registerUserOpenApi(): void {
  openapiRegistry.register('CreateUserRequest', createUserSchema);
  openapiRegistry.register('UpdateUserRequest', updateUserSchema);

  // GET /users
  openapiRegistry.registerPath({
    method: 'get',
    path: '/users',
    tags: ['Users'],
    summary: 'Danh sách người dùng (Phân trang, tìm kiếm & lọc)',
    security: [{ BearerAuth: [] }],
    request: {
      query: findAllUserSchema,
    },
    responses: {
      200: {
        description: 'Lấy danh sách thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  email: z.string().email(),
                  fullName: z.string().nullable(),
                  phoneNumber: z.string().nullable(),
                  avatarUrl: z.string().nullable(),
                  isActive: z.boolean(),
                  isEmailVerified: z.boolean(),
                  role: z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    description: z.string().nullable(),
                  }),
                  createdAt: z.string().datetime(),
                }),
              ),
              meta: z.object({
                total: z.number(),
                page: z.number(),
                limit: z.number(),
                totalPages: z.number(),
              }),
            }),
          },
        },
      },
      403: { description: 'Không có quyền USER_READ' },
    },
  });

  // GET /users/:id
  openapiRegistry.registerPath({
    method: 'get',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Chi tiết thông tin người dùng theo ID',
    security: [{ BearerAuth: [] }],
    request: {
      params: userIdParamSchema,
    },
    responses: {
      200: {
        description: 'Lấy chi tiết thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                phoneNumber: z.string().nullable(),
                avatarUrl: z.string().nullable(),
                isActive: z.boolean(),
                isEmailVerified: z.boolean(),
                role: z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  description: z.string().nullable(),
                }),
                createdAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy người dùng' },
    },
  });

  // POST /users
  openapiRegistry.registerPath({
    method: 'post',
    path: '/users',
    tags: ['Users'],
    summary: 'Tạo tài khoản người dùng mới (Dành cho Quản trị viên)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: createUserSchema },
        },
      },
    },
    responses: {
      201: {
        description: 'Tạo người dùng thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                roleId: z.string().uuid(),
                isActive: z.boolean(),
              }),
            }),
          },
        },
      },
      400: { description: 'Dữ liệu không hợp lệ hoặc Email đã tồn tại' },
    },
  });

  // PUT /users/:id
  openapiRegistry.registerPath({
    method: 'put',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Cập nhật thông tin người dùng theo ID',
    security: [{ BearerAuth: [] }],
    request: {
      params: userIdParamSchema,
      body: {
        content: {
          'application/json': { schema: updateUserSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                phoneNumber: z.string().nullable(),
                avatarUrl: z.string().nullable(),
                isActive: z.boolean(),
              }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy người dùng' },
    },
  });

  // DELETE /users/:id
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Xóa mềm người dùng (Soft delete & vô hiệu hóa phiên đăng nhập)',
    security: [{ BearerAuth: [] }],
    request: {
      params: userIdParamSchema,
    },
    responses: {
      200: {
        description: 'Xóa người dùng thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Xóa người dùng thành công' }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy người dùng' },
    },
  });

  // GET /users/:id/sessions
  openapiRegistry.registerPath({
    method: 'get',
    path: '/users/{id}/sessions',
    tags: ['Users'],
    summary: 'Danh sách các phiên đăng nhập của người dùng (Quản trị viên)',
    security: [{ BearerAuth: [] }],
    request: { params: userIdParamSchema },
    responses: {
      200: {
        description: 'Lấy danh sách phiên đăng nhập thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  userId: z.string().uuid(),
                  ipAddress: z.string().nullable(),
                  userAgent: z.string().nullable(),
                  isRevoked: z.boolean(),
                  expiresAt: z.string().datetime(),
                  createdAt: z.string().datetime(),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // DELETE /users/:id/sessions/:sessionId
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/users/{id}/sessions/{sessionId}',
    tags: ['Users'],
    summary: 'Hủy một phiên đăng nhập cụ thể của người dùng (Quản trị viên)',
    security: [{ BearerAuth: [] }],
    request: { params: userSessionParamsSchema },
    responses: {
      200: {
        description: 'Thu hồi phiên đăng nhập thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã thu hồi phiên đăng nhập' }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy phiên đăng nhập' },
    },
  });

  // DELETE /users/:id/sessions
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/users/{id}/sessions',
    tags: ['Users'],
    summary: 'Thu hồi toàn bộ phiên đăng nhập của người dùng (Quản trị viên)',
    security: [{ BearerAuth: [] }],
    request: { params: userIdParamSchema },
    responses: {
      200: {
        description: 'Thu hồi tất cả phiên đăng nhập thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã thu hồi tất cả phiên đăng nhập của người dùng' }),
            }),
          },
        },
      },
    },
  });

  // GET /users/:id/devices
  openapiRegistry.registerPath({
    method: 'get',
    path: '/users/{id}/devices',
    tags: ['Users'],
    summary: 'Danh sách thiết bị đăng nhập của người dùng (Quản trị viên)',
    security: [{ BearerAuth: [] }],
    request: { params: userIdParamSchema },
    responses: {
      200: {
        description: 'Lấy danh sách thiết bị thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  deviceId: z.string(),
                  deviceName: z.string().nullable(),
                  deviceType: z.string().nullable(),
                  os: z.string().nullable(),
                  browser: z.string().nullable(),
                  ipAddress: z.string().nullable(),
                  lastActiveAt: z.string().datetime(),
                  createdAt: z.string().datetime(),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // DELETE /users/:id/devices/:deviceId
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/users/{id}/devices/{deviceId}',
    tags: ['Users'],
    summary: 'Xóa thiết bị đăng nhập của người dùng (Quản trị viên)',
    security: [{ BearerAuth: [] }],
    request: { params: userDeviceParamsSchema },
    responses: {
      200: {
        description: 'Xóa thiết bị thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã xóa thiết bị của người dùng' }),
            }),
          },
        },
      },
      404: { description: 'Thiết bị không tồn tại' },
    },
  });
}
