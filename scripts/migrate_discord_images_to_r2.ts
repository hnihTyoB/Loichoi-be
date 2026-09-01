import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DiscordMediaService } from '../src/modules/discord-import/discord-media.service';

const prisma = new PrismaClient();

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

async function main() {
  console.log('=============================================================');
  console.log('🚀 BẮT ĐẦU CHUYỂN ĐỔI ẢNH DISCORD SANG CLOUDFLARE R2 (VĨNH VIỄN)');
  console.log('=============================================================\n');

  // 1. Tìm tất cả themes đang dùng link Discord CDN
  const themes = await prisma.keyboardTheme.findMany({
    where: {
      coverUrl: { contains: 'discordapp' },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      coverUrl: true,
    },
  });

  console.log(`[*] Tìm thấy tổng cộng ${themes.length} bàn phím cần chuyển đổi ảnh bìa sang R2.`);

  let successCount = 0;
  let failCount = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < themes.length; i += BATCH_SIZE) {
    const batch = themes.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(themes.length / BATCH_SIZE);

    console.log(`\n[Đợt ${batchNum}/${totalBatches}] Đang xử lý ${batch.length} bàn phím...`);

    // 1.1 Lấy danh sách URL cần refresh
    const urls = batch.map((t) => t.coverUrl);
    const refreshedMap = await DiscordMediaService.refreshDiscordAttachmentUrls(urls);

    // 1.2 Tải và upload lên R2 song song với concurrency = 10
    await pMap(
      batch,
      async (theme) => {
        const freshUrl = refreshedMap.get(theme.coverUrl) || theme.coverUrl;
        const r2Url = await DiscordMediaService.downloadAndUploadToR2(freshUrl, `themes/${theme.id}`);

        if (r2Url) {
          await prisma.keyboardTheme.update({
            where: { id: theme.id },
            data: { coverUrl: r2Url },
          });

          // Cập nhật cả draft nếu có
          await prisma.keyboardDraft.updateMany({
            where: { keyboardThemeId: theme.id },
            data: { coverUrl: r2Url },
          });

          successCount++;
          console.log(`  [✓] (${successCount}/${themes.length}) ${theme.name} -> R2: ${r2Url}`);
        } else {
          failCount++;
          console.error(`  [✕] Không thể chuyển đổi ảnh cho: ${theme.name} (${theme.id})`);
        }
      },
      10,
    );
  }

  // 2. Chuyển đổi cả ảnh xem trước (previewImages) nếu có
  const previewImages = await prisma.keyboardImage.findMany({
    where: {
      url: { contains: 'discordapp' },
    },
    select: {
      id: true,
      keyboardThemeId: true,
      url: true,
    },
  });

  if (previewImages.length > 0) {
    console.log(`\n[*] Tìm thấy ${previewImages.length} ảnh xem trước cần chuyển đổi sang R2...`);
    const pUrls = previewImages.map((p) => p.url);
    const pRefreshedMap = await DiscordMediaService.refreshDiscordAttachmentUrls(pUrls);

    await pMap(
      previewImages,
      async (img) => {
        const freshUrl = pRefreshedMap.get(img.url) || img.url;
        const r2Url = await DiscordMediaService.downloadAndUploadToR2(freshUrl, `themes/${img.keyboardThemeId}/previews`);
        if (r2Url) {
          await prisma.keyboardImage.update({
            where: { id: img.id },
            data: { url: r2Url },
          });
        }
      },
      10,
    );
    console.log('  [✓] Đã hoàn tất chuyển đổi ảnh xem trước sang R2!');
  }

  console.log('\n=============================================================');
  console.log(`🎉 HOÀN TẤT CHUYỂN ĐỔI:`);
  console.log(`   - Tổng số ảnh bìa chuyển sang R2 thành công: ${successCount}`);
  console.log(`   - Thất bại (nếu có): ${failCount}`);
  console.log('=============================================================');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error in migration:', err);
  process.exit(1);
});
