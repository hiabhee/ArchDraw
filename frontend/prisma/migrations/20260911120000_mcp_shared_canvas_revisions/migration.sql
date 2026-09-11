ALTER TABLE "shared_canvases"
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "mcp_update_token" TEXT;

CREATE UNIQUE INDEX "shared_canvases_mcp_update_token_key"
ON "shared_canvases"("mcp_update_token");
