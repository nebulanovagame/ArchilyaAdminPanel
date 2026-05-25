-- ============================================================================
-- AI STUDIO JOBS — Consolidated migration
 -- ============================================================================
-- Creates the ai_studio_jobs table with all columns required by:
--   - Express backend (src/ai-jobs/express.js) — INSERT with id, user_id, status, prompt, tool_id, output_type, credit_cost, metadata, billing, queued_at
--   - Job processor (src/ai-jobs/processor.js) — UPDATE with started_at, attempt_count, locked_at, result_url, result_text, completed_at, failed_at, last_attempt_error
--   - WebPanel hooks (use-realtime-doc.ts) — Realtime SELECT subscription
-- ============================================================================

-- SAFE ENUM creation
DO $$ BEGIN
    CREATE TYPE ai_job_status AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_studio_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    status ai_job_status NOT NULL DEFAULT 'pending',
    prompt TEXT,
    tool_id TEXT,
    output_type TEXT,
    result_url TEXT,
    result_text TEXT,
    credit_cost INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    feedback TEXT,
    -- Runtime columns (added by processor):
    started_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    queued_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    locked_at TIMESTAMPTZ,
    last_attempt_error JSONB,
    billing JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Timestamps:
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.ai_studio_jobs IS 'AI Studio işleri - Express backend tarafından yönetilir';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_user_id
    ON public.ai_studio_jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_status
    ON public.ai_studio_jobs(status);

CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_created_at_desc
    ON public.ai_studio_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_tool_id
    ON public.ai_studio_jobs(tool_id);

CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_queue
    ON public.ai_studio_jobs(status, created_at)
    WHERE status IN ('pending', 'queued', 'running');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_studio_jobs_updated_at ON public.ai_studio_jobs;

CREATE TRIGGER update_ai_studio_jobs_updated_at
    BEFORE UPDATE ON public.ai_studio_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.ai_studio_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Kullanıcılar sadece kendi job'larını SELECT ile okuyabilir (Realtime için)
-- Insert/Update/Delete işlemleri sadece service_role (backend) üzerinden yapılır.
DROP POLICY IF EXISTS "Users can view own AI jobs" ON public.ai_studio_jobs;
CREATE POLICY "Users can view own AI jobs"
    ON public.ai_studio_jobs FOR SELECT
    USING (auth.uid() = user_id);

-- Service role bypasses RLS automatically; no separate policy needed.

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================
-- The Express backend stores AI job images in a bucket named 'ai-studio'.
-- This bucket must exist for job input/output image storage.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-studio', 'ai-studio', false)
ON CONFLICT (id) DO NOTHING;
-- ============================================================================
