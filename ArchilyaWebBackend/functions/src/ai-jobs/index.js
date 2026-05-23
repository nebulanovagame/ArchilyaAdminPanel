const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { AI_STUDIO_JOB_QUEUE_FUNCTION, AI_STUDIO_JOB_QUEUE_MAX_ATTEMPTS, FieldValue, GEMINI_API_KEY, GEMINI_FALLBACK_MODELS, GEMINI_MODELS, REVISION_CREDIT_COST, REVISION_TOTAL_BASE64_LIMIT, SCENE_EDIT_TOTAL_BASE64_LIMIT, buildAiErrorDetails, buildAiStudioPrompt, buildPromptInspirationPrompt, buildRevisionParts, buildSceneEditParts, callGeminiGenerateContent, chargeAiCredits, chargeAiStudioJobCredits, claimAiStudioJobRun, db, ensureUserProfileDoc, executeAiStudioJob, extractGeminiImage, extractGeminiText, getAiStudioJobRef, getAiStudioToolOutputType, getImagePartBase64Length, getSceneEditTotalBase64Length, isAiStudioRetriableError, mapAiToolConfig, markAiStudioJobForRetry, normalizeAiStudioJobError, normalizeAiStudioJobInput, normalizeEmail, normalizeSceneEditReferences, normalizeText, persistAiStudioInputImage, persistAiStudioOutputImage, refundAiCredits, refundAiStudioJobCredits, requireAuth, summarizeGeminiPayload, validateImagePart, getFunctions } = shared;
exports.createAiStudioJobSecure = onCall(
  {
    timeoutSeconds: 180,
    memory: '1GiB',
    region: 'europe-west1',
  },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || '');
    const normalizedInput = normalizeAiStudioJobInput(request.data || {});
    const jobRef = getAiStudioJobRef(uid, db.collection('_').doc().id);
    const jobId = jobRef.id;
    const requestStartedAt = Date.now();

    console.info('[createAiStudioJobSecure] start', {
      jobId,
      toolId: normalizedInput.toolId,
      outputType: normalizedInput.outputType,
      uidPrefix: String(uid).slice(0, 8),
      promptLength: normalizedInput.prompt.length,
      referenceCount: normalizedInput.referenceImages.length,
      workflow: normalizedInput.workflow,
      totalImageBase64Length: normalizedInput.totalImageBase64Length,
    });

    await ensureUserProfileDoc(uid, { email });

    const primaryImage = await persistAiStudioInputImage({
      uid,
      jobId,
      category: 'primary',
      imagePart: normalizedInput.imagePart,
    });

    const storedReferences = await Promise.all(
      normalizedInput.referenceImages.map(async (reference, index) => ({
        type: reference.type,
        label: reference.label,
        note: reference.note,
        ...(await persistAiStudioInputImage({
          uid,
          jobId,
          category: `reference-${reference.type || 'object'}`,
          imagePart: reference.imagePart,
          index,
        })),
      }))
    );

    await jobRef.set({
      jobId,
      uid,
      email: email || null,
      status: 'pending',
      toolId: normalizedInput.toolId,
      toolLabel: normalizedInput.toolLabel,
      outputType: normalizedInput.outputType,
      style: normalizedInput.style,
      sceneEditMode: normalizedInput.sceneEditMode || normalizedInput.workflow,
      extraNote: normalizedInput.extraNote,
      generationVariant: normalizedInput.generationVariant,
      sourceImageName: normalizedInput.sourceImageName,
      sourceImageMimeType: normalizedInput.sourceImageMimeType,
      sourceImageUri: normalizedInput.sourceImageUri,
      workflow: normalizedInput.workflow,
      referenceCount: storedReferences.length,
      sceneReferences: normalizedInput.sceneReferences,
      input: {
        primaryImage: {
          ...primaryImage,
          sourceImageName: normalizedInput.sourceImageName,
          sourceImageMimeType: normalizedInput.sourceImageMimeType,
          sourceImageUri: normalizedInput.sourceImageUri,
        },
        referenceImages: storedReferences,
      },
      result: null,
      error: null,
      billing: {
        amount: normalizedInput.config.credits,
        toolId: normalizedInput.toolId,
        status: 'not_charged',
        chargeSource: null,
        workspaceId: null,
        userId: uid,
        chargedAt: null,
        refundedAt: null,
        refundError: null,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      await getFunctions().taskQueue(AI_STUDIO_JOB_QUEUE_FUNCTION).enqueue(
        { uid, jobId },
        {
          id: jobId,
          dispatchDeadlineSeconds: 1800,
        }
      );

      await jobRef.set({
        queuedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      console.info('[createAiStudioJobSecure] queued', {
        jobId,
        toolId: normalizedInput.toolId,
        outputType: normalizedInput.outputType,
        durationMs: Date.now() - requestStartedAt,
      });

      return { success: true, jobId };
    } catch (err) {
      console.error('[createAiStudioJobSecure] enqueue failed', {
        jobId,
        toolId: normalizedInput.toolId,
        outputType: normalizedInput.outputType,
        durationMs: Date.now() - requestStartedAt,
        errorMessage: err?.message || 'unknown',
      });

      await jobRef.set({
        status: 'failed',
        error: normalizeAiStudioJobError(err),
        updatedAt: FieldValue.serverTimestamp(),
        failedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      throw new HttpsError('aborted', 'AI job kuyruga eklenemedi. Lutfen tekrar deneyin.');
    }
  }
);

exports.processAiStudioJob = onTaskDispatched(
  {
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 1800,
    memory: '2GiB',
    region: 'europe-west1',
    retryConfig: {
      maxAttempts: AI_STUDIO_JOB_QUEUE_MAX_ATTEMPTS,
      minBackoffSeconds: 30,
      maxBackoffSeconds: 300,
      maxDoublings: 4,
    },
    rateLimits: {
      maxConcurrentDispatches: 4,
      maxDispatchesPerSecond: 4,
    },
  },
  async (request) => {
    const uid = normalizeText(request?.data?.uid, 200);
    const jobId = normalizeText(request?.data?.jobId, 200);

    if (!uid || !jobId) {
      throw new HttpsError('invalid-argument', 'AI job gorev verisi eksik.');
    }

    const jobRef = getAiStudioJobRef(uid, jobId);
    const attemptNumber = Number(request.retryCount || 0) + 1;
    const isFinalAttempt = attemptNumber >= AI_STUDIO_JOB_QUEUE_MAX_ATTEMPTS;
    const requestStartedAt = Date.now();
    const claim = await claimAiStudioJobRun({ jobRef, taskContext: request });

    if (claim.skip) {
      console.info('[processAiStudioJob] skipped', { jobId, status: claim.job?.status || 'unknown' });
      return;
    }

    let job = claim.job || {};
    let charge = null;

    try {
      console.info('[processAiStudioJob] start', {
        jobId,
        toolId: job.toolId,
        outputType: job.outputType,
        attemptNumber,
        retryCount: Number(request.retryCount || 0),
      });

      charge = await chargeAiStudioJobCredits({
        jobRef,
        uid,
        email: normalizeEmail(job.email || ''),
        amount: Number(job.billing?.amount || 0),
        toolId: String(job.toolId || 'unknown'),
      });

      const latestJobSnap = await jobRef.get();
      job = latestJobSnap.data() || job;

      const result = await executeAiStudioJob(job);
      await jobRef.set({
        status: 'completed',
        chargeSource: charge?.source || null,
        result: result.outputType === 'image'
          ? {
              outputType: 'image',
              image: result.image,
              model: result.model,
            }
          : {
              outputType: 'text',
              text: result.text,
              model: result.model,
            },
        responseSummary: result.summary,
        error: null,
        retry: null,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      console.info('[processAiStudioJob] success', {
        jobId,
        toolId: job.toolId,
        outputType: job.outputType,
        model: result.model,
        chargeSource: charge?.source || null,
        durationMs: Date.now() - requestStartedAt,
      });
    } catch (err) {
      const normalizedError = normalizeAiStudioJobError(err);
      const retryable = isAiStudioRetriableError(err) && !isFinalAttempt;

      console.error('[processAiStudioJob] failed', {
        jobId,
        toolId: job.toolId,
        outputType: job.outputType,
        attemptNumber,
        isFinalAttempt,
        retryable,
        durationMs: Date.now() - requestStartedAt,
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
      });

      if (retryable) {
        await markAiStudioJobForRetry({ jobRef, err, attemptNumber });
        throw err instanceof HttpsError ? err : new HttpsError('internal', normalizedError.message);
      }

      let refundSucceeded = false;
      let refundError = null;
      try {
        refundSucceeded = await refundAiStudioJobCredits(jobRef);
      } catch (refundErr) {
        refundError = normalizeAiStudioJobError(refundErr);
      }

      const latestJobSnap = await jobRef.get();
      const latestBilling = (latestJobSnap.data() || {}).billing || job.billing || {};

      await jobRef.set({
        status: 'failed',
        error: normalizedError,
        retry: {
          retryable: false,
          lastAttemptNumber: attemptNumber,
          finalAttemptReached: isFinalAttempt,
          updatedAt: new Date().toISOString(),
        },
        ...(refundError ? {
          billing: {
            ...latestBilling,
            refundError,
          },
        } : {}),
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      if (refundError) {
        console.error('[processAiStudioJob] refund failed', {
          jobId,
          refundError: refundError.message,
        });
      } else {
        console.info('[processAiStudioJob] refund result', {
          jobId,
          refunded: refundSucceeded,
        });
      }
    }
  }
);

exports.runAiStudioToolSecure = onCall(
  {
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 540,
    memory: '2GiB',
    region: 'europe-west1',
  },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || '');
    const {
      imagePart,
      outputType,
      toolId,
      referenceImages,
      style,
      extraNote,
      sceneEditMode,
      workflow,
    } = request.data || {};
    const normalizedToolId = String(toolId || 'unknown').trim();
    const inferredOutputType = getAiStudioToolOutputType(normalizedToolId);
    const normalizedOutputType = outputType === 'text' || outputType === 'image' ? outputType : inferredOutputType;
    const model = normalizedOutputType === 'image' ? GEMINI_MODELS.image : GEMINI_MODELS.text;
    const fallbackModels = normalizedOutputType === 'image' ? GEMINI_FALLBACK_MODELS.image : GEMINI_FALLBACK_MODELS.text;
    const requestStartedAt = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (normalizedOutputType !== 'text' && normalizedOutputType !== 'image') {
      throw new HttpsError('invalid-argument', 'Gecersiz cikti tipi.');
    }

    validateImagePart(imagePart);
    const normalizedReferences = normalizedToolId === 'sceneedit'
      ? normalizeSceneEditReferences(referenceImages)
      : [];

    if (normalizedToolId === 'sceneedit' && !normalizedReferences.length) {
      throw new HttpsError('invalid-argument', 'Sahne duzenleme icin en az bir referans gorsel gereklidir.');
    }

    const totalImageBase64Length = normalizedToolId === 'sceneedit'
      ? getSceneEditTotalBase64Length(imagePart, normalizedReferences)
      : getImagePartBase64Length(imagePart);

    if (normalizedToolId === 'sceneedit' && totalImageBase64Length > SCENE_EDIT_TOTAL_BASE64_LIMIT) {
      throw new HttpsError('invalid-argument', 'Toplam sahne duzenleme gorselleri cok buyuk. Daha az veya daha kucuk referans kullanin.');
    }

    const normalizedWorkflow = normalizeText(workflow || sceneEditMode, 80);
    const prompt = buildAiStudioPrompt({
      toolId: normalizedToolId,
      style: normalizeText(style, 80),
      extraNote: normalizeText(extraNote, 2000),
      sceneEditMode: normalizeText(sceneEditMode, 80),
      workflow: normalizedWorkflow,
      referenceImages: normalizedReferences,
    });
    const config = mapAiToolConfig(normalizedToolId, normalizedOutputType);
    const imageMimeType = String(imagePart?.inlineData?.mimeType || '');
    const imageDataLength = String(imagePart?.inlineData?.data || '').length;
    const referenceTypes = normalizedReferences.map((reference) => reference.type);

    console.info('[runAiStudioToolSecure] start', {
      requestId,
      toolId: normalizedToolId,
      outputType: normalizedOutputType,
      model,
      uidPrefix: String(uid).slice(0, 8),
      promptLength: prompt.length,
      imageMimeType,
      imageDataLength,
      referenceCount: normalizedReferences.length,
      referenceTypes,
      workflow: normalizedToolId === 'sceneedit' ? normalizedWorkflow : '',
      totalImageBase64Length,
    });

    let charge = null;
    let activeModel = model;
    try {
      charge = await chargeAiCredits({
        uid,
        email,
        amount: config.credits,
        toolId: normalizedToolId,
      });

      const userParts = normalizedToolId === 'sceneedit'
        ? buildSceneEditParts({
            imagePart,
            prompt,
            workflow: normalizedWorkflow,
            referenceImages: normalizedReferences,
          })
        : [imagePart, { text: prompt }];

      const payload = {
        contents: [{
          role: 'user',
          parts: userParts,
        }],
      };

      if (normalizedOutputType === 'image') {
        payload.generationConfig = {
          responseModalities: ['IMAGE', 'TEXT'],
        };
      }

      const geminiResponse = await callGeminiGenerateContent({
        model,
        payload,
        fallbackModels,
        context: {
          toolId: normalizedToolId,
          outputType: normalizedOutputType,
        },
      });

      const data = geminiResponse.data;
      activeModel = geminiResponse.model;

      const summary = summarizeGeminiPayload(data);
      console.info('[runAiStudioToolSecure] gemini response', {
        requestId,
        toolId: normalizedToolId,
        outputType: normalizedOutputType,
        model: activeModel,
        requestedModel: model,
        durationMs: Date.now() - requestStartedAt,
        candidateCount: summary.candidateCount,
        finishReasons: summary.finishReasons,
        blockReason: summary.blockReason,
        hasImagePart: summary.hasImagePart,
        hasTextPart: summary.hasTextPart,
        referenceCount: normalizedReferences.length,
        referenceTypes,
      });

      if (normalizedOutputType === 'image') {
        const image = extractGeminiImage(data, {
          toolId: normalizedToolId,
          model: activeModel,
          outputType: normalizedOutputType,
        });
        const storedImage = await persistAiStudioOutputImage({
          uid,
          jobId: requestId,
          toolId: normalizedToolId,
          image,
        });
        console.info('[runAiStudioToolSecure] success image', {
          requestId,
          toolId: normalizedToolId,
          outputType: normalizedOutputType,
          model: activeModel,
          requestedModel: model,
          durationMs: Date.now() - requestStartedAt,
          mimeType: storedImage.mimeType,
          sizeBytes: storedImage.sizeBytes,
          storagePath: storedImage.storagePath,
          chargeSource: charge.source,
          referenceCount: normalizedReferences.length,
          referenceTypes,
        });
        return {
          success: true,
          chargeSource: charge.source,
          downloadUrl: storedImage.downloadUrl,
          mimeType: storedImage.mimeType,
          sizeBytes: storedImage.sizeBytes,
          storagePath: storedImage.storagePath,
        };
      }

      const text = extractGeminiText(data);
      console.info('[runAiStudioToolSecure] success text', {
        requestId,
        toolId: normalizedToolId,
        outputType: normalizedOutputType,
        model: activeModel,
        requestedModel: model,
        durationMs: Date.now() - requestStartedAt,
        textLength: text.length,
        chargeSource: charge.source,
        referenceCount: normalizedReferences.length,
        referenceTypes,
      });
      return { success: true, chargeSource: charge.source, text };
    } catch (err) {
      console.error('[runAiStudioToolSecure] failed', {
        requestId,
        toolId: normalizedToolId,
        outputType: normalizedOutputType,
        model: activeModel,
        requestedModel: model,
        durationMs: Date.now() - requestStartedAt,
        errorCode: err?.code || 'unknown',
        errorMessage: err?.message || 'unknown',
        errorDetails: err?.details || null,
        referenceCount: normalizedReferences.length,
        referenceTypes,
      });

      if (charge) {
        try {
          await refundAiCredits(charge);
          console.info('[runAiStudioToolSecure] refund success', {
            requestId,
            toolId: normalizedToolId,
            amount: charge.amount,
            chargeSource: charge.source,
          });
        } catch (refundErr) {
          console.error('[runAiStudioToolSecure] refund failed:', refundErr);
          throw new HttpsError(
            'aborted',
            'AI islemi basarisiz oldu. Kredi iadesi tamamlanamadi, lutfen destek ile iletisime gecin.',
            buildAiErrorDetails({
              category: 'credit_refund_failed',
              userMessage: 'Islem basarisiz oldu ancak kredi iadesi tamamlanamadi. Lutfen destek ile iletisime gecin.',
              toolId: normalizedToolId,
              model: activeModel,
              outputType: normalizedOutputType,
            })
          );
        }
      }

      if (err instanceof HttpsError) throw err;
      throw new HttpsError(
        'aborted',
        err?.message || 'AI islemi tamamlanamadi.',
        buildAiErrorDetails({
          category: 'ai_unhandled_error',
          userMessage: 'AI islemi tamamlanamadi. Lutfen tekrar deneyin.',
          toolId: normalizedToolId,
          model: activeModel,
          outputType: normalizedOutputType,
        })
      );
    }
  }
);

exports.runAiRevisionSecure = onCall(
  {
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 420,
    memory: '2GiB',
    region: 'europe-west1',
  },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || '');
    const { baseImagePart, maskImagePart, promptText } = request.data || {};
    const prompt = normalizeText(promptText, 4_000);
    const requestStartedAt = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Revize prompt metni zorunludur.');
    }

    validateImagePart(baseImagePart);
    validateImagePart(maskImagePart);

    const totalImageBase64Length =
      getImagePartBase64Length(baseImagePart) + getImagePartBase64Length(maskImagePart);

    if (totalImageBase64Length > REVISION_TOTAL_BASE64_LIMIT) {
      throw new HttpsError(
        'invalid-argument',
        'Revize gorselleri cok buyuk. Daha kucuk bir gorsel veya daha sade maske deneyin.'
      );
    }

    const model = GEMINI_MODELS.image;
    const fallbackModels = GEMINI_FALLBACK_MODELS.image;

    console.info('[runAiRevisionSecure] start', {
      requestId,
      toolId: 'revise',
      outputType: 'image',
      model,
      uidPrefix: String(uid).slice(0, 8),
      promptLength: prompt.length,
      baseImageMimeType: String(baseImagePart?.inlineData?.mimeType || ''),
      maskImageMimeType: String(maskImagePart?.inlineData?.mimeType || ''),
      baseImageLength: String(baseImagePart?.inlineData?.data || '').length,
      maskImageLength: String(maskImagePart?.inlineData?.data || '').length,
      totalImageBase64Length,
    });

    let charge = null;
    let activeModel = model;

    try {
      charge = await chargeAiCredits({
        uid,
        email,
        amount: REVISION_CREDIT_COST,
        toolId: 'revise',
      });

      const payload = {
        contents: [
          {
            role: 'user',
            parts: buildRevisionParts({ baseImagePart, maskImagePart, prompt }),
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      };

      const geminiResponse = await callGeminiGenerateContent({
        model,
        payload,
        fallbackModels,
        context: {
          toolId: 'revise',
          outputType: 'image',
        },
      });

      const data = geminiResponse.data;
      activeModel = geminiResponse.model;
      const summary = summarizeGeminiPayload(data);

      console.info('[runAiRevisionSecure] gemini response', {
        requestId,
        toolId: 'revise',
        outputType: 'image',
        model: activeModel,
        requestedModel: model,
        durationMs: Date.now() - requestStartedAt,
        candidateCount: summary.candidateCount,
        finishReasons: summary.finishReasons,
        blockReason: summary.blockReason,
        hasImagePart: summary.hasImagePart,
        hasTextPart: summary.hasTextPart,
      });

      const image = extractGeminiImage(data, {
        toolId: 'revise',
        model: activeModel,
        outputType: 'image',
      });

      console.info('[runAiRevisionSecure] success image', {
        requestId,
        toolId: 'revise',
        outputType: 'image',
        model: activeModel,
        requestedModel: model,
        durationMs: Date.now() - requestStartedAt,
        mimeType: image.mimeType,
        chargeSource: charge.source,
      });

      return { success: true, chargeSource: charge.source, ...image };
    } catch (err) {
      console.error('[runAiRevisionSecure] failed', {
        requestId,
        toolId: 'revise',
        outputType: 'image',
        model: activeModel,
        requestedModel: model,
        durationMs: Date.now() - requestStartedAt,
        errorCode: err?.code || 'unknown',
        errorMessage: err?.message || 'unknown',
        errorDetails: err?.details || null,
      });

      if (charge) {
        try {
          await refundAiCredits(charge);
          console.info('[runAiRevisionSecure] refund success', {
            requestId,
            toolId: 'revise',
            amount: charge.amount,
            chargeSource: charge.source,
          });
        } catch (refundErr) {
          console.error('[runAiRevisionSecure] refund failed:', refundErr);
          throw new HttpsError(
            'aborted',
            'Revize islemi basarisiz oldu. Kredi iadesi tamamlanamadi, lutfen destek ile iletisime gecin.',
            buildAiErrorDetails({
              category: 'credit_refund_failed',
              userMessage: 'Revize islemi basarisiz oldu ancak kredi iadesi tamamlanamadi. Lutfen destek ile iletisime gecin.',
              toolId: 'revise',
              model: activeModel,
              outputType: 'image',
            })
          );
        }
      }

      if (err instanceof HttpsError) throw err;
      throw new HttpsError(
        'aborted',
        err?.message || 'Revize islemi tamamlanamadi.',
        buildAiErrorDetails({
          category: 'ai_unhandled_error',
          userMessage: 'Revize islemi tamamlanamadi. Lutfen tekrar deneyin.',
          toolId: 'revise',
          model: activeModel,
          outputType: 'image',
        })
      );
    }
  }
);

exports.generateAiStudioPromptInspirationSecure = onCall(
  {
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 60,
    memory: '1GiB',
    region: 'europe-west1',
  },
  async (request) => {
    const uid = requireAuth(request);
    const { imagePart, style, targetTool } = request.data || {};
    const normalizedTargetTool = (normalizeText(targetTool, 80) || 'img2img').toLowerCase();
    const allowedTargetTools = ['img2img', 'enhance', 'plancolor'];
    const requestStartedAt = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    validateImagePart(imagePart);

    if (!allowedTargetTools.includes(normalizedTargetTool)) {
      throw new HttpsError('invalid-argument', 'Gecersiz prompt hedef araci.');
    }

    const model = GEMINI_MODELS.text;
    const fallbackModels = GEMINI_FALLBACK_MODELS.text;
    const prompt = buildPromptInspirationPrompt({
      targetTool: normalizedTargetTool,
      style: normalizeText(style, 80),
      extraNote: '',
    });

    console.info('[generateAiStudioPromptInspirationSecure] start', {
      requestId,
      toolId: 'prompt-inspiration',
      targetTool: normalizedTargetTool,
      outputType: 'text',
      model,
      uidPrefix: String(uid).slice(0, 8),
      promptLength: prompt.length,
      imageMimeType: String(imagePart?.inlineData?.mimeType || ''),
      imageDataLength: String(imagePart?.inlineData?.data || '').length,
    });

    let activeModel = model;

    try {
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [imagePart, { text: prompt }],
          },
        ],
      };

      const geminiResponse = await callGeminiGenerateContent({
        model,
        payload,
        fallbackModels,
        context: {
          toolId: 'prompt-inspiration',
          outputType: 'text',
        },
      });

      const data = geminiResponse.data;
      activeModel = geminiResponse.model;
      const summary = summarizeGeminiPayload(data);

      console.info('[generateAiStudioPromptInspirationSecure] gemini response', {
        requestId,
        toolId: 'prompt-inspiration',
        targetTool: normalizedTargetTool,
        outputType: 'text',
        model: activeModel,
        requestedModel: model,
        durationMs: Date.now() - requestStartedAt,
        candidateCount: summary.candidateCount,
        finishReasons: summary.finishReasons,
        blockReason: summary.blockReason,
        hasImagePart: summary.hasImagePart,
        hasTextPart: summary.hasTextPart,
      });

      const text = extractGeminiText(data);

      console.info('[generateAiStudioPromptInspirationSecure] success', {
        requestId,
        toolId: 'prompt-inspiration',
        targetTool: normalizedTargetTool,
        outputType: 'text',
        model: activeModel,
        requestedModel: model,
        durationMs: Date.now() - requestStartedAt,
        textLength: text.length,
      });

      return { success: true, text, model: activeModel };
    } catch (err) {
      console.error('[generateAiStudioPromptInspirationSecure] failed', {
        requestId,
        toolId: 'prompt-inspiration',
        targetTool: normalizedTargetTool,
        outputType: 'text',
        model: activeModel,
        requestedModel: model,
        durationMs: Date.now() - requestStartedAt,
        errorCode: err?.code || 'unknown',
        errorMessage: err?.message || 'unknown',
        errorDetails: err?.details || null,
      });

      if (err instanceof HttpsError) throw err;
      throw new HttpsError(
        'aborted',
        'Prompt onerisi olusturulamadi. Lutfen tekrar deneyin.',
        buildAiErrorDetails({
          category: 'prompt_inspiration_failed',
          userMessage: 'Prompt onerisi olusturulamadi. Lutfen tekrar deneyin.',
          toolId: 'prompt-inspiration',
          model: activeModel,
          outputType: 'text',
        })
      );
    }
  }
);
