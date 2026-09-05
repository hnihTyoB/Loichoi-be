import crypto from 'crypto';
import IORedis from 'ioredis';
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

interface OAuthStateEntry {
  createdAt: number;
  redirectUri?: string;
  nonce?: string;
}

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.argv.some((arg) => arg.includes('test')) ||
  process.env.npm_lifecycle_event === 'test';

export class DiscordOAuthService {
  private static readonly stateMap = new Map<string, OAuthStateEntry>();
  private static readonly STATE_TTL_SECONDS = 5 * 60; // 5 minutes
  private static readonly STATE_TTL_MS = DiscordOAuthService.STATE_TTL_SECONDS * 1000;
  private redisClient?: IORedis;
  private isRedisAvailable = false;

  constructor() {
    if (!isTestEnv && envConfig.redis.enabled) {
      this.initRedis();
    }
  }

  private initRedis(): void {
    try {
      this.redisClient = new IORedis({
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        password: envConfig.redis.password,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times: number) => {
          if (times > 2) {
            this.isRedisAvailable = false;
            return null;
          }
          return Math.min(times * 200, 500);
        },
      });

      this.redisClient.on('connect', () => {
        this.isRedisAvailable = true;
      });

      this.redisClient.on('error', () => {
        this.isRedisAvailable = false;
      });

      this.redisClient.connect().catch(() => {
        this.isRedisAvailable = false;
      });
    } catch {
      this.isRedisAvailable = false;
    }
  }

  /**
   * Sinh state CSRF token an toàn kèm nonce gắn với browser session (lưu Redis phân tán + fallback in-memory)
   */
  async generateState(customRedirectUri?: string, nonce?: string): Promise<string> {
    this.cleanExpiredStates();
    const state = crypto.randomBytes(32).toString('hex');
    const entry: OAuthStateEntry = {
      createdAt: Date.now(),
      redirectUri: customRedirectUri,
      nonce,
    };

    DiscordOAuthService.stateMap.set(state, entry);

    if (this.isRedisAvailable && this.redisClient) {
      try {
        await this.redisClient.set(
          `oauth_state:${state}`,
          JSON.stringify(entry),
          'EX',
          DiscordOAuthService.STATE_TTL_SECONDS,
        );
      } catch (err) {
        console.warn('[DiscordOAuthService] Lỗi lưu state vào Redis, sử dụng in-memory fallback:', err);
      }
    }

    return state;
  }

  /**
   * Xác thực state CSRF, so khớp nonce với browser cookie và tiêu thụ (dùng một lần)
   */
  async verifyAndConsumeState(
    state: string,
    expectedNonce?: string,
  ): Promise<{ isValid: boolean; redirectUri?: string }> {
    this.cleanExpiredStates();

    let entry: OAuthStateEntry | undefined;

    // Ưu tiên đọc từ Redis phân tán nếu có
    if (this.isRedisAvailable && this.redisClient) {
      try {
        const raw = await this.redisClient.get(`oauth_state:${state}`);
        if (raw) {
          entry = JSON.parse(raw) as OAuthStateEntry;
          await this.redisClient.del(`oauth_state:${state}`);
        }
      } catch (err) {
        console.warn('[DiscordOAuthService] Lỗi đọc state từ Redis, fallback in-memory:', err);
      }
    }

    // Fallback sang in-memory Map
    if (!entry) {
      entry = DiscordOAuthService.stateMap.get(state);
    }

    // Xóa state ngay lập tức để chống replay attack
    DiscordOAuthService.stateMap.delete(state);

    if (!entry) {
      return { isValid: false };
    }

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
