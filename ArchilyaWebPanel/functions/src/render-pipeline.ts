import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { z } from "zod";

const REGION = "europe-west1";
const AI_STUDIO_JOBS_COLLECTION = "aiStudioJobs";
const USERS_COLLECTION = "users";

const RENDER_PIPELINE_CREDIT_COST = 50;
const DEPTH_ESTIMATION_CREDIT_COST = 10;
const SCENE_CONSISTENCY_CREDIT_COST = 15;

// Rate limits
const RATE_LIMIT_USER_PER_MINUTE = 2;
const RATE_LIMIT_WORKSPACE_PER_HOUR = 20;
const RATE_LIMIT_USER_WINDOW_MS = 60_000;
const RATE_LIMIT_WORKSPACE_WINDOW_MS = 3_600_000;

interface SceneInput {
  id: string;
  label: string;
  imageUrl: string;
}

interface MaterialInput {
  id: string;
  name: string;
  category: string;
}

interface RenderPipelinePayload {
  scenes: SceneInput[];
  materials: MaterialInput[];
  lightPreference?: string;
  moodboardUrls?: string[];
  constraints?: string;
  workspaceId?: string;
}

interface CreditState {
  credits: number;
}

async function deductCredits(uid: string, amount: number, description: string): Promise<void> {
  const db = getFirestore();
  const userRef = db.collection(USERS_COLLECTION).doc(uid);

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      // Kullanıcı yoksa otomatik olarak 0 kredi varsay
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
    if (!userDoc.exists) {
      return;
    }

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

async function checkRateLimit(uid: string, workspaceId?: string): Promise<void> {
  try {
    const db = getFirestore();
    const now = Timestamp.now();

    // Per-user rate limit: 2 per minute
    const userWindowStart = Timestamp.fromMillis(now.toMillis() - RATE_LIMIT_USER_WINDOW_MS);
    const userJobsQuery = await db
      .collection(AI_STUDIO_JOBS_COLLECTION)
      .where("userId", "==", uid)
      .where("createdAt", ">=", userWindowStart)
      .limit(RATE_LIMIT_USER_PER_MINUTE)
      .get();

    if (userJobsQuery.size >= RATE_LIMIT_USER_PER_MINUTE) {
      throw new HttpsError(
        "resource-exhausted",
        `Dakikada en fazla ${RATE_LIMIT_USER_PER_MINUTE} render işlemi başlatabilirsiniz. Lütfen biraz bekleyin.`,
      );
    }

    // Per-workspace rate limit: 20 per hour
    if (workspaceId) {
      const workspaceWindowStart = Timestamp.fromMillis(now.toMillis() - RATE_LIMIT_WORKSPACE_WINDOW_MS);
      const workspaceJobsQuery = await db
        .collection(AI_STUDIO_JOBS_COLLECTION)
        .where("userId", "==", uid)
        .where("workspaceId", "==", workspaceId)
        .where("createdAt", ">=", workspaceWindowStart)
        .limit(RATE_LIMIT_WORKSPACE_PER_HOUR)
        .get();

      if (workspaceJobsQuery.size >= RATE_LIMIT_WORKSPACE_PER_HOUR) {
        throw new HttpsError(
          "resource-exhausted",
          `Workspace başına saatte en fazla ${RATE_LIMIT_WORKSPACE_PER_HOUR} render işlemi başlatabilirsiniz.`,
        );
      }
    }
  } catch (error) {
    // Eğer HttpsError ise re-throw et
    if (error instanceof HttpsError) {
      throw error;
    }
    // Firestore index hatası vb. durumlarda rate limit kontrolünü atla
    logger.warn("Rate limit check failed, skipping", { uid, error: String(error) });
  }
}

const MAX_SCENES = 8;
const MAX_MATERIALS = 12;
const MAX_MOODBOARDS = 6;
const MAX_CONSTRAINT_LENGTH = 5000;

const requestRevisionPayloadSchema = z.object({
  jobId: z.string().min(1),
  stageId: z.number().int().min(1).max(4).optional(),
  feedback: z.string().min(1).max(2000),
  updateConstraints: z.boolean().optional(),
  workspaceId: z.string().optional(),
});

interface RequestRevisionPayload {
  jobId: string;
  stageId?: number;
  feedback: string;
  updateConstraints?: boolean;
  workspaceId?: string;
}

interface RequestRevisionResult {
  jobId: string;
  status: "pending";
  parentJobId: string;
  revisionStageId: number;
}

function validateRenderPipelinePayload(data: unknown): RenderPipelinePayload {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Geçersiz istek verisi.");
  }

  const payload = data as Record<string, unknown>;

  if (!Array.isArray(payload.scenes) || payload.scenes.length === 0) {
    throw new HttpsError("invalid-argument", "En az bir sahne gereklidir.");
  }

  if (payload.scenes.length > MAX_SCENES) {
    throw new HttpsError("invalid-argument", `En fazla ${MAX_SCENES} sahne eklenebilir.`);
  }

  const scenes = payload.scenes.map((scene: unknown, index: number) => {
    if (!scene || typeof scene !== "object") {
      throw new HttpsError("invalid-argument", `Geçersiz sahne verisi: ${index}`);
    }
    const s = scene as Record<string, unknown>;
    if (typeof s.id !== "string" || typeof s.imageUrl !== "string") {
      throw new HttpsError("invalid-argument", `Sahne ${index} için id ve imageUrl zorunludur.`);
    }
    if (s.imageUrl.length > 2048) {
      throw new HttpsError("invalid-argument", `Sahne ${index} imageUrl çok uzun.`);
    }
    return {
      id: s.id,
      label: String(s.label || "").slice(0, 200),
      imageUrl: s.imageUrl,
    };
  });

  const materials = Array.isArray(payload.materials)
    ? payload.materials.slice(0, MAX_MATERIALS).map((mat: unknown, index: number) => {
        if (!mat || typeof mat !== "object") {
          throw new HttpsError("invalid-argument", `Geçersiz malzeme verisi: ${index}`);
        }
        const m = mat as Record<string, unknown>;
        return {
          id: String(m.id || "").slice(0, 128),
          name: String(m.name || "").slice(0, 200),
          category: String(m.category || "").slice(0, 128),
        };
      })
    : [];

  const moodboardUrls = Array.isArray(payload.moodboardUrls)
    ? payload.moodboardUrls.filter((url): url is string => typeof url === "string").slice(0, MAX_MOODBOARDS)
    : [];

  const constraints = String(payload.constraints || "").slice(0, MAX_CONSTRAINT_LENGTH);

  return {
    scenes,
    materials,
    lightPreference: String(payload.lightPreference || ""),
    moodboardUrls,
    constraints,
    workspaceId: typeof payload.workspaceId === "string" ? payload.workspaceId : undefined,
  };
}

