import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { CreatorQueryDto, CreatorProfileStatsDto } from './creator.dto';

export class CreatorRepository {
  async getCreatorStats(userId: string): Promise<CreatorProfileStatsDto> {
    const [themesCount, downloadStats, followersCount, collectionsCount] = await Promise.all([
      prisma.keyboardTheme.count({
        where: {
          createdBy: userId,
          status: 'PUBLISHED',
        },
      }),
      prisma.keyboardTheme.aggregate({
        where: {
          createdBy: userId,
          status: 'PUBLISHED',
        },
        _sum: {
          downloadCount: true,
          likeCount: true,
        },
      }),
      prisma.userFollow.count({
        where: {
          followingId: userId,
        },
      }),
      prisma.collection.count({
        where: {
          userId,
          isPublic: true,
        },
      }),
    ]);

    return {
      themesCount,
      downloadsCount: downloadStats._sum.downloadCount || 0,
      likesCount: downloadStats._sum.likeCount || 0,
      followersCount,
      collectionsCount,
    };
  }

  async findByUsername(username: string) {
    return prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
        deletedAt: null,
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
        createdAt: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
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
        createdAt: true,
      },
    });
  }

  async findPublicList(query: CreatorQueryDto) {
    const { page = 1, limit = 20, search, isFeatured, sort = 'TOP_FOLLOWERS' } = query;

    const where: Prisma.UserWhereInput = {
      isCreator: true,
      deletedAt: null,
      username: { not: null },
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
              { bio: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(isFeatured !== undefined ? { isFeaturedCreator: isFeatured } : {}),
    };

    let orderBy: Prisma.UserOrderByWithRelationInput[] = [{ createdAt: 'desc' }];
    if (sort === 'NAME_ASC') {
      orderBy = [{ fullName: 'asc' }, { username: 'asc' }];
    } else if (sort === 'NAME_DESC') {
      orderBy = [{ fullName: 'desc' }, { username: 'desc' }];
    } else if (sort === 'LATEST') {
      orderBy = [{ createdAt: 'desc' }];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          username: true,
          bio: true,
          avatarUrl: true,
          bannerUrl: true,
          isCreator: true,
          isFeaturedCreator: true,
          createdAt: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Lấy stats cho danh sách creator
    const dataWithStats = await Promise.all(
      users.map(async (user) => {
        const stats = await this.getCreatorStats(user.id);
        return {
          id: user.id,
          fullName: user.fullName,
          username: user.username!,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          bannerUrl: user.bannerUrl,
          isCreator: user.isCreator,
          isFeaturedCreator: user.isFeaturedCreator,
          stats,
        };
      }),
    );

    // Xử lý sắp xếp theo số liệu tổng hợp nếu có yêu cầu
    if (sort === 'TOP_FOLLOWERS') {
      dataWithStats.sort((a, b) => b.stats.followersCount - a.stats.followersCount);
    } else if (sort === 'TOP_DOWNLOADS') {
      dataWithStats.sort((a, b) => b.stats.downloadsCount - a.stats.downloadsCount);
    } else if (sort === 'TOP_THEMES') {
      dataWithStats.sort((a, b) => b.stats.themesCount - a.stats.themesCount);
    }

    return {
      data: dataWithStats,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async isUserFollowing(followerId: string, followingId: string): Promise<boolean> {
    const record = await prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
      select: { id: true },
    });
    return !!record;
  }

  async toggleFollow(
    followerId: string,
    followingId: string,
  ): Promise<{ isFollowing: boolean; followerCount: number }> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (existing) {
        await tx.userFollow.delete({
          where: { id: existing.id },
        });
        const followerCount = await tx.userFollow.count({
          where: { followingId },
        });
        return { isFollowing: false, followerCount };
      } else {
        await tx.userFollow.create({
          data: {
            followerId,
            followingId,
          },
        });
        const followerCount = await tx.userFollow.count({
          where: { followingId },
        });
        return { isFollowing: true, followerCount };
      }
    });
  }

  async getUserFollowingList(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: Prisma.UserFollowWhereInput = {
      followerId: userId,
      following: { deletedAt: null },
    };

    const [follows, total] = await prisma.$transaction([
      prisma.userFollow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
            select: {
              id: true,
              fullName: true,
              username: true,
              bio: true,
              avatarUrl: true,
              bannerUrl: true,
              isCreator: true,
              isFeaturedCreator: true,
            },
          },
        },
      }),
      prisma.userFollow.count({ where }),
    ]);

    const data = await Promise.all(
      follows.map(async (f) => {
        const stats = await this.getCreatorStats(f.following.id);
        return {
          id: f.following.id,
          fullName: f.following.fullName,
          username: f.following.username || '',
          bio: f.following.bio,
          avatarUrl: f.following.avatarUrl,
          bannerUrl: f.following.bannerUrl,
          isCreator: f.following.isCreator,
          isFeaturedCreator: f.following.isFeaturedCreator,
          stats,
          followedAt: f.createdAt,
        };
      }),
    );

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

export const creatorRepository = new CreatorRepository();
