import { prisma } from '../../database/prisma.client';
import { ActivitySummaryStatsDto } from './cron.dto';

export class CronRepository {
  /**
   * Xóa toàn bộ các bản ghi Audit Logs tạo trước thời điểm cutoffDate
   */
  async deleteAuditLogsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    return result.count;
  }

  /**
   * Xóa toàn bộ các token xác thực và phiên đã hết hạn
   */
  async deleteExpiredTokens(cutoffDate: Date): Promise<{
    refreshTokensCount: number;
    verificationTokensCount: number;
    passwordResetTokensCount: number;
  }> {
    const [refreshRes, verifyRes, resetRes] = await prisma.$transaction([
      prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: cutoffDate } },
      }),
      prisma.verificationToken.deleteMany({
        where: { expiresAt: { lt: cutoffDate } },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: cutoffDate } },
      }),
    ]);

    return {
      refreshTokensCount: refreshRes.count,
      verificationTokensCount: verifyRes.count,
      passwordResetTokensCount: resetRes.count,
    };
  }

  /**
   * Lấy toàn bộ danh sách avatarUrl hiện tại của các User đang lưu trong DB
   */
  async getAllUserAvatarUrls(): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: {
        avatarUrl: { not: null },
      },
      select: {
        avatarUrl: true,
      },
    });

    return users
      .map((u) => u.avatarUrl)
      .filter((url): url is string => Boolean(url));
  }

  /**
   * Lấy toàn bộ danh sách coverUrl và previewImages của KeyboardTheme đang lưu trong DB
   */
  async getAllThemeImageUrls(): Promise<string[]> {
    const [themes, previewImages] = await Promise.all([
      prisma.keyboardTheme.findMany({
        select: { coverUrl: true },
      }),
      prisma.keyboardImage.findMany({
        select: { url: true },
      }),
    ]);

    const urls = new Set<string>();
    for (const t of themes) {
      if (t.coverUrl) urls.add(t.coverUrl);
    }
    for (const p of previewImages) {
      if (p.url) urls.add(p.url);
    }
    return Array.from(urls);
  }


  /**
   * Tổng hợp thống kê hoạt động hệ thống trong khoảng thời gian từ startDate đến endDate
   */
  async getActivityStats(startDate: Date, endDate: Date): Promise<ActivitySummaryStatsDto> {
    const [
      newUsersCount,
      activeSessionsCount,
      notificationsSentCount,
      emailsSentCount,
      webhookDeliveriesCount,
      auditLogsCount,
    ] = await prisma.$transaction([
      prisma.user.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.refreshToken.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.notification.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.emailNotification.count({
        where: {
          status: 'SENT',
          sentAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.webhookDelivery.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    return {
      newUsersCount,
      activeSessionsCount,
      notificationsSentCount,
      emailsSentCount,
      webhookDeliveriesCount,
      auditLogsCount,
    };
  }

  /**
   * Lấy danh sách email của tất cả người dùng có quyền Quản trị (vai trò ADMIN / SUPER_ADMIN)
   */
  async findAdminUsers(): Promise<Array<{ id: string; email: string; fullName: string | null }>> {
    const admins = await prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        email: { not: null },
        role: {
          name: { in: ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] },
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    return admins as Array<{ id: string; email: string; fullName: string | null }>;
  }

  /**
   * Tạo bản ghi Audit Log ghi vết thao tác Cron Job
   */
  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: (data.details as any) || null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  /**
   * Lấy lịch sử lần chạy gần nhất của các Cron Jobs từ Audit Logs
   */
  async getLatestRunsForJobs(jobNames: string[]): Promise<Map<string, { lastRun: Date; status: string }>> {
    const logs = await prisma.auditLog.findMany({
      where: {
        targetType: 'CRON_JOB',
        targetId: { in: jobNames },
      },
      orderBy: {
        createdAt: 'desc',
      },
      distinct: ['targetId'],
      select: {
        targetId: true,
        createdAt: true,
      },
    });

    const map = new Map<string, { lastRun: Date; status: string }>();
    for (const log of logs) {
      map.set(log.targetId, { lastRun: log.createdAt, status: 'SUCCESS' });
    }
    return map;
  }

  /**
   * Lấy cấu hình trạng thái Bật/Tắt của các Cron Jobs từ bảng SystemConfig
   */
  async getJobStatuses(): Promise<Record<string, boolean>> {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'CRON_JOB_STATUSES' },
    });

    if (!config || !config.value || typeof config.value !== 'object') {
      return {};
    }

    return config.value as Record<string, boolean>;
  }

  /**
   * Cập nhật trạng thái Bật/Tắt của một Cron Job vào bảng SystemConfig
   */
  async setJobStatus(jobName: string, enabled: boolean): Promise<Record<string, boolean>> {
    const current = await this.getJobStatuses();
    const updated = { ...current, [jobName]: enabled };

    await prisma.systemConfig.upsert({
      where: { key: 'CRON_JOB_STATUSES' },
      update: {
        value: updated,
        updatedAt: new Date(),
      },
      create: {
        key: 'CRON_JOB_STATUSES',
        value: updated,
        category: 'CRON',
        description: 'Trạng thái kích hoạt tự động của các tác vụ định kỳ Cron Jobs',
        isPublic: false,
      },
    });

    return updated;
  }
}

export const cronRepository = new CronRepository();
