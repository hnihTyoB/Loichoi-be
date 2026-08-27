import { z } from 'zod';

export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const createColorSchema = z.object({
  name: z.string().min(2, 'Tên màu phải có tối thiểu 2 ký tự').max(50, 'Tên màu tối đa 50 ký tự').trim(),
  slug: z
    .string()
    .min(2, 'Slug phải có tối thiểu 2 ký tự')
    .max(50, 'Slug tối đa 50 ký tự')
    .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
    .optional(),
  hex: z
    .string()
    .trim()
    .regex(hexColorRegex, 'Mã màu hex không đúng định dạng (Ví dụ: #FFB7C5, #FFF)'),
});

export const updateColorSchema = z.object({
  name: z.string().min(2, 'Tên màu phải có tối thiểu 2 ký tự').max(50, 'Tên màu tối đa 50 ký tự').trim().optional(),
  slug: z
    .string()
    .min(2, 'Slug phải có tối thiểu 2 ký tự')
    .max(50, 'Slug tối đa 50 ký tự')
    .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
    .optional(),
  hex: z
    .string()
    .trim()
    .regex(hexColorRegex, 'Mã màu hex không đúng định dạng (Ví dụ: #FFB7C5, #FFF)')
    .optional(),
});

export const colorIdParamSchema = z.object({
  id: z.string().uuid('ID màu phải là UUID hợp lệ'),
});

export const colorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});
