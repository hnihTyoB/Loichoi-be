import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import {
  CollectionQueryDto,
  CollectionManagementQueryDto,
  CreateCollectionDto,
  UpdateCollectionDto,
} from './collection.dto';

const creatorSummarySelect = {
  id: true,
  fullName: true,
  username: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export class CollectionRepository {
  async findManagementList(query: CollectionManagementQueryDto) {
    const { page = 1, limit = 20, search, isPublic, isFeatured, creator, userId, sort = 'LATEST' } = query;

    const where: Prisma.CollectionWhereInput = {
      ...(isPublic !== undefined ? { isPublic } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(isFeatured !== undefined ? { isFeatured } : {}),
      ...(userId ? { userId } : {}),
      ...(creator
        ? {
            user: {
              username: creator,
            },
          }
        : {}),
    };

    let orderBy: Prisma.CollectionOrderByWithRelationInput[] = [{ createdAt: 'desc' }];
    if (sort === 'FEATURED') {
      orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'NAME_ASC') {
      orderBy = [{ name: 'asc' }];
    } else if (sort === 'NAME_DESC') {
      orderBy = [{ name: 'desc' }];
    }

    const skip = (page - 1) * limit;

    const [collections, total] = await prisma.$transaction([
      prisma.collection.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: creatorSummarySelect,
          },
          items: {
            take: 4,
            orderBy: { position: 'asc' },
            include: {
              theme: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  coverUrl: true,
                },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.collection.count({ where }),
    ]);

    const data = collections.map((col) => ({
      id: col.id,
      name: col.name,
      slug: col.slug,
      description: col.description,
      coverUrl: col.coverUrl,
      isPublic: col.isPublic,
      isFeatured: col.isFeatured,
      creator: col.user,
      itemsCount: col._count.items,
      previewThemes: col.items.map((it) => ({
        id: it.theme.id,
        name: it.theme.name,
        slug: it.theme.slug,
        coverUrl: it.theme.coverUrl,
      })),
      createdAt: col.createdAt,
      updatedAt: col.updatedAt,
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

  async findPublicList(query: CollectionQueryDto) {
    const { page = 1, limit = 20, search, isFeatured, creator, sort = 'LATEST' } = query;

    const where: Prisma.CollectionWhereInput = {
      isPublic: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(isFeatured !== undefined ? { isFeatured } : {}),
      ...(creator
        ? {
            user: {
              username: creator,
            },
          }
        : {}),
    };

    let orderBy: Prisma.CollectionOrderByWithRelationInput[] = [{ createdAt: 'desc' }];
    if (sort === 'FEATURED') {
      orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'NAME_ASC') {
      orderBy = [{ name: 'asc' }];
    } else if (sort === 'NAME_DESC') {
      orderBy = [{ name: 'desc' }];
    }

    const skip = (page - 1) * limit;

    const [collections, total] = await prisma.$transaction([
      prisma.collection.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: creatorSummarySelect,
          },
          items: {
            take: 4,
            orderBy: { position: 'asc' },
            include: {
              theme: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  coverUrl: true,
                },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.collection.count({ where }),
    ]);

    const data = collections.map((col) => ({
      id: col.id,
      name: col.name,
      slug: col.slug,
      description: col.description,
      coverUrl: col.coverUrl,
      isPublic: col.isPublic,
      isFeatured: col.isFeatured,
      creator: col.user,
      itemsCount: col._count.items,
      previewThemes: col.items.map((it) => ({
        id: it.theme.id,
        name: it.theme.name,
        slug: it.theme.slug,
        coverUrl: it.theme.coverUrl,
      })),
      createdAt: col.createdAt,
      updatedAt: col.updatedAt,
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

  async findPublicBySlug(slug: string) {
    const col = await prisma.collection.findFirst({
      where: {
        slug,
        isPublic: true,
      },
      include: {
        user: {
          select: creatorSummarySelect,
        },
        items: {
          orderBy: { position: 'asc' },
          include: {
            theme: {
              select: {
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
                  select: creatorSummarySelect,
                },
                categories: {
                  where: { category: { isActive: true } },
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
              },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    if (!col) return null;

    return {
      id: col.id,
      name: col.name,
      slug: col.slug,
      description: col.description,
      coverUrl: col.coverUrl,
      isPublic: col.isPublic,
      isFeatured: col.isFeatured,
      creator: col.user,
      itemsCount: col._count.items,
      items: col.items.map((it) => ({
        id: it.id,
        position: it.position,
        addedAt: it.createdAt,
        theme: {
          id: it.theme.id,
          name: it.theme.name,
          slug: it.theme.slug,
          coverUrl: it.theme.coverUrl,
          platform: it.theme.platform as any,
          accessLevel: it.theme.accessLevel as any,
          requiredDiscordRoleIds: it.theme.requiredDiscordRoleIds,
          downloadCount: it.theme.downloadCount,
          likeCount: it.theme.likeCount,
          isFeatured: it.theme.isFeatured,
          publishedAt: it.theme.publishedAt,
          author: it.theme.author,
          categories: it.theme.categories.map((c) => c.category),
        },
      })),
      createdAt: col.createdAt,
      updatedAt: col.updatedAt,
    };
  }

  async findById(id: string) {
    return prisma.collection.findUnique({
      where: { id },
      include: {
        user: { select: creatorSummarySelect },
        items: {
          orderBy: { position: 'asc' },
          include: {
            theme: true,
          },
        },
        _count: { select: { items: true } },
      },
    });
  }

  async findBySlug(slug: string) {
    return prisma.collection.findUnique({
      where: { slug },
      include: {
        user: { select: creatorSummarySelect },
      },
    });
  }

  async create(data: CreateCollectionDto & { slug: string; userId: string }) {
    return prisma.$transaction(async (tx) => {
      const col = await tx.collection.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          coverUrl: data.coverUrl,
          isPublic: data.isPublic ?? true,
          userId: data.userId,
        },
      });

      if (data.themeIds && data.themeIds.length > 0) {
        await tx.collectionItem.createMany({
          data: data.themeIds.map((themeId, index) => ({
            collectionId: col.id,
            keyboardThemeId: themeId,
            position: index,
          })),
        });
      }

      return col;
    });
  }

  async update(id: string, data: UpdateCollectionDto & { slug?: string }) {
    return prisma.collection.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        coverUrl: data.coverUrl,
        isPublic: data.isPublic,
        isFeatured: data.isFeatured,
      },
    });
  }

  async delete(id: string) {
    return prisma.collection.delete({
      where: { id },
    });
  }

  async addTheme(collectionId: string, themeId: string, position?: number) {
    const finalPosition =
      position !== undefined
        ? position
        : await prisma.collectionItem.count({ where: { collectionId } });

    return prisma.collectionItem.create({
      data: {
        collectionId,
        keyboardThemeId: themeId,
        position: finalPosition,
      },
    });
  }

  async removeTheme(collectionId: string, themeId: string) {
    return prisma.collectionItem.deleteMany({
      where: {
        collectionId,
        keyboardThemeId: themeId,
      },
    });
  }

  async isThemeInCollection(collectionId: string, themeId: string): Promise<boolean> {
    const item = await prisma.collectionItem.findUnique({
      where: {
        collectionId_keyboardThemeId: {
          collectionId,
          keyboardThemeId: themeId,
        },
      },
    });
    return !!item;
  }

  async countCollectionItems(collectionId: string): Promise<number> {
    return prisma.collectionItem.count({
      where: { collectionId },
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

export const collectionRepository = new CollectionRepository();