export const startRenderPipeline = onCall(
  {
    region: REGION,
    cors: true,
    invoker: "public",
    maxInstances: 50,
  },
  async (request) => {
    const uid = validateAuth(request.auth);
    const payload = validateRenderPipelinePayload(request.data);

    logger.info("Starting render pipeline", { uid, sceneCount: payload.scenes.length });

    await checkRateLimit(uid, payload.workspaceId);

    try {
      await deductCredits(uid, RENDER_PIPELINE_CREDIT_COST, "Archilya Render Pipeline");
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Credit deduction failed", { uid, error });
      throw new HttpsError("internal", "Kredi işlemi başarısız oldu.");
    }

    const db = getFirestore();
    const jobRef = db.collection(AI_STUDIO_JOBS_COLLECTION).doc();
    const jobId = jobRef.id;
    const now = Timestamp.now();

    const jobData = {
      userId: uid,
      workspaceId: payload.workspaceId || null,
      status: "pending",
      progressMessage: "Render pipeline başlatılıyor...",
      toolId: "archilyarender",
      toolLabel: "Archilya Render",
      outputType: "image",
      stage: 1,
      totalStages: 4,
      scenes: payload.scenes,
      materials: payload.materials,
      lightPreference: payload.lightPreference,
      moodboardUrls: payload.moodboardUrls,
      constraints: payload.constraints,
      creditCost: RENDER_PIPELINE_CREDIT_COST,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    };

    try {
      await jobRef.set(jobData);
      logger.info("Render pipeline job created", { jobId, uid });
    } catch (error) {
      logger.error("Failed to create render job", { uid, error });
      await refundCredits(uid, RENDER_PIPELINE_CREDIT_COST, "Archilya Render Pipeline - Oluşturma hatası");
      throw new HttpsError("internal", "İş oluşturulamadı.");
    }

    return { jobId, status: "pending" };
  },
);

