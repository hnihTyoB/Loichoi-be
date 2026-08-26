import { KeyboardRepository } from './keyboard.repository';
import { CategoryRepository } from '../category/category.repository';
import { discordBotService, DiscordBotService } from '../auth/discord-bot.service';
import { systemConfigService, SystemConfigService } from '../system-config/system-config.service';
import { FEATURE_FLAGS } from '../../common/constants/system-config.constant';
import { envConfig } from '../../config/env.config';
import {
  KeyboardQueryDto,
  KeyboardManagementQueryDto,
  CreateKeyboardDto,
  UpdateKeyboardDto,
} from './keyboard.dto';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { toSlug } from '../../common/helpers/slug.helper';
import { formatVietnamDate, getVietnamDayRange } from '../../common/helpers/date.helper';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';

export class KeyboardService {
  private readonly repository = new KeyboardRepository();
  private readonly categoryRepository = new CategoryRepository();
  private readonly discordBotService: DiscordBotService = discordBotService;
  private readonly systemConfigService: SystemConfigService = systemConfigService;

  async findPublicList(query: KeyboardQueryDto, currentUserId?: string) {
    return this.repository.findPublicList(query, currentUserId);
  }

  async findPublicBySlug(slug: string, currentUserId?: string) {
    const theme = await this.repository.findPublicBySlug(slug, currentUserId);
    if (!theme) {
      throw new AppError(
        'Giao diện bàn phím không tồn tại hoặc chưa được phát hành',
        404,
        ERROR_CODE.THEME_NOT_FOUND,
      );
    }
    return theme;
  }

  async findManagementList(query: KeyboardManagementQueryDto) {
    return this.repository.findManagementList(query);
  }

  async findManagementById(id: string) {
    const theme = await this.repository.findManagementById(id);
    if (!theme) {
      throw new AppError('Giao diện bàn phím không tồn tại', 404, ERROR_CODE.THEME_NOT_FOUND);
    }
    return theme;
  }

