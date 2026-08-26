import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { usernameParamSchema, creatorQuerySchema } from '../src/modules/creator/creator.validation';
import {
  createCollectionSchema,
  updateCollectionSchema,
  collectionQuerySchema,
  addCollectionThemeSchema,
} from '../src/modules/collection/collection.validation';
import {
  studioUpdateProfileSchema,
  studioApplySchema,
  studioThemeQuerySchema,
} from '../src/modules/studio/studio.validation';
import { CreatorService } from '../src/modules/creator/creator.service';
import { CollectionService } from '../src/modules/collection/collection.service';
import { KeyboardService } from '../src/modules/keyboard/keyboard.service';
import { StudioService } from '../src/modules/studio/studio.service';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';

describe('KeyboardHub Platform - Validation Schemas', () => {
  it('should validate usernameParamSchema correctly', () => {
    const valid = usernameParamSchema.parse({ username: 'kurothemes' });
    assert.equal(valid.username, 'kurothemes');

    const validWithSymbols = usernameParamSchema.parse({ username: 'kuro_themes.official-99' });
    assert.equal(validWithSymbols.username, 'kuro_themes.official-99');

    assert.throws(() => usernameParamSchema.parse({ username: 'a' })); // Min 2 chars
    assert.throws(() => usernameParamSchema.parse({ username: 'invalid username with spaces' }));
    assert.throws(() => usernameParamSchema.parse({ username: 'invalid@symbols!' }));
  });

  it('should validate creatorQuerySchema correctly', () => {
    const valid = creatorQuerySchema.parse({
      page: '2',
      limit: '15',
      search: 'kuro',
      isFeatured: 'true',
      sort: 'TOP_FOLLOWERS',
    });
    assert.equal(valid.page, 2);
    assert.equal(valid.limit, 15);
    assert.equal(valid.search, 'kuro');
    assert.equal(valid.isFeatured, true);
    assert.equal(valid.sort, 'TOP_FOLLOWERS');
  });

  it('should validate createCollectionSchema correctly', () => {
    const valid = createCollectionSchema.parse({
      name: 'Sakura & Pastel Aesthetics',
      slug: 'sakura-pastel-aesthetics',
      description: 'Hand-curated pastel collection',
      coverUrl: 'https://images.unsplash.com/photo-1522383225653-ed111181a951',
      isPublic: true,
      themeIds: ['11111111-1111-1111-1111-111111111111'],
    });
    assert.equal(valid.name, 'Sakura & Pastel Aesthetics');
    assert.equal(valid.slug, 'sakura-pastel-aesthetics');
    assert.equal(valid.isPublic, true);
    assert.equal(valid.themeIds?.length, 1);

    assert.throws(() => createCollectionSchema.parse({ name: 'AB' })); // Min 3 chars
    assert.throws(() =>
      createCollectionSchema.parse({
        name: 'Valid Name',
        coverUrl: 'not-a-url',
      }),
    );
  });

  it('should validate studioUpdateProfileSchema and studioApplySchema', () => {
    const validUpdate = studioUpdateProfileSchema.parse({
      username: 'kurothemes_v2',
      fullName: 'Kuro Studio',
      bio: 'New bio description',
      socialLinks: {
        twitter: 'https://twitter.com/kurothemes',
        discord: 'https://discord.gg/kuro',
      },
    });
    assert.equal(validUpdate.username, 'kurothemes_v2');
    assert.equal(validUpdate.fullName, 'Kuro Studio');

    const validApply = studioApplySchema.parse({
      username: 'artisan_keyboards',
      bio: 'Creating artisan theme packs',
      socialLinks: {
        website: 'https://artisan-keyboards.com',
      },
    });
    assert.equal(validApply.username, 'artisan_keyboards');
  });
});

