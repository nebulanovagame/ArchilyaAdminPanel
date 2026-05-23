/**
 * Archilya AI Transform — Firebase Cloud Functions v4 (ControlNet Edition)
 *
 * Güvenli Mimari:
 * - Replicate API anahtarı YALNIZCA Firebase Secret Manager'da tutulur.
 * - Frontend hiçbir zaman anahtara doğrudan erişemez.
 *
 * MİMARİNİN ÇELİK CETVELİ (ControlNet):
 * Klasik img2img modelleri (SUPIR, FLUX.1-pro vb.) "Strength" ayarı yüksek tutulduğunda
 * orijinal geometriyi yok eder, pencerelerin yerini değiştirir (Halüsinasyon).
 * Bu sorunu kökünden çözmek için tüm sistem CONTROLNET (Canny Edge Detection)
 * altyapısına geçirilmiştir.
 *
 * FONKSİYONLAR:
 *   1. transformImage      — Hızlı Stil Dönüşümü (SDXL ControlNet Canny)
 *                            Orijinal çizgileri kilitler, içini yeni materyalle doldurur.
 *   2. archRenderPipeline  — 2 Aşamalı Ultra-Render (FLUX-Dev ControlNet → Real-ESRGAN)
 *                            Mimerra kalitesi: Çizgiler kilitli + FLUX aydınlatması + 4K Upscale
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched }   = require('firebase-functions/v2/tasks');
const { defineSecret }       = require('firebase-functions/params');
const admin                  = require('firebase-admin');
const { getFunctions }       = require('firebase-admin/functions');
const crypto                 = require('crypto');
const Replicate              = require('replicate');
const { Resend }             = require('resend');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

admin.initializeApp();

const REPLICATE_API_KEY = defineSecret('REPLICATE_API_KEY');
const GEMINI_API_KEY    = defineSecret('GEMINI_API_KEY');
const RESEND_API_KEY    = defineSecret('RESEND_API_KEY');
const R2_ACCESS_KEY_ID = defineSecret('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = defineSecret('R2_SECRET_ACCESS_KEY');

const GEMINI_MODELS = {
  chat:  'gemini-3.1-flash-lite-preview',
  text:  'gemini-3.1-flash-lite-preview',
  image: 'gemini-3.1-flash-image-preview',
};

const GEMINI_FALLBACK_MODELS = {
  chat:  ['gemini-2.5-flash'],
  text:  ['gemini-2.5-flash'],
  image: ['gemini-3-pro-image-preview'],
};

const SCENE_EDIT_REFERENCE_TYPES = ['object', 'material', 'style'];
const SCENE_EDIT_MAX_REFERENCES = 4;
const SCENE_EDIT_TOTAL_BASE64_LIMIT = 7_200_000;
const REVISION_TOTAL_BASE64_LIMIT = 11_000_000;
const REVISION_CREDIT_COST = 10;
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

const AI_STUDIO_STYLE_PROMPTS = {
  photorealistic: 'quiet luxury architectural realism, editorial exterior photography mood, tactile mineral surfaces, restrained landscaping, sophisticated premium residential atmosphere',
  modern: 'high-end contemporary architecture, monolithic but elegant composition, refined white mineral surfaces, low-iron glass, dark bronze or blackened metal detailing, restrained luxury landscape treatment',
  scandinavian: 'premium Nordic architecture, pale natural timber, muted mineral surfaces, crisp glazing, calm atmospheric daylight, understated warmth and restrained material harmony',
  brutalist: 'refined brutalist architecture, weighty board-formed concrete, deep reveals, monumental calm, controlled shadow play, austere yet luxurious material dignity',
  mediterranean: 'luxury Mediterranean architecture, limewashed mineral walls, travertine and natural stone accents, muted terracotta tones, elegant warm daylight, understated coastal sophistication',
  industrial: 'high-end industrial architecture, weathered brick, darkened steel, raw yet curated material palette, moody editorial realism, sophisticated urban warehouse character',
  sketch: 'museum-quality architectural drawing aesthetic, precise drafted linework, refined tonal hierarchy, elegant presentation sketch with curated contrast and disciplined composition',
  futuristic: 'luxury near-future architecture, controlled parametric geometry, premium advanced materials, restrained cinematic innovation, elegant sci-fi realism rather than fantasy spectacle',
};

const AI_STUDIO_PLAN_STYLE_PROMPTS = {
  photorealistic: 'luxury real-estate presentation board, realistic top-down natural materials, elegant neutral palette, curated contrast and high legibility',
  modern: 'contemporary premium plan board, light oak textures, soft mineral finishes, muted graphite accents, disciplined graphic hierarchy',
  scandinavian: 'Scandinavian premium plan board, bright white base, pale oak textures, soft sage accents, warm and airy restrained presentation language',
  brutalist: 'refined brutalist plan board, exposed concrete textures, charcoal wall tones, monochrome hierarchy, strong yet elegant readability',
  mediterranean: 'Mediterranean luxury plan board, travertine and terracotta cues, warm plaster tones, olive accents, polished hospitality-style presentation',
  industrial: 'high-end industrial plan board, weathered timber, brushed concrete, dark steel accents, urban neutral palette with clean hierarchy',
  sketch: 'architectural presentation sketch board, precise ink contours, curated wash textures, handcrafted sophistication with clear room readability',
  futuristic: 'premium futuristic plan board, crisp high-contrast hierarchy, subtle cyan accents, polished material cues and disciplined compositional clarity',
};

const SCENE_EDIT_MODES = ['place', 'replace', 'material-swap', 'scene-compose', 'remove'];

function normalizeSceneEditMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  return SCENE_EDIT_MODES.includes(normalized) ? normalized : 'scene-compose';
}

function buildTransformStylePrompt({ style = 'modern', extraNote = '' } = {}) {
  const normalizedStyle = normalizeText(style, 80) || 'modern';
  const stylePrompt = AI_STUDIO_STYLE_PROMPTS[normalizedStyle] || normalizedStyle;
  const safeExtraNote = normalizeText(extraNote, 2000);
  const extraPart = safeExtraNote
    ? `\nAdditional art-direction requirements: ${safeExtraNote}.`
    : '';

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
${stylePrompt}${extraPart}

QUALITY TARGET:
- Luxury publication-ready architectural image.
- Sophisticated and restrained premium visual language.
- Elegant editorial composition, never flashy catalog style.
- Tactile materials: mineral matte concrete, natural timber grain, believable low-iron glass, refined metal accents.
- Preserve crisp edge definition and believable microtexture.
- Light must reveal depth and form, not flatten surfaces.

NEGATIVE CONSTRAINTS:
- No generic AI luxury styling.
- No warped windows, melted edges, floating objects, duplicated vegetation, distorted furniture, excessive glow or fake reflections.
- No text overlays, labels, logos or watermark.

Return one single transformed image only.`;
}

function buildEnhancedRenderPrompt({ extraNote = '' } = {}) {
  const safeExtraNote = normalizeText(extraNote, 2000);
  const extraPart = safeExtraNote
    ? `\nSPECIAL FOCUS:\n${safeExtraNote}\n`
    : '';

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
- Strengthen contact shadows, edge fidelity, glazing realism and surface microtexture without introducing sharpened halos.
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

${extraPart}AVOID:
- plastic AI textures
- oversharpening and overprocessing
- fake luxury effects
- random clutter
- malformed details
- inconsistent glazing
- cartoon vegetation

Return one premium final image only.`;
}

function buildPlanColorPrompt({ style = 'modern', extraNote = '' } = {}) {
  const normalizedStyle = normalizeText(style, 80) || 'modern';
  const stylePrompt = AI_STUDIO_PLAN_STYLE_PROMPTS[normalizedStyle] || normalizedStyle;
  const safeExtraNote = normalizeText(extraNote, 2000);
  const extraPart = safeExtraNote
    ? `\nAdditional presentation requirements: ${safeExtraNote}.`
    : '';

  return `You are a premium architectural presentation designer producing luxury real-estate presentation boards from floor plans.

${ARCHILYA_PREMIUM_VISUAL_CORE}

TASK:
Transform this floor plan into an elegant top-down architectural presentation image suitable for a high-end client, investor pack or luxury sales dossier.

STYLE DIRECTION:
${stylePrompt}${extraPart}

NON-NEGOTIABLE RULES:
- Preserve exact plan geometry.
- Preserve all walls, openings, circulation boundaries and room relationships.
- Never distort dimensions, room shapes or architectural layout.
- If style conflicts with plan accuracy, accuracy always wins.

PRESENTATION GOALS:
- Deliver polished luxury board aesthetics, not a childish color map.
- Use refined graphic hierarchy with clear room readability and tasteful contrast.
- Apply realistic top-down material textures aligned with room function.
- Interpret the plan room by room, zone by zone, based on layout clues and furniture if labels are absent.
- Differentiate living, sleeping, circulation, wet-area and service spaces with appropriate palette temperature, material cues and texture density.
- Wet areas should read as stone/ceramic resistant surfaces, living zones as warmer and more tactile, circulation as calmer and cleaner.
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

function buildSceneEditPrompt({ editMode = 'scene-compose', references = [], extraNote = '' } = {}) {
  const normalizedMode = normalizeSceneEditMode(editMode);
  const modeInstructions = {
    place: 'Place referenced objects with precise scale, contact and perspective while preserving architectural integrity.',
    replace: 'Replace requested objects only, preserving composition, perspective and lighting continuity.',
    'material-swap': 'Transfer referenced material language to target surfaces only, without altering geometry.',
    'scene-compose': 'Compose a coherent premium edit using all references while preserving original framing and architecture.',
    remove: 'Remove specified elements cleanly while keeping untouched architecture visually unchanged.',
  };
  const referenceLines = references
    .map((reference, index) => {
      const note = reference.note ? ` | Note: ${reference.note}` : '';
      return `${index + 1}. Type=${String(reference.type || 'object').toUpperCase()} | Label=${reference.label || 'Untitled reference'}${note}`;
    })
    .join('\n');
  const userInstruction = normalizeText(extraNote, 2000);

  return `You are Archilya Scene Edit Director, a specialist in surgical architectural post-production for premium CGI and architectural photography.

EDIT MODE: ${normalizedMode}
MODE GOAL: ${modeInstructions[normalizedMode]}

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
${referenceLines || 'No references'}

${userInstruction ? `USER ART DIRECTION:\n${userInstruction}\n\n` : ''}FINAL USER REQUEST:
${userInstruction || 'Use references with maximum precision while preserving the original architecture and camera framing.'}

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

function buildAnalysisPrompt(extraNote = '') {
  const safeExtraNote = normalizeText(extraNote, 2000);
  const extraSection = safeExtraNote
    ? `\n\nKullanici Notu: "${safeExtraNote}"\nBu notu raporun ilgili bolumlerine stratejik bicimde yedir; ayri ve yapay bir ek paragraf gibi kullanma.`
    : '';

  return `Sen Archilya'nin en kidemli mimari tasarim direktoru ve gorsellestirme danismanisin. Sana verilen mimari gorseli; tasarim niteligi, temsil gucu, malzeme karakteri, mekansal anlati ve musteri/yatirimci ikna potansiyeli acisindan degerlendir.
${extraSection}

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

function buildPromptInspirationPrompt({ targetTool = 'img2img', style = 'modern', extraNote = '' } = {}) {
  const normalizedTargetTool = String(targetTool || 'img2img').trim().toLowerCase();
  const normalizedStyle = normalizeText(style, 80) || 'modern';
  const stylePromptMap = normalizedTargetTool === 'plancolor'
    ? AI_STUDIO_PLAN_STYLE_PROMPTS
    : AI_STUDIO_STYLE_PROMPTS;
  const stylePrompt = stylePromptMap[normalizedStyle] || normalizedStyle;
  const safeExtraNote = normalizeText(extraNote, 2000);
  const extraSection = safeExtraNote
    ? `\nKullanici yonlendirmesi: ${safeExtraNote}`
    : '';
  const targetInstructions = {
    img2img: 'Hedef arac img2img: Mevcut geometriyi, kutleyi, oranlari, cephe bosluklarini, kamera acisini ve kompozisyonu koruyan; yalnizca malzeme, renk paleti, atmosfer, peyzaj dili, ruh hali ve aydinlatmayi profesyonelce donusturen bir render promptu uret.',
    enhance: 'Hedef arac enhance: Tasarimi ve mimari kararlari aynen koruyan; yalnizca realizm, isik kalitesi, malzeme inandiriciligi, atmosfer, detay okunurlugu ve premium sunum etkisini yukselten bir render iyilestirme promptu uret.',
    plancolor: 'Hedef arac plancolor: Plan geometrisini, duvarlari, acikliklari ve mekan iliskilerini koruyan; zonlari gorselden sezerek ustten gorunumlu malzeme ve renk stratejisi oneren premium plan renklendirme promptu uret.',
  };
  const targetInstruction = targetInstructions[normalizedTargetTool] || targetInstructions.img2img;

  return `You are Archilya Prompt Inspiration Director, a senior architectural visualization prompt strategist.

Analyze the uploaded architectural image with professional architectural judgement. Identify the real visual evidence in the image: building type, geometry, massing, proportions, facade logic, materials, setting, landscape/context, lighting condition, composition and camera angle.

Blend the selected style direction with Archilya premium standards. The result must feel tailored to this exact image, not like a generic preset.

ARCHILYA PREMIUM STANDARD:
${ARCHILYA_PREMIUM_VISUAL_CORE}

SELECTED STYLE DIRECTION:
${stylePrompt}${extraSection}

TARGET TOOL INSTRUCTION:
${targetInstruction}

OUTPUT TASK:
Write ONLY one single professional Turkish prompt for render generation. The prompt must be ready to paste into an AI render tool. It should describe what to preserve from the uploaded image and what to improve or transform according to the target tool and selected style.

STRICT OUTPUT RULES:
- Output must be entirely Turkish.
- Output only the final prompt text.
- No markdown, no title, no critique, no explanation, no bullet list, no numbered list.
- Do not mention that you analyzed the image.
- Do not include alternatives or multiple versions.
- Keep the prompt refined, precise, architectural and production-ready.`;
}

function getAiStudioToolOutputType(toolId) {
  return String(toolId || '').trim() === 'analysis' ? 'text' : 'image';
}

function normalizeImageUrls(value) {
  if (!Array.isArray(value)) return [];
  return value.map((url) => normalizeText(url, 5000)).filter(Boolean).slice(0, 12);
}

function buildAiStudioPrompt({ toolId, style = '', extraNote = '', sceneEditMode = '', workflow = '', referenceImages = [] } = {}) {
  const normalizedToolId = String(toolId || '').trim();
  if (normalizedToolId === 'analysis') {
    return buildAnalysisPrompt(extraNote);
  }
  if (normalizedToolId === 'img2img') {
    return buildTransformStylePrompt({ style, extraNote });
  }
  if (normalizedToolId === 'enhance') {
    return buildEnhancedRenderPrompt({ extraNote });
  }
  if (normalizedToolId === 'plancolor') {
    return buildPlanColorPrompt({ style, extraNote });
  }
  if (normalizedToolId === 'sceneedit') {
    return buildSceneEditPrompt({
      editMode: sceneEditMode || workflow,
      references: referenceImages,
      extraNote,
    });
  }
  throw new HttpsError('invalid-argument', 'Gecersiz AI arac secimi.');
}

const CONTACT_FROM_EMAIL = 'iletisim@archilya.com';
const CONTACT_INBOX_EMAIL = 'info@nebulanovagames.com';
const CONTACT_REPLY_PHONE = '0 (282) 606 06 39';
const CONTACT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const CONTACT_RATE_LIMIT_PER_EMAIL = 2;
const CONTACT_RATE_LIMIT_PER_IP = 5;

const DEFAULT_R2_BUCKET_NAME = 'archilya-projects';
const DEFAULT_R2_REGION = 'auto';
const DEFAULT_R2_ENDPOINT = 'https://2ac54c48d49780d28efe4cb0cbcea4e7.eu.r2.cloudflarestorage.com';
const R2_REGION = normalizeText(process.env.R2_REGION || DEFAULT_R2_REGION, 40) || DEFAULT_R2_REGION;
const R2_UPLOAD_URL_TTL_SECONDS = Math.max(10 * 60, Number(process.env.R2_UPLOAD_URL_TTL_SECONDS || 60 * 60) || 60 * 60);
const R2_DOWNLOAD_URL_TTL_SECONDS = Math.max(10 * 60, Number(process.env.R2_DOWNLOAD_URL_TTL_SECONDS || 15 * 60) || 15 * 60);
const R2_MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

let resolvedR2Target = null;

// ─── Akıllı Yardımcılar ───────────────────────────────────────────────────────

/** Belirtilen ms kadar bekle */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Replicate modelini akıllı retry ile çalıştır.
 * 429 (Too Many Requests) hatasında retry_after süresini okur,
 * bekler ve otomatik olarak tekrar dener.
 */
