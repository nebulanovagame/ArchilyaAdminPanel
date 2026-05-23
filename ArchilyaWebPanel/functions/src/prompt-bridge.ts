import { logger } from "firebase-functions";

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.0-flash";

// Sabit sistem promptu — Türkçe mimari/İç mekan talimatlarını İngilizce'ye çevirir
const TRANSLATION_SYSTEM_PROMPT = `You are a professional architectural and interior design prompt translator. 
Your task is to translate Turkish user instructions into clear, detailed English prompts suitable for AI image generation models (Flux, Stable Diffusion, etc.).

Rules:
1. Translate the user's intent accurately, not word-for-word
2. Add relevant architectural/interior design context when needed
3. Keep the prompt concise but descriptive (under 200 words)
4. Preserve spatial relationships, materials, and lighting descriptions
5. Output ONLY the translated prompt — no explanations, no quotes

Examples:
- "koltuğu kaldır" → "Remove the sofa and fill the space naturally with the surrounding floor and wall textures"
- "duvar rengini maviye çevir" → "Change the wall color to blue, keeping the same lighting and material finish"
- "oda daha modern olsun" → "Transform the room into a modern style with clean lines, minimal furniture, and neutral tones"
- "parke yerine halı" → "Replace the wooden parquet flooring with a plush carpet, maintaining the same room layout"`;

export interface PromptBridgeOptions {
  instruction: string;
  mode?: "place" | "replace" | "material-swap" | "scene-compose" | "remove" | null;
  targetObject?: string;
  replacement?: string;
  style?: string;
}

export class PromptBridgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "PromptBridgeError";
  }
}

function getGeminiHeaders(): Record<string, string> {
  if (!GEMINI_API_KEY) {
    throw new PromptBridgeError(
      "Gemini API key yapılandırılmamış.",
      "missing-api-key",
    );
  }
  return {
    "Content-Type": "application/json",
  };
}

function isGeminiConfigured() {
  const normalizedKey = GEMINI_API_KEY.trim();
  return Boolean(normalizedKey) && normalizedKey !== "AIzaSy-ROTATE_ME";
}

/**
 * Türkçe talimatı İngilizce'ye çevirir.
 * Gemini API kullanarak mimari/iç mekan bağlamında optimize edilmiş çeviri yapar.
 * 
 * @param turkishInstruction - Kullanıcının Türkçe talimatı
 * @param context - Opsiyonel bağlam bilgisi (oda tipi, stil vb.)
 * @returns İngilizce çevrilmiş prompt
 */