describe('KeyboardHub Platform - Creator Domain Services', () => {
  let creatorService: CreatorService;

  beforeEach(() => {
    creatorService = new CreatorService();
  });

  it('should get public creator profile with computed stats and isFollowing', async () => {
    const mockRepo = {
      findByUsername: async (username: string) => {
        if (username === 'kurothemes') {
          return {
            id: 'creator-uuid-1',
            fullName: 'Kuro Themes',
            username: 'kurothemes',
            bio: 'Creator bio',
            avatarUrl: 'https://cdn.example.com/avatar.jpg',
            bannerUrl: 'https://cdn.example.com/banner.jpg',
            isCreator: true,
            isFeaturedCreator: true,
            socialLinks: { twitter: 'https://twitter.com/kuro' },
            createdAt: new Date('2026-01-01'),
          };
        }
        return null;
      },
      getCreatorStats: async () => ({
        themesCount: 18,
        downloadsCount: 126000,
        followersCount: 12000,
        likesCount: 3400,
        collectionsCount: 4,
      }),
      isUserFollowing: async () => true,
    };

    (creatorService as any).repository = mockRepo;

    const profile = await creatorService.getProfileByUsername('kurothemes', 'user-uuid-1');
    assert.equal(profile.username, 'kurothemes');
    assert.equal(profile.stats.themesCount, 18);
    assert.equal(profile.stats.downloadsCount, 126000);
    assert.equal(profile.stats.followersCount, 12000);
    assert.equal(profile.stats.likesCount, 3400);
    assert.equal(profile.isFollowing, true);
  });

  it('should throw 404 CREATOR_NOT_FOUND when creator does not exist', async () => {
    const mockRepo = {
      findByUsername: async () => null,
    };
    (creatorService as any).repository = mockRepo;

    await assert.rejects(
      () => creatorService.getProfileByUsername('nonexistent_creator'),
      (err: AppError) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, ERROR_CODE.CREATOR_NOT_FOUND);
        return true;
      },
    );
  });

  it('should toggle follow and prevent following self', async () => {
    const mockRepo = {
      findByUsername: async (username: string) => ({
        id: 'creator-uuid-1',
        username,
      }),
      toggleFollow: async (followerId: string, followingId: string) => ({
        isFollowing: true,
        followerCount: 12001,
      }),
      createAuditLog: async () => {},
    };
    (creatorService as any).repository = mockRepo;

    // Follow another creator -> OK
    const result = await creatorService.toggleFollow('kurothemes', 'user-uuid-2');
    assert.equal(result.isFollowing, true);
    assert.equal(result.followerCount, 12001);

    // Follow self -> throws CANNOT_FOLLOW_SELF
    await assert.rejects(
      () => creatorService.toggleFollow('kurothemes', 'creator-uuid-1'),
      (err: AppError) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, ERROR_CODE.CANNOT_FOLLOW_SELF);
        return true;
      },
    );
  });
});

describe('KeyboardHub Platform - Keyboard Likes Domain', () => {
  let keyboardService: KeyboardService;

  beforeEach(() => {
    keyboardService = new KeyboardService();
  });

  it('should toggle like on theme and return updated likeCount', async () => {
    const mockRepo = {
      findBySlug: async (slug: string) => ({
        id: 'theme-uuid-1',
        slug,
        status: 'PUBLISHED',
      }),
      toggleLike: async (userId: string, themeId: string) => ({
        liked: true,
        likeCount: 3401,
      }),
      createAuditLog: async () => {},
    };
    const mockConfigService = {
      isFeatureEnabled: async () => true,
    };

    (keyboardService as any).repository = mockRepo;
    (keyboardService as any).systemConfigService = mockConfigService;

    const result = await keyboardService.toggleLike('sakura-dream', 'user-uuid-1');
    assert.equal(result.liked, true);
    assert.equal(result.likeCount, 3401);
    assert.equal(result.slug, 'sakura-dream');
  });

  it('should reject like if theme is not PUBLISHED or does not exist', async () => {
    const mockRepo = {
      findBySlug: async () => null,
    };
    const mockConfigService = {
      isFeatureEnabled: async () => true,
    };

    (keyboardService as any).repository = mockRepo;
    (keyboardService as any).systemConfigService = mockConfigService;

    await assert.rejects(
      () => keyboardService.toggleLike('hidden-theme', 'user-uuid-1'),
      (err: AppError) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, ERROR_CODE.THEME_NOT_FOUND);
        return true;
      },
    );
  });
});

