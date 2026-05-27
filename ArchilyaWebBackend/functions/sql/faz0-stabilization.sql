-- FAZ 0 Backend Stabilization Migrations
-- Archilya AI Studio Job Events + Rate Limiting Tables

-- ============================================================
-- 1. AI Studio Job Events (Audit Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_studio_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  user_id UUID,
  tool_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'queued', 'claimed', 'charge_started', 'charged', 'started',
    'provider_call_started', 'provider_call_failed', 'retry_scheduled',
    'completed', 'failed', 'stale_recovered', 'dead_lettered', 'manual_retry'
  )),
  previous_status TEXT,
  new_status TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  attempt INTEGER,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_ai_studio_job_events_job_id ON ai_studio_job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_studio_job_events_user_id ON ai_studio_job_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_studio_job_events_event_type ON ai_studio_job_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ai_studio_job_events_created_at ON ai_studio_job_events(created_at);

-- ============================================================
-- 2. Rate Limit Buckets
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_key ON rate_limit_buckets(bucket_key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_created_at ON rate_limit_buckets(created_at);

-- Temizlik fonksiyonu (eski kayitlari silmek icin)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_buckets()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_buckets
  WHERE created_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. AI Studio Jobs - dead_letter kolonu ekle (varsa atla)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_studio_jobs' AND column_name = 'dead_letter'
  ) THEN
    ALTER TABLE ai_studio_jobs ADD COLUMN dead_letter JSONB DEFAULT NULL;
  END IF;
END $$;

-- ============================================================
-- 4. AI Studio Jobs - locked_at index (stale recovery icin)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_status_locked_at 
ON ai_studio_jobs(status, locked_at) 
WHERE status = 'running';

-- ============================================================
-- 5. AI Studio Jobs - status + attempt_count index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_status_attempt 
ON ai_studio_jobs(status, attempt_count);
