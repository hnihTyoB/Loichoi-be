import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { r2Config } from '../../config/r2.config';
import { R2Service } from '../../common/services/r2.service';
import { isPublicHttpUrl, resolveAndValidateDns } from '../../common/helpers/url.helper';
import { envConfig } from '../../config/env.config';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10MB limit
const DOWNLOAD_TIMEOUT_MS = 15000; // 15 seconds

export class DiscordMediaService {
  private static r2Service = new R2Service();
  private static s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
    },
  });

  /**
   * Kiểm tra URL an toàn: scheme http/https, không thuộc IP private/cloud metadata, DNS không trỏ về local
   */
  private static async isSafeUrl(urlString: string): Promise<boolean> {
    const isPublic = isPublicHttpUrl(urlString, {
      allowPrivate: envConfig.nodeEnv === 'development',
    });
    if (!isPublic) return false;

    try {
      const parsed = new URL(urlString);
      const dnsRes = await resolveAndValidateDns(parsed.hostname, {
        allowPrivate: envConfig.nodeEnv === 'development',
      });
      return dnsRes.isValid;
    } catch {
      return false;
    }
  }

  /**
   * Thực hiện fetch an toàn với DNS validation, SSRF defense và timeout
   */
  private static async safeFetch(url: string): Promise<Response | null> {
    const safe = await this.isSafeUrl(url);
    if (!safe) return null;

    try {
      return await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
    } catch {
      return null;
    }
  }

  /**
   * Đọc response buffer an toàn với Content-Length check và stream size limit chống OOM
   */
  private static async readSafeBuffer(res: Response): Promise<Buffer | null> {
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_MEDIA_BYTES) {
      return null;
    }

    try {
      if (res.body && typeof (res.body as any).getReader === 'function') {
        const reader = (res.body as any).getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            if (totalBytes > MAX_MEDIA_BYTES) {
              await reader.cancel();
              return null;
            }
            chunks.push(value);
          }
        }
        const buffer = Buffer.concat(chunks);
        return buffer.length >= 100 ? buffer : null;
      } else {
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_MEDIA_BYTES || arrayBuffer.byteLength < 100) {
          return null;
        }
        return Buffer.from(arrayBuffer);
      }
    } catch {
      return null;
    }
  }

  /**
   * Làm mới các URL ảnh Discord CDN bị hết hạn (thông qua Discord Bot API).
   * @param urls Danh sách các URL Discord CDN cần làm mới
   * @returns Map từ original URL -> refreshed URL
   */
  static async refreshDiscordAttachmentUrls(urls: string[]): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();
    if (!urls || urls.length === 0) return urlMap;

    const discordUrls = urls.filter((u) => u && typeof u === 'string' && u.includes('discordapp'));
    if (discordUrls.length === 0) return urlMap;

    const CHUNK_SIZE = 50;
    for (let i = 0; i < discordUrls.length; i += CHUNK_SIZE) {
      const chunk = discordUrls.slice(i, i + CHUNK_SIZE);
      try {
        const res = await fetch(`${DISCORD_API_BASE}/attachments/refresh-urls`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ attachment_urls: chunk }),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) continue;

        const data = (await res.json()) as {
          refreshed_urls?: Array<{ original: string; refreshed: string }>;
        };

        if (data.refreshed_urls) {
          for (const item of data.refreshed_urls) {
            urlMap.set(item.original, item.refreshed);
          }
        }
      } catch (err) {
        console.warn('[DiscordMediaService] Lỗi khi làm mới attachment URLs:', err);
      }
    }

    return urlMap;
  }

  /**
   * Tải ảnh từ URL ngoài (hoặc Discord CDN), upload lên Cloudflare R2 bucket
   * và trả về link public R2 vĩnh viễn.
   *
   * @param rawUrl URL ảnh gốc (từ attachment, embed, thumbnail)
   * @param keyPrefix Tiền tố key lưu trên R2 (VD: themes/import-123)
   * @returns URL public vĩnh viễn trên R2, hoặc null nếu không tải được
   */
  static async downloadAndUploadToR2(rawUrl: string, keyPrefix = 'themes/imported'): Promise<string | null> {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) return null;

    if (
      trimmedUrl.includes('placehold.co') ||
      trimmedUrl.includes('placeholder') ||
      trimmedUrl.includes('example.com')
    ) {
      return null;
    }

    if (r2Config.publicBaseUrl && trimmedUrl.startsWith(r2Config.publicBaseUrl.replace(/\/$/, ''))) {
      return trimmedUrl;
    }

    let targetUrl = trimmedUrl;

    // Thử tải trực tiếp với SSRF check, DNS validation và timeout
    let fetchRes = await this.safeFetch(targetUrl);

    // Nếu bị 404, 403 hoặc thất bại và là link Discord -> Thử refresh qua Discord Bot API
    if ((!fetchRes || !fetchRes.ok) && targetUrl.includes('discordapp')) {
      const refreshedMap = await this.refreshDiscordAttachmentUrls([targetUrl]);
      const refreshedUrl = refreshedMap.get(targetUrl);
      if (refreshedUrl) {
        targetUrl = refreshedUrl;
        fetchRes = await this.safeFetch(targetUrl);
      }
    }

    if (!fetchRes || !fetchRes.ok) {
      return null;
    }

    const contentType = fetchRes.headers.get('content-type') || 'image/png';
    if (
      contentType.includes('text/html') ||
      contentType.includes('application/json') ||
      contentType.includes('text/plain')
    ) {
      return null;
    }

    const buffer = await this.readSafeBuffer(fetchRes);
    if (!buffer) {
      return null;
    }

    // Xác định phần mở rộng file
    let ext = 'png';
    if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
    else if (contentType.includes('gif')) ext = 'gif';
    else if (contentType.includes('avif')) ext = 'avif';

    const filename = `${randomUUID().slice(0, 12)}.${ext}`;
    const cleanPrefix = keyPrefix.replace(/^\/+|\/+$/g, '');
    const key = `${cleanPrefix}/${filename}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: r2Config.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      return this.r2Service.getPublicUrl(key);
    } catch (uploadErr: any) {
      console.error(`[DiscordMediaService] Failed to upload image to R2 (${key}):`, uploadErr.message);
      return null;
    }
  }

  /**
   * Tải và lưu vĩnh viễn toàn bộ ảnh (Ảnh bìa + Ảnh xem trước) của một theme lên R2.
   */
  static async persistThemeImages(
    coverUrl: string | null | undefined,
    previewUrls: string[] = [],
    id = 'theme',
  ): Promise<{ coverUrl: string | null; previewUrls: string[] }> {
    const keyPrefix = `themes/imported/${id}`;

    // 1. Lưu ảnh bìa
    let r2CoverUrl: string | null = null;
    if (coverUrl) {
      r2CoverUrl = await this.downloadAndUploadToR2(coverUrl, keyPrefix);
    }

    // 2. Lưu các ảnh preview
    const r2Previews: string[] = [];
    if (Array.isArray(previewUrls) && previewUrls.length > 0) {
      for (const pUrl of previewUrls) {
        if (!pUrl) continue;
        const uploaded = await this.downloadAndUploadToR2(pUrl, keyPrefix);
        if (uploaded && !r2Previews.includes(uploaded) && uploaded !== r2CoverUrl) {
          r2Previews.push(uploaded);
        }
      }
    }

    // 3. Nếu ảnh bìa chính thất bại nhưng có ảnh preview tải được, sử dụng ảnh preview đầu tiên làm ảnh bìa
    if (!r2CoverUrl && r2Previews.length > 0) {
      r2CoverUrl = r2Previews.shift()!;
    }

    return {
      coverUrl: r2CoverUrl,
      previewUrls: r2Previews,
    };
  }
}