async function runWithRetry(replicate, model, input, stepName, maxRetry = 3) {
  let attempt = 0;

  while (attempt <= maxRetry) {
    try {
      console.log(`[${stepName}] Deneme ${attempt + 1}/${maxRetry + 1} — Model: ${model}`);
      const output = await replicate.run(model, { input });
      console.log(`[${stepName}] Başarılı! (Deneme ${attempt + 1})`);
      return output;

    } catch (err) {
      const msg  = err.message || '';
      const is429 = msg.includes('429') ||
                    msg.includes('Too Many Requests') ||
                    msg.includes('throttled') ||
                    msg.includes('rate limit');

      if (is429 && attempt < maxRetry) {
        let waitSec = 15;
        const retryMatch = msg.match(/"retry_after"\s*:\s*(\d+)/);
        if (retryMatch) waitSec = parseInt(retryMatch[1]) + 3;

        console.warn(`[${stepName}] 429 Rate Limit! ${waitSec}s bekleniyor (Deneme ${attempt + 1}/${maxRetry})...`);
        await delay(waitSec * 1000);
        attempt++;
        continue;
      }

      console.error(`[${stepName}] Tüm denemeler başarısız. Son hata: ${msg}`);
      throw err;
    }
  }
}

/** Replicate çıktısını string URL'e çevir */
function extractUrl(output) {
  let raw = Array.isArray(output) ? output[0] : output;
  if (typeof raw === 'string')                   return raw;
  if (raw && typeof raw.url === 'function') {
    const u = raw.url();
    return u instanceof URL ? u.href : String(u);
  }
  if (raw && typeof raw.href === 'string')        return raw.href;
  if (raw && typeof raw.toString === 'function')  return raw.toString();
  return '';
}

/** URL'yi doğrula, boşsa hata fırlat */
function validateUrl(url, stepName) {
  if (!url || url === 'undefined' || url === '[object Object]') {
    throw new HttpsError('aborted', `${stepName} geçerli bir URL döndürmedi.`);
  }
  return url;
}

function normalizeText(value, maxLen = 6000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function validateImagePart(imagePart) {
  const data = imagePart?.inlineData?.data;
  const mimeType = imagePart?.inlineData?.mimeType;
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!data || !mimeType) {
    throw new HttpsError('invalid-argument', 'Referans görsel verisi eksik.');
  }

  if (!allowedMimeTypes.includes(String(mimeType).toLowerCase())) {
    throw new HttpsError('invalid-argument', 'Gecersiz format. Sadece JPG, PNG ve WEBP desteklenir.');
  }

  // 6MB raw dosya icin base64 yaklasik 8.4MB karakter olur.
  if (String(data).length > 8_500_000) {
    throw new HttpsError('invalid-argument', 'Gorsel cok buyuk. Maksimum 6 MB desteklenir.');
  }
}

function normalizeSceneReferenceType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (SCENE_EDIT_REFERENCE_TYPES.includes(normalized)) {
    return normalized;
  }
  return 'object';
}

function normalizeSceneEditReferences(input) {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new HttpsError('invalid-argument', 'Sahne duzenleme referans listesi gecersiz.');
  }
  if (input.length > SCENE_EDIT_MAX_REFERENCES) {
    throw new HttpsError('invalid-argument', `Sahne duzenleme en fazla ${SCENE_EDIT_MAX_REFERENCES} referans destekler.`);
  }

  return input.map((rawRef, index) => {
    if (!rawRef || typeof rawRef !== 'object') {
      throw new HttpsError('invalid-argument', `Referans #${index + 1} verisi gecersiz.`);
    }

    const imagePart = rawRef.imagePart;
    try {
      validateImagePart(imagePart);
    } catch (err) {
      throw new HttpsError(
        'invalid-argument',
        `Referans #${index + 1} gorseli gecersiz: ${err?.message || 'Bilinmeyen hata'}`
      );
    }

    return {
      type: normalizeSceneReferenceType(rawRef.type),
      label: normalizeText(rawRef.label, 120),
      note: normalizeText(rawRef.note, 500),
      imagePart,
    };
  });
}

function getImagePartBase64Length(imagePart) {
  return String(imagePart?.inlineData?.data || '').length;
}

function getSceneEditTotalBase64Length(primaryImagePart, referenceImages = []) {
  const primaryLength = getImagePartBase64Length(primaryImagePart);
  const referenceLength = referenceImages.reduce((total, reference) => (
    total + getImagePartBase64Length(reference?.imagePart)
  ), 0);
  return primaryLength + referenceLength;
}

function buildSceneEditParts({ imagePart, prompt, workflow, referenceImages = [] }) {
  const normalizedWorkflow = normalizeText(workflow, 80) || 'scene-compose';
  const referenceSummary = referenceImages
    .map((reference, index) => {
      const noteText = reference.note ? ` | NOTE: ${reference.note}` : '';
      return `${index + 1}. TYPE=${String(reference.type || 'object').toUpperCase()} | LABEL=${reference.label || 'Untitled'}${noteText}`;
    })
    .join('\n');

  const parts = [
    {
      text: `SCENE_EDIT_CONTEXT\nMODE: ${normalizedWorkflow}\n${ARCHILYA_PREMIUM_VISUAL_CORE}\nYou will receive one PRIMARY_SCENE image and optional REFERENCE images.\nMission: apply the requested scene edit with surgical precision while preserving architectural authorship.\n\nNON_NEGOTIABLE_PRESERVATION:\n- Preserve camera framing, lens perspective, composition and horizon logic.\n- Preserve architectural geometry, massing and facade rhythm unless user explicitly requests structural change.\n- Preserve lighting direction, shadow continuity and material realism.\n- Integrate references with correct scale, contact and physical plausibility.\n\nSURGICAL_PRECISION:\n- Change only requested targets.\n- Do not restyle untouched areas.\n- Do not introduce unrelated redesign decisions.\n- Do not shift openings, proportions or hardscape geometry.\n\nReturn exactly one edited image only with no text overlay or watermark.`,
    },
    {
      text: 'PRIMARY_SCENE_IMAGE',
    },
    imagePart,
  ];

  referenceImages.forEach((reference, index) => {
    parts.push({
      text: `REFERENCE_IMAGE_${index + 1}\nTYPE: ${String(reference.type || 'object').toUpperCase()}\nLABEL: ${reference.label || 'Untitled reference'}${reference.note ? `\nNOTE: ${reference.note}` : ''}`,
    });
    parts.push(reference.imagePart);
  });

  parts.push({
    text: `USER_EDIT_REQUEST\n${prompt}`,
  });

  if (referenceSummary) {
    parts.push({
      text: `REFERENCE_SUMMARY\n${referenceSummary}`,
    });
  }

  return parts;
}

function buildRevisionParts({ baseImagePart, maskImagePart, prompt }) {
  const safePrompt = normalizeText(prompt, 4_000);
  return [
    {
      text: `REGION_REVISION_CONTEXT\n${ARCHILYA_PREMIUM_VISUAL_CORE}\nYou will receive two images:\n1) BASE_IMAGE (original architectural scene)\n2) MASK_IMAGE where WHITE means editable region and BLACK means locked region.\n\nCORE_MISSION:\nApply masked revision with surgical precision and zero collateral change.\n\nNON_NEGOTIABLE_RULES:\n- Strictly edit only WHITE mask regions.\n- Keep BLACK mask regions visually unchanged.\n- Preserve camera perspective, geometry, composition, lighting direction and shadow continuity.\n- Match revised region to surrounding materials and atmosphere seamlessly.\n- Avoid any global style drift or unintended redesign.\n\nReturn exactly one edited image with no text overlay or watermark.`,
    },
    {
      text: 'BASE_IMAGE',
    },
    baseImagePart,
    {
      text: 'MASK_IMAGE_WHITE_EDIT_BLACK_LOCK',
    },
    maskImagePart,
    {
      text: `USER_REVISION_REQUEST\n${safePrompt || 'Apply a minimal premium architectural revision only inside the white mask.'}`,
    },
  ];
}

function mapAiToolConfig(toolId, outputType) {
  const toolConfig = {
    analysis: { credits: 5, outputType: 'text' },
    img2img: { credits: 15, outputType: 'image' },
    enhance: { credits: 15, outputType: 'image' },
    plancolor: { credits: 15, outputType: 'image' },
    sceneedit: { credits: 25, outputType: 'image' },
  };

  const config = toolConfig[String(toolId || '').trim()];
  if (!config) {
    throw new HttpsError('invalid-argument', 'Gecersiz AI arac secimi.');
  }
  if (config.outputType !== outputType) {
    throw new HttpsError('invalid-argument', 'Arac ile cikti tipi uyumsuz.');
  }
  return config;
}

function normalizeAiPromptToolId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!AI_PROMPT_HISTORY_ALLOWED_TOOLS.has(normalized)) {
    return '';
  }
  return normalized;
}

function normalizeAiPromptHistoryEntry(entry, fallbackToolId = '') {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const toolId = normalizeAiPromptToolId(entry.toolId || fallbackToolId);
  if (!toolId) {
    return null;
  }

  const referenceCountRaw = Math.round(Number(entry.referenceCount || 0));
  const referenceCount = Number.isFinite(referenceCountRaw)
    ? Math.max(0, Math.min(20, referenceCountRaw))
    : 0;
  const outputTypeRaw = String(entry.outputType || '').trim().toLowerCase();

  return {
    id: normalizeText(entry.id, 80) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    toolId,
    toolLabel: normalizeText(entry.toolLabel, 120) || toolId,
    outputType: outputTypeRaw === 'text' ? 'text' : 'image',
    style: normalizeText(entry.style, 64),
    sceneEditMode: normalizeText(entry.sceneEditMode, 64),
    referenceCount,
    extraNote: normalizeText(entry.extraNote, 2000),
    generationVariant: normalizeText(entry.generationVariant, 40),
    statusLabel: normalizeText(entry.statusLabel, 120),
    createdAt: normalizeText(entry.createdAt, 64) || new Date().toISOString(),
  };
}

function normalizeAiPromptHistoryMap(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const normalizedMap = {};
  for (const [rawToolId, rawHistory] of Object.entries(input)) {
    const toolId = normalizeAiPromptToolId(rawToolId);
    if (!toolId || !Array.isArray(rawHistory)) {
      continue;
    }

    const normalizedEntries = [];
    for (const rawEntry of rawHistory) {
      const normalizedEntry = normalizeAiPromptHistoryEntry(rawEntry, toolId);
      if (!normalizedEntry) {
        continue;
      }

      normalizedEntries.push(normalizedEntry);
      if (normalizedEntries.length >= AI_PROMPT_HISTORY_MAX_ITEMS_PER_TOOL) {
        break;
      }
    }

    if (normalizedEntries.length > 0) {
      normalizedMap[toolId] = normalizedEntries;
    }
  }

  return normalizedMap;
}

function upsertAiPromptHistoryEntry(historyMap, toolId, nextEntry) {
  const safeToolId = normalizeAiPromptToolId(toolId);
  const normalizedEntry = normalizeAiPromptHistoryEntry(nextEntry, safeToolId);
  if (!safeToolId || !normalizedEntry) {
    throw new HttpsError('invalid-argument', 'Prompt gecmisi girdisi gecersiz.');
  }

  const currentEntries = Array.isArray(historyMap[safeToolId]) ? historyMap[safeToolId] : [];
  const dedupedEntries = currentEntries.filter((entry) => entry.id !== normalizedEntry.id);
  const nextEntries = [normalizedEntry, ...dedupedEntries].slice(0, AI_PROMPT_HISTORY_MAX_ITEMS_PER_TOOL);

  return {
    ...historyMap,
    [safeToolId]: nextEntries,
  };
}

