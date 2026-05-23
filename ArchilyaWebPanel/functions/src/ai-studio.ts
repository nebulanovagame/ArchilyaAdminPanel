import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { z } from "zod";

import { generateFluxPro11, ReplicateServiceError } from "./flux-service";
import { kontextEdit } from "./kontext-service";
import { preprocessPrompt, PromptBridgeError } from "./prompt-bridge";
import { buildScenePrompt, type SceneEditModeId } from "./scene-prompts";

const REGION = "europe-west1";
const AI_STUDIO_JOBS_COLLECTION = "aiStudioJobs";
const USERS_COLLECTION = "users";

// Yeni kredi maliyetleri — Flux Pro ~$0.04, Kontext Pro ~$0.05
const AI_STUDIO_CREDIT_COSTS = {
  analysis: 5,
  img2img: 20,
  enhance: 20,
  sceneedit: 35,
  plancolor: 15,
} as const;

const RATE_LIMIT_USER_PER_MINUTE = 3;
const RATE_LIMIT_USER_WINDOW_MS = 60_000;

interface CreditState {
  credits: number;
}

async function deductCredits(uid: string, amount: number, description: string): Promise<void> {
  const db = getFirestore();
  const userRef = db.collection(USERS_COLLECTION).doc(uid);

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError("resource-exhausted", `Yetersiz kredi. Gerekli: ${amount}, Mevcut: 0`);
    }

    const data = userDoc.data() as CreditState;
    const currentCredits = data.credits ?? 0;

    if (currentCredits < amount) {
      throw new HttpsError("resource-exhausted", `Yetersiz kredi. Gerekli: ${amount}, Mevcut: ${currentCredits}`);
    }

    transaction.update(userRef, {
      credits: currentCredits - amount,
      updatedAt: new Date().toISOString(),
    });

    const txRef = db.collection(USERS_COLLECTION).doc(uid).collection("transactions").doc();
    transaction.set(txRef, {
      type: "deduct",
      amount,
      description,
      balanceAfter: currentCredits - amount,
      createdAt: new Date().toISOString(),
    });
  });
}

async function refundCredits(uid: string, amount: number, description: string): Promise<void> {
  const db = getFirestore();
  const userRef = db.collection(USERS_COLLECTION).doc(uid);

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return;

    const data = userDoc.data() as CreditState;
    const currentCredits = data.credits ?? 0;

    transaction.update(userRef, {
      credits: currentCredits + amount,
      updatedAt: new Date().toISOString(),
    });

    const txRef = db.collection(USERS_COLLECTION).doc(uid).collection("transactions").doc();
    transaction.set(txRef, {
      type: "refund",
      amount,
      description,
      balanceAfter: currentCredits + amount,
      createdAt: new Date().toISOString(),
    });
  });
}

function validateAuth(auth: { uid: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Oturum gerekli.");
  }
  return auth.uid;
}