export async function translateToEnglish(
  turkishInstruction: string,
  context?: string,
): Promise<string> {
  if (!turkishInstruction || typeof turkishInstruction !== "string") {
    throw new PromptBridgeError("Çevrilecek talimat boş olamaz.", "empty-instruction");
  }

  const trimmedInstruction = turkishInstruction.trim();
  if (trimmedInstruction.length === 0) {
    throw new PromptBridgeError("Çevrilecek talimat boş olamaz.", "empty-instruction");
  }

  // Eğer zaten İngilizce gibi görünüyorsa (basit heuristic), direkt döndür
  if (isLikelyEnglish(trimmedInstruction)) {
    logger.info("Prompt zaten İngilizce görünüyor, çeviri atlanıyor", { instruction: trimmedInstruction.slice(0, 50) });
    return trimmedInstruction;
  }

  if (!isGeminiConfigured()) {
    logger.warn("Gemini API key yapılandırılmadı; prompt çevirisi atlanıyor", {
      instruction: trimmedInstruction.slice(0, 80),
      hasContext: Boolean(context),
    });
    return trimmedInstruction;
  }

  const userPrompt = context
    ? `Context: ${context}\nInstruction: ${trimmedInstruction}`
    : trimmedInstruction;

  const url = `${GEMINI_API_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const headers = getGeminiHeaders();

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: `${TRANSLATION_SYSTEM_PROMPT}\n\nTranslate this instruction to English:\n${userPrompt}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 512,
      topP: 0.8,
      topK: 40,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (networkError) {
    logger.error("Gemini API ağ hatası", { error: String(networkError) });
    throw new PromptBridgeError(
      "Çeviri servisine bağlanılamadı. Lütfen daha sonra tekrar deneyin.",
      "network-error",
    );
  }

  if (!response.ok) {
    const status = response.status;
    let errorText = "";
    try {
      errorText = await response.text();
    } catch { /* ignore */ }

    logger.error("Gemini API hata yanıtı", { status, body: errorText.slice(0, 500) });

    if (status === 429) {
      throw new PromptBridgeError(
        "Çok fazla çeviri isteği gönderildi. Lütfen biraz bekleyin.",
        "rate-limit",
      );
    }

    if (status === 400 && errorText.includes("API key not valid")) {
      throw new PromptBridgeError(
        "Gemini API key geçersiz.",
        "invalid-api-key",
      );
    }

    throw new PromptBridgeError(
      `Çeviri servisi hatası: ${response.statusText}`,
      "api-error",
    );
  }

  let data: {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
      finishReason?: string;
    }>;
    error?: { message?: string };
  };

  try {
    data = await response.json();
  } catch (parseError) {
    logger.error("Gemini yanıtı parse edilemedi", { error: String(parseError) });
    throw new PromptBridgeError(
      "Çeviri yanıtı işlenemedi.",
      "parse-error",
    );
  }

  if (data.error?.message) {
    logger.error("Gemini API hatası", { error: data.error.message });
    throw new PromptBridgeError(
      `Gemini hatası: ${data.error.message}`,
      "gemini-error",
    );
  }

  const candidate = data.candidates?.[0];
  if (!candidate || candidate.finishReason === "SAFETY") {
    logger.warn("Gemini güvenlik filtresi tetiklendi", { instruction: trimmedInstruction.slice(0, 100) });
    throw new PromptBridgeError(
      "Talimat güvenlik filtreleri tarafından reddedildi.",
      "safety-filter",
    );
  }

  const translatedText = candidate.content?.parts?.[0]?.text?.trim();
  if (!translatedText) {
    logger.error("Gemini boş çeviri döndü", { response: data });
    throw new PromptBridgeError(
      "Çeviri sonucu boş döndü.",
      "empty-translation",
    );
  }

  logger.info("Türkçe → İngilizce çeviri tamamlandı", {
    originalLength: trimmedInstruction.length,
    translatedLength: translatedText.length,
  });

  return translatedText;
}

/**
 * Scene Edit modları için önceden tanımlanmış şablon promptlar.
 * Kullanıcı Türkçe kısa talimat verir, bu fonksiyon İngilizce detaylı prompt üretir.
 * 
 * @param options - Prompt bridge seçenekleri
 * @returns İngilizce detaylı prompt
 */
export async function buildSceneEditPrompt(options: PromptBridgeOptions): Promise<string> {
  const { instruction, mode, targetObject, replacement, style } = options;

  // Eğer mod ve hedef nesne varsa, şablon kullan
  if (mode && targetObject) {
    const templatePrompt = buildTemplatePrompt(mode, targetObject, replacement, style);
    
    // Kullanıcı ek talimat verdiyse, Gemini ile birleştir
    if (instruction && instruction.trim()) {
      const enhancedInstruction = await translateToEnglish(instruction, buildContext(mode, targetObject, style));
      return `${templatePrompt}. Additional details: ${enhancedInstruction}`;
    }
    
    return templatePrompt;
  }

  // Mod yoksa, direkt çeviri yap
  return translateToEnglish(instruction, style ? `Style: ${style}` : undefined);
}

