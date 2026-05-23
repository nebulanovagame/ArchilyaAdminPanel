import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { app } from '../config/firebase';
import { captureException } from './errorTracking';
import { isPdfFile, renderPdfFirstPageToImage } from './pdfService';

type ImageManipulatorAction = NonNullable<Parameters<typeof ImageManipulator.manipulateAsync>[1]>[number];

type OutputType = 'text' | 'image';
type ToolId = 'analysis' | 'img2img' | 'enhance' | 'plancolor' | 'sceneedit';
type StyleId = 'photorealistic' | 'modern' | 'scandinavian' | 'brutalist' | 'mediterranean' | 'industrial' | 'sketch' | 'futuristic';
type SceneWorkflow = 'place' | 'replace' | 'material-swap' | 'scene-compose' | 'remove';
type SceneReferenceType = 'object' | 'material' | 'style';

type ToolConfig = {
  outputType: OutputType;
  credits: number;
};

type SelectOption<TId extends string = string> = {
  id: TId;
  label: string;
};

export type AiStudioToolOption = SelectOption<string> & {
  cost: number;
  outputType: OutputType;
  requiresStyle: boolean;
  supportsSceneReferences: boolean;
};

export type SceneReference = {
  uri: string;
  mimeType?: string | null;
  type?: string | null;
  label?: string | null;
  note?: string | null;
};

type ImagePart = {
  inlineData: {
    data: string;
    mimeType: string;
  };
};

type PreparedSceneReference = {
  type: SceneReferenceType;
  label: string;
  note: string;
  imagePart: ImagePart;
};

type PromptByToolParams = {
  toolId: ToolId;
  style?: string | null;
  extraNote?: string | null;
  workflow?: string | null;
  references: PreparedSceneReference[];
};

type SceneEditPromptParams = {
  workflow?: string | null;
  references: PreparedSceneReference[];
  extraNote?: string | null;
};

type AiStudioCallablePayload = {
  toolId: ToolId;
  imagePart: ImagePart;
  promptText: string;
  outputType: OutputType;
  referenceImages?: PreparedSceneReference[];
  workflow?: SceneWorkflow;
};

type AiStudioCallableResponse = {
  success?: boolean;
  text?: string;
  dataUrl?: string;
  mimeType?: string;
  chargeSource?: string | null;
};

export type RunAiStudioToolParams = {
  toolId: string;
  sourceImageUri: string;
  sourceImageMimeType?: string | null;
  style?: string | null;
  extraNote?: string | null;
  workflow?: string | null;
  references?: SceneReference[];
};

export type AiStudioTextResult = {
  outputType: 'text';
  text: string;
  chargeSource: string | null;
};

export type AiStudioImageResult = {
  outputType: 'image';
  dataUrl: string;
  mimeType: string;
  chargeSource: string | null;
};

export type AiStudioResult = AiStudioTextResult | AiStudioImageResult;

const functions = getFunctions(app, 'europe-west1');
const runAiStudioToolSecureCallable: HttpsCallable<AiStudioCallablePayload, AiStudioCallableResponse> = httpsCallable(
  functions,
  'runAiStudioToolSecure',
  { timeout: 540000 }
);

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_BASE64_LENGTH = 8_500_000;
const MAX_SCENE_REFERENCES = 4;
const AI_IMAGE_TRANSFORM_STEPS: Array<{ actions: ImageManipulatorAction[]; compress: number }> = [
  { actions: [], compress: 0.84 },
  { actions: [{ resize: { width: 1600 } }], compress: 0.82 },
  { actions: [{ resize: { width: 1280 } }], compress: 0.78 },
  { actions: [{ resize: { width: 1024 } }], compress: 0.74 },
];

const ARCHILYA_PREMIUM_VISUAL_CORE = [
  'Editorial architectural photography quality.',
  'Competition-grade architectural visualization.',
  'Hyper-realistic boutique CGI studio standard.',
  'Refined V-Ray / Corona render aesthetic.',
  'Precise physically based materials with believable roughness, reflectance and depth.',
  'Cinematic architectural lighting with natural falloff and atmospheric realism.',
  'Photorealistic natural lighting, never synthetic or plastic.',
  'Strictly avoid generic AI look, plastic textures, malformed geometry, floating objects, warped details, oversharpening, oversaturation, random clutter, text overlays and watermarks.',
  'Prioritize architectural authorship, material dignity, restrained sophistication, spatial clarity and publication-ready visual polish.',
].join('\n');

