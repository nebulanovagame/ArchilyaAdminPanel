"use client";

import { createClient } from "@/lib/supabase/client";

async function getAccessToken() {
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error("Oturum açmanız gerekiyor.");
  }
  return session.access_token;
}

function getBackendBaseUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
}

async function callBackendAiCallable<TPayload, TResult>(
  callableName: string,
  payload: TPayload,
  timeoutMs = 120_000,
): Promise<{ data: TResult }> {
  const accessToken = await getAccessToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getBackendBaseUrl()}/call/${callableName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
      signal: controller.signal,
    });

    const result = (await response.json().catch(() => null)) as {
      data?: TResult;
      result?: TResult;
      error?: { message?: string };
    } | null;

    if (!response.ok || result?.error) {
      throw new Error(result?.error?.message || `AI servisi başarısız oldu: ${callableName}`);
    }

    return { data: (result?.data ?? result?.result) as TResult };
  } finally {
    clearTimeout(timeoutId);
  }
}

const AI_TEXT_TIMEOUT_MS = 120_000;
const AI_PLAN_COLOR_TIMEOUT_MS = 520_000;

const MAX_PROXY_IMAGE_BYTES = 6 * 1024 * 1024;
const TARGET_PROXY_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PROXY_BASE64_LENGTH = 8_500_000;
const MAX_INPUT_LONG_EDGE = 2048;
const PDF_RENDER_LONG_EDGE = 2200;
const LONG_EDGE_STEPS = [MAX_INPUT_LONG_EDGE, 1792, 1536, 1280];
const PHOTO_QUALITY_STEPS = [0.92, 0.86, 0.8, 0.74, 0.68];
const PLAN_WEBP_QUALITY_STEPS = [0.96, 0.9, 0.84, 0.78];
const MAX_OPTIMIZATION_LONG_EDGE_STEPS = 3;
const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PDF_MIME_TYPE = "application/pdf";

const SCENE_EDIT_REFERENCE_TYPES = ["object", "material", "style"];
const SCENE_EDIT_MODES = ["place", "replace", "material-swap", "scene-compose", "remove"];
const SCENE_EDIT_MAX_REFERENCES = 4;
const SCENE_EDIT_TOTAL_BASE64_LENGTH = 7_200_000;

const SCENE_PRIMARY_IMAGE_OPTIONS = {
  profile: "photo",
  targetBytes: 2_400_000,
  maxBytes: 3_000_000,
  maxLongEdge: 2048,
  maxBase64Length: 4_200_000,
};

const SCENE_REFERENCE_IMAGE_OPTIONS = {
  profile: "photo",
  targetBytes: 1_300_000,
  maxBytes: 2_000_000,
  maxLongEdge: 1536,
  maxBase64Length: 2_900_000,
};

let pdfJsLoadPromise: Promise<unknown> | null = null;

type InlineImagePart = {
  inlineData: {
    data: string;
    mimeType: string;
  };
};

type SceneReferenceInput = {
  type: string;
  label?: string;
  note?: string;
  file?: File | null;
  url?: string;
};

type QueueAiStudioJobInput = {
  toolId: "analysis" | "img2img" | "enhance" | "sceneedit" | "plancolor";
  imageFile?: File | null;
  imageUrl?: string | null;
  style?: string;
  extraNote?: string;
  sceneEditMode?: string;
  generationVariant?: string;
  references?: SceneReferenceInput[];
};

type CreateAiStudioJobResult = {
  jobId: string;
};

type CreateAiStudioJobCallableResult = {
  jobId?: string;
  historyId?: string;
  id?: string;
};

export function normalizeMimeType(mimeType: string) {
  const value = String(mimeType || "").toLowerCase();
  return SUPPORTED_MIME_TYPES.includes(value) ? value : "image/jpeg";
}

export function isSupportedMimeType(mimeType: string) {
  return SUPPORTED_MIME_TYPES.includes(String(mimeType || "").toLowerCase());
}

function normalizeImageProfile(profile?: string) {
  return profile === "plan" ? "plan" : "photo";
}

