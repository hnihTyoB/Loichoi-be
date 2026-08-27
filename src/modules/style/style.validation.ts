import { z } from 'zod';

export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createStyleSchema = z.object({
  name: z.string().min(2, 'Tên phong cách phải có tối thiểu 2 ký tự').max(50, 'Tên phong cách tối đa 50 ký tự').trim(),
  slug: z
    .string()
    .min(2, 'Slug phải có tối thiểu 2 ký tự')
    .max(50, 'Slug tối đa 50 ký tự')
    .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
    .optional(),
  description: z.string().max(500, 'Mô tả tối đa 500 ký tự').optional(),
});

export const updateStyleSchema = z.object({
  name: z.string().min(2, 'Tên phong cách phải có tối thiểu 2 ký tự').max(50, 'Tên phong cách tối đa 50 ký tự').trim().optional(),
  slug: z
    .string()
    .min(2, 'Slug phải có tối thiểu 2 ký tự')
    .max(50, 'Slug tối đa 50 ký tự')
    .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
    .optional(),
  description: z.string().max(500, 'Mô tả tối đa 500 ký tự').optional().nullable(),
});

export const styleIdParamSchema = z.object({
  id: z.string().uuid('ID phong cách phải là UUID hợp lệ'),
});

export const styleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});
