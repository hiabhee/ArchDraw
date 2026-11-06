CREATE TABLE public.mcp_working_sessions (
    id UUID NOT NULL,
    payload JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT mcp_working_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT mcp_working_sessions_payload_size CHECK (pg_column_size(payload) <= 2097152),
    CONSTRAINT mcp_working_sessions_version_check CHECK (version > 0)
);

CREATE INDEX mcp_working_sessions_expires_at_idx
    ON public.mcp_working_sessions (expires_at);

CREATE TABLE public.mcp_request_limits (
    ip_hash CHAR(64) NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT mcp_request_limits_pkey PRIMARY KEY (ip_hash),
    CONSTRAINT mcp_request_limits_count_check CHECK (request_count > 0)
);

CREATE INDEX mcp_request_limits_window_started_at_idx
    ON public.mcp_request_limits (window_started_at);

ALTER TABLE public.mcp_working_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_request_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_working_sessions FROM PUBLIC;
REVOKE ALL ON TABLE public.mcp_request_limits FROM PUBLIC;

DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.mcp_working_sessions FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON TABLE public.mcp_request_limits FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
