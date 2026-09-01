import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DiscordImportService } from '../src/modules/discord-import/discord-import.service';
import { DiscordMediaService } from '../src/modules/discord-import/discord-media.service';
import { IMPORT_FLAG, IMPORT_JOB_STATUS } from '../src/common/constants/import.constant';

const prisma = new PrismaClient();
const discordImportService = new DiscordImportService();

async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 10,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function validateAndResolveCoverImage(draft: {
  id?: string;
  coverUrl?: string | null;
  previewUrls?: any;
} | null): Promise<{ isDownloadable: boolean; resolvedCoverUrl: string | null; resolvedPreviewUrls: string[] }> {
  if (!draft) {
    return { isDownloadable: false, resolvedCoverUrl: null, resolvedPreviewUrls: [] };
  }

  const res = await DiscordMediaService.persistThemeImages(
    draft.coverUrl || null,
    Array.isArray(draft.previewUrls) ? draft.previewUrls : [],
    draft.id || 'draft-check',
  );

  return {
    isDownloadable: !!res.coverUrl,
    resolvedCoverUrl: res.coverUrl,
    resolvedPreviewUrls: res.previewUrls,
  };
}

export async function main() {
  const includeSkipped =
    process.argv.includes('--include-skipped') ||
    process.argv.includes('--reprocess-skipped') ||
    process.argv.includes('--all');

  console.log('=== BẮT ĐẦU DUYỆT TỰ ĐỘNG TOÀN BỘ BẢN IMPORT (AUTO APPROVE ALL) ===');
  console.log(' Quy tắc: Tự động làm mới link Discord, lưu vĩnh viễn lên Cloudflare R2.');
  console.log('          Bỏ qua những bàn phím thực sự không thể tải/làm mới ảnh bìa.');
  if (includeSkipped) {
    console.log(' [*] Chế độ mở rộng: Bao gồm cả các bản nháp từng bị bỏ qua (SKIPPED).\n');
  } else {
    console.log(' [*] Để duyệt lại cả các bản từng bị bỏ qua, thêm cờ: --include-skipped\n');
  }

  // 1. Get an admin user ID for actorId
  const admin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'admin@template.local' },
        { role: { name: { in: ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'] } } },
      ],
    },
    select: { id: true, email: true },
  });

  if (!admin) {
    console.error('Không tìm thấy tài khoản admin trong hệ thống!');
    process.exit(1);
  }

  console.log(`[*] Sử dụng quyền Admin của: ${admin.email} (ID: ${admin.id})`);

  let totalApproved = 0;
  let totalSkippedNoCover = 0;
  let totalFailedOther = 0;
  let hasMore = true;
  let batchIndex = 1;
  const processedJobIds = new Set<string>();

  const targetStatuses = includeSkipped
    ? ['NEEDS_REVIEW', 'PENDING', 'SKIPPED']
    : ['NEEDS_REVIEW', 'PENDING'];

  while (hasMore) {
    // Find up to 50 jobs with target status
    const jobs = await prisma.importJob.findMany({
      where: {
        status: { in: targetStatuses },
        id: { notIn: Array.from(processedJobIds) },
      },
      take: 50,
      orderBy: { createdAt: 'asc' },
      include: {
        thread: {
          select: {
            originalName: true,
            discordReferenceNumber: true,
          },
        },
        draft: true,
      },
    });

    if (jobs.length === 0) {
      console.log('    [✓] Đã duyệt hết toàn bộ danh sách import cần xử lý!');
      break;
    }

    console.log(`\n[Đợt ${batchIndex}] Đang kiểm tra & duyệt ${jobs.length} bài...`);
    for (const j of jobs) {
      processedJobIds.add(j.id);
    }

    // 1. Thu thập tất cả các URL Discord trong đợt này và làm mới hàng loạt 1 lần (Batch Refresh)
    const allDiscordUrls: string[] = [];
    for (const j of jobs) {
      if (j.draft?.coverUrl) allDiscordUrls.push(j.draft.coverUrl);
      if (Array.isArray(j.draft?.previewUrls)) {
        for (const p of j.draft.previewUrls) {
          if (p) allDiscordUrls.push(p);
        }
      }
    }

    const refreshedMap = await DiscordMediaService.refreshDiscordAttachmentUrls(allDiscordUrls);

    // 2. Xử lý tải ảnh lên R2 và duyệt từng bài (Concurrency = 8)
    await pMap(
      jobs,
      async (job) => {
        const refStr = job.thread?.discordReferenceNumber ? `#${job.thread.discordReferenceNumber} ` : '';
        const jobTitle = `${refStr}${job.thread?.originalName || 'Không tên'}`;

        if (!job.draft) {
          console.log(`    [!] BỎ QUA Job ${job.id} [${jobTitle}]: Không có bản nháp (Draft)`);
          totalSkippedNoCover++;
          return;
        }

        // Tìm URL ảnh bìa đã làm mới
        const rawCover = job.draft.coverUrl;
        const freshCover = (rawCover && refreshedMap.get(rawCover)) || rawCover;

        // Thử tải và upload ảnh bìa chính lên R2
        let r2CoverUrl: string | null = null;
        if (freshCover) {
          r2CoverUrl = await DiscordMediaService.downloadAndUploadToR2(freshCover, `themes/${job.draft.id}`);
        }

        // Nếu ảnh bìa chính lỗi, thử các ảnh preview
        if (!r2CoverUrl && Array.isArray(job.draft.previewUrls) && job.draft.previewUrls.length > 0) {
          for (const pUrl of job.draft.previewUrls) {
            const freshP = refreshedMap.get(pUrl) || pUrl;
            const uploaded = await DiscordMediaService.downloadAndUploadToR2(freshP, `themes/${job.draft.id}`);
            if (uploaded) {
              r2CoverUrl = uploaded;
              break;
            }
          }
        }

        // Không có bất kỳ ảnh nào tải được -> Bỏ qua
        if (!r2CoverUrl) {
          console.log(`    [!] BỎ QUA Job ${job.id} [${jobTitle}]: Không thể tải/làm mới ảnh bìa`);
          try {
            if (job.draft) {
              const currentFlags = Array.isArray(job.draft.flags) ? (job.draft.flags as string[]) : [];
              const updatedFlags = Array.from(new Set([...currentFlags, IMPORT_FLAG.MISSING_COVER]));
              await prisma.keyboardDraft.update({
                where: { id: job.draft.id },
                data: {
                  flags: updatedFlags,
                  validationStatus: 'INVALID',
                },
              });
            }

            await discordImportService.rejectImportJob(
              job.id,
              'Không duyệt tự động: Không thể tải ảnh bìa',
              admin.id,
            );
            totalSkippedNoCover++;
          } catch (err: any) {
            await prisma.importJob.update({
              where: { id: job.id },
              data: {
                status: IMPORT_JOB_STATUS.SKIPPED,
                lastError: 'Không thể tải ảnh bìa',
                processedAt: new Date(),
              },
            });
            totalSkippedNoCover++;
          }
          return;
        }

        // Đã có ảnh R2 hợp lệ -> Cập nhật draft và duyệt
        try {
          await prisma.keyboardDraft.update({
            where: { id: job.draft.id },
            data: { coverUrl: r2CoverUrl },
          });

          // Tải và lưu các ảnh preview còn lại lên R2
          const r2Previews: string[] = [];
          if (Array.isArray(job.draft.previewUrls)) {
            for (const pUrl of job.draft.previewUrls) {
              const freshP = refreshedMap.get(pUrl) || pUrl;
              const uploaded = await DiscordMediaService.downloadAndUploadToR2(freshP, `themes/${job.draft.id}/previews`);
              if (uploaded && uploaded !== r2CoverUrl && !r2Previews.includes(uploaded)) {
                r2Previews.push(uploaded);
              }
            }
            if (r2Previews.length > 0) {
              await prisma.keyboardDraft.update({
                where: { id: job.draft.id },
                data: { previewUrls: r2Previews },
              });
            }
          }

          const res = await discordImportService.approveImportJob(job.id, admin.id);
          totalApproved++;
          console.log(`    [✓] ĐÃ DUYỆT (${totalApproved}) [${jobTitle}] -> ${res.slug} (R2: OK)`);
        } catch (err: any) {
          console.error(`    [✕] LỖI DUYỆT [${jobTitle}]:`, err.message);
          totalFailedOther++;
          await prisma.importJob.update({
            where: { id: job.id },
            data: {
              status: IMPORT_JOB_STATUS.FAILED,
              lastError: `Lỗi khi duyệt: ${err.message}`,
              processedAt: new Date(),
            },
          });
        }
      },
      8,
    );

    batchIndex++;
  }

  console.log('\n=============================================================');
  console.log(`🎉 HOÀN TẤT TỔNG CỘNG:`);
  console.log(`   - Tổng số đã duyệt & phát hành thành công: ${totalApproved}`);
  console.log(`   - Tổng số bỏ qua do không tải được ảnh bìa: ${totalSkippedNoCover}`);
  console.log(`   - Tổng số thất bại do lỗi khác (nếu có): ${totalFailedOther}`);
  console.log('=============================================================');

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