export const estimateDepth = onCall(
  {
    region: REGION,
    cors: true,
    invoker: "public",
    maxInstances: 50,
  },
  async (request) => {
    const uid = validateAuth(request.auth);
    const data = request.data as Record<string, unknown>;

    if (typeof data.imageUrl !== "string" || !data.imageUrl) {
      throw new HttpsError("invalid-argument", "imageUrl zorunludur.");
    }

    const imageUrl = data.imageUrl;
    const sceneId = String(data.sceneId || "");

    logger.info("Starting depth estimation", { uid, sceneId });

    await checkRateLimit(uid);

    try {
      await deductCredits(uid, DEPTH_ESTIMATION_CREDIT_COST, "Depth Estimation");
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Credit deduction failed for depth", { uid, error });
      throw new HttpsError("internal", "Kredi işlemi başarısız oldu.");
    }

    const db = getFirestore();
    const jobRef = db.collection(AI_STUDIO_JOBS_COLLECTION).doc();
    const jobId = jobRef.id;
    const now = Timestamp.now();

    const jobData = {
      userId: uid,
      status: "pending",
      progressMessage: "Derinlik haritası oluşturuluyor...",
      toolId: "archilyadepth",
      toolLabel: "Depth Estimation",
      outputType: "image",
      sceneId,
      sourceImageUri: imageUrl,
      creditCost: DEPTH_ESTIMATION_CREDIT_COST,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    };

    try {
      await jobRef.set(jobData);
      logger.info("Depth estimation job created", { jobId, uid });
    } catch (error) {
      logger.error("Failed to create depth job", { uid, error });
      await refundCredits(uid, DEPTH_ESTIMATION_CREDIT_COST, "Depth Estimation - Oluşturma hatası");
      throw new HttpsError("internal", "İş oluşturulamadı.");
    }

    return { jobId, status: "pending" };
  },
);

export const compareScenes = onCall(
  {
    region: REGION,
    cors: true,
    invoker: "public",
    maxInstances: 50,
  },
  async (request) => {
    const uid = validateAuth(request.auth);
    const data = request.data as Record<string, unknown>;

    if (!Array.isArray(data.sceneImageUrls) || data.sceneImageUrls.length < 2) {
      throw new HttpsError("invalid-argument", "En az iki sahne görseli gereklidir.");
    }

    const sceneImageUrls = data.sceneImageUrls.filter((url): url is string => typeof url === "string");
    const sceneIds = Array.isArray(data.sceneIds)
      ? data.sceneIds.filter((id): id is string => typeof id === "string")
      : [];

    if (sceneImageUrls.length < 2) {
      throw new HttpsError("invalid-argument", "En az iki geçerli sahne görseli gereklidir.");
    }

    logger.info("Starting scene consistency comparison", { uid, sceneCount: sceneImageUrls.length });

    await checkRateLimit(uid);

    try {
      await deductCredits(uid, SCENE_CONSISTENCY_CREDIT_COST, "Scene Consistency Check");
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Credit deduction failed for consistency", { uid, error });
      throw new HttpsError("internal", "Kredi işlemi başarısız oldu.");
    }

    const db = getFirestore();
    const jobRef = db.collection(AI_STUDIO_JOBS_COLLECTION).doc();
    const jobId = jobRef.id;
    const now = Timestamp.now();

    const jobData = {
      userId: uid,
      status: "pending",
      progressMessage: "Sahne tutarlılığı analiz ediliyor...",
      toolId: "archilyaconsistency",
      toolLabel: "Scene Consistency",
      outputType: "text",
      sceneImageUrls,
      sceneIds,
      creditCost: SCENE_CONSISTENCY_CREDIT_COST,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    };

    try {
      await jobRef.set(jobData);
      logger.info("Scene consistency job created", { jobId, uid });
    } catch (error) {
      logger.error("Failed to create consistency job", { uid, error });
      await refundCredits(uid, SCENE_CONSISTENCY_CREDIT_COST, "Scene Consistency - Oluşturma hatası");
      throw new HttpsError("internal", "İş oluşturulamadı.");
    }

    return { jobId, status: "pending", sceneCount: sceneImageUrls.length };
  },
);

