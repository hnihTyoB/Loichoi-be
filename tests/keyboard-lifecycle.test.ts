import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardService } from '../src/modules/keyboard/keyboard.service';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';

describe('Keyboard Theme Lifecycle & State Transitions', () => {
  let themesDb: Map<string, any>;
  let downloadsDb: Array<{ keyboardThemeId: string }>;
  let categoriesDb: Map<string, any>;
  let mockRepo: any;
  let mockCatRepo: any;
  let service: KeyboardService;

  beforeEach(() => {
    themesDb = new Map();
    downloadsDb = [];
    categoriesDb = new Map([
      ['cat-1', { id: 'cat-1', name: 'Anime', slug: 'anime', isActive: true }],
    ]);

    mockRepo = {
      findById: async (id: string) => themesDb.get(id) || null,
      findBySlug: async (slug: string) => Array.from(themesDb.values()).find((t) => t.slug === slug) || null,
      findPublicBySlug: async (slug: string) => {
        const theme = Array.from(themesDb.values()).find((t) => t.slug === slug && t.status === 'PUBLISHED');
        return theme || null;
      },
      findManagementById: async (id: string) => themesDb.get(id) || null,
      create: async (data: any) => {
        const record = {
          id: 'theme-' + (themesDb.size + 1),
          downloadCount: 0,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        themesDb.set(record.id, record);
        return record;
      },
      update: async (id: string, data: any) => {
        const existing = themesDb.get(id);
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        themesDb.set(id, updated);
        return updated;
      },
      delete: async (id: string) => {
        themesDb.delete(id);
      },
      archive: async (id: string) => {
        const existing = themesDb.get(id);
        if (existing) {
          existing.status = 'HIDDEN';
          existing.updatedAt = new Date();
        }
      },
      countDownloads: async (themeId: string) => {
        return downloadsDb.filter((d) => d.keyboardThemeId === themeId).length;
      },
      createAuditLog: async () => {},
    };

    mockCatRepo = {
      findActiveByIds: async (ids: string[]) => {
        return Array.from(categoriesDb.values()).filter((c) => ids.includes(c.id) && c.isActive);
      },
    };

    service = new KeyboardService();
    (service as any).repository = mockRepo;
    (service as any).categoryRepository = mockCatRepo;
  });

  it('should set publishedAt when creating PUBLISHED theme and null for DRAFT', async () => {
    const draft = await service.create({
      name: 'Sakura Night Draft',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      status: 'DRAFT',
      categoryIds: ['cat-1'],
    });
    assert.equal(draft.status, 'DRAFT');
    assert.equal(draft.publishedAt, null);

    const published = await service.create({
      name: 'Cyberpunk Published',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      status: 'PUBLISHED',
      categoryIds: ['cat-1'],
    });
    assert.equal(published.status, 'PUBLISHED');
    assert.ok(published.publishedAt instanceof Date);
  });

  it('should set publishedAt on transition DRAFT -> PUBLISHED and preserve on HIDDEN -> PUBLISHED', async () => {
    const theme = await service.create({
      name: 'Neon Horizon',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      status: 'DRAFT',
      categoryIds: ['cat-1'],
    });

    // 1. DRAFT -> PUBLISHED: sets publishedAt
    const published = await service.update(theme.id, { status: 'PUBLISHED' });
    assert.equal(published.status, 'PUBLISHED');
    const firstPublishedAt = published.publishedAt;
    assert.ok(firstPublishedAt instanceof Date);

    // 2. PUBLISHED -> HIDDEN: retains publishedAt
    const hidden = await service.update(theme.id, { status: 'HIDDEN' });
    assert.equal(hidden.status, 'HIDDEN');
    assert.equal(hidden.publishedAt, firstPublishedAt);

    // 3. HIDDEN -> PUBLISHED: keeps original publishedAt
    const rePublished = await service.update(theme.id, { status: 'PUBLISHED' });
    assert.equal(rePublished.status, 'PUBLISHED');
    assert.equal(rePublished.publishedAt, firstPublishedAt);
  });

  it('should reject invalid transition PUBLISHED -> DRAFT with 400 INVALID_STATUS_TRANSITION', async () => {
    const published = await service.create({
      name: 'Retro Wave',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      status: 'PUBLISHED',
      categoryIds: ['cat-1'],
    });

    await assert.rejects(
      async () => service.update(published.id, { status: 'DRAFT' }),
      (err: AppError) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, ERROR_CODE.INVALID_STATUS_TRANSITION);
        return true;
      },
    );
  });

  it('should hard-delete theme when downloadCount is 0', async () => {
    const theme = await service.create({
      name: 'Unused Theme',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      status: 'DRAFT',
      categoryIds: ['cat-1'],
    });

    const result = await service.delete(theme.id);
    assert.equal(result.archived, false);
    assert.equal(themesDb.has(theme.id), false);
  });

  it('should auto-archive to HIDDEN instead of physical deletion when downloadCount > 0', async () => {
    const theme = await service.create({
      name: 'Popular Theme',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      status: 'PUBLISHED',
      categoryIds: ['cat-1'],
    });

    // Simulate existing downloads
    downloadsDb.push({ keyboardThemeId: theme.id });

    const result = await service.delete(theme.id);
    assert.equal(result.archived, true);
    assert.equal(themesDb.has(theme.id), true);
    assert.equal(themesDb.get(theme.id).status, 'HIDDEN');
  });

  it('should return 404 THEME_NOT_FOUND when accessing public detail of DRAFT or HIDDEN themes', async () => {
    const draft = await service.create({
      name: 'Secret Theme',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      status: 'DRAFT',
      categoryIds: ['cat-1'],
    });

    await assert.rejects(
      async () => service.findPublicBySlug(draft.slug),
      (err: AppError) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, ERROR_CODE.THEME_NOT_FOUND);
        return true;
      },
    );
  });

  it('should reject publishing theme when categoryIds is empty', async () => {
    mockRepo.countThemeCategories = async () => 0;
    const draft = await service.create({
      name: 'No Category Theme',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      status: 'DRAFT',
      categoryIds: ['cat-1'],
    });

    await assert.rejects(
      async () => service.update(draft.id, { status: 'PUBLISHED', categoryIds: [] }),
      (err: AppError) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
        return true;
      },
    );
  });
});
