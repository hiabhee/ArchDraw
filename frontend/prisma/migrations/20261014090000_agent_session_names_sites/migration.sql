-- Live projects: session names, construction sites for unmapped code, map coverage counters.
ALTER TABLE "agent_sessions"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "site_area" TEXT,
  ADD COLUMN "site_anchor_id" TEXT,
  ADD COLUMN "mapped_hits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "unmapped_hits" INTEGER NOT NULL DEFAULT 0;
