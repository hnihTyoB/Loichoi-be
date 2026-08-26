import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import {
  StudioStatsDto,
  StudioThemeQueryDto,
  StudioUpdateProfileDto,
  StudioApplyDto,
} from './studio.dto';
import { formatVietnamDate } from '../../common/helpers/date.helper';

export class StudioRepository {
  async getCreatorStudioStats(userId: string): Promise<StudioStatsDto> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalThemes,
      publishedThemesCount,
      draftThemesCount,
      themeStats,
      followersCount,
      topThemesRaw,
      recentDownloads,
    ] = await Promise.all([
      prisma.keyboardTheme.count({ where: { createdBy: userId } }),
      prisma.keyboardTheme.count({ where: { createdBy: userId, status: 'PUBLISHED' } }),
      prisma.keyboardTheme.count({ where: { createdBy: userId, status: 'DRAFT' } }),
      prisma.keyboardTheme.aggregate({
        where: { createdBy: userId },
        _sum: { downloadCount: true, likeCount: true },
      }),
      prisma.userFollow.count({ where: { followingId: userId } }),
      prisma.keyboardTheme.findMany({
        where: { createdBy: userId },
        orderBy: [{ downloadCount: 'desc' }, { likeCount: 'desc' }],
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          coverUrl: true,
          downloadCount: true,
          likeCount: true,
          status: true,
        },
      }),
      prisma.download.findMany({
        where: {
          theme: { createdBy: userId },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Nhóm lượt tải theo từng ngày (YYYY-MM-DD) theo múi giờ chuẩn VN UTC+7
    const downloadsByDate: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const dateStr = formatVietnamDate(d);
      downloadsByDate[dateStr] = 0;
    }

    for (const dl of recentDownloads) {
      const dateStr = formatVietnamDate(dl.createdAt);
      if (downloadsByDate[dateStr] !== undefined) {
        downloadsByDate[dateStr]++;
      } else {
        downloadsByDate[dateStr] = 1;
      }
    }

    const recentDownloadsTrend = Object.entries(downloadsByDate).map(([date, downloads]) => ({
      date,
      downloads,
    }));

    return {
      totalThemes,
      publishedThemesCount,
      draftThemesCount,
      totalDownloads: themeStats._sum.downloadCount || 0,
      totalLikes: themeStats._sum.likeCount || 0,
      totalFollowers: followersCount,
      recentDownloadsTrend,
      topThemes: topThemesRaw.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        coverUrl: t.coverUrl,
        downloadCount: t.downloadCount,
        likeCount: t.likeCount,
        status: t.status as any,
      })),
    };
  }

  async findCreatorThemes(userId: string, query: StudioThemeQueryDto) {
    const { page = 1, limit = 20, search, status, categoryId, sort = 'createdAt_desc' } = query;

    const where: Prisma.KeyboardThemeWhereInput = {
      createdBy: userId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(status ? { status } : {}),
      ...(categoryId ? { categories: { some: { categoryId } } } : {}),
    };

    let orderBy: Prisma.KeyboardThemeOrderByWithRelationInput = { createdAt: 'desc' };
    if (sort === 'createdAt_asc') orderBy = { createdAt: 'asc' };
    else if (sort === 'downloadCount_desc') orderBy = { downloadCount: 'desc' };
    else if (sort === 'likeCount_desc') orderBy = { likeCount: 'desc' };
    else if (sort === 'name_asc') orderBy = { name: 'asc' };

    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.keyboardTheme.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          categories: {
            include: {
              category: true,
            },
          },
        },
      }),
      prisma.keyboardTheme.count({ where }),
    ]);

    const data = items.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      coverUrl: item.coverUrl,
      driveUrl: item.driveUrl,
      platform: item.platform as any,
      status: item.status as any,
      accessLevel: item.accessLevel as any,
      requiredDiscordRoleIds: item.requiredDiscordRoleIds,
      downloadCount: item.downloadCount,
      likeCount: item.likeCount,
      isFeatured: item.isFeatured,
      publishedAt: item.publishedAt,
      categoryNames: item.categories.map((c) => c.category.name),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findCreatorThemeById(userId: string, themeId: string) {
    return prisma.keyboardTheme.findFirst({
      where: {
        id: themeId,
        createdBy: userId,
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        previewImages: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  async isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        deletedAt: null,
      },
      select: { id: true },
    });
    return !!user;
  }

  async updateProfile(userId: string, data: StudioUpdateProfileDto) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        fullName: data.fullName,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        bannerUrl: data.bannerUrl,
        socialLinks: data.socialLinks !== undefined ? (data.socialLinks as any) : undefined,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        isCreator: true,
        isFeaturedCreator: true,
        socialLinks: true,
      },
    });
  }

  async applyCreator(userId: string, data: StudioApplyDto) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        bio: data.bio,
        socialLinks: data.socialLinks as any,
        creatorStatus: 'PENDING',
        creatorAppliedAt: new Date(),
        creatorRejectReason: null,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        isCreator: true,
        creatorStatus: true,
        creatorAppliedAt: true,
        isFeaturedCreator: true,
        socialLinks: true,
      },
    });
  }

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        username: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        isCreator: true,
        creatorStatus: true,
        creatorAppliedAt: true,
        isFeaturedCreator: true,
        socialLinks: true,
        isActive: true,
      },
    });
  }

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}

export const studioRepository = new StudioRepository();
