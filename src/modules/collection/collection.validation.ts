import { z } from 'zod';
import { isPublicHttpUrl } from '../../common/helpers/url.helper';
import { slugRegex } from '../keyboard/keyboard.validation';

export const createCollectionSchema = z.object({
  name: z.string().min(3, 'Tên bộ sưu tập phải có tối thiểu 3 ký tự').max(100, 'Tên bộ sưu tập tối đa 100 ký tự').trim(),
  slug: z
    .string()
    .min(2, 'Slug phải có tối thiểu 2 ký tự')
    .max(100, 'Slug tối đa 100 ký tự')
    .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
    .optional(),
  description: z.string().max(1000, 'Mô tả tối đa 1000 ký tự').optional(),
  coverUrl: z
    .string()
    .url('URL ảnh cover không hợp lệ')
    .refine((url) => isPublicHttpUrl(url), {
      message: 'URL ảnh cover không an toàn hoặc không hợp lệ',
    })
    .optional(),
  isPublic: z.boolean().optional().default(true),
  themeIds: z.array(z.string().uuid('Theme ID phải là UUID hợp lệ')).optional().default([]),
});

export const updateCollectionSchema = z.object({
  name: z.string().min(3, 'Tên bộ sưu tập phải có tối thiểu 3 ký tự').max(100, 'Tên bộ sưu tập tối đa 100 ký tự').trim().optional(),
  slug: z
    .string()
    .min(2, 'Slug phải có tối thiểu 2 ký tự')
    .max(100, 'Slug tối đa 100 ký tự')
    .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
    .optional(),
  description: z.string().max(1000, 'Mô tả tối đa 1000 ký tự').optional().nullable(),
  coverUrl: z
    .string()
    .url('URL ảnh cover không hợp lệ')
    .refine((url) => isPublicHttpUrl(url), {
      message: 'URL ảnh cover không an toàn hoặc không hợp lệ',
    })
    .optional()
    .nullable(),
  isPublic: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const addCollectionThemeSchema = z.object({
  themeId: z.string().uuid('Theme ID phải là UUID hợp lệ'),
  position: z.number().int().min(0, 'Position phải là số nguyên không âm').optional(),
});

export const collectionIdParamSchema = z.object({
  id: z.string().uuid('Collection ID phải là UUID hợp lệ'),
});

export const collectionSlugParamSchema = z.object({
  slug: z.string().min(2).max(100).regex(slugRegex, 'Slug không đúng định dạng'),
});

export const collectionThemeParamSchema = z.object({
  id: z.string().uuid('Collection ID phải là UUID hợp lệ'),
  themeId: z.string().uuid('Theme ID phải là UUID hợp lệ'),
});

export const collectionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  isFeatured: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  creator: z.string().trim().optional(),
  sort: z.enum(['LATEST', 'FEATURED', 'NAME_ASC', 'NAME_DESC']).optional().default('LATEST'),
});
