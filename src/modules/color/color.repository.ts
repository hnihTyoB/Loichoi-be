import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { ColorQueryDto } from './color.dto';

export class ColorRepository {
  async findPublicColors() {
    const colors = await prisma.color.findMany({
      orderBy: { name: 'asc' },
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

    return colors.map((col) => ({
      id: col.id,
      name: col.name,
      slug: col.slug,
      hex: col.hex,
      themeCount: col._count.themes,
    }));
  }

  async findAll(query: ColorQueryDto) {
    const { search, page = 1, limit = 20 } = query;

    const where: Prisma.ColorWhereInput = {
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.color.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { themes: true },
          },
        },
      }),
      prisma.color.count({ where }),
    ]);

    const data = items.map((col) => ({
      id: col.id,
      name: col.name,
      slug: col.slug,
      hex: col.hex,
      themeCount: col._count.themes,
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

  findById(id: string) {
    return prisma.color.findUnique({
      where: { id },
      include: {
        _count: {
          select: { themes: true },
        },
      },
    });
  }

  findBySlug(slug: string) {
    return prisma.color.findUnique({
      where: { slug },
    });
  }

  findByIds(ids: string[]) {
    return prisma.color.findMany({
      where: {
        id: { in: ids },
      },
    });
  }

  create(data: { name: string; slug: string; hex: string }) {
    return prisma.color.create({
      data: {
        name: data.name,
        slug: data.slug,
        hex: data.hex,
      },
    });
  }

  update(
    id: string,
    data: {
      name?: string;
      slug?: string;
      hex?: string;
    },
  ) {
    return prisma.color.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return prisma.color.delete({
      where: { id },
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

export const colorRepository = new ColorRepository();
