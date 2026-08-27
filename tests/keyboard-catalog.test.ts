import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
} from '../src/modules/category/category.validation';
import {
  createKeyboardSchema,
  updateKeyboardSchema,
  keyboardPublicQuerySchema,
} from '../src/modules/keyboard/keyboard.validation';
import { toSlug } from '../src/common/helpers/slug.helper';
import {
  isDiscordUrl,
  isGoogleDriveUrl,
  isThemeDownloadUrl,
} from '../src/common/constants/keyboard.constant';
import { CategoryService } from '../src/modules/category/category.service';
import { KeyboardService } from '../src/modules/keyboard/keyboard.service';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';

describe('Category & Keyboard Validation Schemas', () => {
  it('should normalize slug with Vietnamese unaccent and kebab-case', () => {
    assert.equal(toSlug('Giao diện Bàn phím Hoa Anh Đào'), 'giao-dien-ban-phim-hoa-anh-dao');
    assert.equal(toSlug('Cyberpunk Neon 2077! @#$'), 'cyberpunk-neon-2077');
    assert.equal(toSlug('   Pastel   Pink---Theme   '), 'pastel-pink-theme');
  });

  it('should validate Google Drive URLs correctly', () => {
    assert.equal(isGoogleDriveUrl('https://drive.google.com/file/d/12345/view'), true);
    assert.equal(isGoogleDriveUrl('https://docs.google.com/uc?id=12345&export=download'), true);
    assert.equal(isGoogleDriveUrl('https://malicious-site.com/file.zip'), false);
    assert.equal(isGoogleDriveUrl('not-a-url'), false);
  });

  it('should validate Discord download URLs without accepting spoofed domains', () => {
    assert.equal(isDiscordUrl('https://discord.com/channels/123/456/789'), true);
    assert.equal(isDiscordUrl('https://cdn.discordapp.com/attachments/123/456/theme.zip'), true);
    assert.equal(isDiscordUrl('https://discord.gg/keyboard-themes'), true);
    assert.equal(isDiscordUrl('http://discord.com/channels/123/456'), false);
    assert.equal(isDiscordUrl('https://discord.com.evil.example/channels/123/456'), false);
    assert.equal(isDiscordUrl('https://discord.com@evil.example/channels/123/456'), false);
    assert.equal(isThemeDownloadUrl('https://docs.google.com/uc?id=12345&export=download'), true);
    assert.equal(isThemeDownloadUrl('https://discord.com/channels/123/456/789'), true);
    assert.equal(isThemeDownloadUrl('https://example.com/theme.zip'), false);
  });

  it('should validate createCategorySchema', () => {
    const valid = createCategorySchema.parse({
      name: 'Anime & Manga',
      slug: 'anime-manga',
      isActive: true,
    });
    assert.equal(valid.name, 'Anime & Manga');
    assert.equal(valid.slug, 'anime-manga');

    assert.throws(() => {
      createCategorySchema.parse({ name: 'A' }); // Min 2 chars
    });
  });

  it('should validate createKeyboardSchema and require categories for PUBLISHED status', () => {
    const validDraft = {
      name: 'Sakura Night',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      status: 'DRAFT',
      categoryIds: [],
    };
    const parsedDraft = createKeyboardSchema.parse(validDraft);
    assert.equal(parsedDraft.name, 'Sakura Night');

    const parsedDiscordDraft = createKeyboardSchema.parse({
      ...validDraft,
      driveUrl: 'https://discord.com/channels/123/456/789',
    });
    assert.equal(parsedDiscordDraft.driveUrl, 'https://discord.com/channels/123/456/789');

    const publishedWithoutCategory = {
      name: 'Sakura Night',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      status: 'PUBLISHED',
      categoryIds: [],
    };
    assert.throws(() => {
      createKeyboardSchema.parse(publishedWithoutCategory);
    }, /Theme ở trạng thái PUBLISHED bắt buộc phải có ít nhất 1 danh mục/);
  });

  it('should validate keyboardPublicQuerySchema defaults and platform filters', () => {
    const defaultQuery = keyboardPublicQuerySchema.parse({});
    assert.equal(defaultQuery.page, 1);
    assert.equal(defaultQuery.limit, 20);
    assert.equal(defaultQuery.sort, 'LATEST');

    const customQuery = keyboardPublicQuerySchema.parse({
      page: '2',
      limit: '50',
      platform: 'IOS',
      sort: 'POPULAR',
      search: 'anime',
    });
    assert.equal(customQuery.page, 2);
    assert.equal(customQuery.limit, 50);
    assert.equal(customQuery.platform, 'IOS');
    assert.equal(customQuery.sort, 'POPULAR');
  });
});

