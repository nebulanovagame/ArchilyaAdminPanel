-- AI Studio jobs Realtime + RLS hardening.
-- Client/browser role can only SELECT its own jobs.
-- INSERT/UPDATE/DELETE are performed by the backend with service_role.
-- Realtime requires publication membership and SELECT grants for RLS checks.

GRANT SELECT ON public.ai_studio_jobs TO authenticated;
GRANT ALL ON public.ai_studio_jobs TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime') THEN
    GRANT SELECT ON public.ai_studio_jobs TO supabase_realtime;
  END IF;
END $$;

ALTER TABLE public.ai_studio_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_studio_jobs REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Users can manage own AI jobs" ON public.ai_studio_jobs;
DROP POLICY IF EXISTS "Users can view own AI jobs" ON public.ai_studio_jobs;
DROP POLICY IF EXISTS "Service role can manage AI jobs" ON public.ai_studio_jobs;

CREATE POLICY "Users can view own AI jobs"
ON public.ai_studio_jobs
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ai_studio_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_studio_jobs;
  END IF;
END $$;
