-- AlterTable
ALTER TABLE "users" ADD COLUMN "creator_status" TEXT DEFAULT 'NONE',
ADD COLUMN "creator_applied_at" TIMESTAMP(3),
ADD COLUMN "creator_reject_reason" TEXT;

-- CreateIndex
CREATE INDEX "users_creator_status_idx" ON "users"("creator_status");

-- AlterTable
ALTER TABLE "categories" ADD COLUMN "description" TEXT,
ADD COLUMN "icon" TEXT,
ADD COLUMN "color" TEXT,
ADD COLUMN "order_index" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "categories_order_index_idx" ON "categories"("order_index");