  async create(
    data: CreateKeyboardDto,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const slug = data.slug ? toSlug(data.slug) : toSlug(data.name);

    if (!slug) {
      throw new AppError('Không thể tạo định danh (slug) hợp lệ từ tên theme', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const existingSlug = await this.repository.findBySlug(slug);
    if (existingSlug) {
      throw new AppError('Đường dẫn định danh (slug) của theme đã tồn tại', 409, ERROR_CODE.THEME_SLUG_EXISTS);
    }

    // Xác thực danh mục: Bắt buộc tồn tại và isActive = true
    if (data.categoryIds && data.categoryIds.length > 0) {
      const activeCategories = await this.categoryRepository.findActiveByIds(data.categoryIds);
      if (activeCategories.length !== data.categoryIds.length) {
        throw new AppError(
          'Một hoặc nhiều danh mục được gán không tồn tại hoặc đang bị vô hiệu hóa',
          400,
          ERROR_CODE.CATEGORY_INACTIVE,
        );
      }
    }

    const publishedAt = data.status === 'PUBLISHED' ? new Date() : null;

    const theme = await this.repository.create({
      ...data,
      slug,
      publishedAt,
      createdBy: actorId,
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_KEYBOARD,
      targetType: AUDIT_TARGET_TYPE.KEYBOARD_THEME,
      targetId: theme.id,
      details: {
        name: theme.name,
        slug: theme.slug,
        platform: theme.platform,
        status: theme.status,
        accessLevel: theme.accessLevel,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    // Bắn thông báo qua Discord Webhook nếu tạo ở trạng thái PUBLISHED và feature flag được bật
    const isAnnouncementEnabled = await this.systemConfigService.isFeatureEnabled(
      FEATURE_FLAGS.THEME_ANNOUNCEMENT_WEBHOOK,
      true,
    );

    if (isAnnouncementEnabled && theme.status === 'PUBLISHED') {
      this.discordBotService
        .sendThemeAnnouncement({
          name: theme.name,
          slug: theme.slug,
          coverUrl: theme.coverUrl,
          description: theme.description,
          platform: theme.platform,
          accessLevel: theme.accessLevel,
        })
        .catch((err) => console.error('[Discord Webhook Error]', err));
    }

    return this.findManagementById(theme.id);
  }

  async update(
    id: string,
    data: UpdateKeyboardDto,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Giao diện bàn phím không tồn tại', 404, ERROR_CODE.THEME_NOT_FOUND);
    }

    let slug = existing.slug;
    if (data.slug) {
      slug = toSlug(data.slug);
      if (slug !== existing.slug) {
        const existingSlug = await this.repository.findBySlug(slug);
        if (existingSlug && existingSlug.id !== id) {
          throw new AppError('Đường dẫn định danh (slug) của theme đã tồn tại', 409, ERROR_CODE.THEME_SLUG_EXISTS);
        }
      }
    }

    // Kiểm tra danh mục nếu có cập nhật
    if (data.categoryIds !== undefined && data.categoryIds.length > 0) {
      const activeCategories = await this.categoryRepository.findActiveByIds(data.categoryIds);
      if (activeCategories.length !== data.categoryIds.length) {
        throw new AppError(
          'Một hoặc nhiều danh mục được gán không tồn tại hoặc đang bị vô hiệu hóa',
          400,
          ERROR_CODE.CATEGORY_INACTIVE,
        );
      }
    }

    // Kiểm tra invariant: Theme ở trạng thái PUBLISHED phải có ít nhất 1 danh mục
    const targetStatus = data.status || existing.status;
    if (targetStatus === 'PUBLISHED') {
      const finalCategoryCount =
        data.categoryIds !== undefined
          ? data.categoryIds.length
          : (typeof this.repository.countThemeCategories === 'function'
              ? await this.repository.countThemeCategories(id)
              : 1);

      if (finalCategoryCount === 0) {
        throw new AppError(
          'Giao diện bàn phím phải thuộc ít nhất một danh mục trước khi phát hành (PUBLISHED)',
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    // Xử lý chuyển đổi trạng thái (State Transition)
    let publishedAt = existing.publishedAt;
    const isTransitioningToPublished = existing.status !== 'PUBLISHED' && data.status === 'PUBLISHED';

    if (data.status && data.status !== existing.status) {
      if (existing.status === 'PUBLISHED' && data.status === 'DRAFT') {
        throw new AppError(
          'Không thể chuyển trạng thái theme từ PUBLISHED về DRAFT. Vui lòng chuyển sang HIDDEN nếu muốn tạm ngừng phát hành.',
          400,
          ERROR_CODE.INVALID_STATUS_TRANSITION,
        );
      }

      if (data.status === 'PUBLISHED') {
        publishedAt = existing.publishedAt || new Date();
      }
    }

    const updated = await this.repository.update(id, {
      ...data,
      slug,
      publishedAt,
      updatedBy: actorId,
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_KEYBOARD,
      targetType: AUDIT_TARGET_TYPE.KEYBOARD_THEME,
      targetId: id,
      details: {
        before: { name: existing.name, status: existing.status, platform: existing.platform, accessLevel: existing.accessLevel },
        after: { name: updated.name, status: updated.status, platform: updated.platform, accessLevel: updated.accessLevel },
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    // Bắn thông báo qua Discord Webhook nếu chuyển trạng thái sang PUBLISHED và feature flag bật
    const isAnnouncementEnabled = await this.systemConfigService.isFeatureEnabled(
      FEATURE_FLAGS.THEME_ANNOUNCEMENT_WEBHOOK,
      true,
    );

    if (isAnnouncementEnabled && isTransitioningToPublished) {
      this.discordBotService
        .sendThemeAnnouncement({
          name: updated.name,
          slug: updated.slug,
          coverUrl: updated.coverUrl,
          description: updated.description,
          platform: updated.platform,
          accessLevel: updated.accessLevel,
        })
        .catch((err) => console.error('[Discord Webhook Error]', err));
    }

    return this.findManagementById(id);
  }

  async delete(
    id: string,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Giao diện bàn phím không tồn tại', 404, ERROR_CODE.THEME_NOT_FOUND);
    }

    const downloadCount = await this.repository.countDownloads(id);

    if (downloadCount > 0) {
      await this.repository.archive(id);

      await this.repository.createAuditLog({
        actorId,
        action: AUDIT_ACTION.ARCHIVE_KEYBOARD,
        targetType: AUDIT_TARGET_TYPE.KEYBOARD_THEME,
        targetId: id,
        details: { reason: 'Has existing download history', downloadCount },
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });

      return {
        message: 'Theme has existing download history and has been archived (hidden) instead of physically deleted',
        archived: true,
      };
    }

    await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_KEYBOARD,
      targetType: AUDIT_TARGET_TYPE.KEYBOARD_THEME,
      targetId: id,
      details: { name: existing.name, slug: existing.slug },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      message: 'Theme deleted successfully',
      archived: false,
    };
  }

  async toggleLike(
    slug: string,
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const isLikesEnabled = await this.systemConfigService.isFeatureEnabled(
      FEATURE_FLAGS.KEYBOARD_LIKES_ENABLED,
      true,
    );

    if (!isLikesEnabled) {
      throw new AppError('Tính năng yêu thích theme tạm thời bị vô hiệu hóa', 403, ERROR_CODE.FEATURE_DISABLED);
    }

    const theme = await this.repository.findBySlug(slug);
    if (!theme || theme.status !== 'PUBLISHED') {
      throw new AppError('Giao diện bàn phím không tồn tại hoặc chưa được phát hành', 404, ERROR_CODE.THEME_NOT_FOUND);
    }

    const result = await this.repository.toggleLike(userId, theme.id);

    await this.repository.createAuditLog({
      actorId: userId,
      action: result.liked ? AUDIT_ACTION.LIKE_KEYBOARD : AUDIT_ACTION.UNLIKE_KEYBOARD,
      targetType: AUDIT_TARGET_TYPE.KEYBOARD_THEME,
      targetId: theme.id,
      details: { liked: result.liked, likeCount: result.likeCount },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      themeId: theme.id,
      slug: theme.slug,
      liked: result.liked,
      likeCount: result.likeCount,
      message: result.liked ? 'Đã thêm vào danh sách yêu thích' : 'Đã bỏ yêu thích theme',
    };
  }

  async findUserLikedThemes(userId: string, page = 1, limit = 20) {
    return this.repository.findUserLikedThemes(userId, page, limit);
  }

  async processDownload(
    slug: string,
    user: { id: string; isActive?: boolean },
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<string> {
    if (typeof this.repository.findUserById === 'function') {
      const dbUser = await this.repository.findUserById(user.id);
      if (dbUser && !dbUser.isActive) {
        throw new AppError('Tài khoản của bạn đã bị vô hiệu hóa', 403, ERROR_CODE.USER_INACTIVE);
      }
    } else if (user.isActive === false) {
      throw new AppError('Tài khoản của bạn đã bị vô hiệu hóa', 403, ERROR_CODE.USER_INACTIVE);
    }

    const theme = await this.repository.findBySlug(slug);

    if (!theme || theme.status !== 'PUBLISHED') {
      throw new AppError(
        'Giao diện bàn phím không tồn tại hoặc chưa được phát hành',
        404,
        ERROR_CODE.THEME_NOT_FOUND,
      );
    }

    if (!theme.driveUrl) {
      throw new AppError(
        'Không tìm thấy đường dẫn tải file của giao diện này',
        404,
        ERROR_CODE.THEME_NOT_FOUND,
      );
    }

    // ── 1. Kiểm tra tài khoản Discord & Hội viên Server (nếu cần) ─────────────
    const isDiscordGatingEnabled = await this.systemConfigService.isFeatureEnabled(
      FEATURE_FLAGS.DISCORD_GATED_DOWNLOAD,
      true,
    );

    const userSocial = await this.repository.getUserDiscordSocial(user.id);
    let memberInfo: { inGuild: boolean; roles: string[] } = { inGuild: false, roles: [] };

    if (userSocial) {
      memberInfo = await this.discordBotService.getGuildMember(userSocial.providerUserId);
    }

    // Kiểm tra phân quyền truy cập theo Theme Access Level (khi tính năng Gated Download bật)
    if (isDiscordGatingEnabled && (theme.accessLevel === 'DISCORD_MEMBER' || theme.accessLevel === 'DISCORD_ROLE')) {
      if (!userSocial) {
        throw new AppError(
          'Giao diện này yêu cầu liên kết tài khoản Discord để tải về. Vui lòng đăng nhập hoặc liên kết Discord.',
          403,
          ERROR_CODE.DISCORD_NOT_LINKED,
          { inviteUrl: envConfig.discord.inviteUrl },
        );
      }

      if (!memberInfo.inGuild) {
        throw new AppError(
          'Vui lòng tham gia Discord Server của cộng đồng để mở khóa tải giao diện này!',
          403,
          ERROR_CODE.DISCORD_GUILD_REQUIRED,
          { inviteUrl: envConfig.discord.inviteUrl },
        );
      }

      if (theme.accessLevel === 'DISCORD_ROLE') {
        const hasRequiredRole =
          theme.requiredDiscordRoleIds &&
          theme.requiredDiscordRoleIds.length > 0 &&
          theme.requiredDiscordRoleIds.some((roleId) => memberInfo.roles.includes(roleId));

        if (!hasRequiredRole) {
          throw new AppError(
            'Giao diện này dành riêng cho thành viên sở hữu Role đặc biệt (Server Booster / VIP) trong Discord Server!',
            403,
            ERROR_CODE.DISCORD_ROLE_REQUIRED,
            {
              requiredRoleIds: theme.requiredDiscordRoleIds,
              inviteUrl: envConfig.discord.inviteUrl,
            },
          );
        }
      }
    }

    // ── 2. Kiểm tra Hạn mức Số lượt tải theo Cấp bậc (Tier Download Quotas) ───
    const isRedownload = await this.repository.hasUserDownloadedTheme(user.id, theme.id);

    // Nếu người dùng tải lại theme đã từng tải -> Cho phép tải lại miễn phí không trừ Quota
    if (!isRedownload) {
      const isQuotaEnabled = await this.systemConfigService.isFeatureEnabled(
        FEATURE_FLAGS.TIER_DOWNLOAD_QUOTA,
        true,
      );

      if (isQuotaEnabled) {
        // Xác định mốc thời gian bắt đầu tính Quota (theo chu kỳ chuẩn UTC+7 hoặc mốc reset thủ công)
        const cycle = await this.systemConfigService.get<string>('keyboard.quota_reset_cycle', 'MONTHLY');
        let sinceDate: Date | undefined = undefined;

        if (cycle === 'MONTHLY') {
          const nowVietnamStr = formatVietnamDate(new Date());
          const firstDayOfMonthStr = `${nowVietnamStr.slice(0, 7)}-01`;
          const { startOfDay } = getVietnamDayRange(firstDayOfMonthStr);
          sinceDate = startOfDay;
        }

        // Nếu người dùng từng được Admin reset thủ công thì lấy mốc mới hơn
        const userResetAt = await this.repository.getUserQuotaResetAt(user.id);
        if (userResetAt) {
          if (!sinceDate || userResetAt > sinceDate) {
            sinceDate = userResetAt;
          }
        }

        const downloadedUniqueCount = await this.repository.countUniqueThemesDownloadedByUser(
          user.id,
          sinceDate,
        );
        const freeLimit = await this.systemConfigService.get<number>('keyboard.tier_free_download_limit', 10);
        const memberLimit = await this.systemConfigService.get<number>('keyboard.tier_member_download_limit', 50);

        // Xác định Cấp bậc người dùng (hỗ trợ cả Discord Role ID và mock role name)
        const vipRoleIds = await this.systemConfigService.get<string[]>('discord.vip_role_ids', []);
        const isBoosterOrVip =
          memberInfo.inGuild &&
          (memberInfo.roles.some((r) => vipRoleIds.includes(r)) ||
            memberInfo.roles.some((r) => r.toUpperCase().includes('BOOSTER') || r.toUpperCase().includes('VIP')));

        if (isBoosterOrVip) {
          // VIP / Server Booster -> Unlimited Downloads
        } else if (memberInfo.inGuild) {
          // Discord Member -> Giới hạn theo memberLimit
          if (downloadedUniqueCount >= memberLimit) {
            throw new AppError(
              `Bạn đã đạt giới hạn tối đa ${memberLimit} giao diện bàn phím của Thành viên Discord (${cycle === 'MONTHLY' ? 'trong tháng này' : 'trọn đời'}). Hãy nâng cấp Server Booster / VIP để tải không giới hạn!`,
              403,
              ERROR_CODE.DOWNLOAD_QUOTA_EXCEEDED,
              {
                currentDownloads: downloadedUniqueCount,
                maxLimit: memberLimit,
                tier: 'DISCORD_MEMBER',
                nextTier: 'VIP_BOOSTER',
                resetCycle: cycle,
                inviteUrl: envConfig.discord.inviteUrl,
              },
            );
          }
        } else {
          // Free User (chưa join Discord Server) -> Giới hạn theo freeLimit
          if (downloadedUniqueCount >= freeLimit) {
            throw new AppError(
              `Bạn đã đạt giới hạn ${freeLimit} giao diện miễn phí (${cycle === 'MONTHLY' ? 'trong tháng này' : 'trọn đời'}). Vui lòng tham gia Discord Server cộng đồng để mở khóa thêm ${memberLimit} giao diện!`,
              403,
              ERROR_CODE.DOWNLOAD_QUOTA_EXCEEDED,
              {
                currentDownloads: downloadedUniqueCount,
                maxLimit: freeLimit,
                tier: 'FREE_USER',
                nextTier: 'DISCORD_MEMBER',
                resetCycle: cycle,
                inviteUrl: envConfig.discord.inviteUrl,
              },
            );
          }
        }
      }
    }

    try {
      await this.repository.recordDownloadAndIncrement(user.id, theme.id, metadata);
    } catch (error) {
      console.error('[Download Transaction Failed]', error);
      throw new AppError(
        'Không thể xử lý yêu cầu tải file. Vui lòng thử lại sau.',
        500,
        ERROR_CODE.DOWNLOAD_TRANSACTION_FAILED,
      );
    }

    return theme.driveUrl;
  }

  /**
   * Quản trị viên chủ động reset hạn mức tải về cho một người dùng cụ thể
   */
  async resetUserQuota(
    targetUserId: string,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const resetAt = await this.repository.resetUserDownloadQuota(targetUserId);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.RESET_DOWNLOAD_QUOTA,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: targetUserId,
      details: { resetAt },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      userId: targetUserId,
      resetAt,
      message: 'Đã reset hạn mức tải về của người dùng thành công',
    };
  }
}

export const keyboardService = new KeyboardService();
