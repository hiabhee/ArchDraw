-- Token counts per agent session (reported from the session's own transcript; counts only).
ALTER TABLE "agent_sessions"
  ADD COLUMN "model" TEXT,
  ADD COLUMN "usage" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "usage_by_component" JSONB NOT NULL DEFAULT '{}';
