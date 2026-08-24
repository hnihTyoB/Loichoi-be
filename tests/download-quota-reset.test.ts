import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardService } from '../src/modules/keyboard/keyboard.service';
import { DiscordBotService } from '../src/modules/auth/discord-bot.service';
import { SystemConfigService } from '../src/modules/system-config/system-config.service';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';

describe('Download Quota Periodic (Monthly) & Admin Manual Reset', () => {
  let themesDb: Map<string, any>;
  let usersDb: Map<string, { id: string; downloadQuotaResetAt: Date | null }>;
  let downloadsDb: Array<{ userId: string; themeId: string; createdAt: Date }>;
  let configMap: Map<string, any>;
  let mockRepo: any;
  let mockBotService: DiscordBotService;
  let mockConfigService: SystemConfigService;
  let service: KeyboardService;

  beforeEach(() => {
    themesDb = new Map();
    for (let i = 1; i <= 30; i++) {
      const slug = `theme-${i}`;
      themesDb.set(slug, {
        id: `t-${i}`,
        name: `Theme ${i}`,
        slug,
        driveUrl: `https://drive.google.com/file/d/${i}/view`,
        status: 'PUBLISHED',
        accessLevel: 'FREE',
        downloadCount: 0,
      });
    }

    usersDb = new Map([
      ['user-test', { id: 'user-test', downloadQuotaResetAt: null }],
    ]);

    downloadsDb = [];

    configMap = new Map([
      ['feature.tier_download_quota.enabled', true],
      ['keyboard.tier_free_download_limit', 10],
      ['keyboard.tier_member_download_limit', 50],
      ['keyboard.quota_reset_cycle', 'MONTHLY'],
    ]);

    let mockTime = Date.now();
    const getNextTime = () => new Date((mockTime += 1000));

    mockRepo = {
      findBySlug: async (slug: string) => themesDb.get(slug) || null,
      getUserDiscordSocial: async () => null, // Free user
      getUserQuotaResetAt: async (userId: string) => usersDb.get(userId)?.downloadQuotaResetAt || null,
      resetUserDownloadQuota: async (userId: string) => {
        const now = getNextTime();
        const user = usersDb.get(userId);
        if (user) user.downloadQuotaResetAt = now;
        return now;
      },
      hasUserDownloadedTheme: async (userId: string, themeId: string) => {
        return downloadsDb.some((d) => d.userId === userId && d.themeId === themeId);
      },
      countUniqueThemesDownloadedByUser: async (userId: string, sinceDate?: Date) => {
        const userDownloads = downloadsDb.filter((d) => d.userId === userId);
        const uniqueThemes = new Set<string>();
        for (const d of userDownloads) {
          if (!sinceDate) {
            uniqueThemes.add(d.themeId);
          } else {
            const earliest = userDownloads
              .filter((x) => x.themeId === d.themeId)
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
            if (earliest && earliest.createdAt.getTime() >= sinceDate.getTime()) {
              uniqueThemes.add(d.themeId);
            }
          }
        }
        return uniqueThemes.size;
      },
      recordDownloadAndIncrement: async (userId: string, themeId: string) => {
        downloadsDb.push({ userId, themeId, createdAt: getNextTime() });
        const theme = Array.from(themesDb.values()).find((t) => t.id === themeId);
        if (theme) theme.downloadCount += 1;
        return [{}, {}];
      },
      createAuditLog: async () => {},
    };

    mockBotService = new DiscordBotService();
    mockBotService.getGuildMember = async () => ({ inGuild: false, roles: [] });

    mockConfigService = new SystemConfigService({
      findByKey: async (key: string) => (configMap.has(key) ? { key, value: configMap.get(key) } : null),
    } as any);

    service = new KeyboardService();
    (service as any).repository = mockRepo;
    (service as any).discordBotService = mockBotService;
    (service as any).systemConfigService = mockConfigService;
  });

  it('should automatically reset quota on new month (Monthly Cycle)', async () => {
    const user = { id: 'user-test', isActive: true };

    // Giả lập người dùng đã tải 10 themes trong tháng trước (Last Month)
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    for (let i = 1; i <= 10; i++) {
      downloadsDb.push({ userId: user.id, themeId: `t-${i}`, createdAt: lastMonthDate });
    }

    // Sang tháng này, số theme tải trong tháng này = 0
    const thisMonthDownloads = await mockRepo.countUniqueThemesDownloadedByUser(
      user.id,
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );
    assert.equal(thisMonthDownloads, 0);

    // Người dùng được phép tải 10 themes mới trong tháng này
    for (let i = 11; i <= 20; i++) {
      const url = await service.processDownload(`theme-${i}`, user);
      assert.ok(url);
    }

    // Theme thứ 21 (theme thứ 11 trong tháng này) sẽ bị chặn
    await assert.rejects(
      async () => service.processDownload('theme-21', user),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.DOWNLOAD_QUOTA_EXCEEDED);
        assert.equal((err.data as any)?.maxLimit, 10);
        return true;
      },
    );
  });

  it('should allow free redownload of themes from previous month without consuming current month quota', async () => {
    const user = { id: 'user-test', isActive: true };

    // Tải theme-1 vào tháng trước
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    downloadsDb.push({ userId: user.id, themeId: 't-1', createdAt: lastMonthDate });

    // Tháng này tải theme-1 lại (Re-download)
    const redownloadUrl = await service.processDownload('theme-1', user);
    assert.equal(redownloadUrl, 'https://drive.google.com/file/d/1/view');

    // Sau khi re-download, số theme tính vào quota tháng này vẫn là 0 (vì đã tải trước đó)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthQuota = await mockRepo.countUniqueThemesDownloadedByUser(user.id, startOfMonth);
    assert.equal(thisMonthQuota, 0);
  });

  it('should reset user quota immediately when Admin calls resetUserQuota', async () => {
    const user = { id: 'user-test', isActive: true };

    // Dùng hết 10 lượt tải trong tháng này
    for (let i = 1; i <= 10; i++) {
      await service.processDownload(`theme-${i}`, user);
    }

    // Theme 11 bị chặn
    await assert.rejects(async () => service.processDownload('theme-11', user));

    // Admin chủ động reset quota cho user
    const resetResult = await service.resetUserQuota(user.id, 'admin-id');
    assert.equal(resetResult.userId, user.id);
    assert.ok(resetResult.resetAt instanceof Date);

    // Người dùng ngay lập tức có lại 10 lượt tải mới
    for (let i = 11; i <= 20; i++) {
      const url = await service.processDownload(`theme-${i}`, user);
      assert.ok(url);
    }

    // Theme 21 lại bị chặn đúng giới hạn mới 10 lượt
    await assert.rejects(async () => service.processDownload('theme-21', user));
  });

  it('should evaluate lifetime downloads when quota_reset_cycle is configured as LIFETIME', async () => {
    const user = { id: 'user-test', isActive: true };

    // Cấu hình chu kỳ LIFETIME
    configMap.set('keyboard.quota_reset_cycle', 'LIFETIME');
    (mockConfigService as any).cache.clear();

    // Giả lập đã tải 10 themes vào tháng trước
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    for (let i = 1; i <= 10; i++) {
      downloadsDb.push({ userId: user.id, themeId: `t-${i}`, createdAt: lastMonthDate });
    }

    // Ở chế độ LIFETIME, user bị chặn ngay khi tải theme 11 dù sang tháng mới
    await assert.rejects(
      async () => service.processDownload('theme-11', user),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal((err.data as any)?.resetCycle, 'LIFETIME');
        return true;
      },
    );
  });
});
