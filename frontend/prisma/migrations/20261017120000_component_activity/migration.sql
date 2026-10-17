-- History of a live project's components (work bouts and additions per session)
CREATE TABLE "component_activity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "canvas_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "detail_component_id" TEXT,
    "session_key" TEXT NOT NULL,
    "session_name" TEXT,
    "kind" TEXT NOT NULL,
    "intent" TEXT,
    "files" JSONB NOT NULL DEFAULT '[]',
    "edits" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "component_activity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "component_activity_canvas_id_component_id_last_at_idx" ON "component_activity"("canvas_id", "component_id", "last_at" DESC);
CREATE INDEX "component_activity_canvas_id_session_key_last_at_idx" ON "component_activity"("canvas_id", "session_key", "last_at" DESC);

ALTER TABLE "component_activity" ADD CONSTRAINT "component_activity_canvas_id_fkey" FOREIGN KEY ("canvas_id") REFERENCES "user_canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
