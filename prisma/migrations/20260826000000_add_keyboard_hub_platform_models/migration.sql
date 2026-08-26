-- AlterTable: Add creator and profile fields to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banner_url" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_creator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_featured_creator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "social_links" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");
CREATE INDEX IF NOT EXISTS "users_is_creator_idx" ON "users"("is_creator");

-- AlterTable: Add likeCount, isFeatured, and createdBy relation index to keyboard_themes
ALTER TABLE "keyboard_themes" ADD COLUMN IF NOT EXISTS "like_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "keyboard_themes" ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "keyboard_themes_like_count_idx" ON "keyboard_themes"("like_count" DESC);
CREATE INDEX IF NOT EXISTS "keyboard_themes_is_featured_idx" ON "keyboard_themes"("is_featured");
CREATE INDEX IF NOT EXISTS "keyboard_themes_created_by_idx" ON "keyboard_themes"("created_by");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'keyboard_themes_created_by_fkey'
  ) THEN
    ALTER TABLE "keyboard_themes" ADD CONSTRAINT "keyboard_themes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: keyboard_likes
CREATE TABLE IF NOT EXISTS "keyboard_likes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "keyboard_theme_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyboard_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "keyboard_likes_user_id_keyboard_theme_id_key" ON "keyboard_likes"("user_id", "keyboard_theme_id");
CREATE INDEX IF NOT EXISTS "keyboard_likes_user_id_idx" ON "keyboard_likes"("user_id");
CREATE INDEX IF NOT EXISTS "keyboard_likes_keyboard_theme_id_idx" ON "keyboard_likes"("keyboard_theme_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'keyboard_likes_user_id_fkey'
  ) THEN
    ALTER TABLE "keyboard_likes" ADD CONSTRAINT "keyboard_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'keyboard_likes_keyboard_theme_id_fkey'
  ) THEN
    ALTER TABLE "keyboard_likes" ADD CONSTRAINT "keyboard_likes_keyboard_theme_id_fkey" FOREIGN KEY ("keyboard_theme_id") REFERENCES "keyboard_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: user_follows
CREATE TABLE IF NOT EXISTS "user_follows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_follows_follower_id_following_id_key" ON "user_follows"("follower_id", "following_id");
CREATE INDEX IF NOT EXISTS "user_follows_follower_id_idx" ON "user_follows"("follower_id");
CREATE INDEX IF NOT EXISTS "user_follows_following_id_idx" ON "user_follows"("following_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_follows_follower_id_fkey'
  ) THEN
    ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_follows_following_id_fkey'
  ) THEN
    ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: collections
CREATE TABLE IF NOT EXISTS "collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "collections_slug_key" ON "collections"("slug");
CREATE INDEX IF NOT EXISTS "collections_user_id_idx" ON "collections"("user_id");
CREATE INDEX IF NOT EXISTS "collections_is_public_is_featured_idx" ON "collections"("is_public", "is_featured");
CREATE INDEX IF NOT EXISTS "collections_slug_idx" ON "collections"("slug");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'collections_user_id_fkey'
  ) THEN
    ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: collection_items
CREATE TABLE IF NOT EXISTS "collection_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "collection_id" UUID NOT NULL,
    "keyboard_theme_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "collection_items_collection_id_keyboard_theme_id_key" ON "collection_items"("collection_id", "keyboard_theme_id");
CREATE INDEX IF NOT EXISTS "collection_items_collection_id_idx" ON "collection_items"("collection_id");
CREATE INDEX IF NOT EXISTS "collection_items_keyboard_theme_id_idx" ON "collection_items"("keyboard_theme_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'collection_items_collection_id_fkey'
  ) THEN
    ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'collection_items_keyboard_theme_id_fkey'
  ) THEN
    ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_keyboard_theme_id_fkey" FOREIGN KEY ("keyboard_theme_id") REFERENCES "keyboard_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
