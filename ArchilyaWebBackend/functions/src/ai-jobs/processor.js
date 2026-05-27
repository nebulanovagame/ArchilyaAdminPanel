const Sentry = require('@sentry/node');
const { HttpsError } = require('../shared/http-callable');
const { supabase, normalizeText } = require('../shared/supabase-helpers');
const { chargeUserCredits, refundUserCredits } = require('../shared/credit-ledger');
const { EVENT_TYPES, recordJobEvent } = require('../shared/job-events');
const { downloadStoredImage, storeOutputImage } = require('./storage');
const { generateWithFallback, extractImage, extractText } = require('./gemini');

// Retry Architecture (FAZ 0):
// - Provider retry (gemini.js): MAX 2 attempts per model, only for transient network errors
// - Processor retry: MAX 3 attempts total per job, controlled by MAX_ATTEMPTS
// - Cloud Tasks retry: NOT USED in this code path (this is the new Supabase path)
// WORST CASE: 3 processor attempts × 2 gemini attempts = 6 total API calls max
const MAX_ATTEMPTS = Number(process.env.AI_STUDIO_MAX_ATTEMPTS || 3);
const MAX_PROVIDER_RETRIES = Number(process.env.AI_STUDIO_MAX_PROVIDER_RETRIES || 2);
const DEFAULT_BATCH_SIZE = Number(process.env.AI_STUDIO_PROCESS_BATCH_SIZE || 2);
const DEFAULT_STALE_LOCK_MINUTES = Number(process.env.AI_STUDIO_STALE_LOCK_MINUTES || 15);
const DEFAULT_RETRY_DELAY_MS = Number(process.env.AI_STUDIO_RETRY_DELAY_MS || 2000);
const DEAD_LETTER_AFTER_MINUTES = Number(process.env.AI_STUDIO_DEAD_LETTER_AFTER_MINUTES || 60);

function nowIso() {
  return new Date().toISOString();
}

