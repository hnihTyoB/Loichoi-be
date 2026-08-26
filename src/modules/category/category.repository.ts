import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { CategoryQueryDto } from './category.dto';

export class CategoryRepository {
  async findPublicCategories() {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            themes: {
              where: {
                theme: { status: 'PUBLISHED' },
              },
            },
          },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      orderIndex: cat.orderIndex,
      themeCount: cat._count.themes,
    }));
  }

  async findAll(query: CategoryQueryDto) {
    const { search, isActive, page = 1, limit = 20 } = query;

    const where: Prisma.CategoryWhereInput = {
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.category.findMany({
        where,
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          _count: {
            select: { themes: true },
          },
        },
      }),
      prisma.category.count({ where }),
    ]);

    const data = items.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      orderIndex: cat.orderIndex,
      isActive: cat.isActive,
      themeCount: cat._count.themes,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
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

  findById(id: string) {
    return prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { themes: true },
        },
      },
    });
  }

  findBySlug(slug: string) {
    return prisma.category.findUnique({
      where: { slug },
    });
  }

  findActiveByIds(ids: string[]) {
    return prisma.category.findMany({
      where: {
        id: { in: ids },
        isActive: true,
      },
    });
  }

  create(data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    color?: string;
    orderIndex?: number;
    isActive?: boolean;
  }) {
    return prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        color: data.color,
        orderIndex: data.orderIndex ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  update(
    id: string,
    data: {
      name?: string;
      slug?: string;
      description?: string;
      icon?: string;
      color?: string;
      orderIndex?: number;
      isActive?: boolean;
    },
  ) {
    return prisma.category.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return prisma.category.delete({
      where: { id },
    });
  }

  countThemesByCategory(categoryId: string) {
    return prisma.keyboardThemeCategory.count({
      where: { categoryId },
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

export const categoryRepository = new CategoryRepository();