function parseRetryAfterSeconds(text) {
  const message = String(text || '');
  const patterns = [
    /Please retry in\s*([\d.]+)s/i,
    /retry after\s*([\d.]+)\s*(?:s|sec|secs|second|seconds)?/i,
    /try again in\s*([\d.]+)\s*(?:s|sec|secs|second|seconds)?/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match) continue;
    const parsed = Math.ceil(Number(match[1]));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function parseRetryAfterHeaderSeconds(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const seconds = Math.ceil(Number(raw));
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  const retryDate = Date.parse(raw);
  if (!Number.isFinite(retryDate)) {
    return null;
  }

  const deltaSeconds = Math.ceil((retryDate - Date.now()) / 1000);
  return deltaSeconds > 0 ? deltaSeconds : null;
}

function buildGeminiModelChain(primaryModel, fallbackModels = []) {
  const seen = new Set();
  const chain = [];

  for (const candidate of [primaryModel, ...fallbackModels]) {
    const normalized = String(candidate || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    chain.push(normalized);
  }

  return chain;
}

function isGeminiDemandSpike(status, message, geminiStatus) {
  const lowerMessage = String(message || '').toLowerCase();
  const statusLabel = String(geminiStatus || '').toLowerCase();

  return (
    Number(status) === 409 ||
    statusLabel === 'aborted' ||
    lowerMessage.includes('high demand') ||
    lowerMessage.includes('try again later') ||
    lowerMessage.includes('temporarily unavailable')
  );
}

function isGeminiRetriableHttpError(status, message, geminiStatus) {
  if ([408, 409, 429, 500, 502, 503, 504].includes(Number(status))) {
    return true;
  }

  const lowerMessage = String(message || '').toLowerCase();
  const statusLabel = String(geminiStatus || '').toLowerCase();
  return (
    statusLabel === 'resource_exhausted' ||
    statusLabel === 'unavailable' ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('quota exceeded') ||
    lowerMessage.includes('high demand') ||
    lowerMessage.includes('try again later')
  );
}

function computeGeminiRetryDelaySeconds(attempt, retryAfterSeconds = null) {
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(60, Math.max(1, retryAfterSeconds));
  }

  const fallbackDelay = 3 * (2 ** Math.max(0, attempt));
  return Math.min(30, fallbackDelay);
}

function toGeminiHttpsError({ model, status, geminiStatus, errMsg, retryAfterSeconds, context = {} }) {
  const retryInfo = retryAfterSeconds ? ` Lutfen ${retryAfterSeconds} saniye sonra tekrar deneyin.` : '';
  const baseDetails = {
    toolId: context.toolId,
    model,
    outputType: context.outputType,
    httpStatus: status,
    geminiStatus,
    retryAfterSeconds,
  };
  const lowerErrMsg = String(errMsg || '').toLowerCase();
  const isImageModel = /image/i.test(model);
  const isQuotaExceeded = lowerErrMsg.includes('quota exceeded');
  const isHighDemand = isGeminiDemandSpike(status, errMsg, geminiStatus);

  if (status === 429 || isHighDemand || String(geminiStatus || '').toUpperCase() === 'RESOURCE_EXHAUSTED') {
    if (isImageModel) {
      if (isQuotaExceeded) {
        return new HttpsError(
          'resource-exhausted',
          `Gemini gorsel kotasi su an kullanilamiyor.${retryInfo} Bu model icin Google Cloud billing aktif olmali ve key ayni projeye bagli olmalidir.`,
          buildAiErrorDetails({
            ...baseDetails,
            category: 'gemini_quota_exceeded',
            userMessage: `Gorsel uretim servisi su an kota sinirinda.${retryInfo}`.trim(),
          })
        );
      }

      return new HttpsError(
        'resource-exhausted',
        `Gemini gorsel istegi su an yogun.${retryInfo}`,
        buildAiErrorDetails({
          ...baseDetails,
          category: isHighDemand ? 'gemini_high_demand' : 'gemini_rate_limited',
          userMessage: `Gorsel uretim servisi su an yogun.${retryInfo}`.trim(),
        })
      );
    }

    return new HttpsError(
      'resource-exhausted',
      isQuotaExceeded ? `Gemini kota limitine ulasildi.${retryInfo}` : `Gemini metin istegi su an yogun.${retryInfo}`,
      buildAiErrorDetails({
        ...baseDetails,
        category: isQuotaExceeded ? 'gemini_quota_exceeded' : (isHighDemand ? 'gemini_high_demand' : 'gemini_rate_limited'),
        userMessage: `AI servisi su an yogun veya kota sinirinda.${retryInfo}`.trim(),
      })
    );
  }

  if ([500, 502, 503, 504].includes(Number(status))) {
    return new HttpsError(
      'unavailable',
      `Gemini servisi gecici olarak kullanilamiyor (${status}).${retryInfo}`,
      buildAiErrorDetails({
        ...baseDetails,
        category: 'gemini_service_unavailable',
        userMessage: `AI servisi su an gecici olarak kullanilamiyor.${retryInfo}`.trim(),
      })
    );
  }

  if (status === 404) {
    return new HttpsError(
      'failed-precondition',
      'Secilen Gemini modeli bu API surumunde kullanilamiyor.',
      buildAiErrorDetails({
        ...baseDetails,
        category: 'gemini_model_unavailable',
        userMessage: 'AI modeli su an kullanilamiyor. Lutfen biraz sonra tekrar deneyin.',
      })
    );
  }

  if (status === 401 || status === 403) {
    return new HttpsError(
      'permission-denied',
      'Gemini API anahtari gecersiz veya yetkisiz.',
      buildAiErrorDetails({
        ...baseDetails,
        category: 'gemini_auth_error',
        userMessage: 'AI servisine yetki dogrulanamadi. Lutfen destek ile iletisime gecin.',
      })
    );
  }

  return new HttpsError(
    'aborted',
    errMsg,
    buildAiErrorDetails({
      ...baseDetails,
      category: 'gemini_http_error',
      userMessage: 'AI servisi istegi tamamlayamadi. Lutfen tekrar deneyin.',
    })
  );
}

function summarizeGeminiPayload(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const finishReasons = candidates
    .map((candidate) => String(candidate?.finishReason || '').trim())
    .filter(Boolean);
  const hasImagePart = candidates.some((candidate) => {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    return parts.some((part) => {
      const mimeType = String(part?.inlineData?.mimeType || '');
      return mimeType.startsWith('image/') && Boolean(part?.inlineData?.data);
    });
  });
  const hasTextPart = candidates.some((candidate) => {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    return parts.some((part) => typeof part?.text === 'string' && part.text.trim());
  });

  return {
    candidateCount: candidates.length,
    finishReasons,
    firstFinishReason: finishReasons[0] || null,
    blockReason: data?.promptFeedback?.blockReason || null,
    hasImagePart,
    hasTextPart,
  };
}

function buildAiErrorDetails({
  category,
  userMessage,
  toolId,
  model,
  outputType,
  httpStatus = null,
  geminiStatus = null,
  finishReason = null,
  blockReason = null,
  retryAfterSeconds = null,
}) {
  return {
    category: String(category || 'ai_error'),
    userMessage: String(userMessage || 'AI islemi tamamlanamadi. Lutfen tekrar deneyin.'),
    toolId: toolId ? String(toolId) : null,
    model: model ? String(model) : null,
    outputType: outputType ? String(outputType) : null,
    httpStatus: Number.isFinite(httpStatus) ? httpStatus : null,
    geminiStatus: geminiStatus ? String(geminiStatus) : null,
    finishReason: finishReason ? String(finishReason) : null,
    blockReason: blockReason ? String(blockReason) : null,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
  };
}

async function callGeminiGenerateContent({
  model,
  payload,
  context = {},
  fallbackModels = [],
  maxRetryPerModel = 2,
}) {
  let apiKey;
  try {
    apiKey = GEMINI_API_KEY.value();
    if (!apiKey) throw new Error('API anahtarı boş döndü.');
  } catch (err) {
    throw new HttpsError(
      'failed-precondition',
      `Gemini API anahtarı bulunamadı: ${err.message}`,
      buildAiErrorDetails({
        category: 'gemini_key_missing',
        userMessage: 'AI servis ayarlari eksik. Lutfen destek ile iletisime gecin.',
        toolId: context.toolId,
        model,
        outputType: context.outputType,
      })
    );
  }

  const modelChain = buildGeminiModelChain(model, fallbackModels);
  const retries = Number.isInteger(maxRetryPerModel) && maxRetryPerModel >= 0
    ? Math.min(maxRetryPerModel, 4)
    : 2;

  if (!modelChain.length) {
    throw new HttpsError(
      'failed-precondition',
      'Gecerli bir Gemini modeli bulunamadi.',
      buildAiErrorDetails({
        category: 'gemini_model_missing',
        userMessage: 'AI modeli su an hazir degil. Lutfen destek ile iletisime gecin.',
        toolId: context.toolId,
        outputType: context.outputType,
      })
    );
  }

  let lastError = null;

  for (let modelIndex = 0; modelIndex < modelChain.length; modelIndex += 1) {
    const currentModel = modelChain[modelIndex];
    const hasNextModel = modelIndex < modelChain.length - 1;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      let res;

      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        const canRetry = attempt < retries;
        const delaySeconds = computeGeminiRetryDelaySeconds(attempt);

        console.warn('[callGeminiGenerateContent] network error', {
          toolId: context.toolId || 'unknown',
          outputType: context.outputType || 'unknown',
          model: currentModel,
          attempt: attempt + 1,
          maxAttempt: retries + 1,
          willRetry: canRetry,
          willFallback: !canRetry && hasNextModel,
          errorMessage: err?.message || 'unknown',
        });

        if (canRetry) {
          await delay(delaySeconds * 1000);
          continue;
        }

        lastError = new HttpsError(
          'unavailable',
          `Gemini servisine ulasilamadi: ${err.message}`,
          buildAiErrorDetails({
            category: 'gemini_network_error',
            userMessage: 'AI servisine su an ulasilamiyor. Lutfen biraz sonra tekrar deneyin.',
            toolId: context.toolId,
            model: currentModel,
            outputType: context.outputType,
          })
        );

        if (hasNextModel) {
          console.info('[callGeminiGenerateContent] fallback after network error', {
            toolId: context.toolId || 'unknown',
            outputType: context.outputType || 'unknown',
            fromModel: currentModel,
            toModel: modelChain[modelIndex + 1],
          });
          break;
        }

        throw lastError;
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok) {
        if (attempt > 0 || modelIndex > 0) {
          console.info('[callGeminiGenerateContent] recovered', {
            toolId: context.toolId || 'unknown',
            outputType: context.outputType || 'unknown',
            model: currentModel,
            modelIndex,
            attempt: attempt + 1,
          });
        }

        return {
          data,
          model: currentModel,
        };
      }

      const errMsg = data?.error?.message || `Gemini istegi basarisiz (${res.status}).`;
      const geminiStatus = data?.error?.status || null;
      const retryAfterSeconds =
        parseRetryAfterHeaderSeconds(res.headers?.get('retry-after')) ?? parseRetryAfterSeconds(errMsg);
      const retriable = isGeminiRetriableHttpError(res.status, errMsg, geminiStatus);
      const canRetry = retriable && attempt < retries;
      const canFallback = hasNextModel && (retriable || res.status === 404);
      const delaySeconds = computeGeminiRetryDelaySeconds(attempt, retryAfterSeconds);

      lastError = toGeminiHttpsError({
        model: currentModel,
        status: res.status,
        geminiStatus,
        errMsg,
        retryAfterSeconds,
        context,
      });

      console.warn('[callGeminiGenerateContent] request failed', {
        toolId: context.toolId || 'unknown',
        outputType: context.outputType || 'unknown',
        model: currentModel,
        attempt: attempt + 1,
        maxAttempt: retries + 1,
        httpStatus: res.status,
        geminiStatus,
        retriable,
        willRetry: canRetry,
        willFallback: !canRetry && canFallback,
        retryAfterSeconds,
      });

      if (canRetry) {
        await delay(delaySeconds * 1000);
        continue;
      }

      if (canFallback) {
        console.info('[callGeminiGenerateContent] model fallback', {
          toolId: context.toolId || 'unknown',
          outputType: context.outputType || 'unknown',
          fromModel: currentModel,
          toModel: modelChain[modelIndex + 1],
          reasonStatus: res.status,
          reasonGeminiStatus: geminiStatus,
        });
        break;
      }

      throw lastError;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new HttpsError(
    'aborted',
    'Gemini istegi tamamlanamadi.',
    buildAiErrorDetails({
      category: 'gemini_unexpected_error',
      userMessage: 'AI servisi istegi tamamlayamadi. Lutfen tekrar deneyin.',
      toolId: context.toolId,
      model,
      outputType: context.outputType,
    })
  );
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .filter((p) => typeof p.text === 'string' && p.text.trim())
    .map((p) => p.text.trim())
    .join('\n')
    .trim();

  if (text) return text;

  const blockedReason = data?.promptFeedback?.blockReason;
  if (blockedReason) {
    throw new HttpsError(
      'permission-denied',
      `Yanit guvenlik politikasi nedeniyle engellendi (${blockedReason}).`,
      buildAiErrorDetails({
        category: 'gemini_safety_block',
        userMessage: 'Icerik guvenlik politikasi nedeniyle engellendi. Farkli bir gorsel veya not ile tekrar deneyin.',
        outputType: 'text',
        blockReason: blockedReason,
      })
    );
  }

  throw new HttpsError(
    'aborted',
    'Model metin yaniti uretmedi.',
    buildAiErrorDetails({
      category: 'gemini_no_text',
      userMessage: 'Model bu denemede metin yaniti uretmedi. Lutfen tekrar deneyin.',
      outputType: 'text',
    })
  );
}

function extractGeminiImage(data, context = {}) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const imagePart = parts.find((part) => {
      const mimeType = String(part?.inlineData?.mimeType || '');
      return mimeType.startsWith('image/') && Boolean(part?.inlineData?.data);
    });

    if (imagePart?.inlineData?.data) {
      return {
        dataUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
        mimeType: imagePart.inlineData.mimeType,
      };
    }
  }

  const summary = summarizeGeminiPayload(data);
  const fallbackText = candidates
    .flatMap((candidate) => (Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []))
    .find((part) => typeof part?.text === 'string' && part.text.trim())
    ?.text
    ?.trim();

  if (summary.blockReason) {
    throw new HttpsError(
      'permission-denied',
      `Yanit guvenlik politikasi nedeniyle engellendi (${summary.blockReason}).`,
      buildAiErrorDetails({
        category: 'gemini_safety_block',
        userMessage: 'Gorsel guvenlik politikasi nedeniyle uretilemedi. Farkli bir gorsel veya not ile tekrar deneyin.',
        toolId: context.toolId,
        model: context.model,
        outputType: context.outputType,
        finishReason: summary.firstFinishReason,
        blockReason: summary.blockReason,
      })
    );
  }

  if (fallbackText) {
    throw new HttpsError(
      'aborted',
      fallbackText,
      buildAiErrorDetails({
        category: 'gemini_text_instead_of_image',
        userMessage: 'Model bu denemede gorsel yerine metin cevabi dondurdu. Daha sade bir plan gorseli veya not ile tekrar deneyin.',
        toolId: context.toolId,
        model: context.model,
        outputType: context.outputType,
        finishReason: summary.firstFinishReason,
      })
    );
  }

  if (summary.firstFinishReason === 'SAFETY' || summary.firstFinishReason === 'RECITATION') {
    throw new HttpsError(
      'permission-denied',
      'Model cevabi guvenlik nedeniyle tamamlanamadi.',
      buildAiErrorDetails({
        category: 'gemini_safety_block',
        userMessage: 'Gorsel guvenlik nedeniyle engellendi. Farkli bir girdi ile tekrar deneyin.',
        toolId: context.toolId,
        model: context.model,
        outputType: context.outputType,
        finishReason: summary.firstFinishReason,
      })
    );
  }

  throw new HttpsError(
    'aborted',
    'Model gorsel uretemedi.',
    buildAiErrorDetails({
      category: 'gemini_no_image_part',
      userMessage: 'Model bu denemede gorsel uretmedi. Lutfen tekrar deneyin veya daha sade bir not kullanin.',
      toolId: context.toolId,
      model: context.model,
      outputType: context.outputType,
      finishReason: summary.firstFinishReason,
    })
  );
}

