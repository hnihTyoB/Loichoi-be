import { z } from 'zod';
import { isPublicHttpUrl } from '../../common/helpers/url.helper';
import { isGoogleDriveUrl } from '../../common/constants/keyboard.constant';
import { slugRegex, previewImageItemSchema } from '../keyboard/keyboard.validation';

export const studioUpdateProfileSchema = z.object({
  username: z
    .string()
    .min(2, 'Username phải có tối thiểu 2 ký tự')
    .max(50, 'Username tối đa 50 ký tự')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username chỉ được chứa chữ cái, số, dấu gạch dưới, gạch ngang và dấu chấm')
    .optional(),
  fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự').max(100, 'Họ tên tối đa 100 ký tự').trim().optional(),
  bio: z.string().max(1000, 'Bio tối đa 1000 ký tự').optional().nullable(),
  avatarUrl: z
    .string()
    .url('URL ảnh đại diện không hợp lệ')
    .refine((url) => isPublicHttpUrl(url), {
      message: 'URL ảnh đại diện không an toàn hoặc không hợp lệ',
    })
    .optional()
    .nullable(),
  bannerUrl: z
    .string()
    .url('URL ảnh banner không hợp lệ')
    .refine((url) => isPublicHttpUrl(url), {
      message: 'URL ảnh banner không an toàn hoặc không hợp lệ',
    })
    .optional()
    .nullable(),
  socialLinks: z.record(z.string().url('Link mạng xã hội không hợp lệ')).optional().nullable(),
});

export const studioApplySchema = z.object({
  username: z
    .string()
    .min(2, 'Username phải có tối thiểu 2 ký tự')
    .max(50, 'Username tối đa 50 ký tự')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username chỉ được chứa chữ cái, số, dấu gạch dưới, gạch ngang và dấu chấm'),
  bio: z.string().max(1000, 'Bio tối đa 1000 ký tự').optional(),
  socialLinks: z.record(z.string().url('Link mạng xã hội không hợp lệ')).optional(),
});

export const studioThemeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).optional(),
  categoryId: z.string().uuid().optional(),
  sort: z.string().optional().default('createdAt_desc'),
});

export const studioCreateThemeSchema = z
  .object({
    name: z.string().min(3, 'Tên theme phải có tối thiểu 3 ký tự').max(150, 'Tên theme tối đa 150 ký tự').trim(),
    slug: z
      .string()
      .min(2, 'Slug phải có tối thiểu 2 ký tự')
      .max(100, 'Slug tối đa 100 ký tự')
      .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
      .optional(),
    description: z.string().max(2000, 'Mô tả tối đa 2000 ký tự').optional(),
    coverUrl: z
      .string()
      .url('URL ảnh cover không hợp lệ')
      .refine((url) => isPublicHttpUrl(url), {
        message: 'URL ảnh cover không an toàn hoặc không hợp lệ',
      }),
    driveUrl: z
      .string()
      .url('URL Google Drive không hợp lệ')
      .refine((url) => isGoogleDriveUrl(url), {
        message: 'URL tải file phải là đường dẫn Google Drive hợp lệ (drive.google.com / docs.google.com)',
      }),
    platform: z.enum(['IOS', 'ANDROID', 'BOTH'], {
      errorMap: () => ({ message: 'Nền tảng phải là IOS, ANDROID hoặc BOTH' }),
    }),
    status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).optional().default('DRAFT'),
    accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']).optional().default('FREE'),
    requiredDiscordRoleIds: z.array(z.string().trim().min(1, 'Role ID không được rỗng')).optional().default([]),
    categoryIds: z.array(z.string().uuid('Category ID phải là UUID hợp lệ')),
    previewImages: z.array(previewImageItemSchema).max(10, 'Tối đa 10 ảnh xem trước').optional().default([]),
  })
  .refine(
    (data) => {
      if (data.status === 'PUBLISHED' && (!data.categoryIds || data.categoryIds.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Theme ở trạng thái PUBLISHED bắt buộc phải có ít nhất 1 danh mục',
      path: ['categoryIds'],
    },
  )
  .refine(
    (data) => {
      if (data.accessLevel === 'DISCORD_ROLE' && (!data.requiredDiscordRoleIds || data.requiredDiscordRoleIds.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Theme có cấp độ DISCORD_ROLE bắt buộc phải cung cấp ít nhất 1 ID Role của Discord Server',
      path: ['requiredDiscordRoleIds'],
    },
  );

export const studioUpdateThemeSchema = z
  .object({
    name: z.string().min(3, 'Tên theme phải có tối thiểu 3 ký tự').max(150, 'Tên theme tối đa 150 ký tự').trim().optional(),
    slug: z
      .string()
      .min(2, 'Slug phải có tối thiểu 2 ký tự')
      .max(100, 'Slug tối đa 100 ký tự')
      .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
      .optional(),
    description: z.string().max(2000, 'Mô tả tối đa 2000 ký tự').optional().nullable(),
    coverUrl: z
      .string()
      .url('URL ảnh cover không hợp lệ')
      .refine((url) => isPublicHttpUrl(url), {
        message: 'URL ảnh cover không an toàn hoặc không hợp lệ',
      })
      .optional(),
    driveUrl: z
      .string()
      .url('URL Google Drive không hợp lệ')
      .refine((url) => isGoogleDriveUrl(url), {
        message: 'URL tải file phải là đường dẫn Google Drive hợp lệ (drive.google.com / docs.google.com)',
      })
      .optional(),
    platform: z.enum(['IOS', 'ANDROID', 'BOTH']).optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).optional(),
    accessLevel: z.enum(['FREE', 'PREMIUM', 'DISCORD_MEMBER', 'DISCORD_ROLE']).optional(),
    requiredDiscordRoleIds: z.array(z.string().trim().min(1, 'Role ID không được rỗng')).optional(),
    categoryIds: z.array(z.string().uuid('Category ID phải là UUID hợp lệ')).optional(),
    previewImages: z.array(previewImageItemSchema).max(10, 'Tối đa 10 ảnh xem trước').optional(),
  })
  .refine(
    (data) => {
      if (data.status === 'PUBLISHED' && data.categoryIds !== undefined && data.categoryIds.length === 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Theme ở trạng thái PUBLISHED không được để trống danh mục',
      path: ['categoryIds'],
    },
  )
  .refine(
    (data) => {
      if (data.accessLevel === 'DISCORD_ROLE' && (!data.requiredDiscordRoleIds || data.requiredDiscordRoleIds.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Theme có cấp độ DISCORD_ROLE bắt buộc phải cung cấp ít nhất 1 ID Role của Discord Server',
      path: ['requiredDiscordRoleIds'],
    },
  );