const STYLE_PROMPTS: Record<StyleId, string> = {
  photorealistic:
    'photorealistic architectural visualization, studio CGI quality, accurate materials, sharp shadows and global illumination',
  modern:
    'contemporary modern architecture, clean concrete and glass facade, minimal ornamentation and balanced neutral palette',
  scandinavian:
    'Scandinavian architecture, warm timber cladding, large windows, soft northern light and calm natural atmosphere',
  brutalist:
    'brutalist architecture, raw exposed concrete, heavy geometric massing, dramatic shadows and monochrome mood',
  mediterranean:
    'Mediterranean architecture, white plaster walls, terracotta tiles, arched openings and warm daylight',
  industrial:
    'industrial architecture, red brick facade, steel details, moody overcast light and urban material language',
  sketch:
    'architectural sketch style, clean ink contour lines, cross-hatching shadows and hand-drawn presentation look',
  futuristic:
    'futuristic parametric architecture, fluid forms, metallic surfaces and cinematic sci-fi atmosphere',
};

const PLAN_STYLE_PROMPTS: Record<StyleId, string> = {
  photorealistic:
    'premium floor plan board with realistic top-down materials, clean hierarchy and high readability',
  modern:
    'minimal contemporary floor plan presentation, light materials, soft neutral palette and balanced composition',
  scandinavian:
    'Scandinavian floor plan presentation, bright base tones, pale wood textures and airy visual language',
  brutalist:
    'brutalist floor plan presentation, concrete textures, monochrome contrast and strong legibility hierarchy',
  mediterranean:
    'Mediterranean floor plan presentation, terracotta and travertine inspired textures with warm color accents',
  industrial:
    'industrial floor plan presentation, weathered textures, steel accents and urban neutral palette',
  sketch:
    'architectural floor plan with clean contour lines and controlled watercolor style room fills',
  futuristic:
    'futuristic floor plan presentation, crisp contrast, subtle cyan accents and polished material appearance',
};

const TOOL_CONFIG: Record<ToolId, ToolConfig> = {
  analysis: { outputType: 'text', credits: 5 },
  img2img: { outputType: 'image', credits: 15 },
  enhance: { outputType: 'image', credits: 15 },
  plancolor: { outputType: 'image', credits: 15 },
  sceneedit: { outputType: 'image', credits: 25 },
};

const SCENE_EDIT_WORKFLOW_SET: ReadonlySet<string> = new Set(['place', 'replace', 'material-swap', 'scene-compose', 'remove']);
const SCENE_REFERENCE_TYPE_SET: ReadonlySet<string> = new Set(['object', 'material', 'style']);

export const AI_STYLE_OPTIONS: Array<SelectOption<StyleId>> = [
  { id: 'photorealistic', label: 'Fotorealistik' },
  { id: 'modern', label: 'Modern' },
  { id: 'scandinavian', label: 'Iskandinav' },
  { id: 'brutalist', label: 'Brutalist' },
  { id: 'mediterranean', label: 'Akdeniz' },
  { id: 'industrial', label: 'Endustriyel' },
  { id: 'sketch', label: 'Mimari Eskiz' },
  { id: 'futuristic', label: 'Futuristik' },
];

export const AI_SCENE_EDIT_MODES: Array<SelectOption<SceneWorkflow>> = [
  { id: 'place', label: 'Obje Yerlestir' },
  { id: 'replace', label: 'Obje Degistir' },
  { id: 'material-swap', label: 'Malzeme Degistir' },
  { id: 'scene-compose', label: 'Sahne Kompozisyonu' },
  { id: 'remove', label: 'Nesne Kaldir' },
];

export const AI_SCENE_REFERENCE_TYPES: Array<SelectOption<SceneReferenceType>> = [
  { id: 'object', label: 'Obje Referansi' },
  { id: 'material', label: 'Malzeme Referansi' },
  { id: 'style', label: 'Stil Referansi' },
];

