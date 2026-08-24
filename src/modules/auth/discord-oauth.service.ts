import crypto from 'crypto';
import { envConfig } from '../../config/env.config';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';

export interface DiscordUserProfile {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string | null;
  avatar?: string | null;
  email?: string | null;
  verified?: boolean;
}

export class DiscordOAuthService {
  private static readonly stateMap = new Map<string, { createdAt: number; redirectUri?: string; nonce?: string }>();
  private static readonly STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Sinh state CSRF token an toàn kèm nonce gắn với browser session
   */
  generateState(customRedirectUri?: string, nonce?: string): string {
    this.cleanExpiredStates();
    const state = crypto.randomBytes(32).toString('hex');
    DiscordOAuthService.stateMap.set(state, {
      createdAt: Date.now(),
      redirectUri: customRedirectUri,
      nonce,
    });
    return state;
  }

  /**
   * Xác thực state CSRF, so khớp nonce với browser cookie và tiêu thụ (dùng một lần)
   */
  verifyAndConsumeState(state: string, expectedNonce?: string): { isValid: boolean; redirectUri?: string } {
    this.cleanExpiredStates();
    const entry = DiscordOAuthService.stateMap.get(state);
    if (!entry) {
      return { isValid: false };
    }

    // Xóa state ngay lập tức để chống replay attack
    DiscordOAuthService.stateMap.delete(state);

    if (Date.now() - entry.createdAt > DiscordOAuthService.STATE_TTL_MS) {
      return { isValid: false };
    }

    // Kiểm tra ràng buộc nonce cookie nếu có
    if (entry.nonce && expectedNonce && entry.nonce !== expectedNonce) {
      return { isValid: false };
    }

    return { isValid: true, redirectUri: entry.redirectUri };
  }

  /**
   * Tạo URL chuyển hướng đăng nhập Discord
   */
  getAuthorizationUrl(state: string, customRedirectUri?: string): string {
    const clientId = envConfig.discord.clientId;
    const redirectUri = customRedirectUri || envConfig.discord.redirectUri;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify email',
      state,
      prompt: 'consent',
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Đổi authorization code lấy access token từ Discord API kèm Timeout và bảo vệ lỗi upstream
   */
  async exchangeCodeForToken(code: string, customRedirectUri?: string): Promise<string> {
    const clientId = envConfig.discord.clientId;
    const clientSecret = envConfig.discord.clientSecret;
    const redirectUri = customRedirectUri || envConfig.discord.redirectUri;

    if (!clientId || !clientSecret) {
      throw new AppError(
        'Discord OAuth is not configured on this server',
        500,
        ERROR_CODE.CONFIGURATION_ERROR,
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    let response: globalThis.Response;
    try {
      response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err: any) {
      console.error('[Discord OAuth Network/Timeout Error]', err?.message || err);
      throw new AppError(
        'Không thể kết nối đến máy chủ Discord (Gateway Timeout)',
        504,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[Discord OAuth Token Error]', errorData);
      if (response.status >= 500) {
        throw new AppError('Máy chủ Discord tạm thời gián đoạn. Vui lòng thử lại sau.', 502, ERROR_CODE.INTERNAL_SERVER_ERROR);
      }
      throw new AppError(
        'Mã xác thực Discord không hợp lệ hoặc đã hết hạn',
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  /**
   * Lấy thông tin user profile từ Discord API kèm Timeout
   */
  async fetchUserProfile(accessToken: string): Promise<DiscordUserProfile> {
    let response: globalThis.Response;
    try {
      response = await fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch (err: any) {
      console.error('[Discord User Profile Network/Timeout Error]', err?.message || err);
      throw new AppError(
        'Không thể lấy thông tin hồ sơ từ Discord (Gateway Timeout)',
        504,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[Discord User Profile Error]', errorData);
      if (response.status >= 500) {
        throw new AppError('Máy chủ Discord tạm thời gián đoạn. Vui lòng thử lại sau.', 502, ERROR_CODE.INTERNAL_SERVER_ERROR);
      }
      throw new AppError(
        'Không thể tải thông tin hồ sơ từ Discord',
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    return (await response.json()) as DiscordUserProfile;
  }

  /**
   * Xây dựng Avatar URL từ thông tin Discord
   */
  getAvatarUrl(user: DiscordUserProfile): string | null {
    if (!user.avatar) {
      return null;
    }
    const isAnimated = user.avatar.startsWith('a_');
    const format = isAnimated ? 'gif' : 'webp';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${format}?size=256`;
  }

  private cleanExpiredStates(): void {
    const now = Date.now();
    for (const [state, entry] of DiscordOAuthService.stateMap.entries()) {
      if (now - entry.createdAt > DiscordOAuthService.STATE_TTL_MS) {
        DiscordOAuthService.stateMap.delete(state);
      }
    }
  }
}

export const discordOAuthService = new DiscordOAuthService();
