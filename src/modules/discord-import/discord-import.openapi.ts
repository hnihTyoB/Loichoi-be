import { openapiRegistry, PaginationMetaSchema } from '../../config/openapi/openapi.registry';
import {
  CreateImportJobSchema,
  ListImportJobsQuerySchema,
  UpdateDraftSchema,
  BulkApproveSchema,
  RejectImportSchema,
  ImportJobIdParamSchema,
} from './discord-import.validation';
import { z } from 'zod';

export function registerDiscordImportOpenApi(): void {
  openapiRegistry.register('CreateImportJobRequest', CreateImportJobSchema);
  openapiRegistry.register('UpdateDraftRequest', UpdateDraftSchema);
  openapiRegistry.register('BulkApproveRequest', BulkApproveSchema);
  openapiRegistry.register('RejectImportRequest', RejectImportSchema);

  // 1. POST /imports
  openapiRegistry.registerPath({
    method: 'post',
    path: '/imports',
    tags: ['Discord Imports'],
    summary: 'Nhận raw thread data từ Discord Bot hoặc manual import (Yêu cầu IMPORT_MANAGE)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: CreateImportJobSchema },
        },
      },
    },
    responses: {
      201: {
        description: 'Tạo Import Job mới và hoàn tất normalization/parsing thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                importJobId: z.string().uuid(),
                isNew: z.boolean().openapi({ example: true }),
              }),
            }),
          },
        },
      },
      200: {
        description: 'Import Job đã tồn tại (idempotent)',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                importJobId: z.string().uuid(),
                isNew: z.boolean().openapi({ example: false }),
              }),
            }),
          },
        },
      },
    },
  });

  // 2. GET /imports
  openapiRegistry.registerPath({
    method: 'get',
    path: '/imports',
    tags: ['Discord Imports'],
    summary: 'Danh sách Import Jobs với bộ lọc nâng cao (Yêu cầu IMPORT_READ)',
    security: [{ BearerAuth: [] }],
    request: { query: ListImportJobsQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách import jobs thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  status: z.string().openapi({ example: 'NEEDS_REVIEW' }),
                  phase: z.string().openapi({ example: 'DRAFT' }),
                  retryCount: z.number().int().openapi({ example: 0 }),
                  lastError: z.string().nullable(),
                  processedAt: z.string().nullable(),
                  createdAt: z.string().datetime(),
                  updatedAt: z.string().datetime(),
                  thread: z.object({
                    id: z.string().uuid(),
                    discordThreadId: z.string().openapi({ example: '123456789' }),
                    discordReferenceNumber: z.number().int().nullable().openapi({ example: 2378 }),
                    originalName: z.string().openapi({ example: '某某键盘' }),
                  }),
                  draft: z
                    .object({
                      id: z.string().uuid(),
                      englishName: z.string().nullable().openapi({ example: 'Sakura Dream Keyboard' }),
                      platform: z.string().nullable().openapi({ example: 'BOTH' }),
                      downloadSource: z.string().nullable().openapi({ example: 'GOOGLE_DRIVE' }),
                      coverUrl: z.string().nullable(),
                      previewUrls: z.array(z.string()),
                      isDuplicateCandidate: z.boolean().openapi({ example: false }),
                      duplicateReason: z.string().nullable(),
                      validationStatus: z.string().openapi({ example: 'PENDING' }),
                      flags: z.array(z.string()).nullable(),
                      suggestedCategoryIds: z.array(z.string()),
                      suggestedColorIds: z.array(z.string()),
                      suggestedStyleIds: z.array(z.string()),
                    })
                    .nullable(),
                }),
              ),
              total: z.number().int().openapi({ example: 100 }),
              page: z.number().int().openapi({ example: 1 }),
              limit: z.number().int().openapi({ example: 20 }),
              totalPages: z.number().int().openapi({ example: 5 }),
            }),
          },
        },
      },
    },
  });

  // 3. POST /imports/bulk-approve
  openapiRegistry.registerPath({
    method: 'post',
    path: '/imports/bulk-approve',
    tags: ['Discord Imports'],
    summary: 'Duyệt hàng loạt nhiều Import Jobs đủ điều kiện (Yêu cầu IMPORT_APPROVE)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: BulkApproveSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Kết quả duyệt hàng loạt',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                succeeded: z.array(
                  z.object({
                    importJobId: z.string().uuid(),
                    keyboardThemeId: z.string().uuid(),
                    slug: z.string().openapi({ example: 'sakura-dream-keyboard' }),
                  }),
                ),
                failed: z.array(
                  z.object({
                    importJobId: z.string().uuid(),
                    reason: z.string().openapi({ example: 'Missing cover image' }),
                  }),
                ),
              }),
            }),
          },
        },
      },
    },
  });

  // 4. GET /imports/{id}
  openapiRegistry.registerPath({
    method: 'get',
    path: '/imports/{id}',
    tags: ['Discord Imports'],
    summary: 'Chi tiết Import Job & Keyboard Draft (Yêu cầu IMPORT_READ)',
    security: [{ BearerAuth: [] }],
    request: { params: ImportJobIdParamSchema },
    responses: {
      200: {
        description: 'Lấy chi tiết thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                status: z.string(),
                phase: z.string(),
                retryCount: z.number().int(),
                lastError: z.string().nullable(),
                processedAt: z.string().nullable(),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
                thread: z.object({
                  id: z.string().uuid(),
                  discordThreadId: z.string(),
                  discordReferenceNumber: z.number().int().nullable(),
                  originalName: z.string(),
                }),
                draft: z
                  .object({
                    id: z.string().uuid(),
                    englishName: z.string().nullable(),
                    description: z.string().nullable(),
                    platform: z.string().nullable(),
                    downloadSource: z.string().nullable(),
                    downloadUrl: z.string().nullable(),
                    downloadDiscordMsgId: z.string().nullable(),
                    downloadFileName: z.string().nullable(),
                    coverUrl: z.string().nullable(),
                    previewUrls: z.array(z.string()),
                    isDuplicateCandidate: z.boolean(),
                    duplicateOfId: z.string().nullable(),
                    duplicateReason: z.string().nullable(),
                    flags: z.array(z.string()).nullable(),
                    validationStatus: z.string(),
                    adminNotes: z.string().nullable(),
                    reviewedBy: z.string().nullable(),
                    reviewedAt: z.string().nullable(),
                    keyboardThemeId: z.string().nullable(),
                    confidenceName: z.number().nullable(),
                    confidenceCategory: z.number().nullable(),
                    confidenceColor: z.number().nullable(),
                    confidenceStyle: z.number().nullable(),
                    confidenceDescription: z.number().nullable(),
                    suggestedCategoryIds: z.array(z.string()),
                    suggestedColorIds: z.array(z.string()),
                    suggestedStyleIds: z.array(z.string()),
                  })
                  .nullable(),
              }),
            }),
          },
        },
      },
    },
  });

  // 5. PATCH /imports/{id}/draft
  openapiRegistry.registerPath({
    method: 'patch',
    path: '/imports/{id}/draft',
    tags: ['Discord Imports'],
    summary: 'Chỉnh sửa Keyboard Draft trước khi duyệt (Yêu cầu IMPORT_MANAGE)',
    security: [{ BearerAuth: [] }],
    request: {
      params: ImportJobIdParamSchema,
      body: {
        content: {
          'application/json': { schema: UpdateDraftSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật draft thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // 6. POST /imports/{id}/approve
  openapiRegistry.registerPath({
    method: 'post',
    path: '/imports/{id}/approve',
    tags: ['Discord Imports'],
    summary: 'Duyệt đơn lẻ Import Job và tạo Keyboard Theme mới (Yêu cầu IMPORT_APPROVE)',
    security: [{ BearerAuth: [] }],
    request: { params: ImportJobIdParamSchema },
    responses: {
      200: {
        description: 'Duyệt thành công và tạo bàn phím',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                importJobId: z.string().uuid(),
                keyboardThemeId: z.string().uuid(),
                slug: z.string().openapi({ example: 'sakura-dream-keyboard' }),
              }),
            }),
          },
        },
      },
    },
  });

  // 7. POST /imports/{id}/reject
  openapiRegistry.registerPath({
    method: 'post',
    path: '/imports/{id}/reject',
    tags: ['Discord Imports'],
    summary: 'Từ chối Import Job (Yêu cầu IMPORT_MANAGE)',
    security: [{ BearerAuth: [] }],
    request: {
      params: ImportJobIdParamSchema,
      body: {
        content: {
          'application/json': { schema: RejectImportSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Từ chối thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Import job rejected successfully' }),
            }),
          },
        },
      },
    },
  });

  // 8. POST /imports/{id}/reprocess
  openapiRegistry.registerPath({
    method: 'post',
    path: '/imports/{id}/reprocess',
    tags: ['Discord Imports'],
    summary: 'Chạy lại parser & phân tích cho Import Job (Yêu cầu IMPORT_MANAGE)',
    security: [{ BearerAuth: [] }],
    request: { params: ImportJobIdParamSchema },
    responses: {
      200: {
        description: 'Yêu cầu xử lý lại thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Import job queued for reprocessing' }),
            }),
          },
        },
      },
    },
  });
}
