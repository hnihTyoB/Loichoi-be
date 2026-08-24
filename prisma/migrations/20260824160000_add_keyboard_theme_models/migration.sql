-- CreateTable
CREATE TABLE "keyboard_themes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT NOT NULL,
    "drive_url" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'BOTH',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyboard_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyboard_images" (
    "id" UUID NOT NULL,
    "keyboard_theme_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyboard_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyboard_theme_categories" (
    "id" UUID NOT NULL,
    "keyboard_theme_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyboard_theme_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "keyboard_theme_id" UUID NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "keyboard_themes_slug_key" ON "keyboard_themes"("slug");

-- CreateIndex
CREATE INDEX "keyboard_themes_status_published_at_idx" ON "keyboard_themes"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "keyboard_themes_platform_idx" ON "keyboard_themes"("platform");

-- CreateIndex
CREATE INDEX "keyboard_themes_download_count_idx" ON "keyboard_themes"("download_count" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "keyboard_images_keyboard_theme_id_position_key" ON "keyboard_images"("keyboard_theme_id", "position");

-- CreateIndex
CREATE INDEX "keyboard_images_keyboard_theme_id_idx" ON "keyboard_images"("keyboard_theme_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "keyboard_theme_categories_keyboard_theme_id_category_id_key" ON "keyboard_theme_categories"("keyboard_theme_id", "category_id");

-- CreateIndex
CREATE INDEX "keyboard_theme_categories_keyboard_theme_id_idx" ON "keyboard_theme_categories"("keyboard_theme_id");

-- CreateIndex
CREATE INDEX "keyboard_theme_categories_category_id_idx" ON "keyboard_theme_categories"("category_id");

-- CreateIndex
CREATE INDEX "downloads_user_id_created_at_idx" ON "downloads"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "downloads_keyboard_theme_id_created_at_idx" ON "downloads"("keyboard_theme_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "keyboard_images" ADD CONSTRAINT "keyboard_images_keyboard_theme_id_fkey" FOREIGN KEY ("keyboard_theme_id") REFERENCES "keyboard_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyboard_theme_categories" ADD CONSTRAINT "keyboard_theme_categories_keyboard_theme_id_fkey" FOREIGN KEY ("keyboard_theme_id") REFERENCES "keyboard_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyboard_theme_categories" ADD CONSTRAINT "keyboard_theme_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_keyboard_theme_id_fkey" FOREIGN KEY ("keyboard_theme_id") REFERENCES "keyboard_themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