describe('Category Service Logic', () => {
  let categoriesDb: Map<string, any>;
  let themeCategoriesDb: Array<{ categoryId: string; keyboardThemeId: string }>;
  let mockCategoryRepo: any;
  let service: CategoryService;

  beforeEach(() => {
    categoriesDb = new Map();
    themeCategoriesDb = [];

    mockCategoryRepo = {
      findPublicCategories: async () => {
        return Array.from(categoriesDb.values())
          .filter((c) => c.isActive)
          .map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            themeCount: themeCategoriesDb.filter((tc) => tc.categoryId === c.id).length,
          }));
      },
      findAll: async (query: any) => {
        let list = Array.from(categoriesDb.values());
        if (query.search) {
          list = list.filter((c) => c.name.toLowerCase().includes(query.search.toLowerCase()));
        }
        if (query.isActive !== undefined) {
          list = list.filter((c) => c.isActive === query.isActive);
        }
        return { data: list, meta: { total: list.length, page: 1, limit: 20, totalPages: 1 } };
      },
      findById: async (id: string) => categoriesDb.get(id) || null,
      findBySlug: async (slug: string) => {
        return Array.from(categoriesDb.values()).find((c) => c.slug === slug) || null;
      },
      findActiveByIds: async (ids: string[]) => {
        return Array.from(categoriesDb.values()).filter((c) => ids.includes(c.id) && c.isActive);
      },
      create: async (data: any) => {
        const record = { id: 'cat-' + (categoriesDb.size + 1), ...data, createdAt: new Date(), updatedAt: new Date() };
        categoriesDb.set(record.id, record);
        return record;
      },
      update: async (id: string, data: any) => {
        const existing = categoriesDb.get(id);
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        categoriesDb.set(id, updated);
        return updated;
      },
      delete: async (id: string) => {
        categoriesDb.delete(id);
      },
      countThemesByCategory: async (categoryId: string) => {
        return themeCategoriesDb.filter((tc) => tc.categoryId === categoryId).length;
      },
      createAuditLog: async () => {},
    };

    service = new CategoryService();
    (service as any).repository = mockCategoryRepo;
  });

  it('should create a new category and prevent duplicate slugs', async () => {
    const created = await service.create({ name: 'Pastel Aesthetic' });
    assert.equal(created.name, 'Pastel Aesthetic');
    assert.equal(created.slug, 'pastel-aesthetic');

    await assert.rejects(
      async () => service.create({ name: 'Pastel Aesthetic' }),
      (err: AppError) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, ERROR_CODE.CATEGORY_SLUG_EXISTS);
        return true;
      },
    );
  });

  it('should reject deleting category if themes are linked (CATEGORY_IN_USE)', async () => {
    const cat = await service.create({ name: 'Cyberpunk' });
    themeCategoriesDb.push({ categoryId: cat.id, keyboardThemeId: 'theme-123' });

    await assert.rejects(
      async () => service.delete(cat.id),
      (err: AppError) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, ERROR_CODE.CATEGORY_IN_USE);
        return true;
      },
    );

    // Deactivate instead of delete should succeed
    const updated = await service.update(cat.id, { isActive: false });
    assert.equal(updated.isActive, false);
  });
});
