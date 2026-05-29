const { HttpsError } = require('../shared/http-callable');

// ══════════════════════════════════════════════════════════════════════════════
// GEMINI MODEL CONFIG — COST-CONTROLLED 3.1
// ══════════════════════════════════════════════════════════════════════════════
//
// Active models (cost-controlled):
//   Image tools → gemini-3.1-flash-image
//   Text tools  → gemini-3.1-flash-lite
//
// Future premium models (NOT active — reserved for quality/reasoning mode):
//   gemini-3-pro-image    — premium architectural visualization
//   gemini-3.5-flash      — advanced reasoning / multi-step
//
// Env overrides (for CI, staging, or emergency fallback):
//   GEMINI_IMAGE_MODEL           → override image primary
//   GEMINI_IMAGE_FALLBACK_MODEL  → override image fallback
//   GEMINI_TEXT_MODEL            → override text primary
//   GEMINI_TEXT_FALLBACK_MODEL   → override text fallback
// ══════════════════════════════════════════════════════════════════════════════

const MODEL_CONFIG_VERSION = '3.1-cost-controlled';

const GEMINI_MODELS = {
  imagePrimary:   process.env.GEMINI_IMAGE_MODEL            || 'gemini-3.1-flash-image',
  imageFallback:  process.env.GEMINI_IMAGE_FALLBACK_MODEL   || 'gemini-3.1-flash-image',
  textPrimary:    process.env.GEMINI_TEXT_MODEL             || 'gemini-3.1-flash-lite',
  textFallback:   process.env.GEMINI_TEXT_FALLBACK_MODEL    || 'gemini-3.1-flash-lite',

  // Reserved — NOT active in cost-controlled mode:
  // imagePro:    process.env.GEMINI_IMAGE_PRO_MODEL  || 'gemini-3-pro-image',
  // textPro:     process.env.GEMINI_TEXT_PRO_MODEL   || 'gemini-3.5-flash',
};

// ══════════════════════════════════════════════════════════════════════════════
// TOOL → MODEL ROUTING
// ══════════════════════════════════════════════════════════════════════════════

const IMAGE_TOOLS = new Set(['img2img', 'enhance', 'sceneedit', 'plancolor', 'multi-angle']);

function getModelConfig(outputType, toolId) {
  const isImage = outputType === 'image' || (toolId && IMAGE_TOOLS.has(toolId));
  if (isImage) {
    return {
      primary: GEMINI_MODELS.imagePrimary,
      fallback: [GEMINI_MODELS.imageFallback].filter(Boolean),
      role: 'imagePrimary',
      purpose: 'architectural-image-generation',
    };
  }
  return {
    primary: GEMINI_MODELS.textPrimary,
    fallback: [GEMINI_MODELS.textFallback].filter(Boolean),
    role: 'textPrimary',
    purpose: 'architectural-text-analysis',
  };
}

function modelChain(outputType, toolId) {
  const config = getModelConfig(outputType, toolId);
  const seen = new Set();
  return [config.primary, ...config.fallback]
    .filter((model) => {
      if (!model || seen.has(model)) return false;
      seen.add(model);
      return true;
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODEL METADATA — logged per job for audit/debug
// ══════════════════════════════════════════════════════════════════════════════

function getModelMetadata(outputType, toolId) {
  const config = getModelConfig(outputType, toolId);
  return {
    modelUsed: config.primary,
    modelRole: config.role,
    modelPurpose: config.purpose,
    modelConfigVersion: MODEL_CONFIG_VERSION,
    modelFallbackAvailable: config.fallback.length > 0 && config.fallback[0] !== config.primary,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC CONFIG SUMMARY — for health checks (no secrets)
// ══════════════════════════════════════════════════════════════════════════════

function getGeminiConfigSummary() {
  return {
    configVersion: MODEL_CONFIG_VERSION,
    imageModel: GEMINI_MODELS.imagePrimary,
    imageFallback: GEMINI_MODELS.imageFallback,
    textModel: GEMINI_MODELS.textPrimary,
    textFallback: GEMINI_MODELS.textFallback,
    keyConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length >= 10),
    // Reserved models (NOT active):
    reservedModels: {
      imagePro: 'gemini-3-pro-image',
      textPro: 'gemini-3.5-flash',
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readInlineImagePart(part) {
  const inlineData = part?.inlineData || part?.inline_data || null;
  const mimeType = String(inlineData?.mimeType || inlineData?.mime_type || '').toLowerCase();
  const data = String(inlineData?.data || '');
  if (!mimeType.startsWith('image/') || !data) return null;
  return { mimeType, data };
}

function findImagePart(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const image = readInlineImagePart(part);
      if (image) return image;
    }
  }
  return null;
}

function isRetryableStatus(status) {
  return [408, 409, 429, 500, 502, 503, 504].includes(Number(status));
}

// ══════════════════════════════════════════════════════════════════════════════
// GEMINI API CALL
// ══════════════════════════════════════════════════════════════════════════════

async function callGeminiModel({ model, payload, attempt }) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Gemini API anahtari eksik.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error?.message || text || `Gemini HTTP ${response.status}`;
    const code = isRetryableStatus(response.status) ? 'unavailable' : 'internal';
    const error = new HttpsError(code, message, { status: response.status, model, attempt });
    error.retryable = isRetryableStatus(response.status);
    throw error;
  }

  return data;
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERATE WITH FALLBACK
// ══════════════════════════════════════════════════════════════════════════════

async function generateWithFallback({ outputType, payload, toolId }) {
  const chain = modelChain(outputType, toolId);
  if (!chain.length) throw new HttpsError('failed-precondition', 'Gemini modeli tanimli degil.');

  const modelMeta = getModelMetadata(outputType, toolId);
  let lastError = null;

  for (const model of chain) {
    // Provider retry: MAX 2 attempts per model for transient errors only
    // Processor-level retry handles the rest
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const data = await callGeminiModel({ model, payload, attempt });
        if (outputType === 'image' && !findImagePart(data)) {
          const error = new HttpsError('internal', 'Gemini gorsel yaniti bos dondu.', { model, attempt });
          error.retryable = true;
          throw error;
        }
        return { model, data, modelMetadata: modelMeta };
      } catch (error) {
        lastError = error;
        console.warn(JSON.stringify({
          ts: new Date().toISOString(),
          level: 'warn',
          service: 'ai-jobs',
          msg: 'Gemini model failed',
          model,
          attempt,
          error: error.message,
          retryable: error.retryable,
          modelConfigVersion: MODEL_CONFIG_VERSION,
          modelRole: modelMeta.modelRole,
        }));
        if (!error.retryable || attempt === 2) break;
        const jitter = Math.round(Math.random() * 750);
        await delay((750 * (2 ** (attempt - 1))) + jitter);
      }
    }
  }

  throw lastError || new HttpsError('internal', 'Gemini yaniti alinamadi.');
}

// ══════════════════════════════════════════════════════════════════════════════
// RESPONSE EXTRACTORS
// ══════════════════════════════════════════════════════════════════════════════

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text).filter(Boolean).join('\n').trim();
  if (!text) throw new HttpsError('internal', 'Gemini metin yaniti bos dondu.');
  return text;
}

function extractImage(data) {
  const image = findImagePart(data);
  if (!image) throw new HttpsError('internal', 'Gemini gorsel yaniti bos dondu.');
  return image;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  generateWithFallback,
  extractText,
  extractImage,
  getModelMetadata,
  getGeminiConfigSummary,
  MODEL_CONFIG_VERSION,
  GEMINI_MODELS,
};
