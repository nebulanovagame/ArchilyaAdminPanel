const crypto = require('crypto');
const { onCall, HttpsError } = require('../shared/http-callable');
const {
  supabase,
  requireAuth,
  normalizeText,
  normalizeEmail,
  ensureUserProfileDoc,
} = require('../shared/supabase-helpers');
const { storeInputImage } = require('./storage');
const { processAiStudioJob } = require('./processor');
const { TOOL_COSTS, getToolCost } = require('../config/tool-pricing');
const { checkRateLimit } = require('../shared/rate-limiter');

function nowIso() {
  return new Date().toISOString();
}

function initialBillingStatus() {
  return process.env.AI_STUDIO_BILLING_MODE === 'upstream' ? 'charged_upstream' : 'not_charged';
}

function randomId() {
  return crypto.randomUUID();
}

function outputTypeForTool(toolId) {
  return toolId === 'analysis' ? 'text' : 'image';
}

function normalizeReferenceImages(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((reference) => ({
    type: normalizeText(reference?.type, 80),
    label: normalizeText(reference?.label, 160),
    note: normalizeText(reference?.note, 800),
    mimeType: normalizeText(reference?.imagePart?.inlineData?.mimeType, 120),
    hasImageData: Boolean(reference?.imagePart?.inlineData?.data),
  }));
}

function normalizeImagePart(imagePart) {
  if (!imagePart?.inlineData?.data) return null;
  return {
    mimeType: normalizeText(imagePart.inlineData.mimeType, 120) || 'application/octet-stream',
    byteLength: Buffer.byteLength(String(imagePart.inlineData.data), 'base64'),
  };
}

function normalizeJobPayload(data) {
  const toolId = normalizeText(data?.toolId, 80).toLowerCase();
  if (!toolId) throw new HttpsError('invalid-argument', 'toolId zorunludur.');
  if (!TOOL_COSTS[toolId]) {
    throw new HttpsError('invalid-argument', `Bilinmeyen AI araci: ${toolId}`);
  }

  const image = normalizeImagePart(data?.imagePart);
  const references = normalizeReferenceImages(data?.referenceImages);
  return {
    toolId,
    toolLabel: toolId,
    outputType: outputTypeForTool(toolId),
    style: normalizeText(data?.style, 120),
    sceneEditMode: normalizeText(data?.sceneEditMode, 80),
    extraNote: normalizeText(data?.extraNote, 5000),
    generationVariant: normalizeText(data?.generationVariant, 80) || 'default',
    imageUrls: Array.isArray(data?.imageUrls) ? data.imageUrls.map((url) => normalizeText(url, 4000)).filter(Boolean) : [],
    primaryImage: image,
    imagePart: data?.imagePart || null,
    rawReferenceImages: Array.isArray(data?.referenceImages) ? data.referenceImages.slice(0, 4) : [],
    referenceImages: references,
    creditCost: getToolCost(toolId),
  };
}

async function readUser(uid) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error || !data) throw new HttpsError('not-found', 'Kullanici bulunamadi.');
  return data;
}

exports.createAiStudioJobSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const payloadSize = JSON.stringify(request.data || {}).length;
  if (payloadSize > 25 * 1024 * 1024) {
    throw new HttpsError('invalid-argument', 'Istek boyutu cok buyuk.');
  }
  const ip = String(request.rawRequest?.headers?.['x-forwarded-for'] || request.rawRequest?.ip || 'unknown').split(',')[0].trim();
  const rateLimit = await checkRateLimit({
    prefix: 'ai-studio:create',
    identifier: `${uid}:${ip}`,
    windowMs: 60 * 1000,
    maxRequests: 10, // 10 job creation per minute per user
  });
  if (!rateLimit.allowed) {
    throw new HttpsError('resource-exhausted', 'Cok fazla AI islem baslattiniz. Lutfen bir dakika bekleyin.');
  }
  const email = normalizeEmail(request.auth?.token?.email || '');
  const displayName = normalizeText(request.auth?.token?.name || email, 120) || email || uid;
  const payload = normalizeJobPayload(request.data || {});
  await ensureUserProfileDoc(uid, { email, displayName });

  const jobId = randomId();
  const timestamp = nowIso();
  const storedPrimaryImage = await storeInputImage({
    uid,
    jobId,
    imagePart: payload.imagePart,
    label: 'primary',
  });
  const storedReferenceImages = [];
  for (let index = 0; index < payload.rawReferenceImages.length; index += 1) {
    const reference = payload.rawReferenceImages[index];
    if (!reference?.imagePart?.inlineData?.data) continue;
    storedReferenceImages.push({
      type: normalizeText(reference.type, 80),
      label: normalizeText(reference.label, 160),
      note: normalizeText(reference.note, 800),
      image: await storeInputImage({ uid, jobId, imagePart: reference.imagePart, label: `reference-${index}` }),
    });
  }
  const metadata = {
    uid,
    email,
    toolLabel: payload.toolLabel,
    style: payload.style,
    sceneEditMode: payload.sceneEditMode,
    extraNote: payload.extraNote,
    generationVariant: payload.generationVariant,
    imageUrls: payload.imageUrls,
    primaryImage: payload.primaryImage,
    referenceImages: payload.referenceImages,
    input: {
      primaryImage: storedPrimaryImage,
      referenceImages: storedReferenceImages,
    },
    referenceCount: payload.referenceImages.length,
    progressMessage: 'AI isi Supabase kuyruğuna alindi.',
    billing: {
      amount: payload.creditCost,
      toolId: payload.toolId,
      status: initialBillingStatus(),
      userId: uid,
    },
  };

  const { error } = await supabase.from('ai_studio_jobs').insert({
    id: jobId,
    user_id: uid,
    status: 'queued',
    prompt: payload.extraNote,
    tool_id: payload.toolId,
    output_type: payload.outputType,
    credit_cost: payload.creditCost,
    metadata,
    billing: metadata.billing,
    queued_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  });

  if (error) throw new HttpsError('internal', error.message);

  console.info(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'info',
    service: 'ai-jobs',
    msg: 'job created',
    jobId,
    toolId: payload.toolId,
    userId: uid,
    creditCost: payload.creditCost,
  }));

  // Fire background processing without awaiting — UI tracks status via Realtime
  console.info('[ai-jobs] background trigger scheduled', { jobId });
  setTimeout(() => {
    processAiStudioJob(jobId).catch((processErr) => {
      console.error(`[ai-jobs] Background processing failed for job ${jobId}:`, processErr.message);
    });
  }, 100);

  return { success: true, jobId };
});

