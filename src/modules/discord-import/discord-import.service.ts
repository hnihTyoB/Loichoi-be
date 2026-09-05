import { DiscordImportRepository } from './discord-import.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';
import {
  IMPORT_JOB_STATUS,
  IMPORT_FLAG,
  DUPLICATE_REASON,
  DEFAULT_AI_CONFIDENCE_THRESHOLD,
  DEFAULT_BULK_APPROVE_MAX,
} from '../../common/constants/import.constant';
import { toSlug } from '../../common/helpers/slug.helper';
import { envConfig } from '../../config/env.config';
import { isThemeDownloadUrl } from '../../common/constants/keyboard.constant';
import {
  CreateImportJobPayload,
  UpdateDraftPayload,
  BulkApproveResult,
  ApproveResult,
  ImportJobFilter,
  NormalizedImportInput,
  NormalizedLink,
  NormalizedFile,
  NormalizedImage,
} from './discord-import.dto';
import type { CreateImportJobBody, UpdateDraftBody } from './discord-import.validation';
import { DiscordImportAIService } from './discord-import-ai.service';
import { DiscordMediaService } from './discord-media.service';

// ──────────────────────────────────────────────
// Regex helpers (deterministic parser)
// ──────────────────────────────────────────────

const GOOGLE_DRIVE_REGEX =
  /https?:\/\/(?:drive\.google\.com|docs\.google\.com)\/(?:file\/d\/|drive\/folders\/|open\?id=)[A-Za-z0-9_\-]+[^\s]*/gi;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
const BDI_EXTENSION = /\.bdi$/i;
const BDS_EXTENSION = /\.bds$/i;

