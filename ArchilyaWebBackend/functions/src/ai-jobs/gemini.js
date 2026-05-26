const { HttpsError } = require('../shared/http-callable');

const GEMINI_MODELS = {
  text: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
  image: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
};

const GEMINI_FALLBACK_MODELS = {
  text: (process.env.GEMINI_TEXT_FALLBACK_MODELS || 'gemini-2.5-flash-lite').split(',').map((m) => m.trim()).filter(Boolean),
  image: (process.env.GEMINI_IMAGE_FALLBACK_MODELS || 'gemini-2.5-flash-image').split(',').map((m) => m.trim()).filter(Boolean),
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readInlineImagePart(part) {
  const inlineData = part?.inlineData || part?.inline_data || null;
  const mimeType = String(inlineData?.mimeType || inlineData?.mime_type || '').toLowerCase();
  const data = String(inlineData?.data || '');
  if (!mimeType.startsWith('image/') || !data) return null;
  return {
    mimeType,
    data,
  };
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

function modelChain(outputType) {
  const seen = new Set();
  return [GEMINI_MODELS[outputType], ...(GEMINI_FALLBACK_MODELS[outputType] || [])]
    .filter((model) => {
      if (!model || seen.has(model)) return false;
      seen.add(model);
      return true;
    });
}

function isRetryableStatus(status) {
  return [408, 409, 429, 500, 502, 503, 504].includes(Number(status));
}

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

async function generateWithFallback({ outputType, payload }) {
  const chain = modelChain(outputType);
  if (!chain.length) throw new HttpsError('failed-precondition', 'Gemini modeli tanimli degil.');
  let lastError = null;

  for (const model of chain) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const data = await callGeminiModel({ model, payload, attempt });
        if (outputType === 'image' && !findImagePart(data)) {
          const error = new HttpsError('internal', 'Gemini gorsel yaniti bos dondu.', { model, attempt });
          error.retryable = true;
          throw error;
        }
        return { model, data };
      } catch (error) {
        lastError = error;
        if (!error.retryable || attempt === 3) break;
        const jitter = Math.round(Math.random() * 750);
        await delay((750 * (2 ** (attempt - 1))) + jitter);
      }
    }
  }

  throw lastError || new HttpsError('internal', 'Gemini yaniti alinamadi.');
}

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

module.exports = { generateWithFallback, extractText, extractImage };
