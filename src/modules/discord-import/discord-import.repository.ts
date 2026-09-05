import { PrismaClient, DiscordThread, ImportJob, KeyboardDraft } from '@prisma/client';
import { prisma as db } from '../../database/prisma.client';
import {
  ImportJobListItemDto,
  ImportJobWithDraftAndThread,
  ImportJobFilter,
  CreateImportJobPayload,
} from './discord-import.dto';

export class DiscordImportRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = db;
  }

  // ──────────────────────────────────────────────
  // DiscordThread
  // ──────────────────────────────────────────────

  async upsertDiscordThread(data: {
    discordThreadId: string;
    discordChannelId?: string | null;
    originalName: string;
    discordReferenceNumber?: number | null;
    createdAtDiscord?: Date | null;
    rawData: object;
  }): Promise<DiscordThread> {
    return this.prisma.discordThread.upsert({
      where: { discordThreadId: data.discordThreadId },
      update: {
        originalName: data.originalName,
        discordChannelId: data.discordChannelId,
        discordReferenceNumber: data.discordReferenceNumber ?? null,
        createdAtDiscord: data.createdAtDiscord ?? null,
        rawData: data.rawData,
      },
      create: {
        discordThreadId: data.discordThreadId,
        discordChannelId: data.discordChannelId,
        originalName: data.originalName,
        discordReferenceNumber: data.discordReferenceNumber ?? null,
        createdAtDiscord: data.createdAtDiscord ?? null,
        rawData: data.rawData,
      },
    });
  }

  async findDiscordThreadByDiscordId(discordThreadId: string): Promise<DiscordThread | null> {
    return this.prisma.discordThread.findUnique({
      where: { discordThreadId },
    });
  }

  // ──────────────────────────────────────────────
  // ImportJob
  // ──────────────────────────────────────────────

  async createImportJob(discordThreadId: string): Promise<ImportJob> {
    return this.prisma.importJob.create({
      data: {
        discordThreadId,
        status: 'DISCOVERED',
        phase: 'COLLECT',
      },
    });
  }

  /** Find existing active job for a thread (to prevent duplicate jobs) */
  async findActiveJobByDiscordThread(discordThreadDbId: string): Promise<ImportJob | null> {
    return this.prisma.importJob.findFirst({
      where: {
        discordThreadId: discordThreadDbId,
        status: { notIn: ['IMPORTED', 'SKIPPED', 'FAILED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findImportJobById(id: string): Promise<ImportJobWithDraftAndThread | null> {
    return this.prisma.importJob.findUnique({
      where: { id },
      include: {
        thread: true,
        draft: true,
      },
    }) as Promise<ImportJobWithDraftAndThread | null>;
  }

  async updateImportJobStatus(
    id: string,
    data: {
      status: string;
      phase?: string;
      lastError?: string | null;
      processedAt?: Date;
    },
  ): Promise<ImportJob> {
    return this.prisma.importJob.update({
      where: { id },
      data: {
        status: data.status,
        phase: data.phase,
        lastError: data.lastError,
        processedAt: data.processedAt,
      },
    });
  }

  async incrementRetryCount(id: string): Promise<ImportJob> {
    return this.prisma.importJob.update({
      where: { id },
      data: { retryCount: { increment: 1 } },
    });
  }

  async listImportJobs(filter: ImportJobFilter): Promise<{
    data: ImportJobWithDraftAndThread[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { status, validationStatus, isDuplicateCandidate, page = 1, limit = 20 } = filter;

    const where: Record<string, unknown> = {};

    if (status) where['status'] = status;

    if (validationStatus !== undefined || isDuplicateCandidate !== undefined) {
      where['draft'] = {};
      if (validationStatus) (where['draft'] as Record<string, unknown>)['validationStatus'] = validationStatus;
      if (isDuplicateCandidate !== undefined)
        (where['draft'] as Record<string, unknown>)['isDuplicateCandidate'] = isDuplicateCandidate;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.importJob.findMany({
        where,
        include: { thread: true, draft: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.importJob.count({ where }),
    ]);

    return { data: data as ImportJobWithDraftAndThread[], total, page, limit };
  }

  // ──────────────────────────────────────────────
  // KeyboardDraft
  // ──────────────────────────────────────────────

  async createDraft(importJobId: string): Promise<KeyboardDraft> {
    return this.prisma.keyboardDraft.create({
      data: {
        importJobId,
        validationStatus: 'PENDING',
      },
    });
  }

  async updateDraft(id: string, data: Partial<KeyboardDraft>): Promise<KeyboardDraft> {
    // Remove non-updatable fields
    const { id: _id, importJobId: _jobId, createdAt: _ca, ...updateData } = data as Record<string, unknown>;
    return this.prisma.keyboardDraft.update({
      where: { id },
      data: updateData,
    });
  }

  async findDraftByImportJobId(importJobId: string): Promise<KeyboardDraft | null> {
    return this.prisma.keyboardDraft.findUnique({
      where: { importJobId },
    });
  }

  async deleteDraft(id: string): Promise<KeyboardDraft> {
    return this.prisma.keyboardDraft.delete({
      where: { id },
    });
  }

  // ──────────────────────────────────────────────
  // Duplicate checks
  // ──────────────────────────────────────────────

  /** Check if a KeyboardTheme with this driveUrl already exists */
  async findKeyboardByDriveUrl(driveUrl: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.keyboardTheme.findFirst({
      where: { driveUrl },
      select: { id: true, name: true },
    });
  }

  /** Check if a KeyboardTheme with similar name already exists (case-insensitive exact match) */
  async findKeyboardByName(name: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.keyboardTheme.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
  }

  /** Check if any IMPORTED job already exists for this discordThreadDbId */
  async findImportedJobByThread(discordThreadDbId: string): Promise<ImportJob | null> {
    return this.prisma.importJob.findFirst({
      where: {
        discordThreadId: discordThreadDbId,
        status: 'IMPORTED',
      },
    });
  }

  // ──────────────────────────────────────────────
  // Approve transaction
  // ──────────────────────────────────────────────

  async approveAndPublish(input: {
    importJobId: string;
    draftId: string;
    keyboard: {
      name: string;
      slug: string;
      description?: string;
      coverUrl: string;
      driveUrl: string;
      platform: string;
      categoryIds: string[];
      colorIds: string[];
      styleIds: string[];
      previewUrls: string[];
      referenceNumber?: number;
    };
    adminId: string;
  }): Promise<{ keyboardThemeId: string; slug: string }> {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create the keyboard theme
      const keyboard = await tx.keyboardTheme.create({
        data: {
          name: input.keyboard.name,
          slug: input.keyboard.slug,
          description: input.keyboard.description,
          coverUrl: input.keyboard.coverUrl,
          driveUrl: input.keyboard.driveUrl,
          platform: input.keyboard.platform,
          accessLevel: 'DISCORD_MEMBER',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          createdBy: input.adminId,
        },
      });

      // 2. Create preview images
      const imageInserts = input.keyboard.previewUrls.map((url, idx) =>
        tx.keyboardImage.create({
          data: {
            keyboardThemeId: keyboard.id,
            url,
            position: idx,
          },
        }),
      );
      await Promise.all(imageInserts);

      // 3. Attach categories (≤3)
      if (input.keyboard.categoryIds.length > 0) {
        await tx.keyboardThemeCategory.createMany({
          data: input.keyboard.categoryIds.slice(0, 3).map((categoryId) => ({
            keyboardThemeId: keyboard.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      // 4. Attach colors (≤3)
      if (input.keyboard.colorIds.length > 0) {
        await tx.keyboardColor.createMany({
          data: input.keyboard.colorIds.slice(0, 3).map((colorId) => ({
            keyboardThemeId: keyboard.id,
            colorId,
          })),
          skipDuplicates: true,
        });
      }

      // 5. Attach styles (≤3)
      if (input.keyboard.styleIds.length > 0) {
        await tx.keyboardStyle.createMany({
          data: input.keyboard.styleIds.slice(0, 3).map((styleId) => ({
            keyboardThemeId: keyboard.id,
            styleId,
          })),
          skipDuplicates: true,
        });
      }

      // 6. Update draft → link keyboard + mark reviewed
      await tx.keyboardDraft.update({
        where: { id: input.draftId },
        data: {
          keyboardThemeId: keyboard.id,
          reviewedBy: input.adminId,
          reviewedAt: new Date(),
          validationStatus: 'VALID',
        },
      });

      // 7. Update import job → IMPORTED
      await tx.importJob.update({
        where: { id: input.importJobId },
        data: {
          status: 'IMPORTED',
          phase: 'DONE',
          processedAt: new Date(),
        },
      });

      return { keyboardThemeId: keyboard.id, slug: keyboard.slug };
    });

    return result;
  }

  async resetAllImports(): Promise<{ draftsDeleted: number; jobsDeleted: number; threadsDeleted: number }> {
    const [drafts, jobs, threads] = await this.prisma.$transaction([
      this.prisma.keyboardDraft.deleteMany({}),
      this.prisma.importJob.deleteMany({}),
      this.prisma.discordThread.deleteMany({}),
    ]);
    return {
      draftsDeleted: drafts.count,
      jobsDeleted: jobs.count,
      threadsDeleted: threads.count,
    };
  }

  async findKeyboardBySlug(slug: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.keyboardTheme.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
  }

  async findKeyboardById(id: string): Promise<{ id: string; slug: string } | null> {
    return this.prisma.keyboardTheme.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
  }

  async getDefaultTaxonomies(): Promise<{
    defaultCategoryId?: string;
    defaultColorIds: string[];
    defaultStyleId?: string;
  }> {
    const [defaultCat, defaultCols, defaultSty] = await Promise.all([
      this.prisma.category.findFirst({ select: { id: true } }),
      this.prisma.color.findMany({ take: 2, select: { id: true } }),
      this.prisma.style.findFirst({ select: { id: true } }),
    ]);
    return {
      defaultCategoryId: defaultCat?.id,
      defaultColorIds: defaultCols.map((c) => c.id),
      defaultStyleId: defaultSty?.id,
    };
  }

  async createAuditLog(data: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: any;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: data.details,
      },
    });
  }
}