function normalizePositiveInteger(value: unknown, fallbackValue: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function normalizeSceneReferenceType(type: string) {
  const normalized = String(type || "").trim().toLowerCase();
  return SCENE_EDIT_REFERENCE_TYPES.includes(normalized) ? normalized : "object";
}

function normalizeSceneEditMode(mode: string) {
  const normalized = String(mode || "").trim().toLowerCase();
  return SCENE_EDIT_MODES.includes(normalized) ? normalized : "scene-compose";
}

function safeDecodeUri(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isPdfSource(blob: Blob, sourceRef = "") {
  const mimeType = String(blob?.type || "").toLowerCase();
  if (mimeType === PDF_MIME_TYPE) {
    return true;
  }

  const normalizedRef = safeDecodeUri(String(sourceRef || "")).toLowerCase();
  return /(?:\.pdf)(?:$|[?#&])/i.test(normalizedRef);
}

async function loadPdfJs() {
  if (!pdfJsLoadPromise) {
    pdfJsLoadPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfJsModule, workerModule]) => {
      const workerSrc = (workerModule as { default?: string }).default || workerModule;
      const pdfJs = (pdfJsModule as { default?: Record<string, unknown> }).default || pdfJsModule;
      const globalWorkerOptions = (pdfJs as { GlobalWorkerOptions?: { workerSrc?: string } }).GlobalWorkerOptions;
      if (globalWorkerOptions) {
        globalWorkerOptions.workerSrc = workerSrc as string;
      }
      return pdfJs;
    });
  }

  return pdfJsLoadPromise;
}

async function fileToBase64(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

async function loadImageFromBlob(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Görsel okunamadı."));
    };
    image.src = objectUrl;
  });
}

function buildLongEdgeSteps(sourceWidth: number, sourceHeight: number, maxLongEdge = MAX_INPUT_LONG_EDGE) {
  const longestEdge = Math.max(Number(sourceWidth || 0), Number(sourceHeight || 0));
  const normalizedMaxLongEdge = normalizePositiveInteger(maxLongEdge, MAX_INPUT_LONG_EDGE);
  if (!longestEdge) {
    return [normalizedMaxLongEdge];
  }

  const firstStep = Math.min(normalizedMaxLongEdge, Math.round(longestEdge));
  const steps = [firstStep, ...LONG_EDGE_STEPS.filter((edge) => edge < firstStep)];
  return [...new Set(steps)];
}

function getTargetDimensions(sourceWidth: number, sourceHeight: number, targetLongEdge: number) {
  const width = Math.max(1, Math.round(Number(sourceWidth || 1)));
  const height = Math.max(1, Math.round(Number(sourceHeight || 1)));
  const longestEdge = Math.max(width, height);

  if (longestEdge <= targetLongEdge) {
    return { width, height };
  }

  const scale = targetLongEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function createResizedCanvas(image: HTMLImageElement, targetLongEdge: number) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const { width, height } = getTargetDimensions(sourceWidth, sourceHeight, targetLongEdge);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("Görsel yeniden boyutlandırılamadı."));
        return;
      }
      resolve(result);
    }, mimeType, quality);
  });
}