export const AI_STUDIO_TOOLS: AiStudioToolOption[] = [
  {
    id: 'analysis',
    label: 'Mimari Rapor',
    cost: TOOL_CONFIG.analysis.credits,
    outputType: TOOL_CONFIG.analysis.outputType,
    requiresStyle: false,
    supportsSceneReferences: false,
  },
  {
    id: 'img2img',
    label: 'Stil Donusumu',
    cost: TOOL_CONFIG.img2img.credits,
    outputType: TOOL_CONFIG.img2img.outputType,
    requiresStyle: true,
    supportsSceneReferences: false,
  },
  {
    id: 'enhance',
    label: 'Render Iyilestirme',
    cost: TOOL_CONFIG.enhance.credits,
    outputType: TOOL_CONFIG.enhance.outputType,
    requiresStyle: false,
    supportsSceneReferences: false,
  },
  {
    id: 'plancolor',
    label: 'Plan Boyama',
    cost: TOOL_CONFIG.plancolor.credits,
    outputType: TOOL_CONFIG.plancolor.outputType,
    requiresStyle: true,
    supportsSceneReferences: false,
  },
  {
    id: 'sceneedit',
    label: 'Sahne Duzenleme',
    cost: TOOL_CONFIG.sceneedit.credits,
    outputType: TOOL_CONFIG.sceneedit.outputType,
    requiresStyle: false,
    supportsSceneReferences: true,
  },
];

export const AI_TOOL_PRESETS: Record<ToolId, string[]> = {
  analysis: [
    'Cephe kompozisyonunu, malzeme kararlarini ve render kalitesini profesyonel olarak degerlendir.',
    'Mimari dili ve kutle etkisini analiz et; iyilestirme onerileri ver.',
    'Tasariyi uygulanabilirlik, maliyet ve sunum acisindan yorumla.',
  ],
  img2img: [
    'Mimari geometrileri koru, modern beton-cam malzeme dili uygula.',
    'Mevcut kompozisyonu koru, isik ve atmosferi gun batimi tonlarina cek.',
    'Ayni yapinin daha premium ve fotorealistik bir versiyonunu uret.',
  ],
  enhance: [
    'Renderi yarismaya hazir seviyeye cek, malzeme detaylarini netlestir.',
    'Ayni kompozisyonu koru, global illumination ve edge detaylarini guclendir.',
    'Cinematic color grading ile daha derin ve premium bir goruntu olustur.',
  ],
  plancolor: [
    'Plani portfolyo sunumu icin okunabilir ve premium bir sekilde boya.',
    'Mekan hiyerarsisini koruyarak top-down malzeme dokulari ekle.',
    'Mimari plani modern bir sunum paftasi kalitesine tası.',
  ],
  sceneedit: [
    'Referans objeyi sahneye dogal olcek ve perspektifle yerlestir.',
    'Malzeme referansina gore tum cephe kaplamalarini guncelle.',
    'Sahneyi referans stiline yaklastir, ana geometriyi koru.',
  ],
};

function normalizeText(value: unknown, maxLen = 4000): string {
  return String(value || '').trim().slice(0, maxLen);
}

export function normalizeStyle(style: unknown): StyleId {
  const value = normalizeText(style, 80).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(STYLE_PROMPTS, value)) {
    return value as StyleId;
  }
  return 'modern';
}

export function normalizeSceneWorkflow(workflow: unknown): SceneWorkflow {
  const value = normalizeText(workflow, 80).toLowerCase();
  return SCENE_EDIT_WORKFLOW_SET.has(value) ? (value as SceneWorkflow) : 'scene-compose';
}

function normalizeSceneReferenceType(type: unknown): SceneReferenceType {
  const value = normalizeText(type, 80).toLowerCase();
  return SCENE_REFERENCE_TYPE_SET.has(value) ? (value as SceneReferenceType) : 'object';
}

export function normalizeMimeType(rawMimeType: unknown): string {
  const value = String(rawMimeType || '').trim().toLowerCase();
  if (value === 'image/jpg') {
    return 'image/jpeg';
  }
  return value;
}

