import { logger } from "firebase-functions";

export type SceneEditModeId =
  | "remove"
  | "replace"
  | "material-swap"
  | "place"
  | "scene-compose";

interface ScenePromptTemplate {
  id: SceneEditModeId;
  labelTr: string;
  labelEn: string;
  template: string;
  requiresReplacement: boolean;
  defaultPrompt: string;
}

export const SCENE_PROMPT_TEMPLATES: Record<SceneEditModeId, ScenePromptTemplate> = {
  remove: {
    id: "remove",
    labelTr: "Kaldır",
    labelEn: "Remove",
    template: "Remove the {obj} from the scene. Fill the empty space naturally with matching floor, wall, and environmental textures. Maintain consistent lighting, shadows, and perspective throughout.",
    requiresReplacement: false,
    defaultPrompt: "Remove the object and fill the space naturally",
  },
  replace: {
    id: "replace",
    labelTr: "Değiştir",
    labelEn: "Replace",
    template: "Replace the {obj} with {new}. Keep all other elements identical — same camera angle, lighting conditions, room layout, and environmental context. The new object should blend seamlessly.",
    requiresReplacement: true,
    defaultPrompt: "Replace with a different object",
  },
  "material-swap": {
    id: "material-swap",
    labelTr: "Malzeme",
    labelEn: "Material",
    template: "Change the surface material of the {obj} to {mat}. Preserve the exact geometry, proportions, and form. Update material reflections, texture, and finish while keeping the same lighting interaction.",
    requiresReplacement: true,
    defaultPrompt: "Change to a premium material",
  },
  place: {
    id: "place",
    labelTr: "Yerleştir",
    labelEn: "Place",
    template: "Add {obj} at {loc} in the scene. Match the scene's existing lighting direction, shadow intensity, and color temperature. The new element should look naturally integrated.",
    requiresReplacement: true,
    defaultPrompt: "Add a new element to the scene",
  },
  "scene-compose": {
    id: "scene-compose",
    labelTr: "Kompozisyon",
    labelEn: "Composition",
    template: "Recompose the scene with {obj} as the main focal point. {new}. Ensure balanced composition, natural lighting, spatial harmony, and architectural coherence.",
    requiresReplacement: true,
    defaultPrompt: "Recompose with new focal point",
  },
};

interface BuildScenePromptInput {
  mode: SceneEditModeId;
  targetObject: string;
  replacement?: string;
  location?: string;
  style?: string;
  extraNote?: string;
}

/**
 * Scene edit moduna göre İngilizce prompt üretir.
 * 
 * @param input — Mod, hedef nesne, değiştirme/yerleştirme bilgisi
 * @returns Flux/Kontext için optimize edilmiş İngilizce prompt
 * 
 * Örnek:
 * ```ts
 * const prompt = buildScenePrompt({
 *   mode: "remove",
 *   targetObject: "sofa",
 * });
 * // "Remove the sofa from the scene. Fill the empty space naturally..."
 * ```
 */
export function buildScenePrompt(input: BuildScenePromptInput): string {
  const template = SCENE_PROMPT_TEMPLATES[input.mode];
  if (!template) {
    logger.warn("Bilinmeyen scene edit modu, default prompt kullanılıyor", { mode: input.mode });
    return input.extraNote || "Edit the scene as described";
  }

  let prompt = template.template
    .replace(/{obj}/g, input.targetObject.trim())
    .replace(/{new}/g, input.replacement?.trim() || template.defaultPrompt)
    .replace(/{mat}/g, input.replacement?.trim() || template.defaultPrompt)
    .replace(/{loc}/g, input.location?.trim() || "a suitable location");

  // Stil ipucu ekle
  if (input.style?.trim()) {
    prompt += ` Overall style: ${input.style.trim()}.`;
  }

  // Ekstra not ekle
  if (input.extraNote?.trim()) {
    prompt += ` Additional context: ${input.extraNote.trim()}.`;
  }

  return prompt;
}

/**
 * Kullanıcının Türkçe kısa talimatını şablona göre genişletir.
 * 
 * Örnek: "koltuğu kaldır" → mod=remove, targetObject="koltuk" → full prompt
 */
export function parseTurkishInstruction(
  turkishText: string,
  mode: SceneEditModeId,
): BuildScenePromptInput {
  const text = turkishText.trim().toLowerCase();

  // Basit parsing: ilk kelime genellikle eylem, sonrası nesne
  const words = text.split(/\s+/);
  const targetObject = words.slice(1).join(" ") || "the object";

  return {
    mode,
    targetObject,
    extraNote: turkishText,
  };
}

/**
 * Tüm modların TR/EN etiket listesi.
 */
export function getSceneEditModeLabels(): Array<{ id: SceneEditModeId; labelTr: string; labelEn: string }> {
  return Object.values(SCENE_PROMPT_TEMPLATES).map((t) => ({
    id: t.id,
    labelTr: t.labelTr,
    labelEn: t.labelEn,
  }));
}

export type { BuildScenePromptInput, ScenePromptTemplate };
