import { CreatorRepository } from './creator.repository';
import { CreatorQueryDto, CreatorPublicProfileDto, CreatorApplicationQueryDto } from './creator.dto';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';

export class CreatorService {
  private readonly repository = new CreatorRepository();

  async findPublicList(query: CreatorQueryDto) {
    return this.repository.findPublicList(query);
  }

  async getProfileByUsername(
    username: string,
    currentUserId?: string,
  ): Promise<CreatorPublicProfileDto> {
    const creator = await this.repository.findByUsername(username);

    if (!creator) {
      throw new AppError('Người sáng tạo (Creator) không tồn tại', 404, ERROR_CODE.CREATOR_NOT_FOUND);
    }

    const [stats, isFollowing] = await Promise.all([
      this.repository.getCreatorStats(creator.id),
      currentUserId ? this.repository.isUserFollowing(currentUserId, creator.id) : false,
    ]);

    return {
      id: creator.id,
      fullName: creator.fullName,
      username: creator.username!,
      bio: creator.bio,
      avatarUrl: creator.avatarUrl,
      bannerUrl: creator.bannerUrl,
      isCreator: creator.isCreator,
      isFeaturedCreator: creator.isFeaturedCreator,
      socialLinks: (creator.socialLinks as Record<string, string>) || null,
      stats,
      isFollowing: currentUserId ? isFollowing : undefined,
      joinedAt: creator.createdAt,
    };
  }

  async toggleFollow(
    username: string,
    currentUserId: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const creator = await this.repository.findByUsername(username);

    if (!creator) {
      throw new AppError('Người sáng tạo (Creator) không tồn tại', 404, ERROR_CODE.CREATOR_NOT_FOUND);
    }

    if (creator.id === currentUserId) {
      throw new AppError('Bạn không thể tự theo dõi chính mình', 400, ERROR_CODE.CANNOT_FOLLOW_SELF);
    }

    const result = await this.repository.toggleFollow(currentUserId, creator.id);

    await this.repository.createAuditLog({
      actorId: currentUserId,
      action: result.isFollowing ? AUDIT_ACTION.FOLLOW_CREATOR : AUDIT_ACTION.UNFOLLOW_CREATOR,
      targetType: AUDIT_TARGET_TYPE.CREATOR_PROFILE,
      targetId: creator.id,
      details: {
        username: creator.username,
        isFollowing: result.isFollowing,
        followerCount: result.followerCount,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      creatorId: creator.id,
      username: creator.username!,
      isFollowing: result.isFollowing,
      followerCount: result.followerCount,
      message: result.isFollowing ? `Đã theo dõi @${creator.username}` : `Đã bỏ theo dõi @${creator.username}`,
    };
  }

  async getUserFollowing(userId: string, page = 1, limit = 20) {
    return this.repository.getUserFollowingList(userId, page, limit);
  }

  async findApplications(query: CreatorApplicationQueryDto) {
    return this.repository.findApplications(query);
  }

  async approveApplication(
    userId: string,
    adminId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError('Người dùng không tồn tại', 404, ERROR_CODE.NOT_FOUND);
    }

    if (user.isCreator) {
      throw new AppError('Người dùng này đã là Người sáng tạo (Creator)', 400, ERROR_CODE.ALREADY_CREATOR);
    }

    const updated = await this.repository.approveApplication(userId);

    await this.repository.createAuditLog({
      actorId: adminId,
      action: AUDIT_ACTION.APPROVE_CREATOR,
      targetType: AUDIT_TARGET_TYPE.CREATOR_PROFILE,
      targetId: userId,
      details: { username: updated.username },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      message: `Đã phê duyệt đơn đăng ký Creator cho @${updated.username}`,
      creator: updated,
    };
  }

  async rejectApplication(
    userId: string,
    reason?: string,
    adminId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError('Người dùng không tồn tại', 404, ERROR_CODE.NOT_FOUND);
    }

    const updated = await this.repository.rejectApplication(userId, reason);

    await this.repository.createAuditLog({
      actorId: adminId,
      action: AUDIT_ACTION.REJECT_CREATOR,
      targetType: AUDIT_TARGET_TYPE.CREATOR_PROFILE,
      targetId: userId,
      details: { username: updated.username, reason },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      message: `Đã từ chối đơn đăng ký Creator của @${updated.username}`,
      creator: updated,
    };
  }

  async revokeCreator(
    userId: string,
    adminId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError('Người dùng không tồn tại', 404, ERROR_CODE.NOT_FOUND);
    }

    if (!user.isCreator) {
      throw new AppError('Người dùng này không phải là Người sáng tạo (Creator)', 400, ERROR_CODE.CREATOR_NOT_FOUND);
    }

    const updated = await this.repository.revokeCreator(userId);

    await this.repository.createAuditLog({
      actorId: adminId,
      action: AUDIT_ACTION.REVOKE_CREATOR,
      targetType: AUDIT_TARGET_TYPE.CREATOR_PROFILE,
      targetId: userId,
      details: { username: updated.username },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      message: `Đã thu hồi tư cách Creator của @${updated.username}`,
      creator: updated,
    };
  }
}

export const creatorService = new CreatorService();
