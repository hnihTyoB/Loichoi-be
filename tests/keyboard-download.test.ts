import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardService } from '../src/modules/keyboard/keyboard.service';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';

describe('Keyboard Download Engine & Transaction Semantics', () => {
  let themesDb: Map<string, any>;
  let downloadsDb: Array<any>;
  let mockRepo: any;
  let service: KeyboardService;

  beforeEach(() => {
    themesDb = new Map([
      [
        'sakura-night',
        {
          id: 'theme-1',
          name: 'Sakura Night',
          slug: 'sakura-night',
          driveUrl: 'https://drive.google.com/uc?export=download&id=ABC123XYZ',
          status: 'PUBLISHED',
          accessLevel: 'FREE',
          downloadCount: 10,
        },
      ],
      [
        'draft-theme',
        {
          id: 'theme-2',
          name: 'Draft Theme',
          slug: 'draft-theme',
          driveUrl: 'https://drive.google.com/uc?export=download&id=DRAFT123',
          status: 'DRAFT',
          accessLevel: 'FREE',
          downloadCount: 0,
        },
      ],
      [
        'hidden-theme',
        {
          id: 'theme-3',
          name: 'Hidden Theme',
          slug: 'hidden-theme',
          driveUrl: 'https://drive.google.com/uc?export=download&id=HIDDEN123',
          status: 'HIDDEN',
          accessLevel: 'FREE',
          downloadCount: 5,
        },
      ],
    ]);

    downloadsDb = [];

    mockRepo = {
      findBySlug: async (slug: string) => themesDb.get(slug) || null,
      getUserDiscordSocial: async () => null,
      getUserQuotaResetAt: async () => null,
      hasUserDownloadedTheme: async (userId: string, themeId: string) =>
        downloadsDb.some((d) => d.userId === userId && d.keyboardThemeId === themeId),
      countUniqueThemesDownloadedByUser: async () => 0,
      recordDownloadAndIncrement: async (userId: string, themeId: string, metadata?: any) => {
        const theme = Array.from(themesDb.values()).find((t) => t.id === themeId);
        if (!theme) throw new Error('Theme not found');

        downloadsDb.push({
          id: 'dl-' + (downloadsDb.length + 1),
          userId,
          keyboardThemeId: themeId,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
          createdAt: new Date(),
        });

        theme.downloadCount += 1;
        return [{}, {}];
      },
    };

    service = new KeyboardService();
    (service as any).repository = mockRepo;
  });

  it('should reject download if user is inactive with 403 USER_INACTIVE', async () => {
    const inactiveUser = { id: 'user-disabled', isActive: false };

    await assert.rejects(
      async () => service.processDownload('sakura-night', inactiveUser),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.USER_INACTIVE);
        return true;
      },
    );
  });

  it('should reject download if theme is in DRAFT status with 404 THEME_NOT_FOUND', async () => {
    const activeUser = { id: 'user-1', isActive: true };

    await assert.rejects(
      async () => service.processDownload('draft-theme', activeUser),
      (err: AppError) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, ERROR_CODE.THEME_NOT_FOUND);
        return true;
      },
    );
  });

  it('should reject download if theme is in HIDDEN status with 404 THEME_NOT_FOUND', async () => {
    const activeUser = { id: 'user-1', isActive: true };

    await assert.rejects(
      async () => service.processDownload('hidden-theme', activeUser),
      (err: AppError) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, ERROR_CODE.THEME_NOT_FOUND);
        return true;
      },
    );
  });

  it('should record download, increment atomic counter, and return Google Drive URL for PUBLISHED theme', async () => {
    const activeUser = { id: 'user-42', isActive: true };
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0' };

    const driveUrl = await service.processDownload('sakura-night', activeUser, metadata);

    assert.equal(driveUrl, 'https://drive.google.com/uc?export=download&id=ABC123XYZ');
    assert.equal(downloadsDb.length, 1);
    assert.equal(downloadsDb[0].userId, 'user-42');
    assert.equal(downloadsDb[0].keyboardThemeId, 'theme-1');

    const updatedTheme = themesDb.get('sakura-night');
    assert.equal(updatedTheme.downloadCount, 11);
  });

  it('should handle transaction failure gracefully without returning URL', async () => {
    mockRepo.recordDownloadAndIncrement = async () => {
      throw new Error('Database connection failed');
    };

    const activeUser = { id: 'user-42', isActive: true };

    await assert.rejects(
      async () => service.processDownload('sakura-night', activeUser),
      (err: AppError) => {
        assert.equal(err.statusCode, 500);
        assert.equal(err.code, ERROR_CODE.DOWNLOAD_TRANSACTION_FAILED);
        return true;
      },
    );
  });
});
