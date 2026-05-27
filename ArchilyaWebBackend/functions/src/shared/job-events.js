/**
 * Archilya AI Studio — Job Lifecycle Event Logger
 *
 * Job'larin tum lifecycle eventlerini ai_studio_job_events tablosuna yazar.
 * Hata olsa bile ana akisi bozmaz; hata durumunda console ile loglar.
 *
 * FAZ 0: Event logging hatalari Sentry'e de gonderilir.
 */

const Sentry = require('@sentry/node');
const { supabase } = require('./supabase-helpers');

const EVENT_TYPES = {
  QUEUED: 'queued',
  CLAIMED: 'claimed',
  CHARGE_STARTED: 'charge_started',
  CHARGED: 'charged',
  STARTED: 'started',
  PROVIDER_CALL_STARTED: 'provider_call_started',
  PROVIDER_CALL_FAILED: 'provider_call_failed',
  RETRY_SCHEDULED: 'retry_scheduled',
  COMPLETED: 'completed',
  FAILED: 'failed',
  STALE_RECOVERED: 'stale_recovered',
  DEAD_LETTERED: 'dead_lettered',
  MANUAL_RETRY: 'manual_retry',
};

function nowIso() {
  return new Date().toISOString();
}

async function recordJobEvent({
  jobId,
  userId,
  toolId,
  eventType,
  previousStatus = null,
  newStatus = null,
  reason = null,
  metadata = {},
  attempt = null,
  provider = null,
}) {
  if (!jobId || !eventType) {
    console.warn('[job-events] Invalid event: jobId and eventType required', { jobId, eventType });
    return null;
  }

  const payload = {
    job_id: jobId,
    user_id: userId || null,
    tool_id: toolId || null,
    event_type: eventType,
    previous_status: previousStatus,
    new_status: newStatus,
    reason: reason ? String(reason).slice(0, 500) : null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    attempt: Number.isFinite(attempt) ? attempt : null,
    provider: provider ? String(provider).slice(0, 120) : null,
    created_at: nowIso(),
  };

  try {
    const { error } = await supabase.from('ai_studio_job_events').insert(payload);
    if (error) {
      console.warn('[job-events] Insert failed', { jobId, eventType, error: error.message });
      try { Sentry.captureMessage('[job-events] Insert failed', { level: 'warning', extra: { jobId, eventType, error: error.message } }); } catch (_) {}
    }
    return payload;
  } catch (err) {
    const errMsg = err?.message || 'unknown';
    console.warn('[job-events] Exception', { jobId, eventType, error: errMsg });
    try { Sentry.captureMessage('[job-events] Exception', { level: 'warning', extra: { jobId, eventType, error: errMsg } }); } catch (_) {}
    return null;
  }
}

module.exports = {
  EVENT_TYPES,
  recordJobEvent,
};
