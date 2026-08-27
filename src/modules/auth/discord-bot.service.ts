import { envConfig } from '../../config/env.config';

export interface GuildMemberInfo {
  inGuild: boolean;
  roles: string[];
  username?: string;
  cachedAt: number;
}

export class DiscordBotService {
  private static readonly memberCache = new Map<string, GuildMemberInfo>();
  private static readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Truy vấn thông tin thành viên và danh sách Role trong Discord Server qua Bot Token (kèm Caching)
   */
  async getGuildMember(discordUserId: string): Promise<{ inGuild: boolean; roles: string[]; username?: string }> {
    // 1. Kiểm tra Cache
    const cached = DiscordBotService.memberCache.get(discordUserId);
    if (cached && Date.now() - cached.cachedAt < DiscordBotService.CACHE_TTL_MS) {
      return {
        inGuild: cached.inGuild,
        roles: cached.roles,
        username: cached.username,
      };
    }

    const botToken = envConfig.discord.botToken;
    const guildId = envConfig.discord.guildId;

    // Nếu chưa cấu hình bot token (ở môi trường dev/test), fallback cho phép mô phỏng hội viên
    if (!botToken || !guildId) {
      if (envConfig.nodeEnv === 'production') {
        console.warn('[DiscordBotService] Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID in production.');
        return { inGuild: false, roles: [] };
      }
      return { inGuild: true, roles: [] };
    }

    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`, {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (response.status === 404) {
        // User chưa tham gia Discord Server
        const memberInfo: GuildMemberInfo = {
          inGuild: false,
          roles: [],
          cachedAt: Date.now(),
        };
        DiscordBotService.memberCache.set(discordUserId, memberInfo);
        return { inGuild: false, roles: [] };
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Discord Bot API Error ${response.status}]`, errorText);
        // Khi Discord API gặp lỗi tạm thời, không làm hỏng request
        return { inGuild: false, roles: [] };
      }

      const data = (await response.json()) as { roles?: string[]; user?: { username?: string } };
      const memberInfo: GuildMemberInfo = {
        inGuild: true,
        roles: Array.isArray(data.roles) ? data.roles : [],
        username: data.user?.username,
        cachedAt: Date.now(),
      };

      DiscordBotService.memberCache.set(discordUserId, memberInfo);
      return {
        inGuild: true,
        roles: memberInfo.roles,
        username: memberInfo.username,
      };
    } catch (error) {
      console.error('[Discord Bot Service Network Error]', error);
      return { inGuild: false, roles: [] };
    }
  }

  /**
   * Xóa cache thành viên
   */
  invalidateMemberCache(discordUserId: string): void {
    DiscordBotService.memberCache.delete(discordUserId);
  }

  /**
   * Bắn thông báo qua Discord khi có Keyboard Theme mới được phát hành
   * Ưu tiên gửi qua Bot Token để hỗ trợ Button Component (Style 5 - Link Button),
   * nếu không có channelId/botToken thì fallback qua Webhook URL.
   */
  async sendThemeAnnouncement(theme: {
    name: string;
    slug: string;
    coverUrl: string;
    description?: string | null;
    platform: string;
    accessLevel: string;
  }): Promise<void> {
    const { botToken, channelId, webhookUrl } = envConfig.discord;
    if (!botToken && !webhookUrl) return;

    try {
      const themeUrl = `${envConfig.frontendUrl}/keyboards/${theme.slug}`;
      const logoUrl = `${envConfig.frontendUrl}/images/logos/logo_loichoi.png`;

      const embed = {
        title: `Ra mắt Giao diện Bàn phím mới: ${theme.name}`,
        url: themeUrl,
        description: theme.description || 'Giao diện bàn phím mới cực đẹp đã sẵn sàng để tải về và trải nghiệm ngay!',
        color: 0x5865f2, // Discord Blurple
        image: {
          url: theme.coverUrl,
        },
        footer: {
          text: 'Loichoi Keyboard Theme Library',
        },
        timestamp: new Date().toISOString(),
      };

      const components = [
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              style: 5, // Link Button
              label: 'Xem & Tải Bàn Phím',
              url: themeUrl,
            },
          ],
        },
      ];

      // 1. Ưu tiên gửi qua Bot Token vào kênh (Hỗ trợ Button Component chuẩn)
      if (botToken && channelId) {
        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            embeds: [embed],
            components,
          }),
        });

        if (response.ok) {
          return;
        }

        const errBody = await response.text();
        console.warn('[Discord Bot Channel Send Failed, falling back to Webhook]', errBody);
      }

      // 2. Fallback gửi qua Webhook nếu chưa cấu hình Channel ID hoặc Bot API gặp lỗi
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Loichoi Keyboard',
            avatar_url: logoUrl,
            embeds: [embed],
            components,
          }),
        });
      }
    } catch (err) {
      console.error('[Discord Announcement Error]', err);
    }
  }
}

export const discordBotService = new DiscordBotService();
