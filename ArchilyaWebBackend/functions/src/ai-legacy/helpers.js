  const toolConfig = {
    analysis: { credits: 5, outputType: 'text' },
    img2img: { credits: 15, outputType: 'image' },
    enhance: { credits: 15, outputType: 'image' },
    plancolor: { credits: 15, outputType: 'image' },
    sceneedit: { credits: 25, outputType: 'image' },
  };

  const config = toolConfig[String(toolId || '').trim()];
  if (!config) {
    throw new HttpsError('invalid-argument', 'Gecersiz AI arac secimi.');
  }
  if (config.outputType !== outputType) {
    throw new HttpsError('invalid-argument', 'Arac ile cikti tipi uyumsuz.');
  }
  return config;
}

function normalizeAiPromptToolId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!AI_PROMPT_HISTORY_ALLOWED_TOOLS.has(normalized)) {
    return '';
  }
  return normalized;
}

function normalizeAiPromptHistoryEntry(entry, fallbackToolId = '') {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const toolId = normalizeAiPromptToolId(entry.toolId || fallbackToolId);
  if (!toolId) {
    return null;
  }

  const referenceCountRaw = Math.round(Number(entry.referenceCount || 0));
  const referenceCount = Number.isFinite(referenceCountRaw)
    ? Math.max(0, Math.min(20, referenceCountRaw))
    : 0;
  const outputTypeRaw = String(entry.outputType || '').trim().toLowerCase();

  return {
    id: normalizeText(entry.id, 80) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    toolId,
    toolLabel: normalizeText(entry.toolLabel, 120) || toolId,
    outputType: outputTypeRaw === 'text' ? 'text' : 'image',
    style: normalizeText(entry.style, 64),
    sceneEditMode: normalizeText(entry.sceneEditMode, 64),
    referenceCount,
    extraNote: normalizeText(entry.extraNote, 2000),
    generationVariant: normalizeText(entry.generationVariant, 40),
    statusLabel: normalizeText(entry.statusLabel, 120),
    createdAt: normalizeText(entry.createdAt, 64) || new Date().toISOString(),
  };
}

function normalizeAiPromptHistoryMap(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const normalizedMap = {};
  for (const [rawToolId, rawHistory] of Object.entries(input)) {
    const toolId = normalizeAiPromptToolId(rawToolId);
    if (!toolId || !Array.isArray(rawHistory)) {
      continue;
    }

    const normalizedEntries = [];
    for (const rawEntry of rawHistory) {
      const normalizedEntry = normalizeAiPromptHistoryEntry(rawEntry, toolId);
      if (!normalizedEntry) {
        continue;
      }

      normalizedEntries.push(normalizedEntry);
      if (normalizedEntries.length >= AI_PROMPT_HISTORY_MAX_ITEMS_PER_TOOL) {
        break;
      }
    }

    if (normalizedEntries.length > 0) {
      normalizedMap[toolId] = normalizedEntries;
    }
  }

  return normalizedMap;
}

function upsertAiPromptHistoryEntry(historyMap, toolId, nextEntry) {
  const safeToolId = normalizeAiPromptToolId(toolId);
  const normalizedEntry = normalizeAiPromptHistoryEntry(nextEntry, safeToolId);
  if (!safeToolId || !normalizedEntry) {
    throw new HttpsError('invalid-argument', 'Prompt gecmisi girdisi gecersiz.');
  }

  const currentEntries = Array.isArray(historyMap[safeToolId]) ? historyMap[safeToolId] : [];
  const dedupedEntries = currentEntries.filter((entry) => entry.id !== normalizedEntry.id);
  const nextEntries = [normalizedEntry, ...dedupedEntries].slice(0, AI_PROMPT_HISTORY_MAX_ITEMS_PER_TOOL);

  return {
    ...historyMap,
    [safeToolId]: nextEntries,
  };
}

