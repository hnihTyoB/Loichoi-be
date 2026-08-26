import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardService } from '../src/modules/keyboard/keyboard.service';
import { DiscordBotService } from '../src/modules/auth/discord-bot.service';
import { createKeyboardSchema } from '../src/modules/keyboard/keyboard.validation';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';

describe('Discord Gated Membership & Role-Based Access Control', () => {
  let themesDb: Map<string, any>;
  let userSocialsDb: Map<string, any>; // userId -> userSocial
  let downloadsDb: Array<any>;
  let mockRepo: any;
  let mockBotService: DiscordBotService;
  let service: KeyboardService;

  beforeEach(() => {
    themesDb = new Map([
      [
        'free-theme',
        {
          id: 't-free',
          name: 'Free Pastel Theme',
          slug: 'free-theme',
          driveUrl: 'https://drive.google.com/file/d/free/view',
          status: 'PUBLISHED',
          accessLevel: 'FREE',
          downloadCount: 0,
        },
      ],
      [
        'member-theme',
        {
          id: 't-member',
          name: 'Discord Member Exclusive',
          slug: 'member-theme',
          driveUrl: 'https://drive.google.com/file/d/member/view',
          status: 'PUBLISHED',
          accessLevel: 'DISCORD_MEMBER',
          downloadCount: 5,
        },
      ],
      [
        'vip-booster-theme',
        {
          id: 't-booster',
          name: 'Server Booster Special',
          slug: 'vip-booster-theme',
          driveUrl: 'https://drive.google.com/file/d/booster/view',
          status: 'PUBLISHED',
          accessLevel: 'DISCORD_ROLE',
          requiredDiscordRoleIds: ['ROLE_BOOSTER_999', 'ROLE_VIP_101'],
          downloadCount: 12,
        },
      ],
    ]);

    userSocialsDb = new Map([
      ['user-discord-linked', { userId: 'user-discord-linked', provider: 'DISCORD', providerUserId: 'discord_uid_123' }],
      ['user-discord-booster', { userId: 'user-discord-booster', provider: 'DISCORD', providerUserId: 'discord_uid_booster' }],
      ['user-discord-vip', { userId: 'user-discord-vip', provider: 'DISCORD', providerUserId: 'discord_uid_vip' }],
      ['user-discord-not-in-guild', { userId: 'user-discord-not-in-guild', provider: 'DISCORD', providerUserId: 'discord_uid_outsider' }],
    ]);

    downloadsDb = [];

    mockRepo = {
      findBySlug: async (slug: string) => themesDb.get(slug) || null,
      getUserDiscordSocial: async (userId: string) => userSocialsDb.get(userId) || null,
      getUserQuotaResetAt: async () => null,
      hasUserDownloadedTheme: async (userId: string, themeId: string) =>
        downloadsDb.some((d) => d.userId === userId && d.themeId === themeId),
      countUniqueThemesDownloadedByUser: async () => 0,
      recordDownloadAndIncrement: async (userId: string, themeId: string, metadata?: any) => {
        const theme = Array.from(themesDb.values()).find((t) => t.id === themeId);
        if (theme) theme.downloadCount += 1;
        downloadsDb.push({ userId, themeId });
        return [{}, {}];
      },
    };

    mockBotService = new DiscordBotService();
    mockBotService.getGuildMember = async (discordUserId: string) => {
      if (discordUserId === 'discord_uid_booster') {
        return { inGuild: true, roles: ['ROLE_MEMBER', 'ROLE_BOOSTER_999'] };
      }
      if (discordUserId === 'discord_uid_vip') {
        return { inGuild: true, roles: ['ROLE_MEMBER', 'ROLE_VIP_101'] };
      }
      if (discordUserId === 'discord_uid_123') {
        return { inGuild: true, roles: ['ROLE_MEMBER'] };
      }
      if (discordUserId === 'discord_uid_outsider') {
        return { inGuild: false, roles: [] };
      }
      return { inGuild: false, roles: [] };
    };

    service = new KeyboardService();
    (service as any).repository = mockRepo;
    (service as any).discordBotService = mockBotService;
  });

  it('should validate schema and allow optional requiredDiscordRoleIds when accessLevel is DISCORD_ROLE', () => {
    const payloadWithoutRoles = {
      name: 'VIP Theme',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/vip/view',
      platform: 'BOTH',
      status: 'PUBLISHED',
      accessLevel: 'DISCORD_ROLE',
      categoryIds: ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'],
    };

    const parsedWithoutRoles = createKeyboardSchema.parse(payloadWithoutRoles);
    assert.equal(parsedWithoutRoles.accessLevel, 'DISCORD_ROLE');
    assert.deepEqual(parsedWithoutRoles.requiredDiscordRoleIds, []);

    const validPayload = {
      ...payloadWithoutRoles,
      requiredDiscordRoleIds: ['ROLE_VIP_101', 'ROLE_BOOSTER_999'],
    };
    const parsed = createKeyboardSchema.parse(validPayload);
    assert.equal(parsed.accessLevel, 'DISCORD_ROLE');
    assert.deepEqual(parsed.requiredDiscordRoleIds, ['ROLE_VIP_101', 'ROLE_BOOSTER_999']);
  });


  it('should allow downloading FREE theme for any authenticated user without Discord check', async () => {
    const userWithoutDiscord = { id: 'user-email-only', isActive: true };
    const url = await service.processDownload('free-theme', userWithoutDiscord);

    assert.equal(url, 'https://drive.google.com/file/d/free/view');
    assert.equal(downloadsDb.length, 1);
    assert.equal(themesDb.get('free-theme').downloadCount, 1);
  });

  it('should reject DISCORD_MEMBER theme if user has not linked Discord account with 403 DISCORD_NOT_LINKED', async () => {
    const userWithoutDiscord = { id: 'user-no-discord', isActive: true };

    await assert.rejects(
      async () => service.processDownload('member-theme', userWithoutDiscord),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.DISCORD_NOT_LINKED);
        assert.ok((err.data as any)?.inviteUrl);
        return true;
      },
    );
  });

  it('should reject DISCORD_MEMBER theme if user is NOT in Discord server with 403 DISCORD_GUILD_REQUIRED', async () => {
    const userNotInGuild = { id: 'user-discord-not-in-guild', isActive: true };

    await assert.rejects(
      async () => service.processDownload('member-theme', userNotInGuild),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.DISCORD_GUILD_REQUIRED);
        assert.ok((err.data as any)?.inviteUrl);
        return true;
      },
    );
  });

  it('should allow DISCORD_MEMBER theme if user is member of Discord server', async () => {
    const guildMember = { id: 'user-discord-linked', isActive: true };
    const url = await service.processDownload('member-theme', guildMember);

    assert.equal(url, 'https://drive.google.com/file/d/member/view');
    assert.equal(downloadsDb.length, 1);
    assert.equal(themesDb.get('member-theme').downloadCount, 6);
  });

  it('should reject DISCORD_ROLE theme if user lacks all required roles with 403 DISCORD_ROLE_REQUIRED', async () => {
    const memberWithoutRole = { id: 'user-discord-linked', isActive: true };

    await assert.rejects(
      async () => service.processDownload('vip-booster-theme', memberWithoutRole),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.DISCORD_ROLE_REQUIRED);
        assert.deepEqual((err.data as any)?.requiredRoleIds, ['ROLE_BOOSTER_999', 'ROLE_VIP_101']);
        assert.ok((err.data as any)?.inviteUrl);
        return true;
      },
    );
  });

  it('should allow DISCORD_ROLE theme when user has ANY of the required roles (Booster role)', async () => {
    const boosterUser = { id: 'user-discord-booster', isActive: true };
    const url = await service.processDownload('vip-booster-theme', boosterUser);

    assert.equal(url, 'https://drive.google.com/file/d/booster/view');
    assert.equal(downloadsDb.length, 1);
    assert.equal(themesDb.get('vip-booster-theme').downloadCount, 13);
  });

  it('should allow DISCORD_ROLE theme when user has another role in the list (VIP role)', async () => {
    const vipUser = { id: 'user-discord-vip', isActive: true };
    const url = await service.processDownload('vip-booster-theme', vipUser);

    assert.equal(url, 'https://drive.google.com/file/d/booster/view');
    assert.equal(downloadsDb.length, 1);
    assert.equal(themesDb.get('vip-booster-theme').downloadCount, 13);
  });

  it('should reject download request if user account is deactivated in database with 403 USER_INACTIVE', async () => {
    mockRepo.findUserById = async (id: string) => ({ id, isActive: false, downloadQuotaResetAt: null });

    const deactivatedUser = { id: 'user-deactivated' };
    await assert.rejects(
      async () => service.processDownload('free-theme', deactivatedUser),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.USER_INACTIVE);
        return true;
      },
    );
  });

  it('should fallback to discord.vip_role_ids from system config when DISCORD_ROLE theme has empty requiredDiscordRoleIds', async () => {
    themesDb.set('empty-role-theme', {
      id: 't-empty-role',
      name: 'Default VIP Theme',
      slug: 'empty-role-theme',
      driveUrl: 'https://drive.google.com/file/d/empty-role/view',
      status: 'PUBLISHED',
      accessLevel: 'DISCORD_ROLE',
      requiredDiscordRoleIds: [],
      downloadCount: 0,
    });

    (service as any).systemConfigService = {
      isFeatureEnabled: async () => true,
      get: async (key: string, fallback: any) => {
        if (key === 'discord.vip_role_ids') return ['ROLE_VIP_101'];
        return fallback;
      },
    };

    // User with ROLE_VIP_101 should be allowed
    const vipUser = { id: 'user-discord-vip', isActive: true };
    const url = await service.processDownload('empty-role-theme', vipUser);
    assert.equal(url, 'https://drive.google.com/file/d/empty-role/view');

    // Normal member without VIP role should be rejected
    const memberUser = { id: 'user-discord-linked', isActive: true };
    await assert.rejects(
      async () => service.processDownload('empty-role-theme', memberUser),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.DISCORD_ROLE_REQUIRED);
        assert.deepEqual((err.data as any)?.requiredRoleIds, ['ROLE_VIP_101']);
        return true;
      },
    );
  });
});

