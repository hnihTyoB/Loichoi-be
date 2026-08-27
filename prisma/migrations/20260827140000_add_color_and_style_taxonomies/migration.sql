-- CreateTable: colors
CREATE TABLE IF NOT EXISTS "colors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "colors_slug_key" ON "colors"("slug");

-- CreateTable: keyboard_colors
CREATE TABLE IF NOT EXISTS "keyboard_colors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "keyboard_theme_id" UUID NOT NULL,
    "color_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyboard_colors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "keyboard_colors_keyboard_theme_id_color_id_key" ON "keyboard_colors"("keyboard_theme_id", "color_id");
CREATE INDEX IF NOT EXISTS "keyboard_colors_keyboard_theme_id_idx" ON "keyboard_colors"("keyboard_theme_id");
CREATE INDEX IF NOT EXISTS "keyboard_colors_color_id_idx" ON "keyboard_colors"("color_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'keyboard_colors_color_id_fkey'
  ) THEN
    ALTER TABLE "keyboard_colors" ADD CONSTRAINT "keyboard_colors_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'keyboard_colors_keyboard_theme_id_fkey'
  ) THEN
    ALTER TABLE "keyboard_colors" ADD CONSTRAINT "keyboard_colors_keyboard_theme_id_fkey" FOREIGN KEY ("keyboard_theme_id") REFERENCES "keyboard_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: styles
CREATE TABLE IF NOT EXISTS "styles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "styles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "styles_slug_key" ON "styles"("slug");

-- CreateTable: keyboard_styles
CREATE TABLE IF NOT EXISTS "keyboard_styles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "keyboard_theme_id" UUID NOT NULL,
    "style_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyboard_styles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "keyboard_styles_keyboard_theme_id_style_id_key" ON "keyboard_styles"("keyboard_theme_id", "style_id");
CREATE INDEX IF NOT EXISTS "keyboard_styles_keyboard_theme_id_idx" ON "keyboard_styles"("keyboard_theme_id");
CREATE INDEX IF NOT EXISTS "keyboard_styles_style_id_idx" ON "keyboard_styles"("style_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'keyboard_styles_style_id_fkey'
  ) THEN
    ALTER TABLE "keyboard_styles" ADD CONSTRAINT "keyboard_styles_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'keyboard_styles_keyboard_theme_id_fkey'
  ) THEN
    ALTER TABLE "keyboard_styles" ADD CONSTRAINT "keyboard_styles_keyboard_theme_id_fkey" FOREIGN KEY ("keyboard_theme_id") REFERENCES "keyboard_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