describe('KeyboardHub Platform - Collections Domain', () => {
  let collectionService: CollectionService;

  beforeEach(() => {
    collectionService = new CollectionService();
  });

  it('should create collection with auto-slug and audit log', async () => {
    const mockRepo = {
      findBySlug: async () => null,
      create: async (data: any) => ({
        id: 'col-uuid-1',
        name: data.name,
        slug: data.slug,
        isPublic: true,
      }),
      findPublicBySlug: async (slug: string) => ({
        id: 'col-uuid-1',
        name: 'Pastel Dream Themes',
        slug,
        isPublic: true,
        itemsCount: 0,
        items: [],
      }),
      createAuditLog: async () => {},
    };
    const mockConfigService = {
      isFeatureEnabled: async () => true,
      get: async () => 100,
    };

    (collectionService as any).repository = mockRepo;
    (collectionService as any).systemConfigService = mockConfigService;

    const col = await collectionService.create(
      { name: 'Pastel Dream Themes' },
      'user-uuid-1',
    );

    assert.equal(col.name, 'Pastel Dream Themes');
    assert.equal(col.slug, 'pastel-dream-themes');
  });

  it('should enforce ownership on collection update', async () => {
    const mockRepo = {
      findById: async () => ({
        id: 'col-uuid-1',
        userId: 'owner-uuid',
        name: 'Original Name',
        slug: 'original-name',
      }),
    };
    (collectionService as any).repository = mockRepo;

    await assert.rejects(
      () =>
        collectionService.update(
          'col-uuid-1',
          { name: 'New Name' },
          'intruder-uuid',
          'USER',
        ),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.NOT_COLLECTION_OWNER);
        return true;
      },
    );
  });
});

describe('KeyboardHub Platform - Creator Studio Domain', () => {
  let studioService: StudioService;

  beforeEach(() => {
    studioService = new StudioService();
  });

  it('should return complete studio dashboard stats for active creator', async () => {
    const mockRepo = {
      findUserById: async (id: string) => ({
        id,
        isActive: true,
        isCreator: true,
      }),
      getCreatorStudioStats: async () => ({
        totalThemes: 18,
        publishedThemesCount: 16,
        draftThemesCount: 2,
        totalDownloads: 126000,
        totalLikes: 3400,
        totalFollowers: 12000,
        recentDownloadsTrend: [
          { date: '2026-08-25', downloads: 450 },
          { date: '2026-08-26', downloads: 520 },
        ],
        topThemes: [
          {
            id: 'theme-1',
            name: 'Sakura Dream',
            slug: 'sakura-dream',
            coverUrl: 'https://cdn.example.com/sakura.webp',
            downloadCount: 126000,
            likeCount: 3400,
            status: 'PUBLISHED',
          },
        ],
      }),
    };
    const mockConfigService = {
      isFeatureEnabled: async () => true,
    };

    (studioService as any).repository = mockRepo;
    (studioService as any).systemConfigService = mockConfigService;

    const stats = await studioService.getDashboardStats('creator-uuid-1');
    assert.equal(stats.totalThemes, 18);
    assert.equal(stats.totalDownloads, 126000);
    assert.equal(stats.totalLikes, 3400);
    assert.equal(stats.totalFollowers, 12000);
    assert.equal(stats.topThemes[0].name, 'Sakura Dream');
  });

  it('should reject non-creator users with 403 FORBIDDEN', async () => {
    const mockRepo = {
      findUserById: async (id: string) => ({
        id,
        isActive: true,
        isCreator: false, // Normal user
      }),
    };
    const mockConfigService = {
      isFeatureEnabled: async () => true,
    };

    (studioService as any).repository = mockRepo;
    (studioService as any).systemConfigService = mockConfigService;

    await assert.rejects(
      () => studioService.getDashboardStats('normal-user-uuid'),
      (err: AppError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, ERROR_CODE.FORBIDDEN);
        return true;
      },
    );
  });
});