const SALES_CONTACT_EMAIL = 'info@nebulanovagames.com';
const SALES_CONTACT_PHONE = '0 (282) 606 06 39';

const CHAT_SYSTEM_INSTRUCTION = `Sen "Archilya AI" adinda, Archilya platformu icin hem urun destek asistani hem de B2B satis danismani olarak calisan kurumsal bir asistansin.

Temel gorevler:
- Kullaniciya Archilya ozellikleri, panel kullanim adimlari, paket farklari ve AI Studio araclari konusunda net yardim ver.
- Kullanici paneldeyse adim adim yonlendirme yap.
- Sorulan konu Archilya kapsami disindaysa kisa sekilde kapsam disi oldugunu belirt.

Fiyat ve teklif politikasi (kritik):
- Net, baglayici veya kesin teklif verme.
- Fiyat sorularinda "yaklasik", "ortalama" ve "baslangic" dili kullan.
- Referans fiyatlari yalnizca bilgi amaclidir, degisebilecegini belirt.
- Ozel kapsamli taleplerde (kurumsal entegrasyon, ozel proje, birden fazla lokasyon, ozel hizmet paketi) kesin fiyat verme ve mutlaka iletisime yonlendir.

Yaklasik fiyat referanslari:
- Kesif: ucretsiz plan, 150 AI islem, 5 GB, 3 proje.
- Solo: yaklasik 550-700 TL/ay bandi, 1.000 AI islem, 30 GB, 15 proje.
- Pro: yaklasik 1.2K-1.5K TL/ay bandi, 2.200 AI islem, 100 GB, 100 proje, 5 kisilik ekip workspace.
- Studio: yaklasik 4.0K-5.0K TL/ay bandi, 7.000 AI islem havuzu, 750 GB, sinirsiz proje, 20 kisilik workspace.
- Ek AI paketleri: premium top-up mantigindadir; 500 AI islem abone icin yaklasik 350 TL'den baslar, diger paketler kapsamla artar.

Kullaniciya yardim verecegin ana urun alanlari:
- Ana site: paketler, AI/VR degeri, urun modulleri.
- Dashboard: Projeler, Proje Detay, dosya yukleme, klasorleme, versiyonlama, cop kutusu.
- AI Studio: Mimari Rapor, Stil Donusumu, Render Iyilestirme, Sahne Duzenleme, Plan Boyama, kaydet/paylas.
- Ekip/Workspace: uye daveti, rol, havuz kredi ve depolama.
- Abonelik ve kredi mantigi.

Eskalasyon kurali:
- Asagidaki durumlarda kullaniciyi iletisime yonlendir:
  1) Ozel veya sahsi is gorusmesi,
  2) Kapsami karmasik proje teklifleri,
  3) Kurumsal satin alma / ozel entegrasyon,
  4) Kesin fiyat-talep sozlesme sorulari.
- Yonlendirme bilgisi: ${SALES_CONTACT_EMAIL} | ${SALES_CONTACT_PHONE}

Yanit stili:
- Kurumsal, acik ve sonuca odakli ol.
- Varsayilan 2-6 cumle kullan.
- Dashboard yardim sorularinda 3-6 maddelik kisa adimlar ver.
- Emoji kullanma.
- Bilmedigin konuda uydurma bilgi verme; netlestirme veya iletisim yonlendirmesi yap.`;

const CHAT_SYSTEM_ACK = 'Anlasildi. Archilya kapsaminda kurumsal, net ve yonlendirici yanitlar verecegim; fiyatlarda yalnizca yaklasik bilgi paylasacagim.';

function normalizeChatHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-12)
    .map((item) => {
      const role = item?.role === 'model' ? 'model' : item?.role === 'user' ? 'user' : null;
      const text = normalizeText(item?.text || '', 1200);
      if (!role || !text) return null;
      return { role, parts: [{ text }] };
    })
    .filter(Boolean);
}

function normalizeChatMode(mode) {
  return String(mode || '').toLowerCase() === 'dashboard' ? 'dashboard' : 'public';
}

function normalizeChatPath(path) {
  const normalized = normalizeText(path || '', 160);
  return normalized.startsWith('/') ? normalized : '';
}

function getDashboardPathHint(path) {
  if (!path) return 'Kullanici dashboard ana gorunumunde olabilir.';
  if (path.startsWith('/dashboard/ai')) {
    return 'Kullanici su anda AI Studio tarafinda. Arac secimi, referans gorsel, kaydetme ve paylasma adimlarinda pratik yonlendirme ver.';
  }
  if (path.startsWith('/dashboard/projeler/')) {
    return 'Kullanici proje detay sayfasinda. Dosya yukleme, klasor, versiyon, indirme ve arsiv adimlarinda yardim ver.';
  }
  if (path.startsWith('/dashboard/ekip')) {
    return 'Kullanici ekip/workspace alaninda. Uye daveti, rol ve havuz mantigini acikla.';
  }
  if (path.startsWith('/dashboard/abonelik')) {
    return 'Kullanici abonelik sayfasinda. Paket farklarini ve kredi/depolama etkisini kisa karsilastir.';
  }
  if (path.startsWith('/dashboard/ayarlar')) {
    return 'Kullanici ayarlar sayfasinda. Hesap ve profil islemlerinde adim adim yardim ver.';
  }
  if (path.startsWith('/dashboard/cop-kutusu')) {
    return 'Kullanici cop kutusunda. geri yukleme ve kalici silme adimlarini acikla.';
  }
  return `Kullanici panelde su rotada: ${path}.`;
}

function buildChatRuntimeContext({ mode, currentPath }) {
  const normalizedMode = normalizeChatMode(mode);
  const normalizedPath = normalizeChatPath(currentPath);

  if (normalizedMode === 'dashboard') {
    return `Calisma modu: dashboard. ${getDashboardPathHint(normalizedPath)} Panel ozellikleri icin uygulamaya donuk, adim adim ve kisa cevap ver.`;
  }

  return 'Calisma modu: public web sitesi. Kullaniciyi urun degeri, paket secimi ve iletisim adimlarinda net sekilde yonlendir.';
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const INITIAL_CREDITS = 150;
const PLAN_CREDITS = {
  free: 150,
  solo: 1000,
  pro: 2200,
  studio: 7000,
};
const PLAN_PRICES = {
  solo: 699,
  pro: 1499,
  studio: 4999,
};
const PLAN_LABELS = {
  free: 'Kesif',
  solo: 'Solo',
  pro: 'Pro',
  studio: 'Studio',
};
const STUDIO_POOL_CREDITS = 7000;
const STUDIO_POOL_STORAGE = 750 * 1024 * 1024 * 1024;

const WORKSPACE_PLAN_CONFIG = {
  solo: {
    maxMembers: 1,
    poolCredits: 1000,
    poolStorage: 30 * 1024 * 1024 * 1024,
  },
  pro: {
    maxMembers: 5,
    poolCredits: 2200,
    poolStorage: 100 * 1024 * 1024 * 1024,
  },
  studio: {
    maxMembers: 20,
    poolCredits: STUDIO_POOL_CREDITS,
    poolStorage: STUDIO_POOL_STORAGE,
  },
  enterprise: {
    maxMembers: 20,
    poolCredits: STUDIO_POOL_CREDITS,
    poolStorage: STUDIO_POOL_STORAGE,
  },
};
const AI_PROMPT_HISTORY_MAX_ITEMS_PER_TOOL = 8;
const AI_PROMPT_HISTORY_ALLOWED_TOOLS = new Set([
  'analysis',
  'img2img',
  'enhance',
  'plancolor',
  'sceneedit',
  'revise',
]);

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
  }
  return request.auth.uid;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getIyzicoConfig() {
  const apiKey = normalizeText(process.env.IYZICO_API_KEY || '', 200);
  const secretKey = normalizeText(process.env.IYZICO_SECRET_KEY || '', 200);
  const baseUrl = normalizeText(process.env.IYZICO_BASE_URL || '', 200) || 'https://sandbox-api.iyzipay.com';

  if (!apiKey || !secretKey) {
    throw new HttpsError('failed-precondition', 'Iyzico ortam degiskenleri eksik.');
  }

  return {
    apiKey,
    secretKey,
    baseUrl: baseUrl.replace(/\/+$/, ''),
  };
}

function splitFullName(value) {
  const safeValue = normalizeText(value || '', 120) || 'Archilya Kullanici';
  const parts = safeValue.split(/\s+/).filter(Boolean);
  const name = parts[0] || 'Archilya';
  const surname = parts.slice(1).join(' ') || 'Kullanici';
  return { name, surname, fullName: `${name} ${surname}`.trim() };
}

function getSubscriptionPlanConfig(planId) {
  const normalizedPlanId = String(planId || '').trim().toLowerCase();
  if (!['solo', 'pro', 'studio'].includes(normalizedPlanId)) {
    throw new HttpsError('invalid-argument', 'Gecersiz plan secimi.');
  }

  return {
    planId: normalizedPlanId,
    label: PLAN_LABELS[normalizedPlanId] || normalizedPlanId,
    price: Number(PLAN_PRICES[normalizedPlanId] || 0),
    credits: Number(PLAN_CREDITS[normalizedPlanId] || 0),
  };
}

function getWorkspacePlanConfig(planId) {
  const normalizedPlanId = String(planId || '').trim().toLowerCase();
  return WORKSPACE_PLAN_CONFIG[normalizedPlanId] || null;
}

