import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import {
  KeyboardQueryDto,
  KeyboardManagementQueryDto,
  CreateKeyboardDto,
  UpdateKeyboardDto,
} from './keyboard.dto';

const authorSelect = {
  id: true,
  fullName: true,
  username: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const publicThemeSelect = {
  id: true,
  name: true,
  slug: true,
  coverUrl: true,
  platform: true,
  accessLevel: true,
  requiredDiscordRoleIds: true,
  downloadCount: true,
  likeCount: true,
  isFeatured: true,
  publishedAt: true,
  author: {
    select: authorSelect,
  },
  categories: {
    where: {
      category: { isActive: true },
    },
    select: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
  colors: {
    select: {
      color: {
        select: {
          id: true,
          name: true,
          slug: true,
          hex: true,
        },
      },
    },
  },
  styles: {
    select: {
      style: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.KeyboardThemeSelect;

export class KeyboardRepository {
  async findPublicList(query: KeyboardQueryDto, currentUserId?: string) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      categories,
      color,
      colors,
      style,
      styles,
      platform,
      accessLevel,
      isFeatured,
      creator,
      sort = 'LATEST',
    } = query;

    const categorySlugs: string[] = [];
    if (categories) {
      categorySlugs.push(...categories.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
    } else if (category) {
      categorySlugs.push(category.trim().toLowerCase());
    }

    const colorSlugs: string[] = [];
    if (colors) {
      colorSlugs.push(...colors.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
    } else if (color) {
      colorSlugs.push(color.trim().toLowerCase());
    }

    const styleSlugs: string[] = [];
    if (styles) {
      styleSlugs.push(...styles.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
    } else if (style) {
      styleSlugs.push(style.trim().toLowerCase());
    }

    const where: Prisma.KeyboardThemeWhereInput = {
      status: 'PUBLISHED',
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(categorySlugs.length > 0
        ? {
            categories: {
              some: {
                category: {
                  slug: { in: categorySlugs },
                  isActive: true,
                },
              },
            },
          }
        : {}),
      ...(colorSlugs.length > 0
        ? {
            colors: {
              some: {
                color: {
                  slug: { in: colorSlugs },
                },
              },
            },
          }
        : {}),
      ...(styleSlugs.length > 0
        ? {
            styles: {
              some: {
                style: {
                  slug: { in: styleSlugs },
                },
              },
            },
          }
        : {}),
      ...(platform === 'IOS'
        ? { platform: { in: ['IOS', 'BOTH'] } }
        : platform === 'ANDROID'
          ? { platform: { in: ['ANDROID', 'BOTH'] } }
          : platform === 'BOTH'
            ? { platform: 'BOTH' }
            : {}),
      ...(accessLevel ? { accessLevel } : {}),
      ...(isFeatured !== undefined ? { isFeatured } : {}),
      ...(creator
        ? {
            author: {
              username: creator,
            },
          }
        : {}),
    };

    let orderBy: Prisma.KeyboardThemeOrderByWithRelationInput[] = [
      { publishedAt: 'desc' },
      { id: 'desc' },
    ];

    if (sort === 'POPULAR' || sort === 'TOP_DOWNLOADED') {
      orderBy = [{ downloadCount: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }];
    } else if (sort === 'TOP_LIKED') {
      orderBy = [{ likeCount: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }];
    } else if (sort === 'NAME_ASC') {
      orderBy = [{ name: 'asc' }, { id: 'asc' }];
    } else if (sort === 'NAME_DESC') {
      orderBy = [{ name: 'desc' }, { id: 'desc' }];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.keyboardTheme.findMany({
        where,
        select: publicThemeSelect,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.keyboardTheme.count({ where }),
    ]);

    let likedThemeIds = new Set<string>();
    if (currentUserId && items.length > 0) {
      const themeIds = items.map((i) => i.id);
      const likes = await prisma.keyboardLike.findMany({
        where: {
          userId: currentUserId,
          keyboardThemeId: { in: themeIds },
        },
        select: { keyboardThemeId: true },
      });
      likedThemeIds = new Set(likes.map((l) => l.keyboardThemeId));
    }

    const data = items.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      coverUrl: item.coverUrl,
      platform: item.platform as any,
      accessLevel: item.accessLevel as any,
      requiredDiscordRoleIds: item.requiredDiscordRoleIds,
      downloadCount: item.downloadCount,
      likeCount: item.likeCount,
      isFeatured: item.isFeatured,
      isLiked: currentUserId ? likedThemeIds.has(item.id) : undefined,
      publishedAt: item.publishedAt,
      author: item.author,
      categories: item.categories.map((c) => c.category),
      colors: item.colors.map((c) => c.color),
      styles: item.styles.map((s) => s.style),
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

  async findPublicBySlug(slug: string, currentUserId?: string) {
    const item = await prisma.keyboardTheme.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        coverUrl: true,
        platform: true,
        accessLevel: true,
        requiredDiscordRoleIds: true,
        downloadCount: true,
        likeCount: true,
        isFeatured: true,
        publishedAt: true,
        author: {
          select: authorSelect,
        },
        categories: {
          where: {
            category: { isActive: true },
          },
          select: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        colors: {
          select: {
            color: {
              select: {
                id: true,
                name: true,
                slug: true,
                hex: true,
              },
            },
          },
        },
        styles: {
          select: {
            style: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
              },
            },
          },
        },
        previewImages: {
          select: {
            id: true,
            url: true,
            altText: true,
            position: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!item) return null;

    let isLiked: boolean | undefined = undefined;
    if (currentUserId) {
      const likeRecord = await prisma.keyboardLike.findUnique({
        where: {
          userId_keyboardThemeId: {
            userId: currentUserId,
            keyboardThemeId: item.id,
          },
        },
      });
      isLiked = !!likeRecord;
    }

    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      coverUrl: item.coverUrl,
      platform: item.platform as any,
      accessLevel: item.accessLevel as any,
      requiredDiscordRoleIds: item.requiredDiscordRoleIds,
      downloadCount: item.downloadCount,
      likeCount: item.likeCount,
      isFeatured: item.isFeatured,
      isLiked,
      publishedAt: item.publishedAt,
      author: item.author,
      categories: item.categories.map((c) => c.category),
      colors: item.colors.map((c) => c.color),
      styles: item.styles.map((s) => s.style),
      previewImages: item.previewImages,
    };
  }

  async findManagementList(query: KeyboardManagementQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      categoryId,
      colorId,
      styleId,
      platform,
      isFeatured,
      sort = 'createdAt_desc',
    } = query;

    const where: Prisma.KeyboardThemeWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
      ...(categoryId ? { categories: { some: { categoryId } } } : {}),
      ...(colorId ? { colors: { some: { colorId } } } : {}),
      ...(styleId ? { styles: { some: { styleId } } } : {}),
      ...(platform ? { platform } : {}),
      ...(isFeatured !== undefined ? { isFeatured } : {}),
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
          author: { select: authorSelect },
          categories: {
            include: {
              category: true,
            },
          },
          colors: {
            include: {
              color: true,
            },
          },
          styles: {
            include: {
              style: true,
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
      author: item.author,
      categoryNames: item.categories.map((c) => c.category.name),
      colorNames: item.colors.map((c) => c.color.name),
      styleNames: item.styles.map((s) => s.style.name),
      colors: item.colors.map((c) => c.color),
      styles: item.styles.map((s) => s.style),
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

  async findManagementById(id: string) {
    const item = await prisma.keyboardTheme.findUnique({
      where: { id },
      include: {
        author: { select: authorSelect },
        categories: {
          include: {
            category: true,
          },
        },
        colors: {
          include: {
            color: true,
          },
        },
        styles: {
          include: {
            style: true,
          },
        },
        previewImages: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!item) return null;

    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
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
      author: item.author,
      categories: item.categories.map((c) => ({
        id: c.category.id,
        name: c.category.name,
        slug: c.category.slug,
        isActive: c.category.isActive,
      })),
      colors: item.colors.map((c) => c.color),
      styles: item.styles.map((s) => s.style),
      previewImages: item.previewImages,
      createdBy: item.createdBy,
      updatedBy: item.updatedBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  findById(id: string) {
    return prisma.keyboardTheme.findUnique({
      where: { id },
      include: {
        author: { select: authorSelect },
        colors: {
          include: {
            color: true,
          },
        },
        styles: {
          include: {
            style: true,
          },
        },
        previewImages: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }


  findByIds(ids: string[]) {
    return prisma.keyboardTheme.findMany({
      where: { id: { in: ids }, status: 'PUBLISHED' },
      select: { id: true },
    });
  }

  findBySlug(slug: string) {
    return prisma.keyboardTheme.findUnique({
      where: { slug },
      include: { author: { select: authorSelect } },
    });
  }

  async create(
    data: CreateKeyboardDto & { slug: string; publishedAt?: Date | null; createdBy?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const theme = await tx.keyboardTheme.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          coverUrl: data.coverUrl,
          driveUrl: data.driveUrl,
          platform: data.platform,
          status: data.status || 'DRAFT',
          accessLevel: data.accessLevel || 'FREE',
          requiredDiscordRoleIds: data.requiredDiscordRoleIds || [],
          isFeatured: data.isFeatured || false,
          publishedAt: data.publishedAt,
          createdBy: data.createdBy,
          categories: {
            create: data.categoryIds.map((categoryId) => ({
              categoryId,
            })),
          },
          colors:
            data.colorIds && data.colorIds.length > 0
              ? {
                  create: data.colorIds.map((colorId) => ({
                    colorId,
                  })),
                }
              : undefined,
          styles:
            data.styleIds && data.styleIds.length > 0
              ? {
                  create: data.styleIds.map((styleId) => ({
                    styleId,
                  })),
                }
              : undefined,
          previewImages:
            data.previewImages && data.previewImages.length > 0
              ? {
                  create: data.previewImages.map((img) => ({
                    url: img.url,
                    altText: img.altText,
                    position: img.position,
                  })),
                }
              : undefined,
        },
      });

      return theme;
    });
  }

  async update(
    id: string,
    data: UpdateKeyboardDto & { slug?: string; publishedAt?: Date | null; updatedBy?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Cập nhật categories nếu có truyền
      if (data.categoryIds !== undefined) {
        await tx.keyboardThemeCategory.deleteMany({
          where: { keyboardThemeId: id },
        });
        if (data.categoryIds.length > 0) {
          await tx.keyboardThemeCategory.createMany({
            data: data.categoryIds.map((categoryId) => ({
              keyboardThemeId: id,
              categoryId,
            })),
          });
        }
      }

      // 2. Cập nhật colors nếu có truyền
      if (data.colorIds !== undefined) {
        await tx.keyboardColor.deleteMany({
          where: { keyboardThemeId: id },
        });
        if (data.colorIds.length > 0) {
          await tx.keyboardColor.createMany({
            data: data.colorIds.map((colorId) => ({
              keyboardThemeId: id,
              colorId,
            })),
          });
        }
      }

      // 3. Cập nhật styles nếu có truyền
      if (data.styleIds !== undefined) {
        await tx.keyboardStyle.deleteMany({
          where: { keyboardThemeId: id },
        });
        if (data.styleIds.length > 0) {
          await tx.keyboardStyle.createMany({
            data: data.styleIds.map((styleId) => ({
              keyboardThemeId: id,
              styleId,
            })),
          });
        }
      }

      // 4. Cập nhật previewImages nếu có truyền
      if (data.previewImages !== undefined) {
        await tx.keyboardImage.deleteMany({
          where: { keyboardThemeId: id },
        });
        if (data.previewImages.length > 0) {
          await tx.keyboardImage.createMany({
            data: data.previewImages.map((img) => ({
              keyboardThemeId: id,
              url: img.url,
              altText: img.altText,
              position: img.position,
            })),
          });
        }
      }

      // 5. Cập nhật thông tin theme
      const updatedTheme = await tx.keyboardTheme.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          coverUrl: data.coverUrl,
          driveUrl: data.driveUrl,
          platform: data.platform,
          status: data.status,
          accessLevel: data.accessLevel,
          requiredDiscordRoleIds: data.requiredDiscordRoleIds,
          isFeatured: data.isFeatured,
          publishedAt: data.publishedAt,
          updatedBy: data.updatedBy,
        },
      });

      return updatedTheme;
    });
  }

  delete(id: string) {
    return prisma.keyboardTheme.delete({
      where: { id },
    });
  }

  archive(id: string) {
    return prisma.keyboardTheme.update({
      where: { id },
      data: { status: 'HIDDEN' },
    });
  }

  countDownloads(keyboardThemeId: string) {
    return prisma.download.count({
      where: { keyboardThemeId },
    });
  }

  async countThemeCategories(themeId: string): Promise<number> {
    return prisma.keyboardThemeCategory.count({
      where: { keyboardThemeId: themeId },
    });
  }

  async toggleLike(userId: string, keyboardThemeId: string): Promise<{ liked: boolean; likeCount: number }> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.keyboardLike.findUnique({
        where: {
          userId_keyboardThemeId: {
            userId,
            keyboardThemeId,
          },
        },
      });

      if (existing) {
        await tx.keyboardLike.delete({
          where: { id: existing.id },
        });
        const updated = await tx.keyboardTheme.update({
          where: { id: keyboardThemeId },
          data: {
            likeCount: { decrement: 1 },
          },
          select: { likeCount: true },
        });
        return { liked: false, likeCount: Math.max(0, updated.likeCount) };
      } else {
        await tx.keyboardLike.create({
          data: {
            userId,
            keyboardThemeId,
          },
        });
        const updated = await tx.keyboardTheme.update({
          where: { id: keyboardThemeId },
          data: {
            likeCount: { increment: 1 },
          },
          select: { likeCount: true },
        });
        return { liked: true, likeCount: updated.likeCount };
      }
    });
  }

  async isThemeLikedByUser(userId: string, keyboardThemeId: string): Promise<boolean> {
    const like = await prisma.keyboardLike.findUnique({
      where: {
        userId_keyboardThemeId: {
          userId,
          keyboardThemeId,
        },
      },
      select: { id: true },
    });
    return !!like;
  }

  async findUserLikedThemes(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: Prisma.KeyboardLikeWhereInput = {
      userId,
      theme: { status: 'PUBLISHED' },
    };

    const [likes, total] = await prisma.$transaction([
      prisma.keyboardLike.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          theme: {
            select: publicThemeSelect,
          },
        },
      }),
      prisma.keyboardLike.count({ where }),
    ]);

    const data = likes.map((l) => ({
      id: l.theme.id,
      name: l.theme.name,
      slug: l.theme.slug,
      coverUrl: l.theme.coverUrl,
      platform: l.theme.platform as any,
      accessLevel: l.theme.accessLevel as any,
      requiredDiscordRoleIds: l.theme.requiredDiscordRoleIds,
      downloadCount: l.theme.downloadCount,
      likeCount: l.theme.likeCount,
      isFeatured: l.theme.isFeatured,
      isLiked: true,
      publishedAt: l.theme.publishedAt,
      author: l.theme.author,
      categories: l.theme.categories.map((c) => c.category),
      colors: l.theme.colors.map((c) => c.color),
      styles: l.theme.styles.map((s) => s.style),
      likedAt: l.createdAt,
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

  async recordDownloadAndIncrement(
    userId: string,
    keyboardThemeId: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    return prisma.$transaction([
      prisma.download.create({
        data: {
          userId,
          keyboardThemeId,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        },
      }),
      prisma.keyboardTheme.update({
        where: { id: keyboardThemeId },
        data: {
          downloadCount: { increment: 1 },
        },
      }),
    ]);
  }

  /**
   * Đếm số lượng theme duy nhất mà người dùng đã từng tải về (có lọc theo mốc thời gian nếu có)
   */
  async countUniqueThemesDownloadedByUser(userId: string, sinceDate?: Date): Promise<number> {
    const records = await prisma.download.groupBy({
      by: ['keyboardThemeId'],
      where: {
        userId,
        ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
      },
    });
    return records.length;
  }

  /**
   * Truy vấn thông tin tài khoản người dùng để xác thực trạng thái hoạt động
   */
  async findUserById(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, isActive: true, downloadQuotaResetAt: true },
    });
  }

  /**
   * Lấy mốc thời gian Reset Quota gần nhất của người dùng
   */
  async getUserQuotaResetAt(userId: string): Promise<Date | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { downloadQuotaResetAt: true },
    });
    return user?.downloadQuotaResetAt || null;
  }

  /**
   * Reset hạn mức tải về của người dùng (cập nhật mốc downloadQuotaResetAt)
   */
  async resetUserDownloadQuota(userId: string): Promise<Date> {
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { downloadQuotaResetAt: now },
    });
    return now;
  }

  /**
   * Kiểm tra người dùng đã từng tải theme này trước đây chưa (phục vụ Re-download miễn phí)
   */
  async hasUserDownloadedTheme(userId: string, keyboardThemeId: string): Promise<boolean> {
    const record = await prisma.download.findFirst({
      where: {
        userId,
        keyboardThemeId,
      },
      select: { id: true },
    });
    return !!record;
  }

  /**
   * Lấy tài khoản Discord liên kết của User
   */
  async getUserDiscordSocial(userId: string) {
    return prisma.userSocial.findFirst({
      where: {
        userId,
        provider: 'DISCORD',
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

export const keyboardRepository = new KeyboardRepository();