function inferMimeTypeFromUri(uri = ''): string {
  const value = String(uri || '').toLowerCase();
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

function isRemoteUri(uri: string): boolean {
  return /^https?:\/\//i.test(String(uri || '').trim());
}

function isDataUri(uri: string): boolean {
  return String(uri || '').trim().startsWith('data:');
}

function estimateBase64Bytes(base64: string): number {
  const text = String(base64 || '').trim();
  if (!text) return 0;
  return Math.floor((text.length * 3) / 4);
}

function buildTempFilePath(extension = 'jpg'): string {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Gecici dosya alani bulunamadi.');
  }

  const ext = String(extension || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  return `${cacheDir}ai-input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

function inferExtensionFromUri(uri = '', fallback = 'jpg'): string {
  const value = String(uri || '').split('?')[0].trim().toLowerCase();
  const match = value.match(/\.([a-z0-9]{2,5})$/i);
  return (match?.[1] || fallback).toLowerCase();
}

function isContentUri(uri: string): boolean {
  return /^content:\/\//i.test(String(uri || '').trim());
}

function isPhotoLibraryUri(uri: string): boolean {
  return /^ph:\/\//i.test(String(uri || '').trim());
}

async function copyLocalUriToCache(uri: string, extensionHint = 'jpg'): Promise<string> {
  const targetPath = buildTempFilePath(extensionHint);
  await FileSystem.copyAsync({ from: uri, to: targetPath });
  return targetPath;
}

async function downloadRemoteImageToCache(uri: string): Promise<string> {
  const extension = uri.split('.').pop() || 'jpg';
  const targetPath = buildTempFilePath(extension);
  const result = await FileSystem.downloadAsync(uri, targetPath);

  if (Number(result?.status || 0) >= 400) {
    throw new Error('Uzak gorsel indirilemedi. Baglantinizi kontrol edin.');
  }

  return result.uri;
}

function parseDataUri(uri: string, mimeTypeHint?: string | null): ImagePart {
  const value = String(uri || '').trim();
  const match = value.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) {
    throw new Error('Gecersiz data URL formati.');
  }

  const mimeType = ensureSupportedMimeType(match[1] || mimeTypeHint || 'image/jpeg');
  const base64 = String(match[2] || '').trim();
  if (!base64) {
    throw new Error('Data URL icinde gorsel verisi bulunamadi.');
  }

  if (base64.length > MAX_BASE64_LENGTH || estimateBase64Bytes(base64) > MAX_IMAGE_BYTES) {
    throw new Error('Gorsel cok buyuk. Daha kucuk bir gorsel secin.');
  }

  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
}

function ensureSupportedMimeType(rawMimeType: unknown): string {
  const mimeType = normalizeMimeType(rawMimeType);
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new Error('Desteklenmeyen gorsel formati. Sadece JPG, PNG ve WEBP kullanin.');
  }
  return mimeType;
}

async function readBase64WithFallback(uri: string): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      scope: 'mobile_ai_image_read',
      operation: 'read_base64_initial',
      uri_type: isDataUri(uri) ? 'data' : isRemoteUri(uri) ? 'remote' : 'local',
    });
    if (isContentUri(uri) || isPhotoLibraryUri(uri)) {
      const cachedUri = await copyLocalUriToCache(uri, inferExtensionFromUri(uri));
      try {
        return await FileSystem.readAsStringAsync(cachedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } finally {
        FileSystem.deleteAsync(cachedUri, { idempotent: true }).catch(() => null);
      }
    }

    throw new Error('Gorsel verisi okunamadi.');
  }
}

async function transformImageToBase64(localUri: string): Promise<{ base64: string; mimeType: string }> {
  let lastError: Error | null = null;

  for (let i = 0; i < AI_IMAGE_TRANSFORM_STEPS.length; i += 1) {
    const step = AI_IMAGE_TRANSFORM_STEPS[i];

    try {
      const transformed = await ImageManipulator.manipulateAsync(localUri, step.actions, {
        compress: step.compress,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });

      const base64 = String(transformed?.base64 || '').trim();
      if (!base64) {
        throw new Error('Gorsel donusumu tamamlandi ancak base64 olusmadi.');
      }

      const estimatedBytes = estimateBase64Bytes(base64);
      if (base64.length <= MAX_BASE64_LENGTH && estimatedBytes <= MAX_IMAGE_BYTES) {
        return {
          base64,
          mimeType: 'image/jpeg',
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      captureException(lastError, {
        scope: 'mobile_ai_image_transform',
        step_index: String(i),
        compress: String(step.compress),
        has_resize: String(step.actions.some((a) => 'resize' in (a as object))),
      });
    }
  }

  const fallbackBase64 = String((await readBase64WithFallback(localUri)) || '').trim();
  if (!fallbackBase64) {
    throw lastError || new Error('Gorsel base64 formatina donusturulemedi.');
  }

  const fallbackBytes = estimateBase64Bytes(fallbackBase64);
  if (fallbackBase64.length > MAX_BASE64_LENGTH || fallbackBytes > MAX_IMAGE_BYTES) {
    throw new Error('Gorsel cok buyuk. Daha kucuk bir gorsel secin.');
  }

  return {
    base64: fallbackBase64,
    mimeType: 'image/jpeg',
  };
}

async function buildImagePartFromUri(uri: string, mimeTypeHint?: string | null): Promise<ImagePart> {
  if (!uri) {
    throw new Error('Gorsel secimi zorunludur.');
  }

  const trimmedUri = String(uri || '').trim();
  if (isPdfFile(trimmedUri, mimeTypeHint)) {
    const rendered = await renderPdfFirstPageToImage(trimmedUri);
    return await buildImagePartFromUri(rendered.uri, 'image/png');
  }

  if (isDataUri(trimmedUri)) {
    return parseDataUri(trimmedUri, mimeTypeHint);
  }

  let localUri = trimmedUri;
  const cleanupUris: string[] = [];

  try {
    if (isRemoteUri(trimmedUri)) {
      localUri = await downloadRemoteImageToCache(trimmedUri);
      cleanupUris.push(localUri);
    } else if (isContentUri(trimmedUri) || isPhotoLibraryUri(trimmedUri)) {
      localUri = await copyLocalUriToCache(trimmedUri, inferExtensionFromUri(trimmedUri));
      cleanupUris.push(localUri);
    }

    const transformed = await transformImageToBase64(localUri);
    const normalizedHint = normalizeMimeType(mimeTypeHint || inferMimeTypeFromUri(trimmedUri));
    const mimeType = ensureSupportedMimeType(transformed.mimeType || normalizedHint || 'image/jpeg');

    return {
      inlineData: {
        data: transformed.base64,
        mimeType,
      },
    };
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      scope: 'mobile_ai_image_prepare',
      source_uri_category: isDataUri(trimmedUri) ? 'data' : isRemoteUri(trimmedUri) ? 'remote' : isContentUri(trimmedUri) ? 'content' : isPhotoLibraryUri(trimmedUri) ? 'photo_library' : 'local',
      mime_hint: mimeTypeHint || 'none',
    });
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('network request failed')) {
      throw new Error('Gorsel okunamadi. Internet baglantisini ve dosya erisimini kontrol edin.');
    }
    throw error;
  } finally {
    await Promise.all(cleanupUris.map((cleanupUri) => FileSystem.deleteAsync(cleanupUri, { idempotent: true }).catch(() => null)));
  }
}

function buildAnalysisPrompt(extraNote?: string | null): string {
  const userNote = normalizeText(extraNote, 1200);
  const noteSection = userNote
    ? `\n\nKullanici Notu: "${userNote}"\nBu notu raporun ilgili bolumlerine stratejik bicimde yedir; ayri ve yapay bir ek paragraf gibi kullanma.`
    : '';

  return `Sen Archilya'nin en kidemli mimari tasarim direktoru ve gorsellestirme danismanisin. Sana verilen mimari gorseli; tasarim niteligi, temsil gucu, malzeme karakteri, mekansal anlati ve musteri/yatirimci ikna potansiyeli acisindan degerlendir.${noteSection}

Bu ciktiyi siradan bir AI analizi gibi degil, ust segment bir mimarlik ofisinin ic sunum / konsept degerlendirme raporu gibi yaz.
Dil seviyen: akademik olarak guclu, profesyonel olarak ikna edici, gereksiz suslu degil, elit ama anlasilir ve sunuma hazir olsun.

Temel yaklasim:
- Genel kliselerden kesinlikle kacin.
- Yorumlarini yalnizca gorseldeki gercek mimari verilere dayandir.
- Tasarim niyeti, kutle organizasyonu, cephe karakteri ve atmosfer uretimini birlikte oku.
- Degerlendirmeyi hem estetik hem de sunum/satis etkisi acisindan kur.
- Gerektiginde elestirel ol, ancak dilin daima gelistirici ve profesyonel olsun.

Raporu su basliklarla uret:

**Genel Degerlendirme ve Tasarim Izlenimi:**
Yapinin ilk bakista olusturdugu etkiyi, temsil ettigi yasam/marka dilini ve genel tasarim olgunlugunu degerlendir.

**Render ve Sunum Puani (100 uzerinden):**
Tek bir puan ver. Ardindan puanin gerekcesini kompozisyon, isik kalitesi, malzeme okunurlugu, atmosfer ve profesyonel sunum seviyesi uzerinden 2-4 cumleyle acikla.

**Mimari Dil, Tipoloji ve Kimlik:**
Yapinin ait oldugu mimari yaklasimi, cagdas referanslarini ve kimlik tutarliligini degerlendir.

**Kutle, Oran ve Cephe Organizasyonu:**
Kutle kompozisyonu, dolu-bos dengesi, aciklik duzeni, ritim, cati/sacak/cerceve kararlarini analiz et.

**Malzeme Paleti ve Yuzey Karakteri:**
Malzemeleri yalnizca isimlendirme; kalite algisi, dokusal derinlik, yaslanma potansiyeli ve premium etkisini yorumla.

**Isik, Atmosfer ve Gorsel Anlati:**
Isik rejiminin mekani nasil tanimladigini, atmosferin ikna gucunu ve gorsel hikaye kalitesini degerlendir.

**Musteri / Yatirimci Etkisi:**
Bu gorselin hedef kullanici veya yatirimci algisinda nasil bir deger urettigini kisa ve net belirt.

**Gelistirme Onerileri:**
3-5 adet somut, uygulanabilir ve profesyonel oneriler ver. Her oneride, neden kaliteyi yukseltecegini acikla.

**Sunum Stratejisi ve Sonraki Adim:**
Bir sonraki sunum turu icin kamera dili, isik zamani, peyzaj seviyesi, entourage yogunlugu ve render estetik yonunu kisaca yonlendir.

Kurallar:
- Maksimum 450 kelime.
- Tamami Turkce olsun.
- Butun metin birinci sinif mimarlik ofisi tutarliliginda olsun.`;
}

function buildStyleTransferPrompt(style?: string | null, extraNote?: string | null): string {
  const stylePrompt = STYLE_PROMPTS[normalizeStyle(style)] || STYLE_PROMPTS.modern;
  const noteText = normalizeText(extraNote, 1200);
  const noteSection = noteText ? `\nAdditional art-direction requirements: ${noteText}.` : '';

  return `You are the visual director of a boutique architectural CGI studio specialized in premium residential, hospitality and developer-grade imagery.

${ARCHILYA_PREMIUM_VISUAL_CORE}

PRIMARY OBJECTIVE:
Re-style the image without redesigning the building.

STRICT PRESERVATION RULES:
- Preserve the exact geometry, massing, proportions, floor count, openings, camera position and composition.
- Do not alter architectural concept, silhouette or structural logic.
- Change only materials, surface character, facade treatment, palette, mood, landscape styling and lighting atmosphere.
- Keep all edits architecturally credible and physically plausible.

ART DIRECTION TARGET:
${stylePrompt}${noteSection}

QUALITY TARGET:
- Luxury publication-ready architectural image.
- Sophisticated and restrained premium visual language.
- Elegant editorial composition, never flashy catalog style.
- Tactile materials: mineral matte concrete, natural timber grain, believable low-iron glass, refined metal accents.
- Light must reveal depth and form, not flatten surfaces.

NEGATIVE CONSTRAINTS:
- No generic AI luxury styling.
- No warped windows, melted edges, floating objects, duplicated vegetation, distorted furniture, excessive glow or fake reflections.
- No text overlays, labels, logos or watermark.

Return one single transformed image only.`;
}

function buildEnhancePrompt(extraNote?: string | null): string {
  const noteText = normalizeText(extraNote, 1200);
  const noteSection = noteText ? `\nSPECIAL FOCUS:\n${noteText}\n` : '';

  return `You are a world-class architectural visualization director upgrading an ordinary render into a premium boutique-studio image.

${ARCHILYA_PREMIUM_VISUAL_CORE}

TASK:
Enhance this render to luxury publication-ready quality while preserving the exact architecture, camera framing and composition.

NON-NEGOTIABLE PRESERVATION:
- Do not redesign the building.
- Do not change geometry, proportions, facade openings, structural logic or viewpoint.
- Improve only visual quality, realism, material depth, lighting atmosphere, entourage refinement and presentation standard.

UPGRADE STRATEGY:
- Replace amateur CGI appearance with refined editorial architectural photography mood.
- Improve material credibility so concrete, timber, glass, stone and metal feel tactile and premium.
- Introduce sophisticated natural light behavior with believable highlights, soft falloff, shadow depth and atmospheric separation.
- Improve sky, reflections, vegetation and entourage only if they increase realism and architectural focus.
- Keep composition disciplined and visually restrained.

LIGHTING DIRECTION:
- Prefer elegant golden hour sunlight with warm highlights and calm cool shadows when the scene supports it.
- If the composition benefits from diffuse daylight, use soft overcast premium architectural lighting.
- Never create fake HDR look, showroom glare or synthetic lighting drama.

MATERIAL TARGET:
- Concrete: mineral, matte, weighty.
- Timber: subtle grain and natural warmth, never orange/synthetic.
- Glass: crisp and physically believable, not mirror-like unless context requires.
- Metal: refined, restrained and realistic.

${noteSection}AVOID:
- plastic AI textures
- oversharpening and overprocessing
- fake luxury effects
- random clutter
- malformed details
- inconsistent glazing
- cartoon vegetation

Return one premium final image only.`;
}

function buildPlanColorPrompt(style?: string | null, extraNote?: string | null): string {
  const stylePrompt = PLAN_STYLE_PROMPTS[normalizeStyle(style)] || PLAN_STYLE_PROMPTS.modern;
  const noteText = normalizeText(extraNote, 1200);
  const noteSection = noteText ? `\nAdditional presentation requirements: ${noteText}.` : '';

  return `You are a premium architectural presentation designer producing luxury real-estate presentation boards from floor plans.

${ARCHILYA_PREMIUM_VISUAL_CORE}

TASK:
Transform this floor plan into an elegant top-down architectural presentation image suitable for a high-end client, investor pack or luxury sales dossier.

STYLE DIRECTION:
${stylePrompt}${noteSection}

NON-NEGOTIABLE RULES:
- Preserve exact plan geometry.
- Preserve all walls, openings, circulation boundaries and room relationships.
- Never distort dimensions, room shapes or architectural layout.
- If style conflicts with plan accuracy, accuracy always wins.

PRESENTATION GOALS:
- Deliver polished luxury board aesthetics, not a childish color map.
- Use refined graphic hierarchy with clear room readability and tasteful contrast.
- Apply realistic top-down material textures aligned with room function.
- Use elegant restrained high-value palettes.
- Add subtle depth/shadow only to improve legibility.
- Add furniture silhouettes sparingly only when they clarify use.
- Keep composition curated, clean and premium.

VISUAL CHARACTER:
- Warm and sophisticated high-end brochure quality.
- Tactile top-view materials: wood, stone, textile and wet-area finish cues.
- Strong readability with disciplined negative space.

AVOID:
- childish saturation
- noisy textures
- gaming-style graphics
- excessive icons
- random decorations
- fake perspective
- visual clutter
- cheap brochure aesthetics
- text overlays or watermark

Return one single polished presentation image only.`;
}

function buildSceneEditPrompt({ workflow, references, extraNote }: SceneEditPromptParams): string {
  const mode = normalizeSceneWorkflow(workflow);
  const noteText = normalizeText(extraNote, 1500);

  const referenceSummary = references
    .map((reference, index) => {
      const lineNote = reference.note ? ` | NOTE: ${reference.note}` : '';
      return `${index + 1}. TYPE=${String(reference.type || 'object').toUpperCase()} | LABEL=${reference.label || 'Untitled'}${lineNote}`;
    })
    .join('\n');

  return `You are Archilya Scene Edit Director, a specialist in surgical architectural post-production for premium CGI and architectural photography.

EDIT MODE: ${mode}
MODE GOAL: Apply requested changes with surgical precision while preserving architecture and camera integrity.

${ARCHILYA_PREMIUM_VISUAL_CORE}

MISSION:
Apply the requested edit with surgical precision while preserving architectural authorship.

NON-NEGOTIABLE PRESERVATION RULES:
- Preserve camera framing, lens perspective, horizon logic and composition.
- Preserve architectural geometry, massing and facade rhythm unless user explicitly requests a structural change.
- Preserve existing lighting direction, shadow behavior and scene realism.
- Integrate changes so they look native to the original scene.
- Keep all edits physically plausible with correct scale, contact and material response.

SURGICAL PRECISION:
- Change only requested targets.
- Do not restyle untouched areas.
- Do not introduce unrelated design decisions.
- Do not shift window alignments, proportions or hardscape geometry.

REFERENCE CATALOG:
${referenceSummary || 'No references'}

${noteText ? `USER ART DIRECTION:\n${noteText}\n` : ''}
FINAL USER REQUEST:
${noteText || 'Use references with maximum precision while preserving the original architecture and camera framing.'}

AVOID:
- warped geometry
- mismatched shadows
- perspective drift
- floating objects
- scale errors
- duplicated elements
- plastic AI artifacts
- fake compositing look
- text overlays or watermark

Return one single edited image only.`;
}

function buildPromptByTool({ toolId, style, extraNote, workflow, references }: PromptByToolParams): string {
  if (toolId === 'analysis') {
    return buildAnalysisPrompt(extraNote);
  }
  if (toolId === 'img2img') {
    return buildStyleTransferPrompt(style, extraNote);
  }
  if (toolId === 'enhance') {
    return buildEnhancePrompt(extraNote);
  }
  if (toolId === 'plancolor') {
    return buildPlanColorPrompt(style, extraNote);
  }
  if (toolId === 'sceneedit') {
    return buildSceneEditPrompt({ workflow, references, extraNote });
  }
  throw new Error('Gecersiz AI araci secimi.');
}

function normalizeToolId(toolId: unknown): ToolId {
  const value = normalizeText(toolId, 80).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(TOOL_CONFIG, value)) {
    throw new Error('Desteklenmeyen AI araci secildi.');
  }
  return value as ToolId;
}

async function prepareSceneReferences(references: SceneReference[] | null | undefined): Promise<PreparedSceneReference[]> {
  const normalizedInput = Array.isArray(references) ? references.slice(0, MAX_SCENE_REFERENCES) : [];
  if (!normalizedInput.length) {
    throw new Error('Sahne duzenleme icin en az bir referans gorsel secin.');
  }

  const prepared: PreparedSceneReference[] = [];
  for (let i = 0; i < normalizedInput.length; i += 1) {
    const reference = normalizedInput[i] || { uri: '' };
    const imagePart = await buildImagePartFromUri(reference.uri, reference.mimeType);

    prepared.push({
      type: normalizeSceneReferenceType(reference.type),
      label: normalizeText(reference.label, 120),
      note: normalizeText(reference.note, 500),
      imagePart,
    });
  }

  return prepared;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function getFriendlyErrorMessage(error: unknown): string {
  const details = isRecord(error) ? error.details : undefined;
  if (isRecord(details)) {
    const userMessage = normalizeText(details.userMessage, 500);
    if (userMessage) {
      return userMessage;
    }
  }

  const rawMessage = error instanceof Error
    ? error.message
    : isRecord(error) && typeof error.message === 'string'
      ? error.message
      : '';
  const message = String(rawMessage || '').replace(/^FirebaseError:\s*/i, '').trim();

  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes('network request failed')) {
    return 'Ag hatasi olustu. Internet baglantinizi kontrol edip tekrar deneyin.';
  }
  if (normalizedMessage.includes('deadline-exceeded') || normalizedMessage.includes('timeout')) {
    return 'AI servisi zaman asimina ugradi. Daha kucuk bir gorsel ile tekrar deneyin.';
  }
  if (normalizedMessage.includes('unavailable')) {
    return 'AI servisine su an ulasilamiyor. Kisa sure sonra tekrar deneyin.';
  }

  if (message) {
    return message;
  }

  return 'AI islemi tamamlanamadi. Lutfen tekrar deneyin.';
}

function normalizeChargeSource(value: unknown): string | null {
  const normalized = normalizeText(value, 120);
  return normalized || null;
}

export async function runAiStudioToolSecureMobile({
  toolId,
  sourceImageUri,
  sourceImageMimeType,
  style = 'modern',
  extraNote = '',
  workflow = 'scene-compose',
  references = [],
}: RunAiStudioToolParams): Promise<AiStudioResult> {
  const normalizedToolId = normalizeToolId(toolId);
  const config = TOOL_CONFIG[normalizedToolId];
  const imagePart = await buildImagePartFromUri(sourceImageUri, sourceImageMimeType);

  let preparedReferences: PreparedSceneReference[] = [];
  if (normalizedToolId === 'sceneedit') {
    preparedReferences = await prepareSceneReferences(references);
  }

  const promptText = buildPromptByTool({
    toolId: normalizedToolId,
    style,
    extraNote,
    workflow,
    references: preparedReferences,
  });

  const payload: AiStudioCallablePayload = {
    toolId: normalizedToolId,
    imagePart,
    promptText,
    outputType: config.outputType,
  };

  if (normalizedToolId === 'sceneedit') {
    payload.referenceImages = preparedReferences;
    payload.workflow = normalizeSceneWorkflow(workflow);
  }

  try {
    const result = await runAiStudioToolSecureCallable(payload);
    const data = result?.data || {};

    if (!data.success) {
      throw new Error('AI servisi basarisiz sonuc dondu.');
    }

    if (config.outputType === 'text') {
      const text = normalizeText(data.text, 120000);
      if (!text) {
        throw new Error('AI metin cikti uretemedi.');
      }

      return {
        outputType: 'text',
        text,
        chargeSource: normalizeChargeSource(data.chargeSource),
      };
    }

    const dataUrl = normalizeText(data.dataUrl, 12000000);
    if (!dataUrl) {
      throw new Error('AI gorsel cikti uretemedi.');
    }

    return {
      outputType: 'image',
      dataUrl,
      mimeType: normalizeMimeType(data.mimeType) || 'image/png',
      chargeSource: normalizeChargeSource(data.chargeSource),
    };
  } catch (error) {
    captureException(error, {
      scope: 'mobile_ai_generate',
      tool_id: normalizedToolId,
    });
    throw new Error(getFriendlyErrorMessage(error));
  }
}
