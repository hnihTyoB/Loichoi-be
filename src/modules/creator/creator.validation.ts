import { z } from 'zod';

export const usernameParamSchema = z.object({
  username: z
    .string()
    .min(2, 'Username phải có tối thiểu 2 ký tự')
    .max(50, 'Username tối đa 50 ký tự')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username chỉ được chứa chữ cái, số, dấu gạch dưới, gạch ngang và dấu chấm'),
});

export const creatorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  isFeatured: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sort: z
    .enum(['TOP_FOLLOWERS', 'TOP_DOWNLOADS', 'TOP_THEMES', 'NAME_ASC', 'NAME_DESC', 'LATEST'])
    .optional()
    .default('TOP_FOLLOWERS'),
});
