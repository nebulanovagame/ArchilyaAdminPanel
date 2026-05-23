import { fluxRequest, ReplicateServiceError } from "./flux-service";
import { logger } from "firebase-functions";

export type SceneEditMode =
  | "place"
  | "replace"
  | "material-swap"
  | "scene-compose"
  | "remove";

export interface KontextEditOptions {
  referenceImage: string;
  instruction: string;
  mode?: SceneEditMode;
  aspectRatio?: string;
  seed?: number;
  safetyTolerance?: number;
  outputFormat?: "jpeg" | "png" | "webp";
  outputQuality?: number;
}

const FLUX_KONTEXT_PRO_MODEL = "black-forest-labs/flux-kontext-pro";

function validateKontextInput(options: KontextEditOptions): void {
  if (!options.referenceImage || typeof options.referenceImage !== "string") {
    throw new ReplicateServiceError(
      "Referans görsel zorunludur.",
      "missing-reference-image",
    );
  }

  if (!options.instruction || typeof options.instruction !== "string") {
    throw new ReplicateServiceError(
      "Edit talimatı zorunludur.",
      "missing-instruction",
    );
  }

  if (options.referenceImage.length > 10_000_000) {
    throw new ReplicateServiceError(
      "Referans görsel çok büyük. Maksimum 10MB base64 kabul edilir.",
      "image-too-large",
    );
  }
}

/**
 * Flux Kontext Pro ile referans görsel üzerinde düzenleme yapar.
 * 
 * @param options - Edit seçenekleri (referans görsel, talimat, mod vb.)
 * @returns Üretilen görselin URL'si
 * 
 * Örnek kullanım:
 * ```ts
 * const imageUrl = await kontextEdit({
 *   referenceImage: "https://ornek.com/sahne.jpg",
 *   instruction: "Add a modern sofa to the living room",
 *   mode: "place",
 * });
 * ```
 */
export async function kontextEdit(options: KontextEditOptions): Promise<string> {
  validateKontextInput(options);

  const body: Record<string, unknown> = {
    prompt: options.instruction,
    input_image: options.referenceImage,
    aspect_ratio: options.aspectRatio ?? "1:1",
    seed: options.seed ?? Math.floor(Math.random() * 1_000_000),
    safety_tolerance: options.safetyTolerance ?? 2,
    output_format: options.outputFormat ?? "png",
  };

  logger.info("Flux Kontext Pro edit başlatılıyor", {
    mode: options.mode,
    hasReferenceImage: !!options.referenceImage,
    instructionLength: options.instruction.length,
  });

  try {
    const resultUrl = await fluxRequest(FLUX_KONTEXT_PRO_MODEL, body);
    logger.info("Flux Kontext Pro edit tamamlandı", { mode: options.mode });
    return resultUrl;
  } catch (error) {
    logger.error("Flux Kontext Pro edit hatası", { mode: options.mode, error: String(error) });
    throw error;
  }
}

/**
 * Çoklu referans görsel ile Kontext Pro edit.
 * Ana referans + ek referans görselleri birlikte gönderilir.
 * 
 * @param options - Edit seçenekleri
 * @param extraReferences - Ek referans görselleri (URL veya base64)
 * @returns Üretilen görselin URL'si
 */
export async function kontextEditMultiReference(
  options: KontextEditOptions,
  extraReferences: string[],
): Promise<string> {
  validateKontextInput(options);

  if (!Array.isArray(extraReferences) || extraReferences.length === 0) {
    return kontextEdit(options);
  }

  const body: Record<string, unknown> = {
    prompt: options.instruction,
    input_image: options.referenceImage,
    aspect_ratio: options.aspectRatio ?? "1:1",
    seed: options.seed ?? Math.floor(Math.random() * 1_000_000),
    safety_tolerance: options.safetyTolerance ?? 2,
    output_format: options.outputFormat ?? "png",
  };

  // Ek referansları ekle (max 3 ek)
  const limitedExtras = extraReferences.slice(0, 3);
  limitedExtras.forEach((ref, index) => {
    body[`input_image_${index + 2}`] = ref;
  });

  logger.info("Flux Kontext Pro multi-reference edit başlatılıyor", {
    mode: options.mode,
    referenceCount: 1 + limitedExtras.length,
  });

  try {
    const resultUrl = await fluxRequest(FLUX_KONTEXT_PRO_MODEL, body);
    logger.info("Flux Kontext Pro multi-reference edit tamamlandı", { mode: options.mode });
    return resultUrl;
  } catch (error) {
    logger.error("Flux Kontext Pro multi-reference edit hatası", {
      mode: options.mode,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Scene Edit moduna göre önceden tanımlanmış şablonları kullanarak edit yapar.
 * 
 * @param referenceImage - Referans görsel URL veya base64
 * @param mode - Scene edit modu
 * @param targetObject - Hedef nesne (örn: "koltuk", "masa")
 * @param replacement - Yeni nesne veya materyal (mode'a göre)
 * @returns Üretilen görselin URL'si
 */
export async function kontextSceneEdit(
  referenceImage: string,
  mode: SceneEditMode,
  targetObject: string,
  replacement?: string,
): Promise<string> {
  const instruction = buildSceneEditInstruction(mode, targetObject, replacement);

  return kontextEdit({
    referenceImage,
    instruction,
    mode,
  });
}

function buildSceneEditInstruction(
  mode: SceneEditMode,
  targetObject: string,
  replacement?: string,
): string {
  const obj = targetObject.trim();
  const repl = replacement?.trim();

  switch (mode) {
    case "place":
      return `Add a ${repl || "new object"} to the scene, placing it naturally in the ${obj} area`;
    
    case "replace":
      return `Replace the ${obj} with a ${repl || "different object"}, maintaining the same perspective and lighting`;
    
    case "material-swap":
      return `Change the material of the ${obj} to ${repl || "a different material"}, keeping the same shape and lighting`;
    
    case "scene-compose":
      return `Recompose the scene with ${obj} as the main focus, ${repl || "maintaining natural lighting and perspective"}`;
    
    case "remove":
      return `Remove the ${obj} from the scene and fill the space naturally with the surrounding environment`;
    
    default:
      return `${mode}: ${obj}${repl ? ` → ${repl}` : ""}`;
  }
}

export { buildSceneEditInstruction, FLUX_KONTEXT_PRO_MODEL };
