import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// ──────────────────────────────────────────────
// Sub-schemas
// ──────────────────────────────────────────────

const DiscordAttachmentSchema = z
  .object({
    filename: z.string(),
    url: z.string(),
    contentType: z.string().nullable().optional(),
    size: z.number().int().nonnegative().nullable().optional(),
    width: z.number().int().nonnegative().nullable().optional(),
    height: z.number().int().nonnegative().nullable().optional(),
    messageId: z.string(),
  })
  .openapi('DiscordAttachment');

const DiscordMessageSchema = z
  .object({
    messageId: z.string(),
    author: z.string().default('Unknown'),
    content: z.string().default(''),
    timestamp: z.string().default(() => new Date().toISOString()),
    attachments: z.array(DiscordAttachmentSchema).default([]),
    embeds: z.array(z.unknown()).default([]),
  })
  .openapi('DiscordMessage');

// ──────────────────────────────────────────────
// POST /imports — Create Import Job
// ──────────────────────────────────────────────

export const CreateImportJobSchema = z
  .object({
    discordThreadId: z.string().min(1, 'discordThreadId is required'),
    discordChannelId: z.string().nullable().optional(),
    discordGuildId: z.string().nullable().optional(),
    originalName: z.string().min(1, 'originalName is required'),
    discordReferenceNumber: z.number().int().positive().nullable().optional(),
    createdAtDiscord: z.string().nullable().optional(),
    messages: z.array(DiscordMessageSchema).min(1, 'At least one message is required'),
  })
  .openapi('CreateImportJobBody');

export type CreateImportJobBody = z.infer<typeof CreateImportJobSchema>;

// ──────────────────────────────────────────────
// GET /imports — List with filters
// ──────────────────────────────────────────────

export const ListImportJobsQuerySchema = z
  .object({
    status: z
      .enum(['DISCOVERED', 'PROCESSING', 'NEEDS_REVIEW', 'APPROVED', 'IMPORTED', 'FAILED', 'DUPLICATE', 'SKIPPED'])
      .optional(),
    validationStatus: z.enum(['PENDING', 'VALID', 'INVALID']).optional(),
    isDuplicateCandidate: z
      .string()
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    minConfidence: z
      .string()
      .optional()
      .transform((v) => (v ? parseFloat(v) : undefined))
      .pipe(z.number().min(0).max(1).optional()),
    hasFlags: z
      .string()
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    page: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 1))
      .pipe(z.number().int().positive().default(1)),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 20))
      .pipe(z.number().int().positive().max(100).default(20)),
  })
  .openapi('ListImportJobsQuery');

export type ListImportJobsQuery = z.infer<typeof ListImportJobsQuerySchema>;

// ──────────────────────────────────────────────
// PATCH /imports/:id/draft — Update Draft
// ──────────────────────────────────────────────

export const UpdateDraftSchema = z
  .object({
    englishName: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional(),
    platform: z.enum(['IOS', 'ANDROID', 'BOTH']).optional(),
    downloadSource: z.enum(['GOOGLE_DRIVE', 'DISCORD_ATTACHMENT']).optional(),
    downloadUrl: z.string().url().optional(),
    suggestedCategoryIds: z.array(z.string().uuid()).max(3).optional(),
    suggestedColorIds: z.array(z.string().uuid()).max(3).optional(),
    suggestedStyleIds: z.array(z.string().uuid()).max(3).optional(),
    adminNotes: z.string().max(1000).optional(),
  })
  .openapi('UpdateDraftBody');

export type UpdateDraftBody = z.infer<typeof UpdateDraftSchema>;

// ──────────────────────────────────────────────
// POST /imports/:id/reject — Reject
// ──────────────────────────────────────────────

export const RejectImportSchema = z
  .object({
    reason: z.string().min(1).max(500).optional(),
  })
  .openapi('RejectImportBody');

export type RejectImportBody = z.infer<typeof RejectImportSchema>;

// ──────────────────────────────────────────────
// POST /imports/bulk-approve — Bulk Approve
// ──────────────────────────────────────────────

export const BulkApproveSchema = z
  .object({
    jobIds: z.array(z.string().uuid()).min(1).max(50),
  })
  .openapi('BulkApproveBody');

export type BulkApproveBody = z.infer<typeof BulkApproveSchema>;

// ──────────────────────────────────────────────
// Route param schema
// ──────────────────────────────────────────────

export const ImportJobIdParamSchema = z.object({
  id: z.string().uuid(),
});
