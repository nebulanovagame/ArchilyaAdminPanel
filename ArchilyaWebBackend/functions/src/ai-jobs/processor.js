const { HttpsError } = require('../shared/http-callable');
const { supabase, normalizeText } = require('../shared/supabase-helpers');
const { chargeUserCredits, refundUserCredits } = require('../shared/credit-ledger');
const { downloadStoredImage, storeOutputImage } = require('./storage');
const { generateWithFallback, extractImage, extractText } = require('./gemini');

const MAX_ATTEMPTS = Number(process.env.AI_STUDIO_MAX_ATTEMPTS || 3);
const DEFAULT_BATCH_SIZE = Number(process.env.AI_STUDIO_PROCESS_BATCH_SIZE || 2);
const DEFAULT_STALE_LOCK_MINUTES = Number(process.env.AI_STUDIO_STALE_LOCK_MINUTES || 15);
const DEFAULT_RETRY_DELAY_MS = Number(process.env.AI_STUDIO_RETRY_DELAY_MS || 1000);

function nowIso() {
  return new Date().toISOString();
}

function staleBeforeIso(minutes = DEFAULT_STALE_LOCK_MINUTES) {
  return new Date(Date.now() - Math.max(1, Number(minutes) || DEFAULT_STALE_LOCK_MINUTES) * 60 * 1000).toISOString();
}

function logJob(message, context = {}) {
  console.info(`[ai-jobs] ${message}`, context);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function warnJob(message, context = {}) {
  console.warn(`[ai-jobs] ${message}`, context);
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
  logJob('claim started', { jobId });
  const { data: job, error: readError } = await supabase
    .from('ai_studio_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (readError || !job) throw new HttpsError('not-found', readError?.message || 'AI job bulunamadi.');
  if (['completed', 'failed', 'cancelled', 'canceled'].includes(String(job.status))) return { skip: true, job };
  if (Number(job.attempt_count || 0) >= MAX_ATTEMPTS) {
    await supabase.from('ai_studio_jobs').update({
      status: 'failed',
      error_message: 'AI isi maksimum deneme sayisini asti.',
      last_attempt_error: { code: 'resource-exhausted', message: 'AI isi maksimum deneme sayisini asti.' },
      failed_at: nowIso(),
      updated_at: nowIso(),
    }).eq('id', jobId).in('status', ['pending', 'queued', 'running']);
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

  if (updateError || !claimed) return { skip: true, job };
  logJob('claimed job', { jobId, status: claimed.status, attempt: nextAttempt });
  return { skip: false, job: claimed, attempt: nextAttempt };
}

async function chargeJob(job) {
  const metadata = job.metadata && typeof job.metadata === 'object' ? job.metadata : {};
  const billing = job.billing && typeof job.billing === 'object' ? job.billing : metadata.billing || {};
  const amount = Number(job.credit_cost || billing.amount || 0);
  if (!amount) return { charged: false, billing: { ...billing, status: 'not_charged', amount: 0 } };
  if (billing.status === 'charged' || billing.status === 'charged_upstream') return { charged: true, billing };

  logJob('charging credits', { jobId: job.id, toolId: job.tool_id, amount });

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

  const response = await generateWithFallback({ outputType, payload });
  logJob('Gemini call completed', { jobId: job.id, toolId: job.tool_id, outputType });
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
  logJob('processing started', { jobId });
  const claim = await claimJob(jobId);
  if (claim.skip) return { jobId, skipped: true, status: claim.job?.status || null };

  let job = claim.job;
  let billing = job.billing && typeof job.billing === 'object' ? job.billing : {};

  try {
    const charge = await chargeJob(job);
    billing = charge.billing;
    logJob('Gemini call started', { jobId: job.id, toolId: job.tool_id, outputType: job.output_type });
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
    logJob('job completed', { jobId: job.id, toolId: job.tool_id, outputType: result.outputType });
    return { jobId, success: true, model: result.model };
  } catch (error) {
    const normalized = normalizeJobError(error);
    warnJob('job failed during processing', { jobId: job.id, code: normalized.code, attempt: job.attempt_count || claim.attempt || 1 });
    const attempt = Number(job.attempt_count || claim.attempt || 1);
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
        warnJob('retry scheduling skipped due to state conflict', { jobId: job.id, attempt, message: retryError?.message || null });
        return { jobId: job.id, success: false, retry: false, conflict: true, error: normalized };
      }
      logJob('retry scheduled', { jobId: job.id, attempt, maxAttempts: MAX_ATTEMPTS });
      await sleep(DEFAULT_RETRY_DELAY_MS);
      return processAiStudioJob(job.id);
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
      failed_at: nowIso(),
      locked_at: null,
      updated_at: nowIso(),
    }).eq('id', job.id);
    warnJob('job failed permanently', { jobId: job.id, code: normalized.code, attempt });
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
          failed_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq('id', job.id)
        .eq('status', 'running')
        .or(`locked_at.is.null,locked_at.lt.${threshold}`)
        .select('id')
        .single();
      if (!updateError && updated) failed.push(updated.id);
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
    if (!updateError && updated) recovered.push(updated.id);
  }
  if (recovered.length) logJob('recovered stale jobs', { count: recovered.length, staleMinutes });
  if (failed.length) warnJob('failed stale max-attempt jobs', { count: failed.length, staleMinutes });
  return { recovered: recovered.length, failed: failed.length, jobIds: recovered, failedJobIds: failed };
}

async function processQueuedAiStudioJobs({ limit = DEFAULT_BATCH_SIZE } = {}) {
  const batchLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_BATCH_SIZE, 10));
  logJob('worker scan started', { limit: batchLimit });
  await recoverStaleAiStudioJobs({ limit: batchLimit });
  const { data: jobs, error } = await supabase
    .from('ai_studio_jobs')
    .select('id')
    .in('status', ['pending', 'queued'])
    .order('created_at', { ascending: true })
    .limit(batchLimit);
  if (error) throw new HttpsError('internal', error.message);

  logJob('worker found jobs', { count: (jobs || []).length });
  const results = [];
  for (const job of jobs || []) {
    results.push(await processAiStudioJob(job.id));
  }
  return { processed: results.length, results };
}

module.exports = { processAiStudioJob, processQueuedAiStudioJobs, recoverStaleAiStudioJobs };