async function checkRateLimit(uid: string): Promise<void> {
  try {
    const db = getFirestore();
    const now = Timestamp.now();
    const windowStart = Timestamp.fromMillis(now.toMillis() - RATE_LIMIT_USER_WINDOW_MS);

    const userJobsQuery = await db
      .collection(AI_STUDIO_JOBS_COLLECTION)
      .where("userId", "==", uid)
      .where("createdAt", ">=", windowStart)
      .limit(RATE_LIMIT_USER_PER_MINUTE)
      .get();

    if (userJobsQuery.size >= RATE_LIMIT_USER_PER_MINUTE) {
      throw new HttpsError(
        "resource-exhausted",
        `Dakikada en fazla ${RATE_LIMIT_USER_PER_MINUTE} AI işlemi başlatabilirsiniz.`,
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.warn("Rate limit check failed, skipping", { uid, error: String(error) });
  }
}

// Base64 görsel boyutlarını hafifçe parse et (PNG/JPEG)
function getImageDimensions(base64Data: string): { width: number; height: number } | null {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length < 24) return null;

    // PNG signature
    if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // JPEG SOF0 / SOF2 markerları
    for (let i = 0; i < Math.min(buffer.length - 10, 64 * 1024); i += 1) {
      if (buffer[i] === 0xFF && (buffer[i + 1] === 0xC0 || buffer[i + 1] === 0xC2)) {
        const height = buffer.readUInt16BE(i + 5);
        const width = buffer.readUInt16BE(i + 7);
        return { width, height };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function calculateAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  const tolerance = 0.15;

  if (Math.abs(ratio - 1) < tolerance) return "1:1";
  if (Math.abs(ratio - 4 / 3) < tolerance) return "4:3";
  if (Math.abs(ratio - 3 / 4) < tolerance) return "3:4";
  if (Math.abs(ratio - 16 / 9) < tolerance) return "16:9";
  if (Math.abs(ratio - 9 / 16) < tolerance) return "9:16";
  if (Math.abs(ratio - 21 / 9) < tolerance) return "21:9";

  return ratio > 1 ? "16:9" : "9:16";
}

// Görsel base64'ü data URL'e çevir
function inlineDataToDataUrl(data: string, mimeType: string): string {
  const safeMime = mimeType?.includes("/") ? mimeType : "image/jpeg";
  return `data:${safeMime};base64,${data}`;
}

function mapServiceErrorToHttpsError(error: unknown): HttpsError | null {
  if (error instanceof ReplicateServiceError) {
    if (error.code === "missing-api-token" || error.code === "invalid-token" || error.code === "payment-required") {
      return new HttpsError("failed-precondition", error.message);
    }

    if (error.code === "rate-limit") {
      return new HttpsError("resource-exhausted", error.message);
    }

    if (error.code === "network-error" || error.code === "polling-network-error" || error.code === "timeout" || error.code === "max-attempts-exceeded") {
      return new HttpsError("unavailable", error.message);
    }

    return new HttpsError("failed-precondition", error.message);
  }

  if (error instanceof PromptBridgeError) {
    if (error.code === "missing-api-key" || error.code === "invalid-api-key") {
      return new HttpsError("failed-precondition", error.message);
    }

    if (error.code === "rate-limit") {
      return new HttpsError("resource-exhausted", error.message);
    }

    if (error.code === "network-error") {
      return new HttpsError("unavailable", error.message);
    }

    return new HttpsError("invalid-argument", error.message);
  }

  return null;
}

const runAiStudioFluxToolSchema = z.object({
  toolId: z.enum(["analysis", "img2img", "enhance", "sceneedit", "plancolor"]),
  imagePart: z.object({
    inlineData: z.object({
      data: z.string().min(1),
      mimeType: z.string().min(1),
    }),
  }).optional(),
  style: z.string().max(100).optional(),
  sceneEditMode: z.string().max(50).optional(),
  extraNote: z.string().max(5000).optional(),
  generationVariant: z.string().max(50).optional(),
  referenceImages: z.array(z.object({
    type: z.string(),
    label: z.string(),
    note: z.string(),
    imagePart: z.object({
      inlineData: z.object({
        data: z.string(),
        mimeType: z.string(),
      }),
    }),
  })).max(4).optional(),
});

export const runAiStudioFluxTool = onCall(
  {
    region: REGION,
    cors: true,
    invoker: "public",
    maxInstances: 50,
  },
  async (request) => {
    const uid = validateAuth(request.auth);
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Oturum gerekli.");
    }

    let payload: z.infer<typeof runAiStudioFluxToolSchema>;
    try {
      payload = runAiStudioFluxToolSchema.parse(request.data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
        throw new HttpsError("invalid-argument", message);
      }
      throw new HttpsError("invalid-argument", "Geçersiz istek verisi.");
    }

    const { toolId } = payload;
    const creditCost = AI_STUDIO_CREDIT_COSTS[toolId];

    logger.info("AI Studio Flux tool başlatılıyor", { uid, toolId, creditCost });

    await checkRateLimit(uid);

    try {
      await deductCredits(uid, creditCost, `AI Studio — ${toolId}`);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Kredi düşme hatası", { uid, toolId, error });
      throw new HttpsError("internal", "Kredi işlemi başarısız oldu.");
    }

    const db = getFirestore();
    const jobRef = db.collection(AI_STUDIO_JOBS_COLLECTION).doc();
    const jobId = jobRef.id;
    const userJobRef = db.collection(USERS_COLLECTION).doc(uid).collection(AI_STUDIO_JOBS_COLLECTION).doc(jobId);
    const now = Timestamp.now();
    const email = typeof auth.token.email === "string" ? auth.token.email : "";

    // Job document oluştur
    const jobData = {
      uid,
      userId: uid,
      email,
      status: "pending",
      progressMessage: "AI modeli başlatılıyor...",
      toolId,
      toolLabel: toolId,
      outputType: toolId === "analysis" ? "text" : "image",
      style: payload.style || null,
      sceneEditMode: payload.sceneEditMode || null,
      extraNote: payload.extraNote || null,
      generationVariant: payload.generationVariant || "default",
      creditCost,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
      fluxDispatch: true, // Yeni dispatcher ile oluşturuldu
    };

    try {
      await Promise.all([
        jobRef.set(jobData),
        userJobRef.set(jobData),
      ]);
      logger.info("AI Studio Flux job oluşturuldu", { jobId, uid, toolId });
    } catch (error) {
      logger.error("Job oluşturma hatası", { uid, toolId, error });
      await refundCredits(uid, creditCost, `AI Studio — ${toolId} — Oluşturma hatası`);
      throw new HttpsError("internal", "İş oluşturulamadı.");
    }

    // İşlemi başlat
    try {
      await Promise.all([
        jobRef.update({ status: "processing", startedAt: now, progressMessage: "Görsel üretiliyor (~12 saniye)..." }),
        userJobRef.update({ status: "processing", startedAt: now, progressMessage: "Görsel üretiliyor (~12 saniye)..." }),
      ]);

      let resultUrl: string | null = null;
      const resultText: string | null = null;

      const imageDataUrl = payload.imagePart
        ? inlineDataToDataUrl(payload.imagePart.inlineData.data, payload.imagePart.inlineData.mimeType)
        : null;

      if (toolId === "img2img" || toolId === "enhance") {
        // Flux 1.1 Pro — text-to-image / image-to-image
        const englishPrompt = payload.extraNote
          ? await preprocessPrompt(payload.extraNote)
          : toolId === "enhance"
            ? "Enhance this architectural render with better lighting, materials, and detail"
            : "Transform this image with the selected style";

        const styleHint = payload.style ? `${payload.style} style, ` : "";
        const fullPrompt = `${styleHint}${englishPrompt}`;

        // Aspect ratio otomatik algıla
        let aspectRatio = "1:1";
        if (imageDataUrl) {
          const dims = getImageDimensions(payload.imagePart!.inlineData.data);
          if (dims) {
            aspectRatio = calculateAspectRatio(dims.width, dims.height);
            logger.info("Aspect ratio algılandı", { jobId, width: dims.width, height: dims.height, aspectRatio });
          }
        }

        resultUrl = await generateFluxPro11({
          prompt: fullPrompt,
          image: imageDataUrl || undefined,
          aspectRatio,
          outputFormat: "png",
          outputQuality: 90,
        });
      } else if (toolId === "sceneedit") {
        // Flux Kontext Pro — scene editing
        if (!imageDataUrl) {
          throw new HttpsError("invalid-argument", "Scene edit için referans görsel zorunludur.");
        }

        const mode = (payload.sceneEditMode || "scene-compose") as SceneEditModeId;
        const englishInstruction = payload.extraNote
          ? await preprocessPrompt(payload.extraNote, mode)
          : buildScenePrompt({ mode, targetObject: "the scene" });

        resultUrl = await kontextEdit({
          referenceImage: imageDataUrl,
          instruction: englishInstruction,
          mode,
          outputFormat: "png",
          outputQuality: 90,
        });
      } else {
        // analysis, plancolor — şimdilik desteklenmiyor, eski sisteme yönlendir
        throw new HttpsError(
          "unimplemented",
          `"${toolId}" aracı şu anda Flux dispatcher üzerinde desteklenmiyor. Lütfen daha sonra tekrar deneyin.`,
        );
      }

      const completedAt = Timestamp.now();
      const completedPatch = {
        status: "completed",
        completedAt,
        result: {
          imageUrl: resultUrl || "",
          downloadUrl: resultUrl || "",
          text: resultText || "",
          mimeType: resultUrl ? "image/png" : "text/plain",
        },
        downloadUrl: resultUrl || "",
        text: resultText || "",
        mimeType: resultUrl ? "image/png" : "text/plain",
        progressMessage: "Tamamlandı!",
        updatedAt: completedAt,
      };
      await Promise.all([
        jobRef.update(completedPatch),
        userJobRef.update(completedPatch),
      ]);

      // Başarı logu
      await logJobResult(jobId, uid, toolId, "success", { resultUrl, resultText });

      logger.info("AI Studio Flux tool tamamlandı", { jobId, uid, toolId });

      return {
        jobId,
        status: "completed",
        downloadUrl: resultUrl,
        text: resultText,
        mimeType: "image/png",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof HttpsError ? error.code : "internal";

      logger.error("AI Studio Flux tool hatası", { jobId, uid, toolId, error: errorMessage });

      const failedPatch = {
        status: "failed",
        error: {
          code: errorCode,
          message: errorMessage,
        },
        errorCode,
        errorMessage,
        progressMessage: `Hata: ${errorMessage}`,
        updatedAt: Timestamp.now(),
      };
      await Promise.all([
        jobRef.update(failedPatch),
        userJobRef.update(failedPatch),
      ]);

      // Hata logu
      await logJobResult(jobId, uid, toolId, "failed", { error: errorMessage, errorCode });

      // Krediyi iade et
      await refundCredits(uid, creditCost, `AI Studio — ${toolId} — Hata iadesi`);

      if (error instanceof HttpsError) {
        throw error;
      }

      const mappedServiceError = mapServiceErrorToHttpsError(error);
      if (mappedServiceError) {
        throw mappedServiceError;
      }

      throw new HttpsError("internal", `İşlem başarısız: ${errorMessage}`);
    }
  },
);

async function logJobResult(
  jobId: string,
  uid: string,
  toolId: string,
  outcome: "success" | "failed",
  details: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getFirestore();
    const logRef = db.collection("aiStudioJobLogs").doc();
    await logRef.set({
      jobId,
      userId: uid,
      toolId,
      outcome,
      details,
      createdAt: Timestamp.now(),
    });
  } catch (logError) {
    logger.warn("Job log yazma hatası", { jobId, error: String(logError) });
  }
}

export { AI_STUDIO_CREDIT_COSTS };
export type { SceneEditModeId };
