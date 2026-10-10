CREATE TABLE "agentic_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'ArchDraw agent',
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "agentic_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agentic_credentials_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "agentic_credentials_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE TABLE "agentic_pairing_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_code_hash" TEXT NOT NULL,
    "poll_token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "owner_id" TEXT,
    "project_id" UUID,
    "workspace_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_pairing_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agentic_pairing_requests_user_code_hash_key" UNIQUE ("user_code_hash"),
    CONSTRAINT "agentic_pairing_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'completed', 'expired')),
    CONSTRAINT "agentic_pairing_requests_approval_check" CHECK (
      "status" = 'pending' OR ("owner_id" IS NOT NULL AND "project_id" IS NOT NULL AND "workspace_id" IS NOT NULL)
    )
);

CREATE INDEX "agentic_credentials_owner_id_idx" ON "agentic_credentials"("owner_id");
CREATE INDEX "agentic_credentials_project_id_created_at_idx" ON "agentic_credentials"("project_id", "created_at" DESC);
CREATE INDEX "agentic_credentials_expires_at_idx" ON "agentic_credentials"("expires_at");

CREATE INDEX "agentic_pairing_requests_owner_id_created_at_idx" ON "agentic_pairing_requests"("owner_id", "created_at" DESC);
CREATE INDEX "agentic_pairing_requests_project_id_idx" ON "agentic_pairing_requests"("project_id");
CREATE INDEX "agentic_pairing_requests_workspace_id_idx" ON "agentic_pairing_requests"("workspace_id");
CREATE INDEX "agentic_pairing_requests_expires_at_idx" ON "agentic_pairing_requests"("expires_at");

ALTER TABLE "agentic_credentials"
ADD CONSTRAINT "agentic_credentials_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agentic_credentials"
ADD CONSTRAINT "agentic_credentials_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "agentic_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agentic_pairing_requests"
ADD CONSTRAINT "agentic_pairing_requests_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agentic_pairing_requests"
ADD CONSTRAINT "agentic_pairing_requests_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "agentic_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agentic_pairing_requests"
ADD CONSTRAINT "agentic_pairing_requests_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "agentic_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE
  table_name TEXT;
  role_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['agentic_credentials', 'agentic_pairing_requests'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;