function parseRetryAfterSeconds(text) {
  const message = String(text || '');
  const patterns = [
    /Please retry in\s*([\d.]+)s/i,
    /retry after\s*([\d.]+)\s*(?:s|sec|secs|second|seconds)?/i,
    /try again in\s*([\d.]+)\s*(?:s|sec|secs|second|seconds)?/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match) continue;
    const parsed = Math.ceil(Number(match[1]));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function parseRetryAfterHeaderSeconds(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const seconds = Math.ceil(Number(raw));
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  const retryDate = Date.parse(raw);
  if (!Number.isFinite(retryDate)) {
    return null;
  }

  const deltaSeconds = Math.ceil((retryDate - Date.now()) / 1000);
  return deltaSeconds > 0 ? deltaSeconds : null;
}

function buildGeminiModelChain(primaryModel, fallbackModels = []) {
  const seen = new Set();
  const chain = [];

  for (const candidate of [primaryModel, ...fallbackModels]) {
    const normalized = String(candidate || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    chain.push(normalized);
  }

  return chain;
}

function isGeminiDemandSpike(status, message, geminiStatus) {
  const lowerMessage = String(message || '').toLowerCase();
  const statusLabel = String(geminiStatus || '').toLowerCase();

  return (
    Number(status) === 409 ||
    statusLabel === 'aborted' ||
    lowerMessage.includes('high demand') ||
    lowerMessage.includes('try again later') ||
    lowerMessage.includes('temporarily unavailable')
  );
}

function isGeminiRetriableHttpError(status, message, geminiStatus) {
  if ([408, 409, 429, 500, 502, 503, 504].includes(Number(status))) {
    return true;
  }

  const lowerMessage = String(message || '').toLowerCase();
  const statusLabel = String(geminiStatus || '').toLowerCase();
  return (
    statusLabel === 'resource_exhausted' ||
    statusLabel === 'unavailable' ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('quota exceeded') ||
    lowerMessage.includes('high demand') ||
    lowerMessage.includes('try again later')
  );
}

function computeGeminiRetryDelaySeconds(attempt, retryAfterSeconds = null) {
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(60, Math.max(1, retryAfterSeconds));
  }

  const fallbackDelay = 3 * (2 ** Math.max(0, attempt));
  return Math.min(30, fallbackDelay);
}

function toGeminiHttpsError({ model, status, geminiStatus, errMsg, retryAfterSeconds, context = {} }) {
  const retryInfo = retryAfterSeconds ? ` Lutfen ${retryAfterSeconds} saniye sonra tekrar deneyin.` : '';
  const baseDetails = {
    toolId: context.toolId,
    model,
    outputType: context.outputType,
    httpStatus: status,
    geminiStatus,
    retryAfterSeconds,
  };
  const lowerErrMsg = String(errMsg || '').toLowerCase();
  const isImageModel = /image/i.test(model);
  const isQuotaExceeded = lowerErrMsg.includes('quota exceeded');
  const isHighDemand = isGeminiDemandSpike(status, errMsg, geminiStatus);

  if (status === 429 || isHighDemand || String(geminiStatus || '').toUpperCase() === 'RESOURCE_EXHAUSTED') {
    if (isImageModel) {
      if (isQuotaExceeded) {
        return new HttpsError(
          'resource-exhausted',
          `Gemini gorsel kotasi su an kullanilamiyor.${retryInfo} Bu model icin Google Cloud billing aktif olmali ve key ayni projeye bagli olmalidir.`,
          buildAiErrorDetails({
            ...baseDetails,
            category: 'gemini_quota_exceeded',
            userMessage: `Gorsel uretim servisi su an kota sinirinda.${retryInfo}`.trim(),
          })
        );
      }

      return new HttpsError(
        'resource-exhausted',
        `Gemini gorsel istegi su an yogun.${retryInfo}`,
        buildAiErrorDetails({
          ...baseDetails,
          category: isHighDemand ? 'gemini_high_demand' : 'gemini_rate_limited',
          userMessage: `Gorsel uretim servisi su an yogun.${retryInfo}`.trim(),
        })
      );
    }

    return new HttpsError(
      'resource-exhausted',
      isQuotaExceeded ? `Gemini kota limitine ulasildi.${retryInfo}` : `Gemini metin istegi su an yogun.${retryInfo}`,
      buildAiErrorDetails({
        ...baseDetails,
        category: isQuotaExceeded ? 'gemini_quota_exceeded' : (isHighDemand ? 'gemini_high_demand' : 'gemini_rate_limited'),
        userMessage: `AI servisi su an yogun veya kota sinirinda.${retryInfo}`.trim(),
      })
    );
  }

  if ([500, 502, 503, 504].includes(Number(status))) {
    return new HttpsError(
      'unavailable',
      `Gemini servisi gecici olarak kullanilamiyor (${status}).${retryInfo}`,
      buildAiErrorDetails({
        ...baseDetails,
        category: 'gemini_service_unavailable',
        userMessage: `AI servisi su an gecici olarak kullanilamiyor.${retryInfo}`.trim(),
      })
    );
  }

  if (status === 404) {
    return new HttpsError(
      'failed-precondition',
      'Secilen Gemini modeli bu API surumunde kullanilamiyor.',
      buildAiErrorDetails({
        ...baseDetails,
        category: 'gemini_model_unavailable',
        userMessage: 'AI modeli su an kullanilamiyor. Lutfen biraz sonra tekrar deneyin.',
      })
    );
  }

  if (status === 401 || status === 403) {
    return new HttpsError(
      'permission-denied',
      'Gemini API anahtari gecersiz veya yetkisiz.',
      buildAiErrorDetails({
        ...baseDetails,
        category: 'gemini_auth_error',
        userMessage: 'AI servisine yetki dogrulanamadi. Lutfen destek ile iletisime gecin.',
      })
    );
  }

  return new HttpsError(
    'aborted',
    errMsg,
    buildAiErrorDetails({
      ...baseDetails,
      category: 'gemini_http_error',
      userMessage: 'AI servisi istegi tamamlayamadi. Lutfen tekrar deneyin.',
    })
  );
}

function summarizeGeminiPayload(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const finishReasons = candidates
    .map((candidate) => String(candidate?.finishReason || '').trim())
    .filter(Boolean);
  const hasImagePart = candidates.some((candidate) => {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    return parts.some((part) => {
      const mimeType = String(part?.inlineData?.mimeType || '');
      return mimeType.startsWith('image/') && Boolean(part?.inlineData?.data);
    });
  });
  const hasTextPart = candidates.some((candidate) => {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    return parts.some((part) => typeof part?.text === 'string' && part.text.trim());
  });

  return {
    candidateCount: candidates.length,
    finishReasons,
    firstFinishReason: finishReasons[0] || null,
    blockReason: data?.promptFeedback?.blockReason || null,
    hasImagePart,
    hasTextPart,
  };
}

function buildAiErrorDetails({
  category,
  userMessage,
  toolId,
  model,
  outputType,
  httpStatus = null,
  geminiStatus = null,
  finishReason = null,
  blockReason = null,
  retryAfterSeconds = null,
}) {
  return {
    category: String(category || 'ai_error'),
    userMessage: String(userMessage || 'AI islemi tamamlanamadi. Lutfen tekrar deneyin.'),
    toolId: toolId ? String(toolId) : null,
    model: model ? String(model) : null,
    outputType: outputType ? String(outputType) : null,
    httpStatus: Number.isFinite(httpStatus) ? httpStatus : null,
    geminiStatus: geminiStatus ? String(geminiStatus) : null,
    finishReason: finishReason ? String(finishReason) : null,
    blockReason: blockReason ? String(blockReason) : null,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
  };
}

async function callGeminiGenerateContent({