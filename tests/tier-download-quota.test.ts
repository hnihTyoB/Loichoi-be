import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardService } from '../src/modules/keyboard/keyboard.service';
import { DiscordBotService } from '../src/modules/auth/discord-bot.service';
import { SystemConfigService } from '../src/modules/system-config/system-config.service';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';

describe('Tier Download Quotas & Dynamic SystemConfig Limits', () => {
  let themesDb: Map<string, any>;
  let userSocialsDb: Map<string, any>;
  let downloadedHistoryDb: Array<{ userId: string; themeId: string }>;
  let configMap: Map<string, any>;
  let mockRepo: any;
  let mockBotService: DiscordBotService;
  let mockConfigService: SystemConfigService;
  let service: KeyboardService;

  beforeEach(() => {
    themesDb = new Map();
    // Tạo 60 mock themes
    for (let i = 1; i <= 60; i++) {
      const slug = `theme-${i}`;
      themesDb.set(slug, {
        id: `t-${i}`,
        name: `Keyboard Theme ${i}`,
        slug,
        driveUrl: `https://drive.google.com/file/d/${i}/view`,
        status: 'PUBLISHED',
        accessLevel: 'FREE',
        downloadCount: 0,
      });
    }

    userSocialsDb = new Map([
      ['user-discord-member', { userId: 'user-discord-member', provider: 'DISCORD', providerUserId: 'discord_member_id' }],
      ['user-discord-booster', { userId: 'user-discord-booster', provider: 'DISCORD', providerUserId: 'discord_booster_id' }],
    ]);

    downloadedHistoryDb = [];

    configMap = new Map([
      ['feature.tier_download_quota.enabled', true],
      ['keyboard.tier_free_download_limit', 10],
      ['keyboard.tier_member_download_limit', 50],
    ]);

    mockRepo = {
      findBySlug: async (slug: string) => themesDb.get(slug) || null,
      getUserDiscordSocial: async (userId: string) => userSocialsDb.get(userId) || null,
      getUserQuotaResetAt: async () => null,
      hasUserDownloadedTheme: async (userId: string, themeId: string) => {
        return downloadedHistoryDb.some((d) => d.userId === userId && d.themeId === themeId);
      },
      countUniqueThemesDownloadedByUser: async (userId: string) => {
        const uniqueThemes = new Set(downloadedHistoryDb.filter((d) => d.userId === userId).map((d) => d.themeId));
        return uniqueThemes.size;
      },
      recordDownloadAndIncrement: async (userId: string, themeId: string) => {
        downloadedHistoryDb.push({ userId, themeId });
        const theme = Array.from(themesDb.values()).find((t) => t.id === themeId);
        if (theme) theme.downloadCount += 1;
        return [{}, {}];
      },
    };

    mockBotService = new DiscordBotService();
    mockBotService.getGuildMember = async (discordUserId: string) => {
      if (discordUserId === 'discord_booster_id') {
        return { inGuild: true, roles: ['ROLE_MEMBER', 'ROLE_SERVER_BOOSTER'] };
      }
      if (discordUserId === 'discord_member_id') {
        return { inGuild: true, roles: ['ROLE_MEMBER'] };
      }
      return { inGuild: false, roles: [] };
    };

    mockConfigService = new SystemConfigService({
      findByKey: async (key: string) => (configMap.has(key) ? { key, value: configMap.get(key) } : null),
    } as any);

    service = new KeyboardService();
    (service as any).repository = mockRepo;
    (service as any).discordBotService = mockBotService;
    (service as any).systemConfigService = mockConfigService;
  });

  it('should enforce Free User download limit of 10 themes and block 11th download', async () => {
    const freeUser = { id: 'user-free-1', isActive: true };

    // Tải 10 theme đầu tiên thành công
    for (let i = 1; i <= 10; i++) {
      const url = await service.processDownload(`theme-${i}`, freeUser);
      assert.ok(url);
    }

    assert.equal(await mockRepo.countUniqueThemesDownloadedByUser(freeUser.id), 10);

    // Theme thứ 11 phải bị chặn với mã DOWNLOAD_QUOTA_EXCEEDED
    await assert.rejects(
      async () => service.processDownload('theme-11', freeUser),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.DOWNLOAD_QUOTA_EXCEEDED);
        assert.equal((err.data as any)?.maxLimit, 10);
        assert.equal((err.data as any)?.nextTier, 'DISCORD_MEMBER');
        return true;
      },
    );
  });

  it('should allow Free User to redownload previously downloaded theme without consuming quota', async () => {
    const freeUser = { id: 'user-free-1', isActive: true };

    // Đã tải 10 themes (hết quota)
    for (let i = 1; i <= 10; i++) {
      await service.processDownload(`theme-${i}`, freeUser);
    }

    // Tải lại theme 1 (đã tải rồi) -> Cho phép
    const redownloadUrl = await service.processDownload('theme-1', freeUser);
    assert.equal(redownloadUrl, 'https://drive.google.com/file/d/1/view');
  });

  it('should enforce Discord Member download limit of 50 themes and block 51st download', async () => {
    const memberUser = { id: 'user-discord-member', isActive: true };

    // Tải 50 themes thành công
    for (let i = 1; i <= 50; i++) {
      const url = await service.processDownload(`theme-${i}`, memberUser);
      assert.ok(url);
    }

    assert.equal(await mockRepo.countUniqueThemesDownloadedByUser(memberUser.id), 50);

    // Theme thứ 51 phải bị chặn và gợi ý nâng cấp VIP/Booster
    await assert.rejects(
      async () => service.processDownload('theme-51', memberUser),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.DOWNLOAD_QUOTA_EXCEEDED);
        assert.equal((err.data as any)?.maxLimit, 50);
        assert.equal((err.data as any)?.nextTier, 'VIP_BOOSTER');
        return true;
      },
    );
  });

  it('should allow VIP / Server Booster to download unlimited themes (> 50 themes)', async () => {
    const boosterUser = { id: 'user-discord-booster', isActive: true };

    // Tải tất cả 60 themes
    for (let i = 1; i <= 60; i++) {
      const url = await service.processDownload(`theme-${i}`, boosterUser);
      assert.ok(url);
    }

    assert.equal(await mockRepo.countUniqueThemesDownloadedByUser(boosterUser.id), 60);
  });

  it('should immediately adapt when Admin changes Free quota dynamically in SystemConfig', async () => {
    const freeUser = { id: 'user-free-custom', isActive: true };

    // Tải 10 themes ban đầu
    for (let i = 1; i <= 10; i++) {
      await service.processDownload(`theme-${i}`, freeUser);
    }

    // Theme 11 bị chặn
    await assert.rejects(async () => service.processDownload('theme-11', freeUser));

    // Admin chỉnh quota lên 15 trong SystemConfig (không cần redeploy)
    configMap.set('keyboard.tier_free_download_limit', 15);
    (mockConfigService as any).cache.clear();

    // User lập tức được tải thêm theme 11 đến 15
    for (let i = 11; i <= 15; i++) {
      const url = await service.processDownload(`theme-${i}`, freeUser);
      assert.ok(url);
    }

    // Theme 16 lại bị chặn đúng giới hạn mới 15
    await assert.rejects(
      async () => service.processDownload('theme-16', freeUser),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal((err.data as any)?.maxLimit, 15);
        return true;
      },
    );
  });

  it('should recognize VIP user by Discord Snowflake Role ID from SystemConfig discord.vip_role_ids', async () => {
    const snowflakeVipUser = { id: 'user-snowflake-vip', isActive: true };
    userSocialsDb.set('user-snowflake-vip', {
      userId: 'user-snowflake-vip',
      provider: 'DISCORD',
      providerUserId: 'discord_snowflake_vip_id',
    });

    configMap.set('discord.vip_role_ids', ['999888777666555444']);
    (mockConfigService as any).cache.clear();

    // Mock bot service returns raw numeric Discord Snowflake role IDs
    (mockBotService as any).getGuildMember = async (discordUserId: string) => {
      if (discordUserId === 'discord_snowflake_vip_id') {
        return { inGuild: true, roles: ['111222333444555666', '999888777666555444'] };
      }
      return { inGuild: false, roles: [] };
    };

    // User can download all 60 themes without quota restrictions
    for (let i = 1; i <= 60; i++) {
      const url = await service.processDownload(`theme-${i}`, snowflakeVipUser);
      assert.ok(url);
    }
    assert.equal(await mockRepo.countUniqueThemesDownloadedByUser(snowflakeVipUser.id), 60);
  });
});
