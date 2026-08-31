import { PrismaClient } from '@prisma/client';
import { DiscordImportService } from '../src/modules/discord-import/discord-import.service';

const prisma = new PrismaClient();
const discordImportService = new DiscordImportService();

async function main() {
  console.log('=== BẮT ĐẦU DUYỆT TỰ ĐỘNG TOÀN BỘ BẢN IMPORT (AUTO APPROVE ALL) ===');

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
  let totalFailed = 0;
  let hasMore = true;
  let batchIndex = 1;

  while (hasMore) {
    // Find up to 50 jobs with status NEEDS_REVIEW or PENDING
    const jobs = await prisma.importJob.findMany({
      where: {
        status: { in: ['NEEDS_REVIEW', 'PENDING'] },
      },
      take: 50,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        thread: {
          select: {
            originalName: true,
            discordReferenceNumber: true,
          },
        },
      },
    });

    if (jobs.length === 0) {
      console.log('    [✓] Đã duyệt hết toàn bộ danh sách import!');
      break;
    }

    console.log(`\n[Đợt ${batchIndex}] Đang duyệt ${jobs.length} bài...`);
    const jobIds = jobs.map((j) => j.id);

    try {
      const result = await discordImportService.bulkApprove(jobIds, admin.id);
      totalApproved += result.succeeded.length;
      totalFailed += result.failed.length;

      console.log(`    [✓] Thành công: ${result.succeeded.length}, Thất bại: ${result.failed.length}`);

      if (result.failed.length > 0) {
        console.log('    Chi tiết lỗi thất bại:');
        for (const f of result.failed) {
          console.log(`      - Job ${f.importJobId}: ${f.reason}`);
        }
      }
    } catch (err) {
      console.error(`    [!] Lỗi đợt ${batchIndex}:`, err);
      // If batch failed, try single approves to avoid stopping the whole queue
      for (const j of jobs) {
        try {
          await discordImportService.approveImportJob(j.id, admin.id);
          totalApproved++;
        } catch (e: any) {
          console.error(`      - Lỗi job ${j.id}: ${e.message}`);
          totalFailed++;
        }
      }
    }

    batchIndex++;
  }

  console.log('\n=============================================================');
  console.log(`🎉 HOÀN TẤT TỔNG CỘNG:`);
  console.log(`   - Tổng số đã duyệt & phát hành thành công: ${totalApproved}`);
  console.log(`   - Tổng số thất bại (nếu có): ${totalFailed}`);
  console.log('=============================================================');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