exports.runAiStudioFluxTool = onCall({ region: 'europe-west1' }, async (request) => {
  return exports.createAiStudioJobSecure(request);
});

exports.getAiPromptHistorySecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const user = await readUser(uid);
  const history = user.ai_prompt_history && typeof user.ai_prompt_history === 'object'
    ? user.ai_prompt_history
    : {};
  return { success: true, history };
});

exports.saveAiPromptHistorySecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const toolId = normalizeText(request.data?.toolId, 128);
  const entry = request.data?.entry;
  if (!toolId || !entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new HttpsError('invalid-argument', 'toolId ve entry zorunludur.');
  }

  const user = await readUser(uid);
  const history = user.ai_prompt_history && typeof user.ai_prompt_history === 'object'
    ? user.ai_prompt_history
    : {};
  const toolHistory = Array.isArray(history[toolId]) ? history[toolId] : [];
  history[toolId] = [{ ...entry, savedAt: nowIso() }, ...toolHistory].slice(0, 20);

  const { error } = await supabase
    .from('profiles')
    .update({ ai_prompt_history: history, updated_at: nowIso() })
    .eq('id', uid);
  if (error) throw new HttpsError('internal', error.message);

  return { success: true, history };
});

exports.updateAiJobFeedbackSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const jobId = normalizeText(request.data?.jobId || request.data?.id || '', 200);
  const feedback = request.data?.feedback;
  if (!jobId) throw new HttpsError('invalid-argument', 'jobId zorunludur.');
  if (feedback !== 'positive' && feedback !== 'negative') throw new HttpsError('invalid-argument', 'feedback positive veya negative olmalidir.');

  const { error } = await supabase
    .from('ai_studio_jobs')
    .update({ feedback, updated_at: nowIso() })
    .eq('id', jobId)
    .eq('user_id', uid);

  if (error) throw new HttpsError('internal', error.message);
  return { success: true };
});

exports.logAiHistoryEntrySecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const payload = request.data?.payload && typeof request.data.payload === 'object'
    ? request.data.payload
    : request.data || {};
  const prompt = normalizeText(payload.prompt || payload.text || '', 5000);
  if (!prompt) throw new HttpsError('invalid-argument', 'prompt zorunludur.');

  const { data, error } = await supabase.from('ai_history').insert({
    user_id: uid,
    prompt,
    response: normalizeText(payload.response || payload.resultText || '', 5000),
    tool: normalizeText(payload.tool || payload.toolId || '', 120),
    image_url: normalizeText(payload.imageUrl || payload.resultImageUrl || '', 4000),
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : payload,
    created_at: nowIso(),
  }).select('id').single();

  if (error || !data) throw new HttpsError('internal', error?.message || 'AI gecmisi kaydedilemedi.');
  return { success: true, id: data.id, historyId: data.id };
});

exports.updateAiHistoryEntrySecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const historyId = String(request.data?.id || request.data?.historyId || '').trim();
  if (!historyId) throw new HttpsError('invalid-argument', 'historyId zorunludur.');

  const data = request.data?.data && typeof request.data.data === 'object'
    ? request.data.data
    : request.data || {};

  const payload = {};
  if (Object.prototype.hasOwnProperty.call(data, 'response')) payload.response = normalizeText(data.response, 5000);
  if (Object.prototype.hasOwnProperty.call(data, 'resultText')) payload.response = normalizeText(data.resultText, 5000);
  if (Object.prototype.hasOwnProperty.call(data, 'imageUrl')) payload.image_url = normalizeText(data.imageUrl, 4000);
  if (Object.prototype.hasOwnProperty.call(data, 'resultImageUrl')) payload.image_url = normalizeText(data.resultImageUrl, 4000);
  payload.metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : data;
  if (!Object.keys(payload).length) return { success: true, skipped: true };

  const { error } = await supabase.from('ai_history').update(payload).eq('id', historyId).eq('user_id', uid);
  if (error) throw new HttpsError('internal', error.message);
  return { success: true };
});
