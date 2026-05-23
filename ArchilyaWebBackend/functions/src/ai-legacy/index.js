const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { CHAT_SYSTEM_ACK, CHAT_SYSTEM_INSTRUCTION, FieldValue, GEMINI_API_KEY, GEMINI_FALLBACK_MODELS, GEMINI_MODELS, NEGATIVE_PROMPT, REPLICATE_API_KEY, STYLE_PROMPTS, buildChatRuntimeContext, callGeminiGenerateContent, db, delay, ensureUserProfileDoc, extractGeminiImage, extractGeminiText, extractUrl, normalizeAiHistorySceneReferences, normalizeAiPromptHistoryEntry, normalizeAiPromptHistoryMap, normalizeAiPromptToolId, normalizeChatHistory, normalizeChatMode, normalizeChatPath, normalizeEmail, normalizeText, requireAuth, runWithRetry, upsertAiPromptHistoryEntry, validateImagePart, validateUrl } = shared;
exports.getAiPromptHistorySecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || '');
    await ensureUserProfileDoc(uid, { email });

    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.data() || {};
    const history = normalizeAiPromptHistoryMap(userData.aiPromptHistory);

    return {
      success: true,
      history,
    };
  }
);

exports.saveAiPromptHistorySecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || '');
    const requestedToolId = normalizeAiPromptToolId(request.data?.toolId);

    if (!requestedToolId) {
      throw new HttpsError('invalid-argument', 'Gecersiz AI arac kimligi.');
    }

    const requestedEntry = normalizeAiPromptHistoryEntry(request.data?.entry, requestedToolId);
    if (!requestedEntry) {
      throw new HttpsError('invalid-argument', 'Prompt gecmisi girdisi gecersiz.');
    }

    const userRef = db.collection('users').doc(uid);
    await ensureUserProfileDoc(uid, { email });

    let persistedHistory = {};
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const userData = userSnap.data() || {};
      const currentHistory = normalizeAiPromptHistoryMap(userData.aiPromptHistory);
      persistedHistory = upsertAiPromptHistoryEntry(currentHistory, requestedToolId, requestedEntry);

      tx.set(userRef, {
        aiPromptHistory: persistedHistory,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    return {
      success: true,
      history: persistedHistory,
    };
  }
);

exports.logAiHistoryEntrySecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || '');
    const payload = request.data?.payload || {};

    const ref = await db.collection('aiHistory').add({
      uid,
      email: email || null,
      toolId: normalizeText(payload.toolId, 80),
      toolLabel: normalizeText(payload.toolLabel, 120),
      outputType: normalizeText(payload.outputType, 20),
      mode: normalizeText(payload.mode || 'normal', 30),
      style: normalizeText(payload.style, 80),
      workflow: normalizeText(payload.workflow, 80),
      promptRaw: normalizeText(payload.promptRaw, 3000),
      promptPreview: normalizeText(payload.promptPreview, 1500),
      sourceImageName: normalizeText(payload.sourceImageName, 180),
      sourceImageMimeType: normalizeText(payload.sourceImageMimeType, 60),
      sourceImageUri: normalizeText(payload.sourceImageUri, 5000),
      sourceProjectId: normalizeText(payload.sourceProjectId, 120),
      sceneReferences: normalizeAiHistorySceneReferences(payload.sceneReferences),
      status: normalizeText(payload.status || 'queued', 30),
      errorMessage: null,
      resultTextPreview: null,
      hasImageResult: false,
      resultMimeType: null,
      savedProjectId: null,
      savedProjectName: null,
      savedFileUrl: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      historyId: ref.id,
    };
  }
);

exports.updateAiHistoryEntrySecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const historyId = normalizeText(request.data?.historyId, 120);
    const data = request.data?.data;

    if (!historyId) {
      throw new HttpsError('invalid-argument', 'historyId zorunludur.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new HttpsError('invalid-argument', 'data nesnesi zorunludur.');
    }

    const historyRef = db.collection('aiHistory').doc(historyId);
    const historySnap = await historyRef.get();
    if (!historySnap.exists) {
      return { success: true, skipped: true };
    }

    const row = historySnap.data() || {};
    if (normalizeText(row.uid, 120) !== uid) {
      throw new HttpsError('permission-denied', 'Bu AI gecmis kaydini guncelleme yetkiniz yok.');
    }

    const updatePayload = {};

    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
      updatePayload.status = normalizeText(data.status, 30);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'errorMessage')) {
      updatePayload.errorMessage = normalizeText(data.errorMessage, 1200) || null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'resultTextPreview')) {
      updatePayload.resultTextPreview = normalizeText(data.resultTextPreview, 1500) || null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'hasImageResult')) {
      updatePayload.hasImageResult = data.hasImageResult === true;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'resultMimeType')) {
      updatePayload.resultMimeType = normalizeText(data.resultMimeType, 80) || null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'savedProjectId')) {
      updatePayload.savedProjectId = normalizeText(data.savedProjectId, 120) || null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'savedProjectName')) {
      updatePayload.savedProjectName = normalizeText(data.savedProjectName, 240) || null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'savedFileUrl')) {
      updatePayload.savedFileUrl = normalizeText(data.savedFileUrl, 5000) || null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'savedAt')) {
      updatePayload.savedAt = FieldValue.serverTimestamp();
    }

    updatePayload.updatedAt = FieldValue.serverTimestamp();
    await historyRef.update(updatePayload);
    return { success: true };
  }
);

exports.transformImage = onCall(
  {
    secrets:        [REPLICATE_API_KEY],
    timeoutSeconds: 540,
    memory:         '2GiB',
    region:         'europe-west1',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }

    const { imageDataUrl, imageUrl, prompt, strength, style, toolId } = request.data;

    if (!imageDataUrl && !imageUrl) {
      throw new HttpsError('invalid-argument', 'Referans görsel zorunludur.');
    }

    // Klasik "Strength" kavramını ControlNet'in "Conditioning Scale" değerine çevir.
    // Strength yüksekse (dönüşüm çok isteniyorsa), Canny çizgilerine biraz daha az sadık kal (0.65).
    // Strength düşükse (orijinale sadık kalınması isteniyorsa), Canny çizgilerine %100 sadık kal (1.00).
    const strengthVal = Math.min(Math.max(parseFloat(strength) || 0.65, 0.1), 0.99);
    const controlnetScale = 1.0 - (strengthVal * 0.4); // 0.1 → ~0.96 (Çok Sadık), 0.99 → ~0.60 (Özgür)

    const styleText   = STYLE_PROMPTS[style] || STYLE_PROMPTS.photorealistic;
    const userPrompt  = (prompt || '').trim();
    const finalPrompt = userPrompt
      ? `${userPrompt}, ${styleText}, masterpiece, ultra-detailed architecture`
      : `${styleText}, masterpiece, ultra-detailed architecture`;

    const inputImage  = imageDataUrl || imageUrl;

    console.log(`[transformImage] uid=${request.auth.uid} tool=${toolId} controlScale=${controlnetScale.toFixed(2)} style=${style}`);

    let apiKey;
    try {
      apiKey = REPLICATE_API_KEY.value();
      if (!apiKey) throw new Error('API anahtarı boş döndü.');
    } catch (err) {
      throw new HttpsError('failed-precondition', `Replicate API anahtarı bulunamadı: ${err.message}`);
    }

    const replicate = new Replicate({ auth: apiKey });

    let output;
    try {
      output = await runWithRetry(
        replicate,
        'lucataco/sdxl-controlnet',
        {
          image:           inputImage,
          prompt:          finalPrompt,
          negative_prompt: NEGATIVE_PROMPT,
          condition_scale: controlnetScale, // Canny Çizgilerine sadakat (0.0 - 1.0)
          controlnet:      'canny',         // Kesin çizgiler için Canny
          num_inference_steps: 30,          // SDXL için standart kalite
          guidance_scale:  7.5,             // Prompt'a uyum gücü
        },
        'SDXL-ControlNet (Stil Dönüşümü)',
        3
      );
    } catch (err) {
      throw new HttpsError('aborted', `Görsel dönüşümü başarısız: ${err.message}`);
    }

    const outputUrl = validateUrl(extractUrl(output), 'SDXL-ControlNet');
    console.log('[transformImage] Tamamlandı:', outputUrl.slice(0, 80));
    return { success: true, outputUrl };
  }
);