function staleBeforeIso(minutes = DEFAULT_STALE_LOCK_MINUTES) {
  return new Date(Date.now() - Math.max(1, Number(minutes) || DEFAULT_STALE_LOCK_MINUTES) * 60 * 1000).toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function setJobSentryTags(context = {}) {
  try {
    Sentry.setTags({
      jobId: context.jobId || null,
      userId: context.userId || null,
      toolId: context.toolId || null,
      provider: context.provider || 'gemini',
      attempt: context.attempt || null,
      maxAttempts: MAX_ATTEMPTS,
      function: 'processAiStudioJob',
      aiJobSystem: 'supabase-express-worker',
    });
    if (context.jobId) {
      Sentry.setContext('ai-job', {
        jobId: context.jobId,
        userId: context.userId || null,
        toolId: context.toolId || null,
        attempt: context.attempt || null,
        provider: context.provider || 'gemini',
      });
    }
  } catch (_err) {
    // Sentry not initialized — non-blocking
  }
}

function logStructured(level, message, context = {}) {
  const safeContext = { ...context };
  // Sentry tag'leri de log context'e ekle
  if (safeContext.jobId) setJobSentryTags(safeContext);
  const entry = {
    ts: nowIso(),
    level,
    service: 'ai-jobs',
    msg: message,
    ...safeContext,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
    try { Sentry.captureMessage(message, { level: 'error', extra: safeContext }); } catch (_) {}
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
    try { Sentry.captureMessage(message, { level: 'warning', extra: safeContext }); } catch (_) {}
  } else {
    console.info(JSON.stringify(entry));
  }
}

function normalizeJobError(error) {
  return {
    code: normalizeText(error?.code || 'internal', 80) || 'internal',
    message: normalizeText(error?.message || 'AI islemi tamamlanamadi.', 2000) || 'AI islemi tamamlanamadi.',
    details: error?.details || null,
  };
}

function buildPrompt(job) {
  const metadata = job.metadata && typeof job.metadata === 'object' ? job.metadata : {};
  const parts = [
    'You are Archilya AI Studio, a premium architecture visualization assistant.',
    `Tool: ${job.tool_id || metadata.toolId || 'unknown'}`,
    metadata.style ? `Style: ${metadata.style}` : '',
    metadata.sceneEditMode ? `Scene edit mode: ${metadata.sceneEditMode}` : '',
    job.prompt ? `User request: ${job.prompt}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}

async function claimJob(jobId) {
  logStructured('info', 'claim started', { jobId });
  const { data: job, error: readError } = await supabase
    .from('ai_studio_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (readError || !job) throw new HttpsError('not-found', readError?.message || 'AI job bulunamadi.');
  if (['completed', 'failed', 'cancelled', 'canceled'].includes(String(job.status))) {
    await recordJobEvent({
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      eventType: EVENT_TYPES.FAILED,
      previousStatus: job.status,
      newStatus: job.status,
      reason: 'already-terminal',
      attempt: Number(job.attempt_count || 0),
    });
    logStructured('warn', 'claim skipped terminal job', {
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      attempt: Number(job.attempt_count || 0),
      status: job.status,
      reason: 'already-terminal',
    });
    return { skip: true, job };
  }
  if (Number(job.attempt_count || 0) >= MAX_ATTEMPTS) {
    const finalError = { code: 'resource-exhausted', message: 'AI isi maksimum deneme sayisini asti.' };
    await supabase.from('ai_studio_jobs').update({
      status: 'failed',
      error_message: finalError.message,
      last_attempt_error: finalError,
      dead_letter: {
        final_error: finalError,
        attempts: job.attempt_count || 0,
        provider: 'gemini',
        last_failed_at: nowIso(),
        can_manual_retry: false,
        reason: 'max-attempts-before-claim',
        dead_letter_after_minutes: DEAD_LETTER_AFTER_MINUTES,
      },
      failed_at: nowIso(),
      updated_at: nowIso(),
    }).eq('id', jobId).in('status', ['pending', 'queued', 'running']);
    await recordJobEvent({
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      eventType: EVENT_TYPES.DEAD_LETTERED,
      previousStatus: job.status,
      newStatus: 'failed',
      reason: 'max-attempts-before-claim',
      metadata: { finalError, maxAttempts: MAX_ATTEMPTS },
      attempt: Number(job.attempt_count || 0),
      provider: 'gemini',
    });
    logStructured('warn', 'claim dead-lettered max-attempt job', {
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      attempt: Number(job.attempt_count || 0),
      maxAttempts: MAX_ATTEMPTS,
    });
    return { skip: true, job: { ...job, status: 'failed' } };
  }

  const nextAttempt = Number(job.attempt_count || 0) + 1;
  const { data: claimed, error: updateError } = await supabase
    .from('ai_studio_jobs')
    .update({
      status: 'running',
      attempt_count: nextAttempt,
      started_at: job.started_at || nowIso(),
      locked_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq('id', jobId)
    .in('status', ['pending', 'queued'])
    .select('*')
    .single();

  if (updateError || !claimed) {
    logStructured('warn', 'claim skipped due to state conflict', {
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      attempt: nextAttempt,
      status: job.status,
      message: updateError?.message || null,
    });
    return { skip: true, job };
  }
  await recordJobEvent({
    jobId: claimed.id,
    userId: claimed.user_id,
    toolId: claimed.tool_id,
    eventType: EVENT_TYPES.CLAIMED,
    previousStatus: job.status,
    newStatus: claimed.status,
    reason: 'worker-claimed',
    attempt: nextAttempt,
  });
  logStructured('info', 'claimed job', {
    jobId: claimed.id,
    userId: claimed.user_id,
    toolId: claimed.tool_id,
    status: claimed.status,
    attempt: nextAttempt,
  });
  return { skip: false, job: claimed, attempt: nextAttempt };
}

async function chargeJob(job) {
  const metadata = job.metadata && typeof job.metadata === 'object' ? job.metadata : {};
  const billing = job.billing && typeof job.billing === 'object' ? job.billing : metadata.billing || {};
  const amount = Number(job.credit_cost || billing.amount || 0);
  if (!amount) return { charged: false, billing: { ...billing, status: 'not_charged', amount: 0 } };
  await recordJobEvent({
    jobId: job.id,
    userId: job.user_id,
    toolId: job.tool_id,
    eventType: EVENT_TYPES.CHARGE_STARTED,
    previousStatus: job.status,
    newStatus: job.status,
    reason: 'credit-charge-started',
    metadata: { amount },
    attempt: Number(job.attempt_count || 0),
  });
  logStructured('info', 'charge started', {
    jobId: job.id,
    userId: job.user_id,
    toolId: job.tool_id,
    attempt: Number(job.attempt_count || 0),
    amount,
  });

  // Duplicate charge protection: billing status short-circuits already-charged jobs,
  // and the ledger RPC receives the stable ai-studio:${job.id}:charge idempotency key below.
  if (billing.status === 'charged' || billing.status === 'charged_upstream') {
    await recordJobEvent({
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      eventType: EVENT_TYPES.CHARGED,
      previousStatus: job.status,
      newStatus: job.status,
      reason: 'credit-charge-already-completed',
      metadata: { amount, billingStatus: billing.status },
      attempt: Number(job.attempt_count || 0),
    });
    return { charged: true, billing };
  }

  logStructured('info', 'charging credits', {
    jobId: job.id,
    userId: job.user_id,
    toolId: job.tool_id,
    attempt: Number(job.attempt_count || 0),
    amount,
  });

  const result = await chargeUserCredits({
    userId: job.user_id,
    amount,
    description: `AI Studio: ${job.tool_id || 'unknown'}`,
    idempotencyKey: `ai-studio:${job.id}:charge`,
    metadata: { jobId: job.id, toolId: job.tool_id },
  });

  const nextBilling = {
    ...billing,
    amount,
    status: 'charged',
    chargeSource: 'personal',
    chargedAt: nowIso(),
    balanceAfter: result.balance_after,
    transactionId: result.transaction_id,
  };

  await supabase.from('ai_studio_jobs').update({ billing: nextBilling, updated_at: nowIso() }).eq('id', job.id);
  await recordJobEvent({
    jobId: job.id,
    userId: job.user_id,
    toolId: job.tool_id,
    eventType: EVENT_TYPES.CHARGED,
    previousStatus: job.status,
    newStatus: job.status,
    reason: 'credit-charge-completed',
    metadata: { amount, transactionId: result.transaction_id, balanceAfter: result.balance_after },
    attempt: Number(job.attempt_count || 0),
  });
  logStructured('info', 'charge completed', {
    jobId: job.id,
    userId: job.user_id,
    toolId: job.tool_id,
    attempt: Number(job.attempt_count || 0),
    amount,
    transactionId: result.transaction_id,
  });
  return { charged: true, billing: nextBilling };
}

async function refundJob(job, billing, reason) {
  const amount = Number(billing?.amount || job.credit_cost || 0);
  if (!amount || billing?.status === 'refunded' || billing?.status === 'not_charged' || billing?.status === 'charged_upstream') return billing;
  const result = await refundUserCredits({
    userId: job.user_id,
    amount,
    description: `AI Studio iadesi: ${job.tool_id || 'unknown'}`,
    idempotencyKey: `ai-studio:${job.id}:refund`,
    metadata: { jobId: job.id, toolId: job.tool_id, reason: reason || 'failed' },
  });
  return {
    ...billing,
    status: 'refunded',
    refundedAt: nowIso(),
    refundBalanceAfter: result.balance_after,
    refundTransactionId: result.transaction_id,
    refundError: null,
  };
}

async function executeJob(job) {
  const metadata = job.metadata && typeof job.metadata === 'object' ? job.metadata : {};
  const input = metadata.input || {};
  const primaryImage = await downloadStoredImage(input.primaryImage);
  const referenceImages = [];
  for (const reference of Array.isArray(input.referenceImages) ? input.referenceImages : []) {
    const stored = reference?.image || reference;
    if (!stored?.path) continue;
    referenceImages.push({ reference, imagePart: await downloadStoredImage(stored) });
  }
  const prompt = buildPrompt(job);
  const outputType = job.output_type === 'text' ? 'text' : 'image';
  const referenceParts = referenceImages.flatMap((item, index) => [
    { text: `REFERENCE_IMAGE_${index + 1}: ${normalizeText(item.reference?.type || 'reference', 80)} ${normalizeText(item.reference?.note || '', 400)}`.trim() },
    item.imagePart,
  ]);
  const payload = {
    contents: [{ role: 'user', parts: [primaryImage, ...referenceParts, { text: prompt }] }],
  };
  if (outputType === 'image') payload.generationConfig = { responseModalities: ['IMAGE', 'TEXT'] };

  const response = await generateWithFallback({ outputType, payload, maxProviderRetries: MAX_PROVIDER_RETRIES });
  logStructured('info', 'Gemini call completed', {
    jobId: job.id,
    userId: job.user_id,
    toolId: job.tool_id,
    attempt: Number(job.attempt_count || 0),
    outputType,
    model: response.model,
    maxProviderRetries: MAX_PROVIDER_RETRIES,
  });
  if (outputType === 'text') {
    return { outputType, model: response.model, resultText: extractText(response.data), resultUrl: null };
  }

  const outputImage = await storeOutputImage({
    uid: job.user_id,
    jobId: job.id,
    toolId: job.tool_id,
    inlineData: extractImage(response.data),
  });
  return { outputType, model: response.model, resultText: null, resultUrl: outputImage.url, outputImage };
}

async function processAiStudioJob(jobId) {
  await recordJobEvent({
    jobId,
    eventType: EVENT_TYPES.STARTED,
    reason: 'processor-started',
  });
  logStructured('info', 'processing started', { jobId, maxAttempts: MAX_ATTEMPTS, maxProviderRetries: MAX_PROVIDER_RETRIES });
  const claim = await claimJob(jobId);
  if (claim.skip) return { jobId, skipped: true, status: claim.job?.status || null };

  let job = claim.job;
  let billing = job.billing && typeof job.billing === 'object' ? job.billing : {};
  let providerStarted = false;

  try {
    const charge = await chargeJob(job);
    billing = charge.billing;
    await recordJobEvent({
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      eventType: EVENT_TYPES.PROVIDER_CALL_STARTED,
      previousStatus: 'running',
      newStatus: 'running',
      reason: 'gemini-call-started',
      attempt: Number(job.attempt_count || claim.attempt || 1),
      provider: 'gemini',
      metadata: { outputType: job.output_type, maxProviderRetries: MAX_PROVIDER_RETRIES },
    });
    logStructured('info', 'Gemini call started', {
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      attempt: Number(job.attempt_count || claim.attempt || 1),
      outputType: job.output_type,
      provider: 'gemini',
      maxProviderRetries: MAX_PROVIDER_RETRIES,
    });
    providerStarted = true;
    const result = await executeJob({ ...job, billing });
    const nextMetadata = { ...(job.metadata || {}), result: { model: result.model, outputImage: result.outputImage || null } };
    await supabase.from('ai_studio_jobs').update({
      status: 'completed',
      result_url: result.resultUrl,
      result_text: result.resultText,
      metadata: nextMetadata,
      billing,
      error_message: null,
      last_attempt_error: null,
      completed_at: nowIso(),
      updated_at: nowIso(),
      locked_at: null,
    }).eq('id', job.id);
    await recordJobEvent({
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      eventType: EVENT_TYPES.COMPLETED,
      previousStatus: 'running',
      newStatus: 'completed',
      reason: 'job-completed',
      metadata: { outputType: result.outputType, model: result.model },
      attempt: Number(job.attempt_count || claim.attempt || 1),
      provider: 'gemini',
    });
    logStructured('info', 'job completed', {
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      attempt: Number(job.attempt_count || claim.attempt || 1),
      outputType: result.outputType,
      model: result.model,
    });
    return { jobId, success: true, model: result.model };
  } catch (error) {
    const normalized = normalizeJobError(error);
    const attempt = Number(job.attempt_count || claim.attempt || 1);
    if (providerStarted) {
      await recordJobEvent({
        jobId: job.id,
        userId: job.user_id,
        toolId: job.tool_id,
        eventType: EVENT_TYPES.PROVIDER_CALL_FAILED,
        previousStatus: 'running',
        newStatus: 'running',
        reason: normalized.message,
        metadata: { error: normalized },
        attempt,
        provider: 'gemini',
      });
    }
    logStructured('warn', 'job failed during processing', {
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      attempt,
      code: normalized.code,
      message: normalized.message,
      provider: 'gemini',
    });
    const shouldRetry = ['internal', 'unavailable', 'resource-exhausted'].includes(normalized.code) && attempt < MAX_ATTEMPTS;
    if (shouldRetry) {
      const { data: retryRow, error: retryError } = await supabase.from('ai_studio_jobs').update({
        status: 'queued',
        last_attempt_error: normalized,
        error_message: normalized.message,
        locked_at: null,
        updated_at: nowIso(),
      }).eq('id', job.id)
        .eq('status', 'running')
        .eq('attempt_count', attempt)
        .select('id')
        .single();
      if (retryError || !retryRow) {
        logStructured('warn', 'retry scheduling skipped due to state conflict', {
          jobId: job.id,
          userId: job.user_id,
          toolId: job.tool_id,
          attempt,
          message: retryError?.message || null,
        });
        return { jobId: job.id, success: false, retry: false, conflict: true, error: normalized };
      }
      await recordJobEvent({
        jobId: job.id,
        userId: job.user_id,
        toolId: job.tool_id,
        eventType: EVENT_TYPES.RETRY_SCHEDULED,
        previousStatus: 'running',
        newStatus: 'queued',
        reason: `Attempt ${attempt} failed with ${normalized.code}, retrying`,
        metadata: { error: normalized, maxAttempts: MAX_ATTEMPTS },
        attempt,
        provider: 'gemini',
      });
      logStructured('info', 'retry scheduled', {
        jobId: job.id,
        userId: job.user_id,
        toolId: job.tool_id,
        attempt,
        code: normalized.code,
        maxAttempts: MAX_ATTEMPTS,
      });
      await sleep(DEFAULT_RETRY_DELAY_MS);
      return { jobId: job.id, success: false, retry: true, attempt };
    }

    let nextBilling = billing;
    try {
      nextBilling = await refundJob(job, billing, normalized.message);
    } catch (refundError) {
      nextBilling = { ...billing, refundError: normalizeJobError(refundError) };
    }

    await supabase.from('ai_studio_jobs').update({
      status: 'failed',
      billing: nextBilling,
      error_message: normalized.message,
      last_attempt_error: normalized,
      dead_letter: {
        final_error: normalized,
        attempts: attempt,
        provider: 'gemini',
        last_failed_at: nowIso(),
        can_manual_retry: false,
        reason: attempt >= MAX_ATTEMPTS ? 'max-attempts-exhausted' : 'non-retryable-error',
        dead_letter_after_minutes: DEAD_LETTER_AFTER_MINUTES,
      },
      failed_at: nowIso(),
      locked_at: null,
      updated_at: nowIso(),
    }).eq('id', job.id);
    await recordJobEvent({
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      eventType: EVENT_TYPES.DEAD_LETTERED,
      previousStatus: 'running',
      newStatus: 'failed',
      reason: attempt >= MAX_ATTEMPTS ? 'max-attempts-exhausted' : 'non-retryable-error',
      metadata: { finalError: normalized, maxAttempts: MAX_ATTEMPTS },
      attempt,
      provider: 'gemini',
    });
    await recordJobEvent({
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      eventType: EVENT_TYPES.FAILED,
      previousStatus: 'running',
      newStatus: 'failed',
      reason: normalized.message,
      metadata: { error: normalized },
      attempt,
      provider: 'gemini',
    });
    logStructured('warn', 'job failed permanently', {
      jobId: job.id,
      userId: job.user_id,
      toolId: job.tool_id,
      attempt,
      code: normalized.code,
      message: normalized.message,
    });
    return { jobId, success: false, retry: false, error: normalized };
  }
}

async function recoverStaleAiStudioJobs({ staleMinutes = DEFAULT_STALE_LOCK_MINUTES, limit = DEFAULT_BATCH_SIZE } = {}) {
  const threshold = staleBeforeIso(staleMinutes);
  const maxRows = Math.max(1, Math.min(Number(limit) || DEFAULT_BATCH_SIZE, 10));
  const { data: jobs, error } = await supabase
    .from('ai_studio_jobs')
    .select('id, user_id, attempt_count, tool_id, output_type, credit_cost, billing')
    .eq('status', 'running')
    .or(`locked_at.is.null,locked_at.lt.${threshold}`)
    .order('locked_at', { ascending: true })
    .limit(maxRows);
  if (error) throw new HttpsError('internal', error.message);

  const recovered = [];
  const failed = [];
  for (const job of jobs || []) {
    const staleError = {
      code: 'stale-lock',
      message: `AI isi ${staleMinutes} dakikadan uzun suredir kilitli kaldigi icin tekrar kuyruğa alindi.`,
    };

    if (Number(job.attempt_count || 0) >= MAX_ATTEMPTS) {
      let nextBilling = job.billing && typeof job.billing === 'object' ? job.billing : {};
      try {
        nextBilling = await refundJob(job, nextBilling, 'stale-lock-max-attempts');
      } catch (refundError) {
        nextBilling = { ...nextBilling, refundError: normalizeJobError(refundError) };
      }
      const finalError = {
        code: 'stale-lock-max-attempts',
        message: 'AI isi maksimum deneme sayisina ulastiktan sonra kilitli kaldigi icin basarisiz olarak isaretlendi.',
      };
      const { data: updated, error: updateError } = await supabase
        .from('ai_studio_jobs')
        .update({
          status: 'failed',
          billing: nextBilling,
          locked_at: null,
          last_attempt_error: finalError,
          error_message: finalError.message,
          dead_letter: {
            final_error: finalError,
            attempts: job.attempt_count || 0,
            provider: 'gemini',
            last_failed_at: nowIso(),
            can_manual_retry: false,
            reason: 'stale-lock-max-attempts',
          },
          failed_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq('id', job.id)
        .eq('status', 'running')
        .or(`locked_at.is.null,locked_at.lt.${threshold}`)
        .select('id')
        .single();
      if (!updateError && updated) {
        await recordJobEvent({
          jobId: job.id,
          userId: job.user_id,
          toolId: job.tool_id,
          eventType: EVENT_TYPES.DEAD_LETTERED,
          previousStatus: 'running',
          newStatus: 'failed',
          reason: 'stale-lock-max-attempts',
          metadata: { finalError, staleMinutes, maxAttempts: MAX_ATTEMPTS },
          attempt: Number(job.attempt_count || 0),
          provider: 'gemini',
        });
        failed.push(updated.id);
      }
      continue;
    }

    const { data: updated, error: updateError } = await supabase
      .from('ai_studio_jobs')
      .update({
        status: 'queued',
        locked_at: null,
        last_attempt_error: staleError,
        error_message: staleError.message,
        updated_at: nowIso(),
      })
      .eq('id', job.id)
      .eq('status', 'running')
      .or(`locked_at.is.null,locked_at.lt.${threshold}`)
      .select('id')
      .single();
    if (!updateError && updated) {
      await recordJobEvent({
        jobId: job.id,
        userId: job.user_id,
        toolId: job.tool_id,
        eventType: EVENT_TYPES.STALE_RECOVERED,
        previousStatus: 'running',
        newStatus: 'queued',
        reason: 'stale-lock-recovered',
        metadata: { staleError, staleMinutes },
        attempt: Number(job.attempt_count || 0),
        provider: 'gemini',
      });
      recovered.push(updated.id);
    }
  }
  if (recovered.length) logStructured('info', 'recovered stale jobs', { count: recovered.length, staleMinutes });
  if (failed.length) logStructured('warn', 'failed stale max-attempt jobs', { count: failed.length, staleMinutes });
  return { recovered: recovered.length, failed: failed.length, jobIds: recovered, failedJobIds: failed };
}

async function processQueuedAiStudioJobs({ limit = DEFAULT_BATCH_SIZE } = {}) {
  const batchLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_BATCH_SIZE, 10));
  logStructured('info', 'worker scan started', {
    limit: batchLimit,
    maxAttempts: MAX_ATTEMPTS,
    maxProviderRetries: MAX_PROVIDER_RETRIES,
  });
  await recoverStaleAiStudioJobs({ limit: batchLimit });
  const { data: jobs, error } = await supabase
    .from('ai_studio_jobs')
    .select('id')
    .in('status', ['pending', 'queued'])
    .order('created_at', { ascending: true })
    .limit(batchLimit);
  if (error) throw new HttpsError('internal', error.message);

  logStructured('info', 'worker found jobs', { count: (jobs || []).length });
  const results = [];
  for (const job of jobs || []) {
    results.push(await processAiStudioJob(job.id));
  }
  return { processed: results.length, results };
}

module.exports = { processAiStudioJob, processQueuedAiStudioJobs, recoverStaleAiStudioJobs };
