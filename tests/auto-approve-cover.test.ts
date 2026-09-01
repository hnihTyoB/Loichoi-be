import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndResolveCoverImage } from '../scripts/auto_approve_all';
import { DiscordMediaService } from '../src/modules/discord-import/discord-media.service';

describe('Auto Approve All & DiscordMediaService Tests', () => {
  it('should reject invalid or placeholder image URLs in downloadAndUploadToR2', async () => {
    assert.equal(await DiscordMediaService.downloadAndUploadToR2(''), null);
    assert.equal(await DiscordMediaService.downloadAndUploadToR2(null as any), null);
    assert.equal(await DiscordMediaService.downloadAndUploadToR2('not-a-url'), null);
    assert.equal(await DiscordMediaService.downloadAndUploadToR2('https://placehold.co/600x600.png'), null);
    assert.equal(await DiscordMediaService.downloadAndUploadToR2('https://example.com/cover.png'), null);
  });

  it('should reject drafts with no downloadable cover images', async () => {
    const resNull = await validateAndResolveCoverImage(null);
    assert.equal(resNull.isDownloadable, false);

    const draftPlaceholder = {
      coverUrl: 'https://placehold.co/600x600/f8e8ee/6c5b7b.png?text=Kawaii+Keyboard',
      previewUrls: [],
    };
    const resDraftPlaceholder = await validateAndResolveCoverImage(draftPlaceholder);
    assert.equal(resDraftPlaceholder.isDownloadable, false);

    const draftBroken = {
      coverUrl: 'https://invalid-host-nonexistent-12345.com/test.png',
      previewUrls: [],
    };
    const resBroken = await validateAndResolveCoverImage(draftBroken);
    assert.equal(resBroken.isDownloadable, false);
  });

  it('should return R2 public URL directly if URL is already on R2', async () => {
    const r2Url = 'https://pub-7c9b20c466244ea4ac51c76607a39e6f.r2.dev/themes/already-on-r2.webp';
    const draft = {
      coverUrl: r2Url,
      previewUrls: [],
    };

    const result = await validateAndResolveCoverImage(draft);
    assert.equal(result.isDownloadable, true);
    assert.equal(result.resolvedCoverUrl, r2Url);
  });
});