exports.archRenderPipeline = onCall(
  {
    secrets:        [REPLICATE_API_KEY],
    timeoutSeconds: 540,
    memory:         '4GiB',
    region:         'europe-west1',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }

    const {
      imageUrl,
      style           = 'photorealistic',
      customPrompt    = '',
      quality         = 'ultra',
    } = request.data;

    if (!imageUrl) {
      throw new HttpsError('invalid-argument', 'Referans görsel URL zorunludur.');
    }

    const stylePrompt  = STYLE_PROMPTS[style] || STYLE_PROMPTS.photorealistic;
    const basePrompt   = customPrompt.trim()
      ? `${customPrompt.trim()}, ${stylePrompt}`
      : stylePrompt;
    const masterPrompt =
      `${basePrompt}, ` +
      'masterpiece architectural photography, hyper-realistic, ' +
      'Unreal Engine 5 quality render, V-Ray materials, ' +
      'global illumination, highly detailed textures, 8K resolution, cinematic composition';

    console.log(`[archRenderPipeline] uid=${request.auth.uid} style=${style} quality=${quality}`);

    let apiKey;
    try {
      apiKey = REPLICATE_API_KEY.value();
      if (!apiKey) throw new Error('API anahtarı boş döndü.');
    } catch (err) {
      throw new HttpsError('failed-precondition', `Replicate API anahtarı bulunamadı: ${err.message}`);
    }

    const replicate = new Replicate({ auth: apiKey });

    // ══════════════════════════════════════════════════════════════════
    // AŞAMA 1: FLUX-Canny Pro (Geometri Koruma + FLUX Render)
    // Model: black-forest-labs/flux-canny-pro
    // Görevi: Hem çizgileri kilitler hem de FLUX'ın fotorealistik 
    //         ışık ve malzeme kalitesini tek adımda giydirir.
    // ══════════════════════════════════════════════════════════════════

    console.log('[archRenderPipeline] Aşama 1: FLUX ControlNet başlıyor...');
    await delay(1000);

    let stage1Url;
    try {
      const stage1Output = await runWithRetry(
        replicate,
        'black-forest-labs/flux-canny-pro',
        {
          control_image:                 imageUrl,
          prompt:                        masterPrompt,
          steps:                         quality === 'ultra' ? 30 : 22,
          guidance:                      30,              // 1-100 arası FLUX Prompt uyumu (varsayılan 30)
          safety_tolerance:              5,               // Mimari renderlar için esnek güvenlik (1-6 arası)
          prompt_upsampling:             false,           // Kendi promptumuzu bozmaması için kapalı
          output_format:                 'png',
        },
        'FLUX-ControlNet (Aşama 1)',
        3
      );

      stage1Url = validateUrl(extractUrl(stage1Output), 'FLUX-ControlNet (Aşama 1)');
      console.log('[archRenderPipeline] Aşama 1 tamamlandı:', stage1Url.slice(0, 80));

    } catch (err) {
      console.error('[archRenderPipeline] Aşama 1 kritik hata:', err.message);
      throw new HttpsError('aborted', `FLUX-ControlNet render başarısız: ${err.message}`);
    }

    // ══════════════════════════════════════════════════════════════════
    // AŞAMA 2: Real-ESRGAN — 4K Upscale (Mimerra Keskinliği)
    // Görevi: FLUX'tan çıkan 1024px görseli 4096px (4K) seviyesine
    //         yapay zeka ile detaylandırarak büyütür.
    // ══════════════════════════════════════════════════════════════════

    console.log('[archRenderPipeline] Aşama 2 öncesi 4s bekleniyor (burst limit koruması)...');
    await delay(4000);
    console.log('[archRenderPipeline] Aşama 2: Real-ESRGAN 4K upscale başlıyor...');

    let finalUrl;
    try {
      const stage2Output = await runWithRetry(
        replicate,
        'nightmareai/real-esrgan',
        {
          image:        stage1Url,
          scale:        quality === 'ultra' ? 4 : 2, // Ultra: 4x (4K), Standard: 2x (2K)
          face_enhance: false,
        },
        'Real-ESRGAN (Aşama 2)',
        3
      );

      finalUrl = validateUrl(extractUrl(stage2Output), 'Real-ESRGAN (Aşama 2)');
      console.log('[archRenderPipeline] Aşama 2 tamamlandı:', finalUrl.slice(0, 80));

    } catch (err) {
      console.warn('[archRenderPipeline] Aşama 2 (ESRGAN) başarısız, FLUX çıktısı kullanılıyor. Hata:', err.message);
      finalUrl = stage1Url; // ESRGAN patlarsa bile FLUX çıktısını ver (graceful fallback)
    }

    console.log('[archRenderPipeline] Pipeline tamamlandı! Final URL:', finalUrl.slice(0, 80));

    return {
      success:   true,
      outputUrl: finalUrl,
      stage1Url,
      pipeline:  `FLUX ControlNet (Canny) → Real-ESRGAN ${quality === 'ultra' ? '4K' : '2K'}`,
      quality,
    };
  }
);

