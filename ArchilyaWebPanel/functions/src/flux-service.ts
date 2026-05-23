import { logger } from "firebase-functions";

const REPLICATE_API_BASE_URL = process.env.REPLICATE_API_BASE_URL || "https://api.replicate.com/v1";
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "";

const DEFAULT_POLL_INTERVAL_MS = 800;
const DEFAULT_POLL_TIMEOUT_MS = 90_000;

const REPLICATE_RATE_LIMIT_STATUS = 429;
const REPLICATE_AUTH_ERROR_STATUS = 401;

interface ReplicatePredictionResponse {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error?: string;
  logs?: string;
  urls: {
    get: string;
    cancel?: string;
  };
}

export class ReplicateServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly predictionId?: string,
  ) {
    super(message);
    this.name = "ReplicateServiceError";
  }
}

function getReplicateHeaders(): Record<string, string> {
  if (!REPLICATE_API_TOKEN) {
    throw new ReplicateServiceError(
      "Replicate API token yapılandırılmamış.",
      "missing-api-token",
    );
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Token ${REPLICATE_API_TOKEN}`,
    "Prefer": "wait", // async mode
  };
}

async function replicatePost(
  model: string,
  input: Record<string, unknown>,
): Promise<ReplicatePredictionResponse> {
  const url = `${REPLICATE_API_BASE_URL}/predictions`;
  const headers = getReplicateHeaders();

  logger.info("Replicate prediction başlatılıyor", { model, url: url.replace(REPLICATE_API_TOKEN, "***") });

  const body = {
    model,
    input,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (networkError) {
    logger.error("Replicate API ağ hatası", { model, error: String(networkError) });
    throw new ReplicateServiceError(
      "Replicate API'ye bağlanılamadı. Lütfen daha sonra tekrar deneyin.",
      "network-error",
    );
  }

  if (!response.ok) {
    const status = response.status;
    let errorBody: string | Record<string, unknown> = "";
    try {
      errorBody = (await response.json()) as Record<string, unknown>;
    } catch {
      errorBody = await response.text();
    }

    logger.error("Replicate API hata yanıtı", { model, status, body: errorBody });

    if (status === REPLICATE_RATE_LIMIT_STATUS) {
      throw new ReplicateServiceError(
        "Çok fazla istek gönderildi. Lütfen biraz bekleyin.",
        "rate-limit",
        status,
      );
    }

    if (status === REPLICATE_AUTH_ERROR_STATUS) {
      throw new ReplicateServiceError(
        "Replicate API token geçersiz.",
        "invalid-token",
        status,
      );
    }

    if (status === 402 || status === 403) {
      throw new ReplicateServiceError(
        "Replicate kredisi tükendi veya erişim reddedildi.",
        "payment-required",
        status,
      );
    }

    const detail = typeof errorBody === "object" && errorBody !== null
      ? JSON.stringify(errorBody)
      : String(errorBody);
    throw new ReplicateServiceError(
      `Replicate API hatası: ${detail}`,
      "api-error",
      status,
    );
  }

  let data: ReplicatePredictionResponse;
  try {
    data = (await response.json()) as ReplicatePredictionResponse;
  } catch (parseError) {
    logger.error("Replicate API yanıtı parse edilemedi", { model, error: String(parseError) });
    throw new ReplicateServiceError(
      "Replicate API yanıtı işlenemedi.",
      "parse-error",
    );
  }

  if (!data.id || !data.urls?.get) {
    logger.error("Replicate API yanıtında id veya urls eksik", { model, data });
    throw new ReplicateServiceError(
      "Replicate API beklenmeyen yanıt döndü.",
      "invalid-response",
    );
  }

  logger.info("Replicate prediction oluşturuldu", { predictionId: data.id, model, status: data.status });
  return data;
}

async function replicateGetPrediction(
  predictionId: string,
): Promise<ReplicatePredictionResponse> {
  const url = `${REPLICATE_API_BASE_URL}/predictions/${predictionId}`;
  const headers = getReplicateHeaders();

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (networkError) {
    logger.warn("Replicate polling ağ hatası", { predictionId, error: String(networkError) });
    throw new ReplicateServiceError(
      "Replicate sonuç kontrolü başarısız.",
      "polling-network-error",
      undefined,
      predictionId,
    );
  }

  if (!response.ok) {
    const status = response.status;
    let errorText = "";
    try {
      errorText = await response.text();
    } catch { /* ignore */ }

    logger.error("Replicate polling hata yanıtı", { predictionId, status, body: errorText });

    if (status === REPLICATE_RATE_LIMIT_STATUS) {
      throw new ReplicateServiceError(
        "Çok fazla istek gönderildi.",
        "rate-limit",
        status,
        predictionId,
      );
    }

    throw new ReplicateServiceError(
      `Replicate polling hatası: ${response.statusText}`,
      "polling-error",
      status,
      predictionId,
    );
  }

  try {
    return (await response.json()) as ReplicatePredictionResponse;
  } catch (parseError) {
    logger.error("Replicate polling yanıtı parse edilemedi", { predictionId, error: String(parseError) });
    throw new ReplicateServiceError(
      "Replicate polling yanıtı işlenemedi.",
      "polling-parse-error",
      undefined,
      predictionId,
    );
  }
}

interface PollOptions {
  interval?: number;
  timeout?: number;
  maxAttempts?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollReplicateResult(
  predictionId: string,
  options: PollOptions = {},
): Promise<string> {
  const interval = options.interval ?? DEFAULT_POLL_INTERVAL_MS;
  const timeout = options.timeout ?? DEFAULT_POLL_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? Math.ceil(timeout / interval);

  logger.info("Replicate polling başlatıldı", { predictionId, interval, timeout, maxAttempts });

  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeout) {
      logger.error("Replicate polling timeout", { predictionId, elapsed, timeout });
      throw new ReplicateServiceError(
        "İşlem zaman aşımına uğradı. Lütfen daha sonra tekrar deneyin.",
        "timeout",
        undefined,
        predictionId,
      );
    }

    const result = await replicateGetPrediction(predictionId);

    if (result.status === "succeeded") {
      const output = result.output;
      let imageUrl: string | null = null;

      if (typeof output === "string") {
        imageUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        imageUrl = output[0];
      }

      if (!imageUrl) {
        logger.error("Replicate succeeded yanıtında output URL eksik", { predictionId, result });
        throw new ReplicateServiceError(
          "Sonuç hazır ancak görsel URL'si alınamadı.",
          "missing-output-url",
          undefined,
          predictionId,
        );
      }

      logger.info("Replicate polling tamamlandı", { predictionId, attempts: attempt, elapsed });
      return imageUrl;
    }

    if (result.status === "failed") {
      logger.error("Replicate prediction hatası", { predictionId, error: result.error });
      throw new ReplicateServiceError(
        `Görsel üretimi başarısız: ${result.error || "Bilinmeyen hata"}`,
        "prediction-failed",
        undefined,
        predictionId,
      );
    }

    if (result.status === "canceled") {
      logger.warn("Replicate prediction iptal edildi", { predictionId });
      throw new ReplicateServiceError(
        "İşlem iptal edildi.",
        "prediction-canceled",
        undefined,
        predictionId,
      );
    }

    // starting veya processing - devam et
    if (attempt < maxAttempts) {
      await sleep(interval);
    }
  }

  logger.error("Replicate polling max deneme sayısına ulaşıldı", { predictionId, maxAttempts });
  throw new ReplicateServiceError(
    "İşlem zaman aşımına uğradı.",
    "max-attempts-exceeded",
    undefined,
    predictionId,
  );
}

export interface FluxPro11Options {
  prompt: string;
  image?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  promptUpsampling?: boolean;
  seed?: number;
  safetyTolerance?: number;
  outputFormat?: "jpeg" | "png" | "webp";
  outputQuality?: number;
}

const FLUX_11_PRO_MODEL = "black-forest-labs/flux-1.1-pro";

export async function generateFluxPro11(options: FluxPro11Options): Promise<string> {
  const input: Record<string, unknown> = {
    prompt: options.prompt,
    width: options.width ?? 1024,
    height: options.height ?? 1024,
    aspect_ratio: options.aspectRatio ?? "1:1",
    prompt_upsampling: options.promptUpsampling ?? false,
    seed: options.seed ?? Math.floor(Math.random() * 1_000_000),
    safety_tolerance: options.safetyTolerance ?? 2,
    output_format: options.outputFormat ?? "jpeg",
    output_quality: options.outputQuality ?? 80,
  };

  if (options.image) {
    input.image = options.image;
  }

  const prediction = await replicatePost(FLUX_11_PRO_MODEL, input);

  // Eğer prediction zaten succeeded ise (sync mode veya çok hızlı)
  if (prediction.status === "succeeded") {
    const output = prediction.output;
    if (typeof output === "string") return output;
    if (Array.isArray(output) && output.length > 0) return output[0];
  }

  return pollReplicateResult(prediction.id);
}

/**
 * Generic Replicate flux request.
 * Belirtilen model ile prediction oluşturur ve sonucu polling ile bekler.
 */
export async function fluxRequest(
  model: string,
  input: Record<string, unknown>,
): Promise<string> {
  const prediction = await replicatePost(model, input);

  if (prediction.status === "succeeded") {
    const output = prediction.output;
    if (typeof output === "string") return output;
    if (Array.isArray(output) && output.length > 0) return output[0];
  }

  return pollReplicateResult(prediction.id, {
    interval: 800,
    timeout: 90_000,
  });
}

export { REPLICATE_API_BASE_URL, REPLICATE_API_TOKEN, FLUX_11_PRO_MODEL };

// Backward compatibility alias
export { ReplicateServiceError as BFLServiceError };
