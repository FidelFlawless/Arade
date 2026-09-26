-- Search term tracking for "Popular searches"
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.search_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_logs_term_idx ON public.search_logs (term);
CREATE INDEX IF NOT EXISTS search_logs_created_at_idx ON public.search_logs (created_at DESC);

-- RLS on, no public policies: rows are written and read only by the
-- server via the service-role key.
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.search_logs TO service_role;
