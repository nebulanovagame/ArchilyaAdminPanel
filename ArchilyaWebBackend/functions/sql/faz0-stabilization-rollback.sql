-- FAZ 0 Backend Stabilization — ROLLBACK
-- ⚠️  UYARI: Bu script VERI KAYBINA neden olur.
-- ⚠️  Production'da calistirmadan once tum veriyi yedekleyin.
-- ⚠️  Sadece bilincli bir geri donus karari ile kullanin.
--
-- Rollback sirasi:
--   1. Index'leri temizle
--   2. Tablolari sil
--   3. Fonksiyonlari temizle
--   4. Kolonlari kaldir

BEGIN;

-- ============================================================
-- 1. AI Studio Job Events — Index'leri temizle
-- ============================================================
DROP INDEX IF EXISTS idx_ai_studio_job_events_job_id;
DROP INDEX IF EXISTS idx_ai_studio_job_events_user_id;
DROP INDEX IF EXISTS idx_ai_studio_job_events_event_type;
DROP INDEX IF EXISTS idx_ai_studio_job_events_created_at;

-- ============================================================
-- 2. AI Studio Jobs — Index'leri temizle
-- ============================================================
DROP INDEX IF EXISTS idx_ai_studio_jobs_status_locked_at;
DROP INDEX IF EXISTS idx_ai_studio_jobs_status_attempt;

-- ============================================================
-- 3. Rate Limit — Index ve tablolari temizle
-- ============================================================
DROP INDEX IF EXISTS idx_rate_limit_buckets_key;
DROP INDEX IF EXISTS idx_rate_limit_buckets_created_at;
DROP TABLE IF EXISTS rate_limit_buckets;

-- ============================================================
-- 4. AI Studio Job Events — Tabloyu sil
-- ============================================================
DROP TABLE IF EXISTS ai_studio_job_events;

-- ============================================================
-- 5. AI Studio Jobs — dead_letter kolonunu kaldir
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_studio_jobs' AND column_name = 'dead_letter'
  ) THEN
    ALTER TABLE ai_studio_jobs DROP COLUMN dead_letter;
  END IF;
END $$;

-- ============================================================
-- 6. Rate limit cleanup fonksiyonunu temizle
-- ============================================================
DROP FUNCTION IF EXISTS cleanup_old_rate_limit_buckets;

COMMIT;

-- ============================================================
-- Rollback tamamlandi.
-- NOT: ai_studio_jobs tablosunun kendisi silinmez — ana is akisini
-- bozmamak icin tablo korunur. Sadece FAZ 0 ile eklenen kolon ve index'ler
-- kaldirilir.
-- ============================================================