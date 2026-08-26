import { z } from 'zod';

export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Tên danh mục phải có tối thiểu 2 ký tự').max(100, 'Tên danh mục tối đa 100 ký tự').trim(),
  slug: z
    .string()
    .min(2, 'Slug phải có tối thiểu 2 ký tự')
    .max(100, 'Slug tối đa 100 ký tự')
    .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
    .optional(),
  description: z.string().max(500, 'Mô tả tối đa 500 ký tự').trim().optional(),
  icon: z.string().max(100, 'Icon tối đa 100 ký tự').trim().optional(),
  color: z.string().max(50, 'Màu sắc tối đa 50 ký tự').trim().optional(),
  orderIndex: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2, 'Tên danh mục phải có tối thiểu 2 ký tự').max(100, 'Tên danh mục tối đa 100 ký tự').trim().optional(),
  slug: z
    .string()
    .min(2, 'Slug phải có tối thiểu 2 ký tự')
    .max(100, 'Slug tối đa 100 ký tự')
    .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
    .optional(),
  description: z.string().max(500, 'Mô tả tối đa 500 ký tự').trim().optional(),
  icon: z.string().max(100, 'Icon tối đa 100 ký tự').trim().optional(),
  color: z.string().max(50, 'Màu sắc tối đa 50 ký tự').trim().optional(),
  orderIndex: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const categoryIdParamSchema = z.object({
  id: z.string().uuid('ID danh mục phải là UUID hợp lệ'),
});

export const categoryQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