export const requestRevision = onCall(
  {
    region: REGION,
    cors: true,
    invoker: "public",
    maxInstances: 50,
  },
  async (request) => {
    const uid = validateAuth(request.auth);

    let payload: RequestRevisionPayload;
    try {
      payload = requestRevisionPayloadSchema.parse(request.data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
        throw new HttpsError("invalid-argument", message);
      }
      throw new HttpsError("invalid-argument", "Geçersiz istek verisi.");
    }

    const db = getFirestore();
    const parentJobRef = db.collection(AI_STUDIO_JOBS_COLLECTION).doc(payload.jobId);

    let parentJobDoc;
    try {
      parentJobDoc = await parentJobRef.get();
    } catch (error) {
      logger.error("Failed to read parent job", { uid, jobId: payload.jobId, error });
      throw new HttpsError("internal", "İş bilgisi okunamadı.");
    }

    if (!parentJobDoc.exists) {
      throw new HttpsError("not-found", "İş bulunamadı.");
    }

    const parentJobData = parentJobDoc.data()!;
    if (parentJobData.userId !== uid) {
      throw new HttpsError("permission-denied", "Bu işe erişim yetkiniz yok.");
    }

    if (parentJobData.status !== "completed") {
      throw new HttpsError("failed-precondition", "Revizyon yalnızca tamamlanmış işler için istenebilir.");
    }

    await checkRateLimit(uid, parentJobData.workspaceId || payload.workspaceId);

    const revisionJobRef = db.collection(AI_STUDIO_JOBS_COLLECTION).doc();
    const revisionJobId = revisionJobRef.id;
    const revisionStageId = payload.stageId ?? 1;
    const now = Timestamp.now();

    const revisionJobData = {
      userId: uid,
      workspaceId: parentJobData.workspaceId || null,
      parentJobId: payload.jobId,
      revisionOf: payload.jobId,
      revisionFeedback: payload.feedback,
      revisionStageId,
      status: "pending",
      progressMessage: "Revizyon render pipeline başlatılıyor...",
      stage: revisionStageId,
      totalStages: parentJobData.totalStages ?? 4,
      toolId: "archilyarender-revision",
      toolLabel: "Archilya Render Revision",
      outputType: "image",
      scenes: parentJobData.scenes,
      materials: parentJobData.materials ?? [],
      lightPreference: parentJobData.lightPreference,
      moodboardUrls: parentJobData.moodboardUrls ?? [],
      constraints: parentJobData.constraints,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    };

    try {
      await revisionJobRef.set(revisionJobData);
      await parentJobRef.update({
        latestRevisionJobId: revisionJobId,
        latestRevisionStageId: revisionStageId,
        latestRevisionFeedback: payload.feedback,
        updatedAt: now,
      });
      logger.info("Revision job created", { revisionJobId, uid, parentJobId: payload.jobId });
    } catch (error) {
      logger.error("Failed to create revision job", { uid, error });
      throw new HttpsError("internal", "Revizyon işi oluşturulamadı.");
    }

    return {
      jobId: revisionJobId,
      status: "pending",
      parentJobId: payload.jobId,
      revisionStageId,
    } as RequestRevisionResult;
  },
);

export { RENDER_PIPELINE_CREDIT_COST, DEPTH_ESTIMATION_CREDIT_COST, SCENE_CONSISTENCY_CREDIT_COST };
