-- AlterTable
ALTER TABLE "keyboard_themes" ADD COLUMN "access_level" TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE "keyboard_themes" ADD COLUMN "required_discord_role_id" TEXT;

-- CreateIndex
CREATE INDEX "keyboard_themes_access_level_idx" ON "keyboard_themes"("access_level");
