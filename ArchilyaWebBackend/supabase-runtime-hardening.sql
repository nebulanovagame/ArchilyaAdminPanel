-- ============================================================================
-- ARCHILYA SUPABASE RUNTIME HARDENING
-- Apply after supabase-migration.sql before enabling the Express backend.
-- Provides Firestore-compatibility columns still used by migrated clients,
-- idempotent credit ledger RPCs, and AI Studio processing metadata.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------------
-- Compatibility columns for migrated Firebase-shaped project/workspace data.
-- --------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_prompt_history JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS admin_uid UUID,
  ADD COLUMN IF NOT EXISTS admin_email TEXT,
  ADD COLUMN IF NOT EXISTS pool_credits INTEGER,
  ADD COLUMN IF NOT EXISTS pool_storage BIGINT;

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

UPDATE public.workspaces
SET
  admin_uid = COALESCE(admin_uid, admin_id),
  pool_credits = COALESCE(pool_credits, credits),
  pool_storage = COALESCE(pool_storage, max_storage)
WHERE admin_uid IS NULL OR pool_credits IS NULL OR pool_storage IS NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS uid UUID,
  ADD COLUMN IF NOT EXISTS workspace_name TEXT,
  ADD COLUMN IF NOT EXISTS member_uids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS files JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS folders JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS team JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS invites JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS activity_log JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.projects
SET
  uid = COALESCE(uid, owner_id),
  member_uids = CASE
    WHEN member_uids IS NULL OR array_length(member_uids, 1) IS NULL THEN ARRAY[owner_id]
    ELSE member_uids
  END
WHERE uid IS NULL OR member_uids IS NULL OR array_length(member_uids, 1) IS NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS to_uid UUID,
  ADD COLUMN IF NOT EXISTS to_email TEXT,
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS workspace_name TEXT,
  ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.notifications
SET
  to_uid = COALESCE(to_uid, user_id),
  to_email = COALESCE(to_email, email),
  read = COALESCE(read, is_read)
WHERE to_uid IS NULL OR to_email IS NULL OR read IS DISTINCT FROM is_read;

ALTER TABLE public.workspace_invites
  ADD COLUMN IF NOT EXISTS workspace_name TEXT,
  ADD COLUMN IF NOT EXISTS from_uid UUID,
  ADD COLUMN IF NOT EXISTS from_email TEXT,
  ADD COLUMN IF NOT EXISTS from_name TEXT,
  ADD COLUMN IF NOT EXISTS to_uid UUID;

UPDATE public.workspace_invites
SET
  from_uid = COALESCE(from_uid, from_user_id),
  to_uid = COALESCE(to_uid, to_user_id)
WHERE from_uid IS NULL OR to_uid IS NULL;

-- Compatibility table used by migrated Express project handlers.
CREATE TABLE IF NOT EXISTS public.project_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_uid UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_uid)
);

-- --------------------------------------------------------------------------
-- AI Studio runtime fields.
-- --------------------------------------------------------------------------
ALTER TABLE public.ai_studio_jobs
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_error JSONB,
  ADD COLUMN IF NOT EXISTS billing JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_queue
  ON public.ai_studio_jobs(status, created_at)
  WHERE status IN ('pending', 'queued', 'running');

-- --------------------------------------------------------------------------
-- Idempotent credit ledger.
-- --------------------------------------------------------------------------
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_idempotency_key
  ON public.credit_transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.charge_user_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(success BOOLEAN, balance_after INTEGER, transaction_id UUID, already_applied BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.credit_transactions%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_balance_after INTEGER;
  v_tx_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    LOOP
      SELECT * INTO v_existing
      FROM public.credit_transactions
      WHERE idempotency_key = p_idempotency_key
      LIMIT 1;

      IF FOUND THEN
        RETURN QUERY SELECT TRUE, v_existing.balance_after, v_existing.id, TRUE;
        RETURN;
      END IF;

      EXIT;
    END LOOP;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(v_profile.credits, 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient credits' USING ERRCODE = 'P0001';
  END IF;

  v_balance_after := COALESCE(v_profile.credits, 0) - p_amount;

  UPDATE public.profiles
  SET credits = v_balance_after,
      total_spent = COALESCE(total_spent, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  BEGIN
    INSERT INTO public.credit_transactions(
      user_id, amount, type, description, balance_after, metadata, idempotency_key, source
    ) VALUES (
      p_user_id, p_amount, 'credit_deduct', p_description, v_balance_after,
      COALESCE(p_metadata, '{}'::jsonb), p_idempotency_key, 'express'
    )
    RETURNING id INTO v_tx_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.credit_transactions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT TRUE, v_existing.balance_after, v_existing.id, TRUE;
      RETURN;
    END IF;
    RAISE;
  END;

  RETURN QUERY SELECT TRUE, v_balance_after, v_tx_id, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_user_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(success BOOLEAN, balance_after INTEGER, transaction_id UUID, already_applied BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.credit_transactions%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_balance_after INTEGER;
  v_tx_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.credit_transactions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT TRUE, v_existing.balance_after, v_existing.id, TRUE;
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  v_balance_after := COALESCE(v_profile.credits, 0) + p_amount;

  UPDATE public.profiles
  SET credits = v_balance_after,
      total_spent = GREATEST(0, COALESCE(total_spent, 0) - p_amount),
      updated_at = NOW()
  WHERE id = p_user_id;

  BEGIN
    INSERT INTO public.credit_transactions(
      user_id, amount, type, description, balance_after, metadata, idempotency_key, source
    ) VALUES (
      p_user_id, p_amount, 'credit_refund', p_description, v_balance_after,
      COALESCE(p_metadata, '{}'::jsonb), p_idempotency_key, 'express'
    )
    RETURNING id INTO v_tx_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.credit_transactions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT TRUE, v_existing.balance_after, v_existing.id, TRUE;
      RETURN;
    END IF;
    RAISE;
  END;

  RETURN QUERY SELECT TRUE, v_balance_after, v_tx_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.charge_user_credits(UUID, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_user_credits(UUID, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_user_credits(UUID, INTEGER, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_user_credits(UUID, INTEGER, TEXT, TEXT, JSONB) TO service_role;
