-- Detailed map of a live project (one per canvas)
CREATE TABLE "project_detail_maps" (
    "canvas_id" TEXT NOT NULL,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_detail_maps_pkey" PRIMARY KEY ("canvas_id")
);

ALTER TABLE "project_detail_maps" ADD CONSTRAINT "project_detail_maps_canvas_id_fkey" FOREIGN KEY ("canvas_id") REFERENCES "user_canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Where a session is on the detailed map
ALTER TABLE "agent_sessions" ADD COLUMN "detail_component_id" TEXT;
