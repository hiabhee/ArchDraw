-- Catch-up for schema changes that reached existing databases via `prisma db push`
-- but never had a migration, so databases built from migrations alone were missing
-- them. Every statement is idempotent: a no-op where the objects already exist.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "daily_generations" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "daily_generations_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "feature_flags" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "total_generations" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "shared_canvases" ADD COLUMN IF NOT EXISTS "owner_id" TEXT;

ALTER TABLE "tutorial_progress" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "user_canvases" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "usage_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT,
    "guest_id" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "usage_logs_action_created_at_idx" ON "usage_logs"("action", "created_at");
CREATE INDEX IF NOT EXISTS "usage_logs_guest_id_created_at_idx" ON "usage_logs"("guest_id", "created_at");
CREATE INDEX IF NOT EXISTS "usage_logs_user_id_created_at_idx" ON "usage_logs"("user_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shared_canvases_owner_id_fkey') THEN
    ALTER TABLE "shared_canvases" ADD CONSTRAINT "shared_canvases_owner_id_fkey"
      FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_logs_user_id_fkey') THEN
    ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