exports.generateArchitecturalContent = onCall(
  {
    secrets:        [GEMINI_API_KEY],
    timeoutSeconds: 300,
    memory:         '2GiB',
    region:         'europe-west1',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }

    const { imagePart, promptText, outputType = 'text' } = request.data || {};
    const prompt = normalizeText(promptText, 12_000);

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt metni zorunludur.');
    }

    if (outputType !== 'text' && outputType !== 'image') {
      throw new HttpsError('invalid-argument', 'Geçersiz çıktı tipi.');
    }

    validateImagePart(imagePart);

    const model = outputType === 'image' ? GEMINI_MODELS.image : GEMINI_MODELS.text;
    const fallbackModels = outputType === 'image' ? GEMINI_FALLBACK_MODELS.image : GEMINI_FALLBACK_MODELS.text;

    const payload = {
      contents: [{
        role: 'user',
        parts: [imagePart, { text: prompt }],
      }],
    };

    if (outputType === 'image') {
      payload.generationConfig = {
        responseModalities: ['IMAGE', 'TEXT'],
      };
    }

    const geminiResponse = await callGeminiGenerateContent({
      model,
      payload,
      fallbackModels,
      context: {
        toolId: 'generateArchitecturalContent',
        outputType,
      },
    });

    const data = geminiResponse.data;
    const activeModel = geminiResponse.model;

    if (outputType === 'image') {
      const image = extractGeminiImage(data, {
        toolId: 'generateArchitecturalContent',
        model: activeModel,
        outputType,
      });
      return { success: true, ...image };
    }

    const text = extractGeminiText(data);
    return { success: true, text };
  }
);

exports.chatWithArchilyaAI = onCall(
  {
    secrets:        [GEMINI_API_KEY],
    timeoutSeconds: 120,
    memory:         '1GiB',
    region:         'europe-west1',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }

    const message = normalizeText(request.data?.message, 2_000);
    if (!message) {
      throw new HttpsError('invalid-argument', 'Mesaj boş olamaz.');
    }

    const history = normalizeChatHistory(request.data?.history);
    const chatMode = normalizeChatMode(request.data?.mode);
    const currentPath = normalizeChatPath(request.data?.currentPath);
    const runtimeContext = buildChatRuntimeContext({ mode: chatMode, currentPath });

    const payload = {
      contents: [
        { role: 'user',  parts: [{ text: CHAT_SYSTEM_INSTRUCTION }] },
        { role: 'model', parts: [{ text: CHAT_SYSTEM_ACK }] },
        { role: 'user',  parts: [{ text: runtimeContext }] },
        ...history,
        { role: 'user',  parts: [{ text: message }] },
      ],
      generationConfig: {
        maxOutputTokens: 520,
        temperature: 0.55,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',      threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    const geminiResponse = await callGeminiGenerateContent({
      model: GEMINI_MODELS.chat,
      payload,
      fallbackModels: GEMINI_FALLBACK_MODELS.chat,
      context: {
        toolId: 'chatWithArchilyaAI',
        outputType: 'text',
      },
    });
    const reply = extractGeminiText(geminiResponse.data);

    return { success: true, reply };
  }
);