async function renderPdfFirstPageToBlob(pdfBlob: Blob, options: { profile?: string; maxLongEdge?: number } = {}) {
  // TODO: Move this pdf.js rasterization into a Web Worker. It is CPU-heavy, but
  // wiring pdf.js worker output back through canvas safely is more involved than
  // the data URL decode fix and should be handled separately.
  const profile = normalizeImageProfile(options.profile);
  const maxLongEdge = normalizePositiveInteger(options.maxLongEdge, PDF_RENDER_LONG_EDGE);
  const pdfJs = (await loadPdfJs()) as {
    getDocument: (input: { data: ArrayBuffer }) => {
      promise: Promise<{ getPage: (pageNumber: number) => Promise<{ getViewport: (input: { scale: number }) => { width: number; height: number }; render: (input: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> }; cleanup?: () => void }>; destroy?: () => Promise<void> }>; destroy?: () => Promise<void>;
    };
  };
  const buffer = await pdfBlob.arrayBuffer();
  const loadingTask = pdfJs.getDocument({ data: buffer });

  let pdfDoc: { getPage: (pageNumber: number) => Promise<{ getViewport: (input: { scale: number }) => { width: number; height: number }; render: (input: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> }; cleanup?: () => void }>; destroy?: () => Promise<void> } | null = null;
  let firstPage: { getViewport: (input: { scale: number }) => { width: number; height: number }; render: (input: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> }; cleanup?: () => void } | null = null;

  try {
    pdfDoc = await loadingTask.promise;
    firstPage = await pdfDoc.getPage(1);

    const baseViewport = firstPage.getViewport({ scale: 1 });
    const longestEdge = Math.max(baseViewport.width, baseViewport.height) || 1;
    const scale = maxLongEdge / longestEdge;
    const viewport = firstPage.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("PDF ilk sayfasi gorsele cevrilemedi.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await firstPage.render({ canvasContext: context, viewport }).promise;

    const mimeType = profile === "plan" ? "image/png" : "image/webp";
    const quality = profile === "plan" ? undefined : 0.92;
    return await canvasToBlob(canvas, mimeType, quality);
  } catch {
    throw new Error("PDF dosyasi okunamadi. Lutfen farkli bir PDF deneyin.");
  } finally {
    try {
      firstPage?.cleanup?.();
    } catch {}

    try {
      await pdfDoc?.destroy?.();
    } catch {}

    try {
      await loadingTask.destroy?.();
    } catch {}
  }
}

function buildOptimizationLongEdgeSteps(sourceWidth: number, sourceHeight: number, maxLongEdge: number) {
  return buildLongEdgeSteps(sourceWidth, sourceHeight, maxLongEdge).slice(0, MAX_OPTIMIZATION_LONG_EDGE_STEPS);
}

function buildOptimizationEncodeVariants(profile: string) {
  if (profile === "plan") {
    return [
      { mimeType: "image/png" },
      { mimeType: "image/webp", quality: PLAN_WEBP_QUALITY_STEPS[1] },
      { mimeType: "image/webp", quality: PLAN_WEBP_QUALITY_STEPS[2] },
    ] satisfies Array<{ mimeType: string; quality?: number }>;
  }

  return [
    { mimeType: "image/webp", quality: PHOTO_QUALITY_STEPS[1] },
    { mimeType: "image/webp", quality: PHOTO_QUALITY_STEPS[3] },
    { mimeType: "image/jpeg", quality: PHOTO_QUALITY_STEPS[2] },
  ] satisfies Array<{ mimeType: string; quality?: number }>;
}

async function optimizeImageBlob(blob: Blob, options: { profile?: string; targetBytes?: number; maxLongEdge?: number } = {}) {
  try {
    const profile = normalizeImageProfile(options.profile);
    const targetBytes = normalizePositiveInteger(options.targetBytes, TARGET_PROXY_IMAGE_BYTES);
    const maxLongEdge = normalizePositiveInteger(options.maxLongEdge, MAX_INPUT_LONG_EDGE);
    const image = await loadImageFromBlob(blob);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const longEdgeSteps = buildOptimizationLongEdgeSteps(sourceWidth, sourceHeight, maxLongEdge);
    const encodeVariants = buildOptimizationEncodeVariants(profile);
    let bestBlob = blob;

    for (const longEdge of longEdgeSteps) {
      const canvas = createResizedCanvas(image, longEdge);
      if (!canvas) continue;

      for (const variant of encodeVariants) {
        const candidateBlob = await canvasToBlob(canvas, variant.mimeType, variant.quality);

        if (candidateBlob.size < bestBlob.size) {
          bestBlob = candidateBlob;
        }

        if (candidateBlob.size <= targetBytes) {
          return candidateBlob;
        }
      }
    }

    return bestBlob;
  } catch {
    return blob;
  }
}

async function urlToBlob(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Proje görseli indirilemedi. Lütfen farklı bir dosya seçin.");
  }
  return await response.blob();
}

