/**
 * Tiện ích xử lý URL và Key của Cloudflare R2
 */

/**
 * Trích xuất R2 Key từ URL công khai.
 * @param url URL của file ảnh (VD: https://pub-xxx.r2.dev/themes/userId/covers/1234_abc.webp)
 * @param prefix Tiền tố thư mục cần lọc (VD: 'themes' hoặc 'avatars')
 * @returns R2 key (VD: 'themes/userId/covers/1234_abc.webp') hoặc null nếu không phải URL R2
 */
export function extractR2Key(url: string | null | undefined, prefix?: 'avatars' | 'themes'): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    if (prefix) {
      const match = url.match(new RegExp(`${prefix}/[^\\s?#]+`));
      return match ? match[0] : null;
    }

    const match = url.match(/(?:themes|avatars)\/[^\s?#]+/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}
