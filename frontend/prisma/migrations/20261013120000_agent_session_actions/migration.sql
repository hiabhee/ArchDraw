-- Live project figures: what each agent session did last, and where its task points.
ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "last_action" TEXT;
ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "last_action_at" TIMESTAMP(3);
ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "aim_component_id" TEXT;