async function prepareImagePart(imageFile?: File | null, imageUrl?: string | null, options: { profile?: string; maxBytes?: number; maxBase64Length?: number; targetBytes?: number; maxLongEdge?: number } = {}) {
  const maxBytes = normalizePositiveInteger(options.maxBytes, MAX_PROXY_IMAGE_BYTES);
  const maxBase64Length = normalizePositiveInteger(options.maxBase64Length, MAX_PROXY_BASE64_LENGTH);
  const maxMbLabel = (maxBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
  const sourceRef = imageFile?.name || imageUrl || "";
  let sourceBlob: Blob | null = null;

  if (imageFile) {
    sourceBlob = imageFile;
  } else if (imageUrl) {
    sourceBlob = await urlToBlob(imageUrl);
  }

  if (!sourceBlob) {
    return null;
  }

  let workingBlob = sourceBlob;
  if (isPdfSource(sourceBlob, sourceRef)) {
    workingBlob = await renderPdfFirstPageToBlob(sourceBlob, options);
  }

  const optimizedBlob = await optimizeImageBlob(workingBlob, options);
  const hasSupportedResultMime = isSupportedMimeType(optimizedBlob.type) || isSupportedMimeType(workingBlob.type);
  if (!hasSupportedResultMime) {
    throw new Error("Desteklenmeyen format. Lütfen JPG, PNG, WEBP veya PDF kullanın.");
  }

  if (optimizedBlob.size > maxBytes) {
    throw new Error(`Görsel otomatik optimize edildi ancak hala ${maxMbLabel} MB sınırını aşıyor. Lütfen daha küçük bir dosya seçin.`);
  }

  const data = await fileToBase64(optimizedBlob);
  if (String(data).length > maxBase64Length) {
    throw new Error("Görsel optimize edildi ancak aktarım limiti aşıldı. Lütfen daha düşük çözünürlükte bir dosya deneyin.");
  }

  return {
    inlineData: {
      data,
      mimeType: normalizeMimeType(optimizedBlob.type || workingBlob.type),
    },
  } satisfies InlineImagePart;
}

async function generateText(imagePart: InlineImagePart, toolId: string, extraNote = "") {
  const result = await callBackendAiCallable<
    { toolId: string; imagePart: InlineImagePart; extraNote: string },
    { text?: string }
  >("runAiStudioToolSecure", {
    toolId,
    imagePart,
    extraNote: String(extraNote || "").trim(),
  }, AI_TEXT_TIMEOUT_MS);

  return result.data?.text || "";
}

async function callCreateAiStudioJob(payload: Record<string, unknown>, path = "/api/ai-studio/jobs") {
  return postAiStudioJobRoute(payload, path);
}

async function postAiStudioJobRoute(payload: Record<string, unknown>, path = "/api/ai-studio/jobs") {
  const accessToken = await getAccessToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, accessToken }),
  });

  const data = (await response.json().catch(() => null)) as { error?: string; result?: CreateAiStudioJobCallableResult } | null;
  if (!response.ok) {
    throw new Error(data?.error || "AI işi kuyruğa alınamadı.");
  }

  return data?.result;
}

export async function queueAiStudioJob({
  toolId,
  imageFile,
  imageUrl,
  style = "modern",
  extraNote = "",
  sceneEditMode = "scene-compose",
  generationVariant = "default",
  references = [],
}: QueueAiStudioJobInput): Promise<CreateAiStudioJobResult> {
  const normalizedExtraNote = String(extraNote || "").trim();
  const normalizedStyle = String(style || "modern").trim() || "modern";
  const normalizedGenerationVariant = String(generationVariant || "default").trim() || "default";

  let imagePart: InlineImagePart | null = null;
  let workflow = "";
  const referenceImages: Array<{ type: string; label: string; note: string; imagePart: InlineImagePart }> = [];

  if (toolId === "analysis") {
    imagePart = await prepareImagePart(imageFile, imageUrl);
    if (!imagePart) throw new Error("Analiz için görsel zorunludur.");
  } else if (toolId === "img2img") {
    imagePart = await prepareImagePart(imageFile, imageUrl);
    if (!imagePart) throw new Error("Stil dönüşümü için görsel zorunludur.");
  } else if (toolId === "enhance") {
    imagePart = await prepareImagePart(imageFile, imageUrl);
    if (!imagePart) throw new Error("Render iyileştirme için görsel zorunludur.");
  } else if (toolId === "plancolor") {
    imagePart = await prepareImagePart(imageFile, imageUrl, { profile: "plan" });
    if (!imagePart) throw new Error("Plan boyama için görsel zorunludur.");
  } else {
    imagePart = await prepareImagePart(imageFile, imageUrl, SCENE_PRIMARY_IMAGE_OPTIONS);
    if (!imagePart) throw new Error("Sahne düzenleme için ana sahne görseli zorunludur.");

    const normalizedInput = Array.isArray(references) ? references.slice(0, SCENE_EDIT_MAX_REFERENCES) : [];
    if (!normalizedInput.length) {
      throw new Error("Sahne düzenleme için en az bir referans görsel ekleyin.");
    }

    for (let i = 0; i < normalizedInput.length; i += 1) {
      const reference = normalizeSceneReference(normalizedInput[i], i);
      const referenceImagePart = await prepareImagePart(reference.file || null, reference.url || "", SCENE_REFERENCE_IMAGE_OPTIONS);

      if (!referenceImagePart) {
        throw new Error(`Referans #${i + 1} için görsel seçin.`);
      }

      referenceImages.push({
        type: reference.type,
        label: reference.label,
        note: reference.note,
        imagePart: referenceImagePart,
      });
    }

    const totalInlineLength = countTotalInlineLength(imagePart, referenceImages);
    if (totalInlineLength > SCENE_EDIT_TOTAL_BASE64_LENGTH) {
      throw new Error("Toplam referans görselleri çok büyük. Daha az referans ekleyin veya görselleri küçültün.");
    }

    workflow = normalizeSceneEditMode(sceneEditMode);
  }

  const isFluxTool = ["img2img", "enhance", "sceneedit"].includes(toolId);
  const path = isFluxTool ? "/api/ai-studio/flux-job" : "/api/ai-studio/jobs";

  const result = await callCreateAiStudioJob({
    toolId,
    imagePart,
    style: toolId === "img2img" || toolId === "plancolor" ? normalizedStyle : "",
    sceneEditMode: toolId === "sceneedit" ? workflow : "",
    extraNote: normalizedExtraNote,
    generationVariant: normalizedGenerationVariant,
    imageUrls: imageUrl ? [String(imageUrl).trim()].filter(Boolean) : [],
    referenceImages,
  }, path);

  const jobId = String(result?.jobId || result?.historyId || result?.id || "").trim();
  if (!jobId) {
    throw new Error("AI işi oluşturuldu ancak geçerli bir jobId dönmedi.");
  }

  return { jobId };
}

