CREATE TABLE "agentic_projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repository_remote" TEXT,
    "default_branch" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentic_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agentic_workspaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "binding_key" UUID NOT NULL,
    "branch_name" TEXT,
    "base_commit_sha" TEXT,
    "current_revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentic_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agentic_architecture_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "base_commit_sha" TEXT,
    "snapshot" JSONB NOT NULL DEFAULT '{"components":[],"relationships":[]}',
    "summary" TEXT,
    "actor_type" TEXT NOT NULL DEFAULT 'user',
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_architecture_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agentic_project_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "view_type" TEXT NOT NULL DEFAULT 'overview',
    "state" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentic_project_views_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agentic_proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "base_revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "operations" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "decision" JSONB,
    "verification" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentic_proposals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agentic_workspaces_project_id_binding_key_key"
ON "agentic_workspaces"("project_id", "binding_key");

CREATE INDEX "agentic_projects_owner_id_updated_at_idx"
ON "agentic_projects"("owner_id", "updated_at" DESC);

CREATE INDEX "agentic_workspaces_project_id_branch_name_idx"
ON "agentic_workspaces"("project_id", "branch_name");

CREATE UNIQUE INDEX "agentic_architecture_revisions_workspace_id_revision_key"
ON "agentic_architecture_revisions"("workspace_id", "revision");

CREATE INDEX "agentic_architecture_revisions_workspace_id_created_at_idx"
ON "agentic_architecture_revisions"("workspace_id", "created_at" DESC);

CREATE UNIQUE INDEX "agentic_project_views_workspace_id_name_key"
ON "agentic_project_views"("workspace_id", "name");

CREATE INDEX "agentic_project_views_workspace_id_updated_at_idx"
ON "agentic_project_views"("workspace_id", "updated_at" DESC);

CREATE INDEX "agentic_proposals_workspace_id_status_created_at_idx"
ON "agentic_proposals"("workspace_id", "status", "created_at" DESC);

ALTER TABLE "agentic_projects"
ADD CONSTRAINT "agentic_projects_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agentic_workspaces"
ADD CONSTRAINT "agentic_workspaces_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "agentic_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agentic_architecture_revisions"
ADD CONSTRAINT "agentic_architecture_revisions_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "agentic_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agentic_project_views"
ADD CONSTRAINT "agentic_project_views_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "agentic_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agentic_proposals"
ADD CONSTRAINT "agentic_proposals_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "agentic_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE
  table_name TEXT;
  role_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'agentic_projects',
    'agentic_workspaces',
    'agentic_architecture_revisions',
    'agentic_project_views',
    'agentic_proposals'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;