function buildTemplatePrompt(
  mode: NonNullable<PromptBridgeOptions["mode"]>,
  targetObject: string,
  replacement?: string,
  style?: string,
): string {
  const obj = targetObject.trim();
  const repl = replacement?.trim();
  const styleHint = style ? ` in ${style} style` : "";

  switch (mode) {
    case "place":
      return `Add a ${repl || "new element"}${styleHint} to the scene, placing it naturally within the ${obj} area while maintaining consistent lighting, shadows, and perspective`;

    case "replace":
      return `Replace the ${obj} with a ${repl || "different object"}${styleHint}, maintaining exact camera angle, lighting conditions, and environmental context`;

    case "material-swap":
      return `Change the material of the ${obj} to ${repl || "a premium material"}${styleHint}, preserving the original form, proportions, and lighting reflections`;

    case "scene-compose":
      return `Recompose the scene${styleHint} with ${obj} as the focal point, ensuring balanced composition, natural lighting, and spatial harmony`;

    case "remove":
      return `Remove the ${obj} from the scene and seamlessly fill the space with matching floor, wall, and environmental textures, maintaining consistent lighting and perspective`;

    default:
      return `${mode}: ${obj}${repl ? ` → ${repl}` : ""}${styleHint}`;
  }
}

function buildContext(
  mode: string,
  targetObject: string,
  style?: string,
): string {
  const parts = [`Scene edit mode: ${mode}`, `Target: ${targetObject}`];
  if (style) parts.push(`Style: ${style}`);
  return parts.join(", ");
}

export function isLikelyEnglish(text: string): boolean {
  // Basit heuristic: Eğer text'te Türkçe karakterler (ç, ğ, ı, ö, ş, ü) yoksa ve
  // İngilizce yaygın kelimeler varsa, muhtemelen İngilizcedir
  const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
  const normalizedText = String(text || "").trim();
  if (!normalizedText || turkishChars.test(normalizedText)) return false;

  const englishWords = /\b(add|remove|replace|change|transform|make|put|place|create|design|render|enhance|improve|scene|room|living|bedroom|kitchen|bathroom|interior|exterior|architecture|architectural|facade|wall|floor|ceiling|sofa|couch|chair|table|lighting|light|warm|color|blue|green|white|black|wood|stone|concrete|material|style|modern|minimal|minimalist|scandinavian|industrial|brutalist|mediterranean|photorealistic|realistic|luxury|cozy|window|door|garden|terrace|balcony|perspective|composition)\b/i;
  if (englishWords.test(normalizedText)) return true;

  const asciiTurkishWords = /\b(koltuk|koltugu|mavi|yap|sicak|isik|ekle|oda|duvar|zemin|tavan|mutfak|banyo|salon|yatak|masa|sandalye|renk|malzeme|degistir|kaldir|yerlestir|modernlestir|daha|olsun|cevir|ic|mekan|dis|cephe)\b/i;
  if (asciiTurkishWords.test(normalizedText)) return false;

  const asciiWords = normalizedText.match(/[A-Za-z]{3,}/g) || [];
  const totalWords = normalizedText.match(/[\p{L}]{2,}/gu) || [];
  return totalWords.length >= 4 && asciiWords.length / totalWords.length >= 0.8;
}

/**
 * Prompt'u doğrudan çevirir veya şablon kullanarak İngilizce'ye dönüştürür.
 * Bu fonksiyon Flux servisine gitmeden önce preprocessing adımıdır.
 * 
 * @param userPrompt - Kullanıcının Türkçe veya İngilizce promptu
 * @param mode - Opsiyonel scene edit modu
 * @returns İngilizce optimize edilmiş prompt
 */
export async function preprocessPrompt(
  userPrompt: string,
  mode?: PromptBridgeOptions["mode"],
): Promise<string> {
  if (mode) {
    return buildSceneEditPrompt({
      instruction: userPrompt,
      mode,
    });
  }

  return translateToEnglish(userPrompt);
}

export { GEMINI_API_KEY, GEMINI_API_BASE_URL, GEMINI_MODEL };