export async function analyzeArchitectural(imageFile?: File | null, imageUrl?: string | null, extraNote = "") {
  const imagePart = await prepareImagePart(imageFile, imageUrl);
  if (!imagePart) throw new Error("Analiz için görsel zorunludur.");

  return generateText(imagePart, "analysis", extraNote);
}

export async function transformStyle(imageFile?: File | null, imageUrl?: string | null, style = "modern", extraNote = "") {
  const imagePart = await prepareImagePart(imageFile, imageUrl);
  if (!imagePart) throw new Error("Stil dönüşümü için görsel zorunludur.");

  const result = await postAiStudioJobRoute({
    toolId: "img2img",
    imagePart,
    style: String(style || "modern").trim() || "modern",
    extraNote: String(extraNote || "").trim(),
  }, "/api/ai-studio/flux-job");

  const data = result as { downloadUrl?: string; mimeType?: string } | undefined;
  if (!data?.downloadUrl) throw new Error("Model görsel üretemedi.");
  return { dataUrl: data.downloadUrl, mimeType: data.mimeType || "image/png" };
}

export async function generateEnhancedRender(imageFile?: File | null, imageUrl?: string | null, extraNote = "") {
  const imagePart = await prepareImagePart(imageFile, imageUrl);
  if (!imagePart) throw new Error("Render iyileştirme için görsel zorunludur.");

  const result = await postAiStudioJobRoute({
    toolId: "enhance",
    imagePart,
    extraNote: String(extraNote || "").trim(),
  }, "/api/ai-studio/flux-job");

  const data = result as { downloadUrl?: string; mimeType?: string } | undefined;
  if (!data?.downloadUrl) throw new Error("Model görsel üretemedi.");
  return { dataUrl: data.downloadUrl, mimeType: data.mimeType || "image/png" };
}

export async function colorFloorPlan(imageFile?: File | null, imageUrl?: string | null, style = "modern", extraNote = "") {
  const imagePart = await prepareImagePart(imageFile, imageUrl, { profile: "plan" });
  if (!imagePart) throw new Error("Plan boyama için görsel zorunludur.");

  const result = await callBackendAiCallable<
    { toolId: string; imagePart: InlineImagePart; style: string; extraNote: string },
    { downloadUrl?: string; mimeType?: string }
  >("runAiStudioToolSecure", {
    toolId: "plancolor",
    imagePart,
    style: String(style || "modern").trim() || "modern",
    extraNote: String(extraNote || "").trim(),
  }, AI_PLAN_COLOR_TIMEOUT_MS);

  const data = result.data;
  if (!data?.downloadUrl) throw new Error("Model görsel üretemedi.");
  return { dataUrl: data.downloadUrl, mimeType: data.mimeType || "image/png" };
}

