ALTER TABLE "user_canvases" ADD COLUMN "agentic_project_id" UUID;

CREATE UNIQUE INDEX "user_canvases_agentic_project_id_key" ON "user_canvases"("agentic_project_id");

ALTER TABLE "user_canvases"
ADD CONSTRAINT "user_canvases_agentic_project_id_fkey"
FOREIGN KEY ("agentic_project_id") REFERENCES "agentic_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "agent_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "canvas_id" TEXT NOT NULL,
    "session_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "branch" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "intent" TEXT,
    "current_component_id" TEXT,
    "touched" JSONB NOT NULL DEFAULT '{}',
    "unmapped_paths" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_sessions_status_check" CHECK ("status" IN ('active', 'idle', 'ended'))
);

CREATE UNIQUE INDEX "agent_sessions_canvas_id_session_key_key" ON "agent_sessions"("canvas_id", "session_key");
CREATE INDEX "agent_sessions_canvas_id_last_seen_at_idx" ON "agent_sessions"("canvas_id", "last_seen_at" DESC);

ALTER TABLE "agent_sessions"
ADD CONSTRAINT "agent_sessions_canvas_id_fkey"
FOREIGN KEY ("canvas_id") REFERENCES "user_canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE
  role_name TEXT;
BEGIN
  ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.agent_sessions FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