function extractReferenceNumber(name: string): number | null {
  // 1. Look for numbers before heart or decorative symbols: e.g. "3 ♡", "2378 ♡", "3 - "
  const m1 = name.match(/(\d{1,6})\s*[♡♥\-_\s]/);
  if (m1 && m1[1]) return parseInt(m1[1], 10);

  // 2. Look for numbers with prefix #, No., No, №, or inside brackets: e.g. "#3", "No.3", "【3】", "꒰ა 3"
  const m2 = name.match(/(?:#|No\.?|№|꒰[აa]?\s*|[【\[(])\s*(\d{1,6})/i);
  if (m2 && m2[1]) return parseInt(m2[1], 10);

  // 3. Look for first standalone integer in string
  const m3 = name.match(/\b(\d{1,6})\b/);
  if (m3 && m3[1]) return parseInt(m3[1], 10);

  return null;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/[‧꒰ა໒꒱♡♥ʚɞ★☆✦✧【】\[\]()]/g, ' ')
    .replace(/^(?:\s*#?\s*\d+\s*[-_:]*)/, '')
    .replace(/\s+/g, ' ')
    .trim() || raw;
}

export class DiscordImportService {
  private readonly repository = new DiscordImportRepository();

  // ──────────────────────────────────────────────
  // 1. Create Import Job (idempotent by discordThreadId)
  // ──────────────────────────────────────────────

  async createImportJob(
    payload: CreateImportJobBody,
    actorId: string,
  ): Promise<{ importJobId: string; isNew: boolean }> {
    // Auto extract reference number from title if not explicitly provided
    const refNumber = payload.discordReferenceNumber ?? extractReferenceNumber(payload.originalName);

    // Upsert the Discord thread record
    const thread = await this.repository.upsertDiscordThread({
      discordThreadId: payload.discordThreadId,
      discordChannelId: payload.discordChannelId,
      originalName: payload.originalName,
      discordReferenceNumber: refNumber,
      createdAtDiscord: payload.createdAtDiscord ? new Date(payload.createdAtDiscord) : undefined,
      rawData: payload as object,
    });

    // Idempotency: if an active job exists for this thread, update it with fresh messages & metadata
    const existingJob = await this.repository.findActiveJobByDiscordThread(thread.id);
    if (existingJob) {
      if (
        existingJob.status === IMPORT_JOB_STATUS.NEEDS_REVIEW ||
        existingJob.status === IMPORT_JOB_STATUS.DISCOVERED ||
        existingJob.status === IMPORT_JOB_STATUS.PROCESSING
      ) {
        await this.normalizeAndParse(existingJob.id, thread.id, payload);
      }
      return { importJobId: existingJob.id, isNew: false };
    }

    // Create new job
    const job = await this.repository.createImportJob(thread.id);

    // Immediately run normalization + deterministic parsing synchronously
    // (AI phase is deferred to a separate worker — not in scope for this PR)
    await this.normalizeAndParse(job.id, thread.id, payload);

    await this.auditLog(actorId, AUDIT_ACTION.CREATE_IMPORT_JOB, AUDIT_TARGET_TYPE.IMPORT_JOB, job.id, {
      discordThreadId: payload.discordThreadId,
      originalName: payload.originalName,
    });

    return { importJobId: job.id, isNew: true };
  }

  // ──────────────────────────────────────────────
  // 2. Normalize & Deterministic Parse
  // ──────────────────────────────────────────────

  private async normalizeAndParse(
    importJobId: string,
    discordThreadDbId: string,
    payload: CreateImportJobBody,
  ): Promise<void> {
    try {
      await this.repository.updateImportJobStatus(importJobId, {
        status: IMPORT_JOB_STATUS.PROCESSING,
        phase: 'NORMALIZE',
      });

      // ── Normalize ──
      const images: NormalizedImage[] = [];
      const files: NormalizedFile[] = [];
      const links: NormalizedLink[] = [];
      const allText: string[] = [];

      for (const msg of payload.messages) {
        allText.push(msg.content);

        for (const att of msg.attachments) {
          const ext = att.filename.split('.').pop()?.toLowerCase() ?? '';
          const isImage = IMAGE_EXTENSIONS.test(att.filename) || (att.contentType?.startsWith('image/') ?? false);

          if (isImage) {
            images.push({
              url: att.url,
              filename: att.filename,
              messageId: msg.messageId,
              width: att.width,
              height: att.height,
              position: images.length,
            });
          } else {
            files.push({
              filename: att.filename,
              extension: ext,
              url: att.url,
              size: att.size,
              messageId: msg.messageId,
            });
          }
        }

        // Extract images from embeds
        if (Array.isArray(msg.embeds)) {
          for (const embed of msg.embeds as any[]) {
            const imgUrl = embed?.image?.url || embed?.thumbnail?.url;
            if (imgUrl) {
              const baseUrl = imgUrl.split('?')[0].toLowerCase();
              if (!images.some((i) => i.url.split('?')[0].toLowerCase() === baseUrl)) {
                images.push({
                  url: imgUrl,
                  filename: `embed_${images.length + 1}.jpg`,
                  messageId: msg.messageId,
                  position: images.length,
                });
              }
            }
          }
        }

        // Extract images from direct links in content (preserve query string for CDN auth)
        const contentImgMatches = msg.content.match(
          /https?:\/\/[^\s)]+(?:\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.avif)(?:\?[^\s)]+)?/gi,
        );
        if (contentImgMatches) {
          for (const url of contentImgMatches) {
            const baseUrl = url.split('?')[0].toLowerCase();
            if (!images.some((i) => i.url.split('?')[0].toLowerCase() === baseUrl)) {
              images.push({
                url,
                filename: `img_${images.length + 1}.jpg`,
                messageId: msg.messageId,
                position: images.length,
              });
            }
          }
        }

        // Extract URLs from message content
        const driveMatches = msg.content.match(GOOGLE_DRIVE_REGEX);
        if (driveMatches) {
          for (const url of driveMatches) {
            links.push({ url, type: 'GOOGLE_DRIVE', messageId: msg.messageId });
          }
        }
      }

      // ── Deterministic Parse ──
      await this.repository.updateImportJobStatus(importJobId, {
        status: IMPORT_JOB_STATUS.PROCESSING,
        phase: 'PARSE',
      });

      // Platform detection
      const hasBdi = files.some((f) => BDI_EXTENSION.test(f.filename));
      const hasBds = files.some((f) => BDS_EXTENSION.test(f.filename));
      const hasDriveLink = links.some((l) => l.type === 'GOOGLE_DRIVE');

      let platform: string | null = null;
      let downloadSource: string | null = null;
      let downloadUrl: string | null = null;
      let downloadDiscordMsgId: string | null = null;
      let downloadFileName: string | null = null;

      const guildId = (payload as any).discordGuildId || (payload as any).guildId;
      const getDiscordMessageUrl = (msgId?: string | null) => {
        if (!msgId) {
          if (guildId) return `https://discord.com/channels/${guildId}/${payload.discordThreadId}`;
          return `https://discord.com/channels/@me/${payload.discordThreadId}`;
        }
        if (guildId) {
          return `https://discord.com/channels/${guildId}/${payload.discordThreadId}/${msgId}`;
        }
        return `https://discord.com/channels/@me/${payload.discordThreadId}/${msgId}`;
      };

      if (hasBdi && hasBds) {
        platform = 'BOTH';
        downloadSource = 'DISCORD_ATTACHMENT';
        const bdiFile = files.find((f) => BDI_EXTENSION.test(f.filename))!;
        downloadDiscordMsgId = bdiFile.messageId;
        downloadUrl = getDiscordMessageUrl(bdiFile.messageId);
        downloadFileName = bdiFile.filename;
      } else if (hasBdi) {
        platform = 'IOS';
        downloadSource = 'DISCORD_ATTACHMENT';
        const bdiFile = files.find((f) => BDI_EXTENSION.test(f.filename))!;
        downloadDiscordMsgId = bdiFile.messageId;
        downloadUrl = getDiscordMessageUrl(bdiFile.messageId);
        downloadFileName = bdiFile.filename;
      } else if (hasBds) {
        platform = 'ANDROID';
        downloadSource = 'DISCORD_ATTACHMENT';
        const bdsFile = files.find((f) => BDS_EXTENSION.test(f.filename))!;
        downloadDiscordMsgId = bdsFile.messageId;
        downloadUrl = getDiscordMessageUrl(bdsFile.messageId);
        downloadFileName = bdsFile.filename;
      } else if (hasDriveLink) {
        platform = 'BOTH'; // rule: Drive = both platforms available
        downloadSource = 'GOOGLE_DRIVE';
        const driveLink = links.find((l) => l.type === 'GOOGLE_DRIVE')!;
        downloadUrl = driveLink.url;
        downloadDiscordMsgId = driveLink.messageId;
      } else if (files.length > 0) {
        platform = 'BOTH';
        downloadSource = 'DISCORD_ATTACHMENT';
        const firstFile = files[0];
        downloadDiscordMsgId = firstFile.messageId;
        downloadUrl = getDiscordMessageUrl(firstFile.messageId);
        downloadFileName = firstFile.filename;
      } else if (payload.messages.length > 0) {
        const firstMsg = payload.messages[0];
        downloadSource = 'DISCORD_ATTACHMENT';
        downloadDiscordMsgId = firstMsg.messageId;
        downloadUrl = getDiscordMessageUrl(firstMsg.messageId);
      }

      // Deduplicate images by base URL
      const uniqueImages: typeof images = [];
      const seenBaseUrls = new Set<string>();
      for (const img of images) {
        const baseUrl = img.url.split('?')[0].toLowerCase();
        if (!seenBaseUrls.has(baseUrl)) {
          seenBaseUrls.add(baseUrl);
          uniqueImages.push(img);
        }
      }

      // Cover = first unique image, previews = remaining distinct images
      const coverUrl = uniqueImages[0]?.url ?? null;
      const previewUrls = uniqueImages.slice(1).map((i) => i.url);

      // ── Duplicate check ──
      let isDuplicateCandidate = false;
      let duplicateOfId: string | null = null;
      let duplicateReason: string | null = null;

      // 1. Check by Discord thread ID (already-imported job)
      const importedJob = await this.repository.findImportedJobByThread(discordThreadDbId);
      if (importedJob) {
        isDuplicateCandidate = true;
        duplicateReason = DUPLICATE_REASON.THREAD_ID;
      }

      // 2. Check by Drive URL
      if (!isDuplicateCandidate && downloadSource === 'GOOGLE_DRIVE' && downloadUrl) {
        const existing = await this.repository.findKeyboardByDriveUrl(downloadUrl);
        if (existing) {
          isDuplicateCandidate = true;
          duplicateOfId = existing.id;
          duplicateReason = DUPLICATE_REASON.DRIVE_URL;
        }
      }

      // ── Validation flags ──
      const flags: string[] = [];
      if (!coverUrl) flags.push(IMPORT_FLAG.MISSING_COVER);
      if (!downloadUrl) flags.push(IMPORT_FLAG.MISSING_DOWNLOAD);
      if (isDuplicateCandidate) flags.push(IMPORT_FLAG.POSSIBLE_DUPLICATE);

      const validationStatus = flags.includes(IMPORT_FLAG.MISSING_COVER) || flags.includes(IMPORT_FLAG.MISSING_DOWNLOAD)
        ? 'INVALID'
        : 'PENDING';

      const finalStatus =
        isDuplicateCandidate
          ? IMPORT_JOB_STATUS.DUPLICATE
          : validationStatus === 'INVALID'
            ? IMPORT_JOB_STATUS.NEEDS_REVIEW
            : IMPORT_JOB_STATUS.NEEDS_REVIEW; // Default to NEEDS_REVIEW pending AI

      // ── AI Metadata Generation (English Name, Vivid Description, Category/Color/Style Tags) ──
      const refNumber = payload.discordReferenceNumber ?? extractReferenceNumber(payload.originalName);
      const aiMeta = await DiscordImportAIService.generateDraftMetadata(payload.originalName, refNumber);

      // ── Create or update draft ──
      const existingDraft = await this.repository.findDraftByImportJobId(importJobId);

      const draftPayload = {
        englishName: existingDraft?.englishName || aiMeta.englishName,
        description: existingDraft?.description || aiMeta.description,
        suggestedCategoryIds:
          existingDraft?.suggestedCategoryIds && existingDraft.suggestedCategoryIds.length > 0
            ? existingDraft.suggestedCategoryIds
            : aiMeta.categoryIds,
        suggestedColorIds:
          existingDraft?.suggestedColorIds && existingDraft.suggestedColorIds.length > 0
            ? existingDraft.suggestedColorIds
            : aiMeta.colorIds,
        suggestedStyleIds:
          existingDraft?.suggestedStyleIds && existingDraft.suggestedStyleIds.length > 0
            ? existingDraft.suggestedStyleIds
            : aiMeta.styleIds,
        suggestedTags: existingDraft?.suggestedTags || aiMeta.tags,
        platform: platform ?? 'BOTH',
        downloadSource: downloadSource ?? 'DISCORD_ATTACHMENT',
        downloadUrl: downloadUrl ?? undefined,
        downloadDiscordMsgId: downloadDiscordMsgId ?? undefined,
        downloadFileName: downloadFileName ?? undefined,
        coverUrl: coverUrl ?? undefined,
        previewUrls,
        isDuplicateCandidate,
        duplicateOfId: duplicateOfId ?? undefined,
        duplicateReason: duplicateReason ?? undefined,
        flags,
        validationStatus,
        confidenceName: existingDraft?.confidenceName ?? aiMeta.confidence.name,
        confidenceDescription: existingDraft?.confidenceDescription ?? aiMeta.confidence.description,
        confidenceCategory: existingDraft?.confidenceCategory ?? aiMeta.confidence.category,
        confidenceColor: existingDraft?.confidenceColor ?? aiMeta.confidence.color,
        confidenceStyle: existingDraft?.confidenceStyle ?? aiMeta.confidence.style,
      };

      if (existingDraft) {
        await this.repository.updateDraft(existingDraft.id, draftPayload as any);
      } else {
        const draft = await this.repository.createDraft(importJobId);
        await this.repository.updateDraft(draft.id, draftPayload as any);
      }

      await this.repository.updateImportJobStatus(importJobId, {
        status: finalStatus,
        phase: 'DRAFT',
        processedAt: new Date(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await this.repository.updateImportJobStatus(importJobId, {
        status: IMPORT_JOB_STATUS.FAILED,
        lastError: message,
        processedAt: new Date(),
      });
      throw err;
    }
  }

  // ──────────────────────────────────────────────
  // 3. List Import Jobs
  // ──────────────────────────────────────────────

  async listImportJobs(filter: ImportJobFilter) {
    return this.repository.listImportJobs(filter);
  }

  // ──────────────────────────────────────────────
  // 4. Get Import Job Detail
  // ──────────────────────────────────────────────

  async getImportJobById(id: string) {
    const job = await this.repository.findImportJobById(id);
    if (!job) {
      throw new AppError('Import Job not found', 404, ERROR_CODE.NOT_FOUND);
    }
    return job;
  }

  // ──────────────────────────────────────────────
  // 5. Update Draft
  // ──────────────────────────────────────────────

  async updateDraft(importJobId: string, data: UpdateDraftBody, actorId: string) {
    const job = await this.getImportJobById(importJobId);

    if (!job.draft) {
      throw new AppError('Draft not found for this Import Job', 404, ERROR_CODE.NOT_FOUND);
    }

    if (job.status === IMPORT_JOB_STATUS.IMPORTED) {
      throw new AppError('Cannot edit a draft that has already been published', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const updated = await this.repository.updateDraft(job.draft.id, data as any);
    return updated;
  }

  // ──────────────────────────────────────────────
  // 6. Approve (single) — idempotent
  // ──────────────────────────────────────────────

  async approveImportJob(importJobId: string, actorId: string): Promise<ApproveResult> {
    const job = await this.getImportJobById(importJobId);

    // Idempotency: already imported
    if (job.status === IMPORT_JOB_STATUS.IMPORTED && job.draft?.keyboardThemeId) {
      const keyboard = await this.repository.findKeyboardById(job.draft.keyboardThemeId);
      if (keyboard) {
        return { importJobId, keyboardThemeId: keyboard.id, slug: keyboard.slug };
      }
    }

    if (!job.draft) {
      throw new AppError('Cannot approve: Draft not found', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const draft = job.draft;

    // Intelligent Fallbacks & Permanent Storage in Cloudflare R2
    const englishName = draft.englishName || 'Kawaii Aesthetic Keyboard Theme';

    // Persist Discord images permanently to Cloudflare R2 before publishing
    const persisted = await DiscordMediaService.persistThemeImages(
      draft.coverUrl,
      draft.previewUrls,
      draft.id,
    );

    const coverUrl =
      persisted.coverUrl ||
      draft.coverUrl ||
      draft.previewUrls?.[0] ||
      'https://placehold.co/600x600/f8e8ee/6c5b7b.png?text=Kawaii+Keyboard';

    const previewUrls = persisted.previewUrls.length > 0 ? persisted.previewUrls : draft.previewUrls;

    // Update draft with permanent R2 URLs if changed
    if (persisted.coverUrl && persisted.coverUrl !== draft.coverUrl) {
      await this.repository.updateDraft(draft.id, {
        coverUrl: persisted.coverUrl,
        previewUrls,
      } as any);
    }

    if (!draft.downloadUrl || !isThemeDownloadUrl(draft.downloadUrl)) {
      throw new AppError(
        'Bản nháp cần có liên kết tải hợp lệ (Google Drive hoặc Discord attachment) trước khi phê duyệt',
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const downloadUrl = draft.downloadUrl;

    // Build unique slug
    const baseSlug = toSlug(englishName);
    const slug = await this.buildUniqueSlug(baseSlug);

    // Fallback category, color, style if empty so publishing never fails
    let catIds = draft.suggestedCategoryIds;
    let colIds = draft.suggestedColorIds;
    let styIds = draft.suggestedStyleIds;

    if (!catIds || catIds.length === 0 || !colIds || colIds.length === 0 || !styIds || styIds.length === 0) {
      const defaultTax = await this.repository.getDefaultTaxonomies();
      if (!catIds || catIds.length === 0) catIds = defaultTax.defaultCategoryId ? [defaultTax.defaultCategoryId] : [];
      if (!colIds || colIds.length === 0) colIds = defaultTax.defaultColorIds;
      if (!styIds || styIds.length === 0) styIds = defaultTax.defaultStyleId ? [defaultTax.defaultStyleId] : [];
    }

    const result = await this.repository.approveAndPublish({
      importJobId,
      draftId: draft.id,
      keyboard: {
        name: englishName,
        slug,
        description: draft.description ?? undefined,
        coverUrl,
        driveUrl: downloadUrl,
        platform: draft.platform ?? 'BOTH',
        categoryIds: catIds,
        colorIds: colIds,
        styleIds: styIds,
        previewUrls,
        referenceNumber: job.thread.discordReferenceNumber ?? undefined,
      },
      adminId: actorId,
    });

    await this.auditLog(actorId, AUDIT_ACTION.APPROVE_IMPORT_DRAFT, AUDIT_TARGET_TYPE.KEYBOARD_DRAFT, draft.id, {
      importJobId,
      keyboardThemeId: result.keyboardThemeId,
      slug: result.slug,
    });

    return { importJobId, ...result };
  }

  // ──────────────────────────────────────────────
  // 7. Bulk Approve
  // ──────────────────────────────────────────────

  async bulkApprove(jobIds: string[], actorId: string): Promise<BulkApproveResult> {
    if (jobIds.length > DEFAULT_BULK_APPROVE_MAX) {
      throw new AppError(
        `Bulk approve limit is ${DEFAULT_BULK_APPROVE_MAX} items per operation`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const succeeded: ApproveResult[] = [];
    const failed: Array<{ importJobId: string; reason: string }> = [];

    for (const jobId of jobIds) {
      try {
        const result = await this.approveImportJob(jobId, actorId);
        succeeded.push(result);
      } catch (err) {
        failed.push({
          importJobId: jobId,
          reason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    await this.auditLog(actorId, AUDIT_ACTION.BULK_APPROVE_IMPORT, AUDIT_TARGET_TYPE.IMPORT_JOB, 'BULK', {
      total: succeeded.length + failed.length,
      succeeded: succeeded.length,
      failed: failed.length,
    });

    return { succeeded, failed };
  }

  // ──────────────────────────────────────────────
  // 8. Reset All Imports (Wipe clean for testing)
  // ──────────────────────────────────────────────

  async resetAllImports(actorId: string): Promise<{ deletedCount: number }> {
    if (envConfig.nodeEnv === 'production') {
      throw new AppError('Chức năng reset dữ liệu import bị vô hiệu hóa trên môi trường Production', 403, ERROR_CODE.FORBIDDEN);
    }

    const result = await this.repository.resetAllImports();

    await this.auditLog(actorId, AUDIT_ACTION.CREATE_IMPORT_JOB, AUDIT_TARGET_TYPE.IMPORT_JOB, 'RESET_ALL', {
      draftsDeleted: result.draftsDeleted,
      jobsDeleted: result.jobsDeleted,
      threadsDeleted: result.threadsDeleted,
    });

    return { deletedCount: result.jobsDeleted };
  }

  // ──────────────────────────────────────────────
  // 9. Reject Import Job
  // ──────────────────────────────────────────────

  async rejectImportJob(importJobId: string, reason: string | undefined, actorId: string): Promise<void> {
    const job = await this.getImportJobById(importJobId);

    if (job.status === IMPORT_JOB_STATUS.IMPORTED) {
      throw new AppError('Cannot reject an already published keyboard', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    if (job.draft) {
      await this.repository.updateDraft(job.draft.id, {
        adminNotes: reason,
        reviewedBy: actorId,
        reviewedAt: new Date(),
      } as any);
    }

    await this.repository.updateImportJobStatus(importJobId, {
      status: IMPORT_JOB_STATUS.SKIPPED,
      phase: 'DONE',
      processedAt: new Date(),
    });

    await this.auditLog(actorId, AUDIT_ACTION.REJECT_IMPORT_DRAFT, AUDIT_TARGET_TYPE.IMPORT_JOB, importJobId, {
      reason,
    });
  }

  // ──────────────────────────────────────────────
  // 9. Reprocess Import Job
  // ──────────────────────────────────────────────

  async reprocessImportJob(importJobId: string, actorId: string): Promise<void> {
    const job = await this.getImportJobById(importJobId);

    if (job.status === IMPORT_JOB_STATUS.IMPORTED) {
      throw new AppError('Cannot reprocess an already published job', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    await this.repository.incrementRetryCount(importJobId);
    await this.repository.updateImportJobStatus(importJobId, {
      status: IMPORT_JOB_STATUS.PROCESSING,
      phase: 'COLLECT',
      lastError: null,
    });

    // Re-run normalization + parsing (AI phase is async/deferred)
    const thread = job.thread;
    const rawData = thread.rawData as CreateImportJobBody;
    await this.normalizeAndParse(importJobId, thread.id, rawData);

    await this.auditLog(actorId, AUDIT_ACTION.REPROCESS_IMPORT_JOB, AUDIT_TARGET_TYPE.IMPORT_JOB, importJobId, {
      retryCount: job.retryCount + 1,
    });
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  private async buildUniqueSlug(base: string): Promise<string> {
    let slug = base;
    let suffix = 0;
    while (true) {
      const existing = await this.repository.findKeyboardBySlug(slug);
      if (!existing) return slug;
      suffix++;
      slug = `${base}-${suffix}`;
    }
  }

  private async auditLog(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    details?: object,
  ): Promise<void> {
    await this.repository.createAuditLog({
      actorId,
      action,
      targetType,
      targetId,
      details: details ?? {},
    });
  }
}