async function syncOwnedWorkspacePlanState(uid, planId) {
  const workspacePlanConfig = getWorkspacePlanConfig(planId);
  if (!workspacePlanConfig || !uid) {
    return;
  }

  const adminWorkspaceSnap = await db.collection('workspaces').where('adminUid', '==', uid).limit(1).get();
  if (adminWorkspaceSnap.empty) {
    return;
  }

  const workspaceRef = adminWorkspaceSnap.docs[0].ref;
  await workspaceRef.set({
    plan: String(planId).trim().toLowerCase(),
    poolCredits: workspacePlanConfig.poolCredits,
    poolStorage: workspacePlanConfig.poolStorage,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

function getRequestOrigin(request) {
  const rawOrigin = String(
    request.rawRequest?.headers?.origin
    || request.rawRequest?.headers?.referer
    || ''
  ).trim();

  if (!rawOrigin) {
    return 'https://archilya.com';
  }

  try {
    return new URL(rawOrigin).origin;
  } catch {
    return 'https://archilya.com';
  }
}

function getRequestIp(request) {
  const forwardedFor = String(request.rawRequest?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const candidate = forwardedFor || request.rawRequest?.ip || request.rawRequest?.socket?.remoteAddress || '';
  return normalizeText(candidate, 80) || '127.0.0.1';
}

function buildIyzicoAuthorization({ apiKey, secretKey, uriPath, bodyString, randomKey }) {
  const payload = `${randomKey}${uriPath}${bodyString}`;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  const authorizationString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return `IYZWSv2 ${Buffer.from(authorizationString, 'utf8').toString('base64')}`;
}

async function callIyzicoApi({ path, payload }) {
  const { apiKey, secretKey, baseUrl } = getIyzicoConfig();
  const uriPath = String(path || '').trim();
  const bodyString = JSON.stringify(payload || {});
  const randomKey = crypto.randomBytes(16).toString('hex');

  const response = await fetch(`${baseUrl}${uriPath}`, {
    method: 'POST',
    headers: {
      Authorization: buildIyzicoAuthorization({ apiKey, secretKey, uriPath, bodyString, randomKey }),
      'x-iyzi-rnd': randomKey,
      'Content-Type': 'application/json',
    },
    body: bodyString,
  });

  const responseText = await response.text();
  let data = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new HttpsError('internal', 'Iyzico yaniti cozumlenemedi.');
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function decodeCheckoutFormContent(content) {
  const raw = String(content || '').trim();
  if (!raw) return '';
  if (raw.includes('<form') || raw.includes('<script') || raw.includes('<div')) {
    return raw;
  }

  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    return decoded || raw;
  } catch {
    return raw;
  }
}

function createCreditTransactionPayload({
  userId,
  planConfig,
  status,
  token,
  paymentId = '',
  conversationId = '',
}) {
  return {
    userId,
    type: 'subscription',
    planId: planConfig.planId,
    label: `${planConfig.label} Abonelik`,
    amount: planConfig.price,
    credits: planConfig.credits,
    status,
    provider: 'iyzico',
    token,
    paymentId: normalizeText(paymentId, 120),
    conversationId: normalizeText(conversationId, 120),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function finalizeIyzicoPayment({ token, paymentSessionRef, paymentSession, providerResult }) {
  const planConfig = getSubscriptionPlanConfig(paymentSession.planId);
  const userRef = db.collection('users').doc(paymentSession.userId);
  const creditTransactionRef = db.collection('creditTransactions').doc(token);
  await ensureUserProfileDoc(paymentSession.userId, { email: paymentSession.userEmail || '' });

  const result = await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(paymentSessionRef);
    const userSnap = await tx.get(userRef);
    const latestSession = sessionSnap.data() || {};
    const userData = userSnap.data() || {};

    if (latestSession.status === 'completed') {
      tx.set(creditTransactionRef, createCreditTransactionPayload({
        userId: paymentSession.userId,
        planConfig,
        status: 'success',
        token,
        paymentId: providerResult.paymentId || latestSession.paymentId || '',
        conversationId: latestSession.conversationId || '',
      }), { merge: true });

      return {
        success: true,
        alreadyCompleted: true,
        planId: latestSession.planId || planConfig.planId,
        addedCredits: planConfig.credits,
      };
    }

    tx.update(paymentSessionRef, {
      status: 'completed',
      paymentId: normalizeText(providerResult.paymentId, 120),
      providerStatus: normalizeText(providerResult.paymentStatus || providerResult.status, 80),
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      rawResult: providerResult,
    });

    tx.update(userRef, {
      plan: planConfig.planId,
      credits: Number(userData.credits || 0) + planConfig.credits,
      totalEarned: Number(userData.totalEarned || 0) + planConfig.credits,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const userTxRef = db.collection('users').doc(paymentSession.userId).collection('transactions').doc();
    tx.set(userTxRef, {
      type: 'earn',
      amount: planConfig.credits,
      description: `${planConfig.label} abonelik aktivasyonu`,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(creditTransactionRef, {
      ...createCreditTransactionPayload({
        userId: paymentSession.userId,
        planConfig,
        status: 'success',
        token,
        paymentId: providerResult.paymentId || '',
        conversationId: latestSession.conversationId || '',
      }),
      createdAt: latestSession.createdAt || FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      success: true,
      planId: planConfig.planId,
      addedCredits: planConfig.credits,
    };
  });

  if (result?.success) {
    await syncOwnedWorkspacePlanState(paymentSession.userId, planConfig.planId);
  }

  return result;
}

function assertPositiveInt(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new HttpsError('invalid-argument', `${fieldName} pozitif bir tam sayı olmalıdır.`);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function sanitizeFileName(fileName, maxLen = 180) {
  const name = String(fileName || '').trim();
  const normalized = name
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen);

  return normalized || `file_${Date.now()}`;
}

function getFileExtension(fileName) {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? String(parts.pop() || '').toLowerCase() : '';
}

function shouldRouteToR2(fileName, fileSize, contentType = '') {
  const ext = getFileExtension(fileName);
  const normalizedType = String(contentType || '').toLowerCase();
  const largeBySize = Number(fileSize || 0) >= 50 * 1024 * 1024;
  const heavyExtensions = new Set(['pak', 'utoc', 'ucas', 'mp4', 'mov', 'avi', 'mkv', 'zip', 'rar', '7z', 'glb', 'gltf', 'fbx', 'obj', 'blend', 'usdz']);
  const heavyByExt = heavyExtensions.has(ext);
  const heavyByType = /video|octet-stream|model/.test(normalizedType);
  return largeBySize || heavyByExt || heavyByType;
}

function normalizeContentType(contentType, fileName = '') {
  const value = String(contentType || '').trim().toLowerCase();
  if (value) return value;

  const ext = getFileExtension(fileName);
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    zip: 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

function buildR2ObjectKey({ uid, projectId, fileName }) {
  const safeName = sanitizeFileName(fileName, 140);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `users/${uid}/projects/${projectId}/${Date.now()}_${randomPart}_${safeName}`;
}

function buildAdminProductObjectPrefix(productId) {
  return `admin/products/${sanitizeFileName(productId, 80)}`;
}

function buildAdminProductObjectKey({ productId, fileName }) {
  const safeName = sanitizeFileName(fileName, 140);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${buildAdminProductObjectPrefix(productId)}/${Date.now()}_${randomPart}_${safeName}`;
}

function parseCommaSeparatedValues(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((item) => normalizeText(item, 300))
    .map((item) => item.replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function normalizeR2Endpoint(endpoint) {
  const value = String(endpoint || '').trim().replace(/\/+$/, '');
  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function appendIfMissing(list, value) {
  const cleanValue = String(value || '').trim();
  if (!cleanValue || list.includes(cleanValue)) {
    return;
  }
  list.push(cleanValue);
}

function buildR2EndpointCandidates() {
  const configured = [
    ...parseCommaSeparatedValues(process.env.R2_ENDPOINTS),
    ...parseCommaSeparatedValues(process.env.R2_ENDPOINT),
  ]
    .map(normalizeR2Endpoint)
    .filter(Boolean);

  const candidates = [];
  for (const endpoint of [...configured, DEFAULT_R2_ENDPOINT]) {
    const normalized = normalizeR2Endpoint(endpoint);
    if (!normalized) {
      continue;
    }

    appendIfMissing(candidates, normalized);

    if (normalized.includes('.eu.r2.cloudflarestorage.com')) {
      appendIfMissing(
        candidates,
        normalized.replace('.eu.r2.cloudflarestorage.com', '.r2.cloudflarestorage.com'),
      );
      continue;
    }

    if (normalized.includes('.r2.cloudflarestorage.com')) {
      appendIfMissing(
        candidates,
        normalized.replace('.r2.cloudflarestorage.com', '.eu.r2.cloudflarestorage.com'),
      );
    }
  }

  return candidates;
}

function buildR2BucketCandidates() {
  const configured = [
    ...parseCommaSeparatedValues(process.env.R2_BUCKET_NAMES),
    ...parseCommaSeparatedValues(process.env.R2_BUCKET_NAME),
  ];

  const candidates = [];
  for (const bucket of [...configured, DEFAULT_R2_BUCKET_NAME]) {
    appendIfMissing(candidates, normalizeText(bucket, 120));
  }

  return candidates;
}

function getR2Credentials() {
  let accessKeyId;
  let secretAccessKey;

  try {
    accessKeyId = R2_ACCESS_KEY_ID.value();
    secretAccessKey = R2_SECRET_ACCESS_KEY.value();
  } catch (err) {
    throw new HttpsError('failed-precondition', `R2 secret okunamadi: ${err.message}`);
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new HttpsError('failed-precondition', 'R2 baglantisi icin gerekli secret ayarlari eksik.');
  }

  return { accessKeyId, secretAccessKey };
}

function createR2Client(input) {
  return new S3Client({
    region: R2_REGION,
    endpoint: input.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: input.accessKeyId,
      secretAccessKey: input.secretAccessKey,
    },
  });
}

function getR2ErrorCode(error) {
  return String(error?.Code || error?.code || error?.name || '').trim() || 'unknown';
}

function getR2ErrorMessage(error) {
  return String(error?.message || error || '').trim() || 'Bilinmeyen hata';
}

async function resolveR2Target(forceRefresh = false) {
  if (resolvedR2Target && !forceRefresh) {
    return resolvedR2Target;
  }

  const credentials = getR2Credentials();
  const endpointCandidates = buildR2EndpointCandidates();
  const configuredBucketCandidates = buildR2BucketCandidates();

  if (!endpointCandidates.length || !configuredBucketCandidates.length) {
    throw new HttpsError(
      'failed-precondition',
      'R2 endpoint veya bucket adaylari bos. R2_ENDPOINT/R2_BUCKET_NAME ayarlari kontrol edilmeli.',
    );
  }

  let lastError = null;

  for (const endpoint of endpointCandidates) {
    const client = createR2Client({
      endpoint,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    });

    const endpointBucketCandidates = [...configuredBucketCandidates];
    try {
      const listed = await client.send(new ListBucketsCommand({}));
      const discovered = Array.isArray(listed?.Buckets)
        ? listed.Buckets.map((bucket) => normalizeText(bucket?.Name, 120)).filter(Boolean)
        : [];

      for (const bucketName of discovered) {
        appendIfMissing(endpointBucketCandidates, bucketName);
      }
    } catch (error) {
      console.warn(
        `[r2] bucket listesi alinamadi. endpoint=${endpoint} code=${getR2ErrorCode(error)} message=${getR2ErrorMessage(error)}`,
      );
    }

    for (const bucketName of endpointBucketCandidates) {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
        resolvedR2Target = { client, endpoint, bucketName };
        console.log(`[r2] endpoint ve bucket dogrulandi. endpoint=${endpoint} bucket=${bucketName}`);
        return resolvedR2Target;
      } catch (error) {
        lastError = error;
        const statusCode = Number(error?.$metadata?.httpStatusCode || 0);
        const errorCode = getR2ErrorCode(error);

        if (statusCode === 403 || errorCode.toLowerCase() === 'accessdenied') {
          resolvedR2Target = { client, endpoint, bucketName };
          console.warn(`[r2] HeadBucket 403 dondu, endpoint/bucket yine de kullaniliyor. endpoint=${endpoint} bucket=${bucketName}`);
          return resolvedR2Target;
        }

        console.warn(
          `[r2] endpoint/bucket probe basarisiz. endpoint=${endpoint} bucket=${bucketName} code=${errorCode} message=${getR2ErrorMessage(error)}`,
        );
      }
    }
  }

  throw new HttpsError(
    'failed-precondition',
    `R2 endpoint/bucket eslesmesi bulunamadi. endpoint adaylari: ${endpointCandidates.join(' | ')} ; bucket adaylari: ${configuredBucketCandidates.join(' | ')} ; son hata: ${getR2ErrorCode(lastError)} ${getR2ErrorMessage(lastError)}`,
  );
}

async function assertProjectMemberAccess(projectId, uid) {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) {
    throw new HttpsError('invalid-argument', 'projectId zorunludur.');
  }

  const projectRef = db.collection('projects').doc(normalizedProjectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) {
    throw new HttpsError('not-found', 'Proje bulunamadi.');
  }

  const project = projectSnap.data() || {};
  const memberUids = project.memberUids || [];
  if (!memberUids.includes(uid)) {
    throw new HttpsError('permission-denied', 'Bu proje dosyalarina erisim yetkiniz yok.');
  }

  return { projectRef, project, projectId: normalizedProjectId };
}

async function assertAdminPanelAccess(uid) {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) {
    throw new HttpsError('unauthenticated', 'Giris yapmaniz gerekiyor.');
  }

  const adminRef = db.collection('admins').doc(normalizedUid);
  const adminSnap = await adminRef.get();
  if (!adminSnap.exists) {
    throw new HttpsError('permission-denied', 'Admin panel yetkisi gerekiyor.');
  }

  const adminData = adminSnap.data() || {};
  if (adminData.isActive === false) {
    throw new HttpsError('permission-denied', 'Admin hesabi pasif oldugu icin islem yapilamiyor.');
  }

  return { adminRef, adminData, uid: normalizedUid };
}

function hasProjectDeletionAccess(project, uid) {
  if (String(project?.uid || '') === uid) return true;
  const role = (project?.team || []).find((member) => String(member?.uid || '') === uid)?.role || '';
  return role === 'owner' || role === 'editor';
}

async function isActiveAdmin(uid) {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) {
    return false;
  }

  const adminSnap = await db.collection('admins').doc(normalizedUid).get();
  if (!adminSnap.exists) {
    return false;
  }

  const adminData = adminSnap.data() || {};
  return adminData.isActive !== false;
}

function extractR2ObjectKeyFromProductFile(file) {
  if (!file || typeof file !== 'object') {
    return '';
  }

  const objectKey = normalizeText(file.objectKey, 500);
  if (objectKey) {
    return objectKey;
  }

  const fileUrl = normalizeText(file.url, 1200);
  if (!fileUrl.toLowerCase().startsWith('r2://')) {
    return '';
  }

  return normalizeText(fileUrl.slice(5), 500);
}

function productContainsObjectKey(product, objectKey) {
  const normalizedObjectKey = normalizeText(objectKey, 500);
  if (!normalizedObjectKey) {
    return false;
  }

  const files = Array.isArray(product?.files) ? product.files : [];
  return files.some((file) => extractR2ObjectKeyFromProductFile(file) === normalizedObjectKey);
}

function isPublicDemoProduct(product) {
  return normalizeText(product?.category, 80).toLowerCase() === 'demo_map';
}

async function assertProductReadAccess(productId, uid) {
  const normalizedProductId = String(productId || '').trim();
  if (!normalizedProductId) {
    throw new HttpsError('invalid-argument', 'productId zorunludur.');
  }

  const productRef = db.collection('products').doc(normalizedProductId);
  const productSnap = await productRef.get();
  if (!productSnap.exists) {
    throw new HttpsError('not-found', 'Urun bulunamadi.');
  }

  const product = productSnap.data() || {};
  if (isPublicDemoProduct(product)) {
    return { productRef, product, productId: normalizedProductId };
  }

  if (String(product?.assignedTo || '').trim() === uid) {
    return { productRef, product, productId: normalizedProductId };
  }

  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists) {
    const userData = userSnap.data() || {};
    const ownedProjectIds = Array.isArray(userData.owned_project_ids)
      ? userData.owned_project_ids.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

    if (ownedProjectIds.includes(normalizedProductId)) {
      return { productRef, product, productId: normalizedProductId };
    }
  }

  if (await isActiveAdmin(uid)) {
    return { productRef, product, productId: normalizedProductId };
  }

  throw new HttpsError('permission-denied', 'Bu urun dosyalarina erisim yetkiniz yok.');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildRateLimitDocId(prefix, value) {
  const normalized = String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 120);
  return `${prefix}_${normalized || 'unknown'}`;
}

async function enforceContactRateLimit({ email, ip }) {
  const now = Date.now();
  const items = [
    {
      docId: buildRateLimitDocId('email', email),
      limit: CONTACT_RATE_LIMIT_PER_EMAIL,
      label: 'e-posta',
    },
  ];

  if (ip) {
    items.push({
      docId: buildRateLimitDocId('ip', ip),
      limit: CONTACT_RATE_LIMIT_PER_IP,
      label: 'ip',
    });
  }

  await db.runTransaction(async (tx) => {
    const docs = await Promise.all(
      items.map((item) => tx.get(db.collection('contactRateLimits').doc(item.docId)))
    );

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const snap = docs[i];
      const data = snap.exists ? snap.data() || {} : {};
      const previousWindowStart = Number(data.windowStartMs || 0);
      const inActiveWindow = previousWindowStart > 0 && (now - previousWindowStart) < CONTACT_RATE_LIMIT_WINDOW_MS;
      const windowStartMs = inActiveWindow ? previousWindowStart : now;
      const currentCount = inActiveWindow ? Number(data.count || 0) : 0;

      if (currentCount + 1 > item.limit) {
        throw new HttpsError(
          'resource-exhausted',
          `Cok sik mesaj gonderiyorsunuz (${item.label}). Lutfen birkac dakika sonra tekrar deneyin.`
        );
      }

      tx.set(
        db.collection('contactRateLimits').doc(item.docId),
        {
          windowStartMs,
          count: currentCount + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });
}

function buildContactSubmissionAdminHtml({ name, email, message, submissionId, source, ip, userAgent }) {
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');
  return `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.45">
      <h2 style="margin:0 0 12px">Yeni Iletisim Formu Mesaji</h2>
      <p style="margin:0 0 6px"><strong>Gonderim ID:</strong> ${escapeHtml(submissionId)}</p>
      <p style="margin:0 0 6px"><strong>Isim:</strong> ${escapeHtml(name)}</p>
      <p style="margin:0 0 6px"><strong>E-posta:</strong> ${escapeHtml(email)}</p>
      <p style="margin:0 0 6px"><strong>Kaynak:</strong> ${escapeHtml(source)}</p>
      <p style="margin:0 0 6px"><strong>IP:</strong> ${escapeHtml(ip || '-')}</p>
      <p style="margin:0 0 14px"><strong>User-Agent:</strong> ${escapeHtml(userAgent || '-')}</p>
      <div style="padding:12px;border:1px solid #ddd;background:#fafafa;border-radius:8px">
        ${safeMessage}
      </div>
    </div>
  `;
}

function buildContactSubmissionUserHtml({ name, message }) {
  const safeName = escapeHtml(name);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');

  return `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.45">
      <h2 style="margin:0 0 12px">Mesajinizi Aldik</h2>
      <p style="margin:0 0 10px">Merhaba ${safeName},</p>
      <p style="margin:0 0 10px">Archilya iletisime gonderdiginiz mesaj bize ulasti. En kisa surede size geri donus saglayacagiz.</p>
      <div style="padding:12px;border:1px solid #ddd;background:#fafafa;border-radius:8px;margin:0 0 12px">
        ${safeMessage}
      </div>
      <p style="margin:0 0 6px"><strong>Iletisim:</strong> ${escapeHtml(CONTACT_INBOX_EMAIL)}</p>
      <p style="margin:0"><strong>Telefon:</strong> ${escapeHtml(CONTACT_REPLY_PHONE)}</p>
    </div>
  `;
}

function getResendClient() {
  let apiKey;
  try {
    apiKey = RESEND_API_KEY.value();
  } catch (err) {
    throw new HttpsError('failed-precondition', `Mail servisi anahtari okunamadi: ${err.message}`);
  }

  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Mail servisi anahtari bulunamadi.');
  }

  return new Resend(apiKey);
}

async function sendContactSubmissionEmails({ name, email, message, submissionId, source, ip, userAgent }) {
  const resend = getResendClient();
  const fromAddress = `Archilya Iletisim <${CONTACT_FROM_EMAIL}>`;

  const adminPromise = resend.emails.send({
    from: fromAddress,
    to: [CONTACT_INBOX_EMAIL],
    replyTo: email,
    subject: `Yeni Iletisim Formu Mesaji - ${name}`,
    html: buildContactSubmissionAdminHtml({
      name,
      email,
      message,
      submissionId,
      source,
      ip,
      userAgent,
    }),
  });

  const userPromise = resend.emails.send({
    from: fromAddress,
    to: [email],
    subject: 'Mesajinizi Aldik - Archilya',
    html: buildContactSubmissionUserHtml({
      name,
      message,
    }),
  });

  const [adminResult, userResult] = await Promise.allSettled([adminPromise, userPromise]);

  return {
    admin: {
      sent: adminResult.status === 'fulfilled' && Boolean(adminResult.value?.id),
      error: adminResult.status === 'rejected' ? String(adminResult.reason?.message || adminResult.reason || 'unknown') : null,
      id: adminResult.status === 'fulfilled' ? adminResult.value?.id || null : null,
    },
    user: {
      sent: userResult.status === 'fulfilled' && Boolean(userResult.value?.id),
      error: userResult.status === 'rejected' ? String(userResult.reason?.message || userResult.reason || 'unknown') : null,
      id: userResult.status === 'fulfilled' ? userResult.value?.id || null : null,
    },
  };
}

async function ensureUserProfileDoc(uid, extras = {}) {
  const userRef = db.collection('users').doc(uid);
  const normalizedExtras = {
    ...(extras.email ? { email: normalizeEmail(extras.email) } : {}),
    ...(extras.displayName ? { displayName: normalizeText(extras.displayName, 120) } : {}),
  };

  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set({
      credits: INITIAL_CREDITS,
      totalEarned: INITIAL_CREDITS,
      totalSpent: 0,
      plan: 'free',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...normalizedExtras,
    });

    const txRef = db.collection('users').doc(uid).collection('transactions').doc();
    await txRef.set({
      type: 'earn',
      amount: INITIAL_CREDITS,
      description: 'Hos geldin kredisi',
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  if (Object.keys(normalizedExtras).length > 0) {
    await userRef.set({
      ...normalizedExtras,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}
function normalizeAiHistorySceneReferences(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.slice(0, 4).map((item) => ({
    uri: normalizeText(item?.uri, 5000),
    mimeType: normalizeText(item?.mimeType, 60),
    type: normalizeText(item?.type, 30),
    label: normalizeText(item?.label, 120),
    note: normalizeText(item?.note, 500),
  }));
}

async function getAuthorizedWorkspaceForUser(workspaceId, uid) {
  const wsRef = db.collection('workspaces').doc(workspaceId);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) {
    throw new HttpsError('not-found', 'Calisma alani bulunamadi.');
  }

  const ws = wsSnap.data() || {};
  const memberUids = Array.isArray(ws.memberUids) ? ws.memberUids : [];
  if (!memberUids.includes(uid)) {
    throw new HttpsError('permission-denied', 'Bu calisma alani icin yetkiniz yok.');
  }

  return { wsRef, ws };
}

async function findSingleWorkspaceForUser(uid) {
  const wsSnap = await db.collection('workspaces')
    .where('memberUids', 'array-contains', uid)
    .limit(2)
    .get();

  if (wsSnap.size > 1) {
    throw new HttpsError('failed-precondition', 'Hesap birden fazla calisma alanina bagli gorunuyor.');
  }

  if (wsSnap.empty) return null;

  const docSnap = wsSnap.docs[0];
  return { id: docSnap.id, ref: docSnap.ref, data: docSnap.data() || {} };
}

async function chargeAiCredits({ uid, email, amount, toolId }) {
  const workspace = await findSingleWorkspaceForUser(uid);

  if (workspace) {
    await db.runTransaction(async (tx) => {
      const wsSnap = await tx.get(workspace.ref);
      if (!wsSnap.exists) {
        throw new HttpsError('not-found', 'Calisma alani bulunamadi.');
      }
      const ws = wsSnap.data() || {};
      const currentPool = Number(ws.poolCredits || 0);
      const memberUids = Array.isArray(ws.memberUids) ? ws.memberUids : [];

      if (!memberUids.includes(uid)) {
        throw new HttpsError('permission-denied', 'Calisma alani kredisi icin yetkiniz yok.');
      }
      if (currentPool < amount) {
        throw new HttpsError('failed-precondition', `Workspace havuzunda yeterli kredi yok. Mevcut: ${currentPool}, gereken: ${amount}.`);
      }

      tx.update(workspace.ref, {
        poolCredits: currentPool - amount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return {
      source: 'workspace',
      workspaceId: workspace.id,
      amount,
      toolId,
    };
  }

  const userRef = db.collection('users').doc(uid);
  await ensureUserProfileDoc(uid, { email });

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const data = userSnap.data() || {};
    const credits = Number(data.credits || 0);
    if (credits < amount) {
      throw new HttpsError('failed-precondition', `Yetersiz kredi. Mevcut: ${credits}, gereken: ${amount}.`);
    }

    tx.update(userRef, {
      credits: credits - amount,
      totalSpent: Number(data.totalSpent || 0) + amount,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const txRef = db.collection('users').doc(uid).collection('transactions').doc();
    tx.set(txRef, {
      type: 'spend',
      amount,
      description: `AI islem: ${toolId}`,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    source: 'personal',
    userId: uid,
    amount,
    toolId,
  };
}

async function refundAiCredits(charge) {
  if (!charge) return;

  if (charge.source === 'workspace' && charge.workspaceId) {
    const wsRef = db.collection('workspaces').doc(charge.workspaceId);
    await wsRef.update({
      poolCredits: FieldValue.increment(charge.amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  if (charge.source === 'personal' && charge.userId) {
    const userRef = db.collection('users').doc(charge.userId);
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const data = userSnap.data() || {};
      tx.update(userRef, {
        credits: Number(data.credits || 0) + charge.amount,
        totalSpent: Math.max(0, Number(data.totalSpent || 0) - charge.amount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const txRef = db.collection('users').doc(charge.userId).collection('transactions').doc();
      tx.set(txRef, {
        type: 'refund',
        amount: charge.amount,
        description: `AI islem iadesi: ${charge.toolId}`,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  }
}

const AI_STUDIO_JOB_QUEUE_FUNCTION = 'locations/europe-west1/functions/processAiStudioJob';
const AI_STUDIO_JOB_QUEUE_MAX_ATTEMPTS = 3;
const AI_STUDIO_JOB_STORAGE_PREFIX = 'ai-studio-jobs';

function getAiStudioJobRef(uid, jobId) {
  return db.collection('users').doc(uid).collection('aiStudioJobs').doc(jobId);
}

function buildAiStudioJobStoragePrefix(uid, jobId) {
  return `${AI_STUDIO_JOB_STORAGE_PREFIX}/${uid}/${jobId}`;
}

function sanitizeStoragePathSegment(value, fallback = 'file') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

function getImageExtensionFromMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  throw new HttpsError('invalid-argument', 'Desteklenmeyen gorsel formatı.');
}

function buildFirebaseStorageDownloadUrl(bucketName, filePath, downloadToken) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;
}

function normalizeAiStudioJobInput(data = {}) {
  const {
    imagePart,
    outputType,
    toolId,
    toolLabel,
    style,
    sceneEditMode,
    extraNote,
    generationVariant,
    sourceImageName,
    sourceImageMimeType,
    sourceImageUri,
    imageUrls,
    sceneReferences,
    referenceImages,
    workflow,
  } = data || {};

  const normalizedToolId = String(toolId || 'unknown').trim();
  const inferredOutputType = getAiStudioToolOutputType(normalizedToolId);
  const normalizedOutputType = outputType === 'text' || outputType === 'image' ? outputType : inferredOutputType;

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

  const normalizedStyle = normalizeText(style, 80);
  const normalizedSceneEditMode = normalizeText(sceneEditMode, 80);
  const normalizedWorkflow = normalizedToolId === 'sceneedit'
    ? normalizeSceneEditMode(workflow || normalizedSceneEditMode)
    : '';
  const normalizedExtraNote = normalizeText(extraNote, 2000);
  const prompt = buildAiStudioPrompt({
    toolId: normalizedToolId,
    style: normalizedStyle,
    extraNote: normalizedExtraNote,
    sceneEditMode: normalizedSceneEditMode || normalizedWorkflow,
    workflow: normalizedWorkflow,
    referenceImages: normalizedReferences,
  });
  const normalizedImageUrls = normalizeImageUrls(imageUrls);
  const normalizedSceneReferences = normalizeAiHistorySceneReferences(sceneReferences);
  const config = mapAiToolConfig(normalizedToolId, normalizedOutputType);

  return {
    toolId: normalizedToolId,
    toolLabel: normalizeText(toolLabel, 120) || normalizedToolId,
    outputType: normalizedOutputType,
    prompt,
    style: normalizedStyle,
    sceneEditMode: normalizedSceneEditMode || normalizedWorkflow,
    extraNote: normalizedExtraNote,
    generationVariant: normalizeText(generationVariant, 40) || 'default',
    sourceImageName: normalizeText(sourceImageName, 180),
    sourceImageMimeType: normalizeText(sourceImageMimeType, 80) || normalizeText(imagePart?.inlineData?.mimeType, 80),
    sourceImageUri: normalizeText(sourceImageUri, 5000) || normalizedImageUrls[0] || '',
    imageUrls: normalizedImageUrls,
    sceneReferences: normalizedSceneReferences.length
      ? normalizedSceneReferences
      : normalizedReferences.map((reference) => ({
          type: reference.type,
          label: reference.label,
          note: reference.note,
          mimeType: normalizeText(reference.imagePart?.inlineData?.mimeType, 80),
          uri: '',
        })),
    workflow: normalizedWorkflow,
    imagePart,
    referenceImages: normalizedReferences,
    config,
    totalImageBase64Length,
  };
}

async function saveAiStudioStorageFile({ filePath, buffer, mimeType, makeDownloadable = false }) {
  const bucket = admin.storage().bucket();
  const metadata = { contentType: mimeType };
  let downloadToken = null;

  if (makeDownloadable) {
    downloadToken = crypto.randomUUID();
    metadata.metadata = { firebaseStorageDownloadTokens: downloadToken };
  }

  await bucket.file(filePath).save(buffer, {
    resumable: false,
    metadata,
  });

  return {
    bucketName: bucket.name,
    downloadToken,
  };
}

async function persistAiStudioInputImage({ uid, jobId, category, imagePart, index = 0 }) {
  validateImagePart(imagePart);

  const mimeType = String(imagePart?.inlineData?.mimeType || '').toLowerCase();
  const ext = getImageExtensionFromMimeType(mimeType);
  const buffer = Buffer.from(String(imagePart?.inlineData?.data || ''), 'base64');
  const safeCategory = sanitizeStoragePathSegment(category, 'input');
  const filePath = `${buildAiStudioJobStoragePrefix(uid, jobId)}/inputs/${safeCategory}-${index}.${ext}`;

  await saveAiStudioStorageFile({ filePath, buffer, mimeType });

  return {
    storagePath: filePath,
    mimeType,
    sizeBytes: buffer.length,
  };
}

async function loadAiStudioInputImage(storedImage) {
  if (!storedImage?.storagePath || !storedImage?.mimeType) {
    throw new HttpsError('failed-precondition', 'AI job girdi gorseli eksik.');
  }

  const bucket = admin.storage().bucket();
  const [buffer] = await bucket.file(String(storedImage.storagePath)).download();

  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType: String(storedImage.mimeType),
    },
  };
}

function extractAiStudioOutputBase64(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match?.[1] || !match?.[2]) {
    throw new HttpsError('aborted', 'AI gorsel cikti verisi gecersiz.');
  }

  return {
    mimeType: String(match[1]).toLowerCase(),
    base64Data: match[2],
  };
}

async function persistAiStudioOutputImage({ uid, jobId, toolId, image }) {
  const extracted = extractAiStudioOutputBase64(image?.dataUrl || '');
  const mimeType = String(image?.mimeType || extracted.mimeType || '').toLowerCase();
  const ext = getImageExtensionFromMimeType(mimeType);
  const buffer = Buffer.from(extracted.base64Data, 'base64');
  const filePath = `${buildAiStudioJobStoragePrefix(uid, jobId)}/outputs/${sanitizeStoragePathSegment(toolId, 'result')}-${Date.now()}.${ext}`;
  const savedFile = await saveAiStudioStorageFile({
    filePath,
    buffer,
    mimeType,
    makeDownloadable: true,
  });

  return {
    mimeType,
    sizeBytes: buffer.length,
    storagePath: filePath,
    downloadUrl: buildFirebaseStorageDownloadUrl(savedFile.bucketName, filePath, savedFile.downloadToken),
  };
}

function normalizeAiStudioJobError(err) {
  return {
    code: normalizeText(err?.code || 'unknown', 120) || 'unknown',
    message: normalizeText(err?.message || 'AI islemi tamamlanamadi.', 4000) || 'AI islemi tamamlanamadi.',
    details: err instanceof HttpsError && err?.details ? err.details : null,
  };
}

function isAiStudioRetriableError(err) {
  const code = String(err?.code || '').toLowerCase();
  const category = String(err?.details?.category || '').toLowerCase();

  if (['internal', 'unavailable', 'deadline-exceeded', 'resource-exhausted'].includes(code)) {
    return true;
  }

  if (Number.isFinite(Number(err?.details?.retryAfterSeconds))) {
    return true;
  }

  return [
    'gemini_network_error',
    'gemini_http_error',
    'gemini_unexpected_error',
  ].includes(category);
}

async function markAiStudioJobForRetry({ jobRef, err, attemptNumber }) {
  await jobRef.set({
    status: 'pending',
    error: normalizeAiStudioJobError(err),
    retry: {
      retryable: true,
      lastAttemptNumber: attemptNumber,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function claimAiStudioJobRun({ jobRef, taskContext }) {
  return db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) {
      throw new HttpsError('not-found', 'AI job bulunamadi.');
    }

    const job = jobSnap.data() || {};
    if (job.status === 'completed' || job.status === 'failed') {
      return { skip: true, job };
    }

    tx.set(jobRef, {
      status: 'running',
      startedAt: job.startedAt || FieldValue.serverTimestamp(),
      lastAttemptAt: FieldValue.serverTimestamp(),
      attemptCount: FieldValue.increment(1),
      processor: {
        queueName: taskContext.queueName || null,
        taskId: taskContext.id || null,
        retryCount: Number.isFinite(taskContext.retryCount) ? taskContext.retryCount : 0,
        executionCount: Number.isFinite(taskContext.executionCount) ? taskContext.executionCount : 1,
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { skip: false, job };
  });
}

async function chargeAiStudioJobCredits({ jobRef, uid, email, amount, toolId }) {
  const workspace = await findSingleWorkspaceForUser(uid);

  if (workspace) {
    return db.runTransaction(async (tx) => {
      const [jobSnap, wsSnap] = await Promise.all([
        tx.get(jobRef),
        tx.get(workspace.ref),
      ]);

      if (!jobSnap.exists) {
        throw new HttpsError('not-found', 'AI job bulunamadi.');
      }
      if (!wsSnap.exists) {
        throw new HttpsError('not-found', 'Calisma alani bulunamadi.');
      }

      const job = jobSnap.data() || {};
      const billing = job.billing || {};
      if (billing.status === 'charged') {
        return {
          source: 'workspace',
          workspaceId: billing.workspaceId || workspace.id,
          amount: Number(billing.amount || amount),
          toolId,
        };
      }

      const ws = wsSnap.data() || {};
      const currentPool = Number(ws.poolCredits || 0);
      const memberUids = Array.isArray(ws.memberUids) ? ws.memberUids : [];

      if (!memberUids.includes(uid)) {
        throw new HttpsError('permission-denied', 'Calisma alani kredisi icin yetkiniz yok.');
      }
      if (currentPool < amount) {
        throw new HttpsError('failed-precondition', `Workspace havuzunda yeterli kredi yok. Mevcut: ${currentPool}, gereken: ${amount}.`);
      }

      tx.update(workspace.ref, {
        poolCredits: currentPool - amount,
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(jobRef, {
        billing: {
          amount,
          toolId,
          status: 'charged',
          chargeSource: 'workspace',
          workspaceId: workspace.id,
          userId: uid,
          chargedAt: FieldValue.serverTimestamp(),
          refundedAt: null,
          refundError: null,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return {
        source: 'workspace',
        workspaceId: workspace.id,
        amount,
        toolId,
      };
    });
  }

  await ensureUserProfileDoc(uid, { email });
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const [jobSnap, userSnap] = await Promise.all([
      tx.get(jobRef),
      tx.get(userRef),
    ]);

    if (!jobSnap.exists) {
      throw new HttpsError('not-found', 'AI job bulunamadi.');
    }

    const job = jobSnap.data() || {};
    const billing = job.billing || {};
    if (billing.status === 'charged') {
      return {
        source: 'personal',
        userId: billing.userId || uid,
        amount: Number(billing.amount || amount),
        toolId,
      };
    }

    const data = userSnap.data() || {};
    const credits = Number(data.credits || 0);
    if (credits < amount) {
      throw new HttpsError('failed-precondition', `Yetersiz kredi. Mevcut: ${credits}, gereken: ${amount}.`);
    }

    tx.update(userRef, {
      credits: credits - amount,
      totalSpent: Number(data.totalSpent || 0) + amount,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const txRef = db.collection('users').doc(uid).collection('transactions').doc();
    tx.set(txRef, {
      type: 'spend',
      amount,
      description: `AI islem: ${toolId}`,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(jobRef, {
      billing: {
        amount,
        toolId,
        status: 'charged',
        chargeSource: 'personal',
        workspaceId: null,
        userId: uid,
        chargedAt: FieldValue.serverTimestamp(),
        refundedAt: null,
        refundError: null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      source: 'personal',
      userId: uid,
      amount,
      toolId,
    };
  });
}

async function refundAiStudioJobCredits(jobRef) {
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) {
    throw new HttpsError('not-found', 'AI job bulunamadi.');
  }

  const job = jobSnap.data() || {};
  const billing = job.billing || {};
  const amount = Number(billing.amount || 0);

  if (!amount || billing.status === 'refunded' || billing.status === 'not_charged') {
    return false;
  }

  if (billing.chargeSource === 'workspace' && billing.workspaceId) {
    const wsRef = db.collection('workspaces').doc(String(billing.workspaceId));
    await db.runTransaction(async (tx) => {
      const [latestJobSnap, wsSnap] = await Promise.all([
        tx.get(jobRef),
        tx.get(wsRef),
      ]);

      if (!latestJobSnap.exists || !wsSnap.exists) {
        throw new HttpsError('not-found', 'Iade icin gerekli belge bulunamadi.');
      }

      const latestBilling = (latestJobSnap.data() || {}).billing || {};
      if (latestBilling.status === 'refunded' || latestBilling.status === 'not_charged') {
        return;
      }

      tx.update(wsRef, {
        poolCredits: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(jobRef, {
        billing: {
          ...latestBilling,
          status: 'refunded',
          refundError: null,
          refundedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    return true;
  }

  if (billing.chargeSource === 'personal' && billing.userId) {
    const userRef = db.collection('users').doc(String(billing.userId));
    await db.runTransaction(async (tx) => {
      const [latestJobSnap, userSnap] = await Promise.all([
        tx.get(jobRef),
        tx.get(userRef),
      ]);

      if (!latestJobSnap.exists) {
        throw new HttpsError('not-found', 'AI job bulunamadi.');
      }

      const latestBilling = (latestJobSnap.data() || {}).billing || {};
      if (latestBilling.status === 'refunded' || latestBilling.status === 'not_charged') {
        return;
      }

      const data = userSnap.data() || {};
      tx.update(userRef, {
        credits: Number(data.credits || 0) + amount,
        totalSpent: Math.max(0, Number(data.totalSpent || 0) - amount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const txRef = db.collection('users').doc(uid).collection('transactions').doc();
      tx.set(txRef, {
        type: 'refund',
        amount,
        description: `AI islem iadesi: ${latestBilling.toolId || 'unknown'}`,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.set(jobRef, {
        billing: {
          ...latestBilling,
          status: 'refunded',
          refundError: null,
          refundedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    return true;
  }

  return false;
}

async function executeAiStudioJob(job) {
  const toolId = String(job.toolId || 'unknown');
  const outputType = job.outputType === 'image' ? 'image' : 'text';
  const model = outputType === 'image' ? GEMINI_MODELS.image : GEMINI_MODELS.text;
  const fallbackModels = outputType === 'image' ? GEMINI_FALLBACK_MODELS.image : GEMINI_FALLBACK_MODELS.text;
  const primaryImagePart = await loadAiStudioInputImage(job.input?.primaryImage);

  const normalizedReferences = await Promise.all(
    (Array.isArray(job.input?.referenceImages) ? job.input.referenceImages : []).map(async (reference) => ({
      type: normalizeSceneReferenceType(reference?.type),
      label: normalizeText(reference?.label, 120),
      note: normalizeText(reference?.note, 500),
      imagePart: await loadAiStudioInputImage(reference),
    }))
  );

  const prompt = buildAiStudioPrompt({
    toolId,
    style: normalizeText(job.style, 80),
    extraNote: normalizeText(job.extraNote, 2000),
    sceneEditMode: normalizeText(job.sceneEditMode, 80),
    workflow: normalizeText(job.workflow, 80),
    referenceImages: normalizedReferences,
  });

  const userParts = toolId === 'sceneedit'
    ? buildSceneEditParts({
        imagePart: primaryImagePart,
        prompt,
        workflow: normalizeText(job.workflow, 80),
        referenceImages: normalizedReferences,
      })
    : [primaryImagePart, { text: prompt }];

  const payload = {
    contents: [{
      role: 'user',
      parts: userParts,
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
    context: { toolId, outputType },
  });

  const data = geminiResponse.data;
  const activeModel = geminiResponse.model;
  const summary = summarizeGeminiPayload(data);

  if (outputType === 'image') {
    const image = extractGeminiImage(data, {
      toolId,
      model: activeModel,
      outputType,
    });
    const storedImage = await persistAiStudioOutputImage({
      uid: String(job.uid || ''),
      jobId: String(job.jobId || ''),
      toolId,
      image,
    });

    return {
      outputType,
      model: activeModel,
      summary,
      image: storedImage,
    };
  }

  return {
    outputType,
    model: activeModel,
    summary,
    text: extractGeminiText(data),
  };
}

function normalizeMember(member) {
  if (!member || !member.uid) return null;
  return {
    uid: String(member.uid),
    email: normalizeEmail(member.email || ''),
    displayName: normalizeText(member.displayName || member.email || '', 120) || normalizeEmail(member.email || ''),
    role: member.role === 'admin' ? 'admin' : 'member',
    joinedAt: member.joinedAt || new Date().toISOString(),
  };
}

function buildChunkedBatches(docs, buildUpdate) {
  const chunks = [];
  let batch = db.batch();
  let count = 0;

  docs.forEach((docSnap) => {
    const updatePayload = buildUpdate(docSnap);
    if (!updatePayload) return;
    batch.update(docSnap.ref, updatePayload);
    count += 1;

    if (count === 400) {
      chunks.push(batch);
      batch = db.batch();
      count = 0;
    }
  });

  if (count > 0) chunks.push(batch);
  return chunks;
}

function buildChunkedDeleteBatches(docs) {
  const chunks = [];
  let batch = db.batch();
  let count = 0;

  docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    count += 1;

    if (count === 400) {
      chunks.push(batch);
      batch = db.batch();
      count = 0;
    }
  });

  if (count > 0) chunks.push(batch);
  return chunks;
}

async function getWorkspaceProjects(workspaceId) {
  const snap = await db.collection('projects').where('workspaceId', '==', workspaceId).get();
  return snap.docs.filter((d) => d.data()?.isDeleted !== true);
}

async function syncMemberIntoWorkspaceProjects(workspaceId, memberInfo) {
  const projects = await getWorkspaceProjects(workspaceId);
  if (!projects.length) return;

  const normalizedMember = normalizeMember(memberInfo);
  if (!normalizedMember) return;

  const batches = buildChunkedBatches(projects, (projDoc) => {
    const proj = projDoc.data() || {};
    const memberUids = Array.isArray(proj.memberUids) ? proj.memberUids : [];
    if (memberUids.includes(normalizedMember.uid)) return null;

    return {
      memberUids: FieldValue.arrayUnion(normalizedMember.uid),
      team: FieldValue.arrayUnion({
        uid: normalizedMember.uid,
        email: normalizedMember.email,
        role: 'member',
      }),
      activityLog: FieldValue.arrayUnion({
        action: 'member_join',
        user: normalizedMember.email,
        timestamp: new Date().toISOString(),
        details: `${normalizedMember.email} calisma alani uyesi olarak projeye eklendi`,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    };
  });

  await Promise.all(batches.map((b) => b.commit()));
}

async function syncMemberRemovalFromWorkspaceProjects(workspaceId, memberUid, memberEmail) {
  const projects = await getWorkspaceProjects(workspaceId);
  if (!projects.length) return;

  const normalizedUid = String(memberUid);
  const normalizedEmail = normalizeEmail(memberEmail || '');

  const batches = buildChunkedBatches(projects, (projDoc) => {
    const proj = projDoc.data() || {};
    const memberUids = Array.isArray(proj.memberUids) ? proj.memberUids : [];
    const team = Array.isArray(proj.team) ? proj.team : [];

    if (!memberUids.includes(normalizedUid)) return null;

    if (proj.uid === normalizedUid) {
      return {
        workspaceId: null,
        workspaceName: null,
        activityLog: FieldValue.arrayUnion({
          action: 'workspace_detach',
          user: normalizedEmail,
          timestamp: new Date().toISOString(),
          details: `${normalizedEmail} workspace disina alindigi icin sahip oldugu proje bagimsiz moda gecirildi`,
        }),
        updatedAt: FieldValue.serverTimestamp(),
      };
    }

    const teamMember = team.find((m) => String(m?.uid || '') === normalizedUid);
    const payload = {
      memberUids: FieldValue.arrayRemove(normalizedUid),
      activityLog: FieldValue.arrayUnion({
        action: 'member_removed',
        user: normalizedEmail,
        timestamp: new Date().toISOString(),
        details: `${normalizedEmail} calisma alanindan cikarildigi icin proje erisimi kaldirildi`,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (teamMember) payload.team = FieldValue.arrayRemove(teamMember);
    return payload;
  });

  await Promise.all(batches.map((b) => b.commit()));
}

function resolveProjectFileTypeKey(rawType) {
  const ext = normalizeText(rawType, 24).toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'dwg' || ext === 'dxf') return 'dwg';
  return 'img';
}

function buildProjectFolderId(rawFolderId = '') {
  const normalized = normalizeText(rawFolderId, 120).replace(/[^a-zA-Z0-9_-]/g, '');
  if (normalized) {
    return normalized;
  }
  return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function findProjectFolderByName(folders, folderName = '') {
  const target = normalizeText(folderName, 120).toLowerCase();
  if (!target) return null;
  return (Array.isArray(folders) ? folders : []).find(
    (folder) => normalizeText(folder?.name, 120).toLowerCase() === target,
  ) || null;
}

function normalizeProjectAiMeta(rawMeta) {
  if (!rawMeta || typeof rawMeta !== 'object') {
    return null;
  }

  const referenceCountRaw = Math.round(Number(rawMeta.referenceCount || 0));
  const referenceCount = Number.isFinite(referenceCountRaw)
    ? Math.max(0, Math.min(20, referenceCountRaw))
    : 0;

  return {
    source: normalizeText(rawMeta.source, 80) || 'ai-studio',
    isAiGenerated: rawMeta.isAiGenerated !== false,
    toolId: normalizeText(rawMeta.toolId, 80),
    toolLabel: normalizeText(rawMeta.toolLabel, 120),
    promptText: normalizeText(rawMeta.promptText, 6000),
    style: normalizeText(rawMeta.style, 120),
    editMode: normalizeText(rawMeta.editMode, 120),
    referenceCount,
    generatedAt: normalizeText(rawMeta.generatedAt, 80) || new Date().toISOString(),
  };
}

function normalizeProjectFileForMutation(rawFile = {}, { aiMode = false } = {}) {
  if (!rawFile || typeof rawFile !== 'object') {
    throw new HttpsError('invalid-argument', 'file verisi gecersiz.');
  }

  const name = sanitizeFileName(rawFile.name, 220);
  const url = normalizeText(rawFile.url, 4000);
  if (!url) {
    throw new HttpsError('invalid-argument', 'file.url zorunludur.');
  }

  const type = normalizeText(rawFile.type, 24).toLowerCase() || getFileExtension(name) || 'bin';
  const contentType = normalizeContentType(rawFile.contentType, name);
  const sizeRaw = Number(rawFile.size || 0);
  const size = Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.round(sizeRaw) : 0;
  const folderIdValue = rawFile.folderId == null ? '' : normalizeText(rawFile.folderId, 120);
  const pathValue = normalizeText(rawFile.path, 1200);
  const objectKeyValue = normalizeText(rawFile.objectKey, 800);
  const storageProvider = normalizeText(rawFile.storageProvider, 32).toLowerCase() || 'firebase';

  return {
    name,
    size,
    type,
    url,
    path: pathValue || null,
    storageProvider,
    objectKey: objectKeyValue || null,
    contentType,
    folderId: folderIdValue || null,
    createdAt: normalizeText(rawFile.createdAt, 80) || new Date().toISOString(),
    aiGenerated: aiMode || rawFile.aiGenerated === true,
    aiMeta: aiMode ? normalizeProjectAiMeta(rawFile.aiMeta) : null,
  };
}

function ensureUniqueProjectFileName(rawFileName, files) {
  const normalized = sanitizeFileName(rawFileName, 220);
  const used = new Set(
    (Array.isArray(files) ? files : [])
      .map((file) => normalizeText(file?.name, 260).toLowerCase())
      .filter(Boolean),
  );

  if (!used.has(normalized.toLowerCase())) {
    return normalized;
  }

  const ext = getFileExtension(normalized);
  const stem = ext ? normalized.slice(0, -(ext.length + 1)) : normalized;

  let cursor = 2;
  while (cursor < 10000) {
    const candidate = ext ? `${stem}_v${cursor}.${ext}` : `${stem}_v${cursor}`;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
    cursor += 1;
  }

  return ext ? `${stem}_${Date.now()}.${ext}` : `${stem}_${Date.now()}`;
}

// ─── Stil Promptları (Detaylı Malzeme ve Işıklandırma) ────────────────────────

const STYLE_PROMPTS = {
  photorealistic:
    'photorealistic professional architectural render, exterior, bright sunny day, ' +
    'clear blue sky, realistic glass reflections, clean concrete and wood surfaces, ' +
    'studio quality CGI, highly detailed, 8K resolution, architectural photography',
  modern:
    'sleek contemporary modern architecture, minimalist, exterior, ' +
    'large floor-to-ceiling glass windows, smooth white concrete, dark steel framing, ' +
    'clean precise lines, premium luxury material finish, daylight',
  scandinavian:
    'Scandinavian nordic architecture, exterior, warm natural vertical timber cladding, ' +
    'birch wood, soft diffused daylight, cozy minimalist nordic design, ' +
    'matte dark gray metal roof, calm peaceful atmosphere',
  brutalist:
    'brutalist architecture, exterior, raw exposed board-formed concrete, ' +
    'heavy geometric massing, dramatic directional sunlight, sharp dark shadows, ' +
    'monolithic imposing presence, fine aggregate surface texture',
  mediterranean:
    'Mediterranean architecture, exterior, crisp white lime stucco walls, ' +
    'terracotta barrel roof tiles, warm afternoon golden sunlight, ' +
    'rich ochre tones, coastal luxury villa aesthetic',
  industrial:
    'industrial loft architecture, exterior, weathered red brick facade, ' +
    'corten steel panels, large black steel factory grid windows, exposed beams, ' +
    'urban warehouse aesthetic, cloudy overcast sky',
  sketch:
    'precise architectural hand-drawn pen and ink sketch, exterior elevation, ' +
    'clean technical linework, cross-hatching shading, white paper background, ' +
    'drafting pen professional illustration, no photorealism',
  futuristic:
    'futuristic parametric architecture, exterior, flowing organic curved form, ' +
    'glowing LED accents, metallic titanium composite panels, dynamic geometry, ' +
    'utopian high-tech, cinematic sci-fi render quality',
};

const NEGATIVE_PROMPT =
  'blurry, low quality, distorted, deformed, watermark, text overlay, signature, ' +
  'cartoon, anime, painting, people, cars, vehicles, animals, oversaturated, ' +
  'noise, jpeg artifacts, pixelated, out of focus, overexposed, underexposed, ' +
  'flat lighting, dull colors, ugly, asymmetrical, bad proportions';

// ─── 1. FONKSİYON: transformImage (SDXL ControlNet Canny) ────────────────────
// Görevi: Hızlı Stil Dönüşümü.
// Model: lucataco/sdxl-controlnet
// Mantık: Görselin siyah-beyaz çizgi haritasını çıkarır (Canny).
//         "controlnet_conditioning_scale" ile bu çizgilere ne kadar sadık
//         kalacağını belirler (0.75 - 1.00 arası idealdir).

// ─── 2. FONKSİYON: archRenderPipeline (FLUX ControlNet + ESRGAN 4K) ──────────
// Görevi: Ultra-Render (Mimerra Kalitesi)
// Model 1: black-forest-labs/flux-canny-pro (Canny/Depth koruması + FLUX ışıklandırması)
// Model 2: nightmareai/real-esrgan (4K Jilet Keskinleştirme)

// ─── 3. FONKSİYON: generateArchitecturalContent (Gemini Proxy) ──────────────
// Frontend API anahtarını gizlemek için tüm Gemini çağrıları backend üzerinden geçer.

// ─── 4. FONKSİYON: chatWithArchilyaAI (Gemini Chat Proxy) ──────────────────



module.exports = {
  AI_PROMPT_HISTORY_ALLOWED_TOOLS,
  AI_PROMPT_HISTORY_MAX_ITEMS_PER_TOOL,
  AI_STUDIO_JOB_QUEUE_FUNCTION,
  AI_STUDIO_JOB_QUEUE_MAX_ATTEMPTS,
  AI_STUDIO_JOB_STORAGE_PREFIX,
  ARCHILYA_PREMIUM_VISUAL_CORE,
  CHAT_SYSTEM_ACK,
  CHAT_SYSTEM_INSTRUCTION,
  CONTACT_FROM_EMAIL,
  CONTACT_INBOX_EMAIL,
  CONTACT_RATE_LIMIT_PER_EMAIL,
  CONTACT_RATE_LIMIT_PER_IP,
  CONTACT_RATE_LIMIT_WINDOW_MS,
  CONTACT_REPLY_PHONE,
  DEFAULT_R2_BUCKET_NAME,
  DEFAULT_R2_ENDPOINT,
  DEFAULT_R2_REGION,
  FieldValue,
  GEMINI_API_KEY,
  GEMINI_FALLBACK_MODELS,
  GEMINI_MODELS,
  INITIAL_CREDITS,
  NEGATIVE_PROMPT,
  PLAN_CREDITS,
  PLAN_LABELS,
  PLAN_PRICES,
  R2_ACCESS_KEY_ID,
  R2_DOWNLOAD_URL_TTL_SECONDS,
  R2_MAX_UPLOAD_BYTES,
  R2_REGION,
  R2_SECRET_ACCESS_KEY,
  R2_UPLOAD_URL_TTL_SECONDS,
  REPLICATE_API_KEY,
  RESEND_API_KEY,
  REVISION_CREDIT_COST,
  REVISION_TOTAL_BASE64_LIMIT,
  SALES_CONTACT_EMAIL,
  SALES_CONTACT_PHONE,
  SCENE_EDIT_MAX_REFERENCES,
  SCENE_EDIT_REFERENCE_TYPES,
  SCENE_EDIT_TOTAL_BASE64_LIMIT,
  STUDIO_POOL_CREDITS,
  STUDIO_POOL_STORAGE,
  STYLE_PROMPTS,
  WORKSPACE_PLAN_CONFIG,
  admin,
  appendIfMissing,
  assertAdminPanelAccess,
  assertPositiveInt,
  assertProductReadAccess,
  assertProjectMemberAccess,
  buildAdminProductObjectKey,
  buildAdminProductObjectPrefix,
  buildAiErrorDetails,
  buildAiStudioPrompt,
  buildAiStudioJobStoragePrefix,
  buildChatRuntimeContext,
  buildChunkedBatches,
  buildChunkedDeleteBatches,
  buildContactSubmissionAdminHtml,
  buildContactSubmissionUserHtml,
  buildFirebaseStorageDownloadUrl,
  getFunctions,
  buildGeminiModelChain,
  buildIyzicoAuthorization,
  buildPromptInspirationPrompt,
  buildProjectFolderId,
  buildR2BucketCandidates,
  buildR2EndpointCandidates,
  buildR2ObjectKey,
  buildRateLimitDocId,
  buildRevisionParts,
  buildSceneEditParts,
  callGeminiGenerateContent,
  callIyzicoApi,
  chargeAiCredits,
  chargeAiStudioJobCredits,
  claimAiStudioJobRun,
  computeGeminiRetryDelaySeconds,
  createCreditTransactionPayload,
  createR2Client,
  db,
  decodeCheckoutFormContent,
  delay,
  enforceContactRateLimit,
  ensureUniqueProjectFileName,
  ensureUserProfileDoc,
  escapeHtml,
  executeAiStudioJob,
  extractAiStudioOutputBase64,
  extractGeminiImage,
  extractGeminiText,
  extractR2ObjectKeyFromProductFile,
  extractUrl,
  finalizeIyzicoPayment,
  findProjectFolderByName,
  findSingleWorkspaceForUser,
  getAiStudioJobRef,
  getAuthorizedWorkspaceForUser,
  getDashboardPathHint,
  getFileExtension,
  getImageExtensionFromMimeType,
  getImagePartBase64Length,
  getAiStudioToolOutputType,
  getIyzicoConfig,
  getR2Credentials,
  getR2ErrorCode,
  getR2ErrorMessage,
  getRequestIp,
  getRequestOrigin,
  getResendClient,
  getSceneEditTotalBase64Length,
  getSubscriptionPlanConfig,
  getWorkspacePlanConfig,
  getWorkspaceProjects,
  hasProjectDeletionAccess,
  isActiveAdmin,
  isAiStudioRetriableError,
  isGeminiDemandSpike,
  isGeminiRetriableHttpError,
  isPublicDemoProduct,
  isValidEmail,
  loadAiStudioInputImage,
  mapAiToolConfig,
  markAiStudioJobForRetry,
  normalizeAiHistorySceneReferences,
  normalizeAiPromptHistoryEntry,
  normalizeAiPromptHistoryMap,
  normalizeAiPromptToolId,
  normalizeAiStudioJobError,
  normalizeAiStudioJobInput,
  normalizeChatHistory,
  normalizeChatMode,
  normalizeChatPath,
  normalizeContentType,
  normalizeEmail,
  normalizeMember,
  normalizeProjectAiMeta,
  normalizeProjectFileForMutation,
  normalizeR2Endpoint,
  normalizeSceneEditReferences,
  normalizeSceneReferenceType,
  normalizeText,
  parseCommaSeparatedValues,
  parseRetryAfterHeaderSeconds,
  parseRetryAfterSeconds,
  persistAiStudioInputImage,
  persistAiStudioOutputImage,
  productContainsObjectKey,
  refundAiCredits,
  refundAiStudioJobCredits,
  requireAuth,
  resolveProjectFileTypeKey,
  resolveR2Target,
  runWithRetry,
  sanitizeFileName,
  sanitizeStoragePathSegment,
  saveAiStudioStorageFile,
  sendContactSubmissionEmails,
  shouldRouteToR2,
  splitFullName,
  summarizeGeminiPayload,
  syncMemberIntoWorkspaceProjects,
  syncMemberRemovalFromWorkspaceProjects,
  syncOwnedWorkspacePlanState,
  toGeminiHttpsError,
  upsertAiPromptHistoryEntry,
  validateImagePart,
  validateUrl,
};