function normalizeSceneReference(input: SceneReferenceInput, index: number) {
  if (!input || typeof input !== "object") {
    throw new Error(`Referans #${index + 1} geçersiz.`);
  }

  return {
    type: normalizeSceneReferenceType(input.type),
    label: String(input.label || "").trim().slice(0, 120),
    note: String(input.note || "").trim().slice(0, 500),
    file: input.file || null,
    url: String(input.url || "").trim(),
  };
}

function countTotalInlineLength(primaryImagePart: InlineImagePart, references: Array<{ imagePart: InlineImagePart }>) {
  const primaryLength = String(primaryImagePart?.inlineData?.data || "").length;
  return primaryLength + references.reduce((total, reference) => total + String(reference?.imagePart?.inlineData?.data || "").length, 0);
}

export async function editSceneWithReferences({
  primaryImageFile,
  primaryImageUrl,
  references = [],
  editMode = "scene-compose",
  extraNote = "",
}: {
  primaryImageFile?: File | null;
  primaryImageUrl?: string | null;
  references?: SceneReferenceInput[];
  editMode?: string;
  extraNote?: string;
}) {
  const primaryImagePart = await prepareImagePart(primaryImageFile, primaryImageUrl, SCENE_PRIMARY_IMAGE_OPTIONS);
  if (!primaryImagePart) throw new Error("Sahne düzenleme için ana sahne görseli zorunludur.");

  const normalizedInput = Array.isArray(references) ? references.slice(0, SCENE_EDIT_MAX_REFERENCES) : [];
  if (!normalizedInput.length) {
    throw new Error("Sahne düzenleme için en az bir referans görsel ekleyin.");
  }

  const preparedReferences: Array<{ type: string; label: string; note: string; imagePart: InlineImagePart }> = [];
  for (let i = 0; i < normalizedInput.length; i += 1) {
    const reference = normalizeSceneReference(normalizedInput[i], i);
    const referenceImagePart = await prepareImagePart(reference.file || null, reference.url || "", SCENE_REFERENCE_IMAGE_OPTIONS);

    if (!referenceImagePart) {
      throw new Error(`Referans #${i + 1} için görsel seçin.`);
    }

    preparedReferences.push({
      type: reference.type,
      label: reference.label,
      note: reference.note,
      imagePart: referenceImagePart,
    });
  }

  const totalInlineLength = countTotalInlineLength(primaryImagePart, preparedReferences);
  if (totalInlineLength > SCENE_EDIT_TOTAL_BASE64_LENGTH) {
    throw new Error("Toplam referans görselleri çok büyük. Daha az referans ekleyin veya görselleri küçültün.");
  }

  const result = await postAiStudioJobRoute({
    toolId: "sceneedit",
    imagePart: primaryImagePart,
    referenceImages: preparedReferences,
    sceneEditMode: normalizeSceneEditMode(editMode),
    extraNote: String(extraNote || "").trim(),
  }, "/api/ai-studio/flux-job");

  const data = result as { downloadUrl?: string; mimeType?: string } | undefined;
  if (!data?.downloadUrl) throw new Error("Model sahne düzenleme çıktısı üretemedi.");
  return { dataUrl: data.downloadUrl, mimeType: data.mimeType || "image/png" };
}

export async function generatePromptInspiration({
  imageFile,
  imageUrl,
  style = "modern",
  targetTool = "img2img",
}: {
  imageFile?: File | null;
  imageUrl?: string | null;
  style?: string;
  targetTool?: string;
}): Promise<{ text: string }> {
  const imagePart = await prepareImagePart(imageFile, imageUrl);
  if (!imagePart) throw new Error("Görsel analizi için görsel zorunludur.");

  const result = await callBackendAiCallable<
    { imagePart: InlineImagePart; style: string; targetTool: string },
    { text?: string }
  >("generateAiStudioPromptInspirationSecure", {
    imagePart,
    style: String(style || "modern").trim() || "modern",
    targetTool: String(targetTool || "img2img").trim() || "img2img",
  }, 60_000);

  const data = result.data;
  if (!data?.text) throw new Error("Prompt oluşturulamadı.");
  return { text: data.text };
}
