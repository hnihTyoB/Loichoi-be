import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { StyleQueryDto } from './style.dto';

export class StyleRepository {
  async findPublicStyles() {
    const styles = await prisma.style.findMany({
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

    return styles.map((st) => ({
      id: st.id,
      name: st.name,
      slug: st.slug,
      description: st.description,
      themeCount: st._count.themes,
    }));
  }

  async findAll(query: StyleQueryDto) {
    const { search, page = 1, limit = 20 } = query;

    const where: Prisma.StyleWhereInput = {
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.style.findMany({
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
      prisma.style.count({ where }),
    ]);

    const data = items.map((st) => ({
      id: st.id,
      name: st.name,
      slug: st.slug,
      description: st.description,
      themeCount: st._count.themes,
      createdAt: st.createdAt,
      updatedAt: st.updatedAt,
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
    return prisma.style.findUnique({
      where: { id },
      include: {
        _count: {
          select: { themes: true },
        },
      },
    });
  }

  findBySlug(slug: string) {
    return prisma.style.findUnique({
      where: { slug },
    });
  }

  findByIds(ids: string[]) {
    return prisma.style.findMany({
      where: {
        id: { in: ids },
      },
    });
  }

  create(data: { name: string; slug: string; description?: string }) {
    return prisma.style.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
      },
    });
  }

  update(
    id: string,
    data: {
      name?: string;
      slug?: string;
      description?: string | null;
    },
  ) {
    return prisma.style.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return prisma.style.delete({
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

export const styleRepository = new StyleRepository();
