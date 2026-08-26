import { StudioRepository } from './studio.repository';
import { KeyboardService } from '../keyboard/keyboard.service';
import { systemConfigService, SystemConfigService } from '../system-config/system-config.service';
import {
  StudioThemeQueryDto,
  StudioCreateThemeDto,
  StudioUpdateThemeDto,
  StudioUpdateProfileDto,
  StudioApplyDto,
} from './studio.dto';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';
import { FEATURE_FLAGS } from '../../common/constants/system-config.constant';

export class StudioService {
  private readonly repository = new StudioRepository();
  private readonly keyboardService = new KeyboardService();
  private readonly systemConfigService: SystemConfigService = systemConfigService;

  private async ensureCreatorStudioEnabled() {
    const isEnabled = await this.systemConfigService.isFeatureEnabled(
      FEATURE_FLAGS.CREATOR_STUDIO_ENABLED,
      true,
    );
    if (!isEnabled) {
      throw new AppError('Creator Studio hiện đang tạm khóa hoặc bảo trì', 403, ERROR_CODE.FEATURE_DISABLED);
    }
  }

  private async ensureCreatorUser(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user || !user.isActive) {
      throw new AppError('Tài khoản của bạn đã bị khóa hoặc không tồn tại', 403, ERROR_CODE.USER_INACTIVE);
    }
    if (!user.isCreator) {
      throw new AppError(
        'Bạn chưa đăng ký tài khoản Creator. Vui lòng gửi yêu cầu trở thành Creator qua Creator Studio Apply.',
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }
    return user;
  }

  async getDashboardStats(userId: string) {
    await this.ensureCreatorStudioEnabled();
    await this.ensureCreatorUser(userId);
    return this.repository.getCreatorStudioStats(userId);
  }

  async getCreatorThemes(userId: string, query: StudioThemeQueryDto) {
    await this.ensureCreatorStudioEnabled();
    await this.ensureCreatorUser(userId);
    return this.repository.findCreatorThemes(userId, query);
  }

  async createTheme(
    userId: string,
    data: StudioCreateThemeDto,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.ensureCreatorStudioEnabled();
    await this.ensureCreatorUser(userId);
    return this.keyboardService.create(data, userId, metadata);
  }

  async updateTheme(
    userId: string,
    themeId: string,
    data: StudioUpdateThemeDto,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.ensureCreatorStudioEnabled();
    await this.ensureCreatorUser(userId);

    const existing = await this.repository.findCreatorThemeById(userId, themeId);
    if (!existing) {
      throw new AppError(
        'Theme không tồn tại hoặc bạn không phải là tác giả của theme này',
        404,
        ERROR_CODE.THEME_NOT_FOUND,
      );
    }

    return this.keyboardService.update(themeId, data, userId, metadata);
  }

  async deleteTheme(
    userId: string,
    themeId: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.ensureCreatorStudioEnabled();
    await this.ensureCreatorUser(userId);

    const existing = await this.repository.findCreatorThemeById(userId, themeId);
    if (!existing) {
      throw new AppError(
        'Theme không tồn tại hoặc bạn không phải là tác giả của theme này',
        404,
        ERROR_CODE.THEME_NOT_FOUND,
      );
    }

    return this.keyboardService.delete(themeId, userId, metadata);
  }

  async updateProfile(
    userId: string,
    data: StudioUpdateProfileDto,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.ensureCreatorStudioEnabled();
    await this.ensureCreatorUser(userId);

    if (data.username) {
      const isTaken = await this.repository.isUsernameTaken(data.username, userId);
      if (isTaken) {
        throw new AppError('Tên người dùng (username) này đã có người sử dụng', 409, ERROR_CODE.USERNAME_ALREADY_TAKEN);
      }
    }

    const updated = await this.repository.updateProfile(userId, data);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.UPDATE_CREATOR_PROFILE,
      targetType: AUDIT_TARGET_TYPE.CREATOR_PROFILE,
      targetId: userId,
      details: { username: updated.username, fullName: updated.fullName },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return updated;
  }

  async applyCreator(
    userId: string,
    data: StudioApplyDto,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.ensureCreatorStudioEnabled();

    const user = await this.repository.findUserById(userId);
    if (!user || !user.isActive) {
      throw new AppError('Tài khoản của bạn đã bị khóa hoặc không tồn tại', 403, ERROR_CODE.USER_INACTIVE);
    }

    if (user.isCreator) {
      throw new AppError('Bạn đã là Người sáng tạo (Creator) trên nền tảng', 400, ERROR_CODE.ALREADY_CREATOR);
    }

    const isTaken = await this.repository.isUsernameTaken(data.username, userId);
    if (isTaken) {
      throw new AppError('Tên người dùng (username) này đã có người sử dụng', 409, ERROR_CODE.USERNAME_ALREADY_TAKEN);
    }

    const creator = await this.repository.applyCreator(userId, data);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.APPLY_CREATOR,
      targetType: AUDIT_TARGET_TYPE.CREATOR_PROFILE,
      targetId: userId,
      details: { username: creator.username },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      message: 'Chúc mừng bạn đã trở thành Người sáng tạo (Creator) trên KeyboardHub!',
      creator,
    };
  }
}

export const studioService = new StudioService();
