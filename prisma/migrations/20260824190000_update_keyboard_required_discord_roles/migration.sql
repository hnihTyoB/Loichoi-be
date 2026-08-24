-- AlterTable
ALTER TABLE "keyboard_themes" DROP COLUMN IF EXISTS "required_discord_role_id";
ALTER TABLE "keyboard_themes" ADD COLUMN "required_discord_role_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
