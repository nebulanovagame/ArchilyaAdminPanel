/**
 * Archilya AI Studio — Prompt Templates
 *
 * Extracted from shared/index.js for the active Supabase job pipeline (processor.js).
 * These templates were previously defined but NOT connected to the active pipeline.
 *
 * PROMPT VERSION: 2.0.0
 *
 * Architecture:
 * - Every image-generation prompt MUST include GEOMETRY_LOCK_HEADER.
 * - Every scene-edit prompt MUST include REFERENCE_ROLE_SEPARATION.
 * - Settings from frontend are translated via translateSettingsToPromptParams().
 * - Negative prompt (NEGATIVE_PROMPT_COMMON) is appended to Gemini generationConfig where supported.
 *
 * DO NOT modify source templates in shared/index.js — they serve the legacy Firebase pipeline.
 */

const { normalizeText } = require('./supabase-helpers');

// ══════════════════════════════════════════════════════════════════════════════
// PROMPT VERSION — bump on any template change for audit/debug traceability
// ══════════════════════════════════════════════════════════════════════════════
const PROMPT_VERSION = '2.0.0';

// ══════════════════════════════════════════════════════════════════════════════
// ARCHILYA PREMIUM VISUAL CORE — shared by all visual-generation templates
// ══════════════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════════════
// GEOMETRY LOCK HEADER — mandatory for ALL image-generation prompts
// ══════════════════════════════════════════════════════════════════════════════
const GEOMETRY_LOCK_HEADER = [
  'CRITICAL ARCHITECTURAL PRESERVATION RULES:',
  '1. PRESERVE exact geometry, massing, proportions, floor count and silhouette.',
  '2. PRESERVE all window and door positions, sizes, alignments and opening rhythm.',
  '3. PRESERVE camera perspective, lens angle, horizon line and composition.',
  '4. PRESERVE ceiling height, floor separation, and all structural boundaries.',
  '5. PRESERVE furniture layout and object positions unless explicitly requested to change.',
  '6. CHANGE ONLY: materials, surface finishes, lighting quality, atmosphere, vegetation, entourage.',
  '7. DO NOT redesign, reshape, relocate, add or remove any architectural element.',
  '8. DO NOT alter facade rhythm, opening proportions, or structural logic.',
  '9. IF IN DOUBT between "improve" and "preserve" — PRESERVE.',
  '10. The source image defines architectural truth. Your job is enhancement, not redesign.',
].join('\n');

// ══════════════════════════════════════════════════════════════════════════════
// REFERENCE ROLE SEPARATION — mandatory for scene-edit prompts
// ══════════════════════════════════════════════════════════════════════════════
const REFERENCE_ROLE_SEPARATION = [
  'IMAGE ROLE DEFINITIONS:',
  '- PRIMARY IMAGE: The architectural ground truth. Defines ALL geometry, perspective, spatial layout, camera framing and architectural structure.',
  '- REFERENCE IMAGES: Style/material/atmosphere inspiration ONLY.',
  '  * Extract material palettes, lighting moods, color tones, and surface character from references.',
  '  * Do NOT copy reference image geometry, camera angle, composition, or architectural elements.',
  '  * Do NOT replace the primary scene with content from reference images.',
  '  * Blend reference style INTO the primary scene without redesigning it.',
  '- THE PRIMARY IMAGE ALWAYS WINS when there is a conflict between reference style and architectural integrity.',
].join('\n');

// ══════════════════════════════════════════════════════════════════════════════
// STYLE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS TRANSLATION MAPS — Turkish frontend values → English prompt instructions
// ══════════════════════════════════════════════════════════════════════════════
const ATMOSPHERE_TRANSLATIONS = {
  'golden-hour': 'warm golden hour sunlight with soft elongated shadows, amber highlights and cool shadow tones',
  'natural-daylight': 'natural diffused daylight, neutral white balance, soft ambient illumination with subtle sky reflections',
  twilight: 'elegant twilight atmosphere, deep blue sky transition, warm interior light spill, sophisticated dusk ambiance',
  'overcast-soft': 'soft overcast lighting, even diffused illumination, muted shadows, calm atmospheric mood',
  'warm-interior': 'warm interior lighting, cozy ambient glow, layered light sources, intimate residential atmosphere',
  'cool-modern': 'cool contemporary lighting, crisp shadows, clean modern ambiance, high-contrast architectural illumination',
  'dramatic-shadow': 'dramatic chiaroscuro lighting, deep sculptural shadows, theatrical architectural highlights, bold contrast',
  'sunny-morning': 'bright morning sunlight, fresh dawn atmosphere, crisp early light, gentle warmth and optimism',
};

const MATERIAL_TRANSLATIONS = {
  'natural-wood': 'natural oak and walnut timber, visible grain, warm tactile wood surfaces, matte or satin finish',
  'stone-marble': 'honed marble and natural stone, subtle veining, cool mineral surfaces, polished or honed finish',
  'metal-glass': 'dark bronze and blackened steel, low-iron glass curtain walls, refined metal detailing, brushed or matte metal',
  'concrete-minimal': 'board-formed and smooth architectural concrete, mineral matte surfaces, monolithic weight and texture',
  'warm-textile': 'linen, wool and natural textile warmth, soft fabric panels, upholstered surfaces, residential comfort palette',
  'mixed-premium': 'curated mix of natural stone, timber, glass and refined metal, balanced premium material composition',
};

const PRESERVE_TRANSLATIONS = {
  perspective: 'preserve exact camera perspective, lens angle, horizon line and composition',
  massing: 'preserve building massing, overall volume, silhouette and architectural proportions',
  'window-position': 'preserve all window and door positions, sizes, alignments and opening rhythm',
  'furniture-layout': 'preserve furniture placement, spatial arrangement and object positions',
  'floor-separation': 'preserve floor-to-floor heights, ceiling planes and vertical spatial boundaries',
  'ceiling-form': 'preserve ceiling geometry, height, form, coffers, bulkheads and tray details',
};

const STYLE_STRENGTH_TRANSLATIONS = {
  low: 'Subtle style application: preserve the original character, apply only gentle material and lighting refinements. The source image character should remain dominant.',
  medium: 'Balanced style application: noticeably improve materials and lighting while keeping the architectural identity intact. Source and target style should feel harmonized.',
  high: 'Strong style transformation: dramatically upgrade material quality, lighting atmosphere, and presentation standard. The architecture must still be preserved, but the visual character can shift significantly toward the target style.',
};

const PLAN_TYPE_TRANSLATIONS = {
  'floor-plan': 'architectural floor plan with room layouts and spatial organization',
  'site-plan': 'site plan with building footprint, landscape context and property boundaries',
  section: 'architectural section drawing showing vertical spatial relationships and structural logic',
  elevation: 'architectural elevation drawing showing facade composition, material articulation and proportional system',
};

const PALETTE_TRANSLATIONS = {
  'warm-premium': 'warm premium palette with natural timber, gold-beige accents, cream mineral tones, refined luxury warmth',
  monochrome: 'sophisticated monochrome palette, charcoal-to-white gradient, disciplined grayscale hierarchy, elegant restraint',
  'pastel-architecture': 'soft architectural pastels, muted sage and sky tones, gentle warm-cool balance, light and airy presentation',
  'luxury-real-estate': 'high-end real estate palette, deep charcoal and warm taupe, gold-bronze accents, premium polished finish',
};

const PRESENTATION_TRANSLATIONS = {
  'clean-modern': 'clean modern presentation, crisp line hierarchy, restrained color, professional board aesthetic',
  'architectural-board': 'architecture competition board style, strong graphic hierarchy, curated negative space, refined diagrammatic clarity',
  'real-estate': 'luxury real estate marketing style, warm inviting palette, lifestyle-oriented presentation, polished sales-ready finish',
  'minimal-line': 'minimal line-drawing aesthetic, precise ink-like contours, subtle tone washes, architectural sketch elegance',
};

const REPORT_TONE_TRANSLATIONS = {
  professional: 'Professional and balanced tone. Objective, authoritative, suitable for client presentation.',
  critical: 'Critical and evaluative tone. Identify weaknesses honestly, push for higher design standards.',
  constructive: 'Constructive and supportive tone. Focus on actionable improvements, mentor-like guidance.',
  detailed: 'Detailed and comprehensive tone. Deep analysis, thorough evaluation, leave no stone unturned.',
};

const REVISION_TYPE_TRANSLATIONS = {
  ceiling: 'Revise only the ceiling design: ceiling height, form, material, lighting integration, coffer details or tray ceiling treatment.',
  lighting: 'Revise only the lighting design: fixture types, placement, color temperature, intensity and lighting atmosphere.',
  material: 'Revise only materials and surface finishes: wall treatments, flooring, countertops, millwork finishes.',
  furniture: 'Revise only furniture: style, arrangement, pieces, upholstery, without altering spatial layout.',
  floor: 'Revise only the flooring: flooring material, pattern, finish, transition details.',
  general: 'Apply general revision according to the provided instructions while preserving overall architecture and composition.',
};

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS TRANSLATION FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Translates frontend settings (Turkish keys) into structured English prompt instructions.
 * Used by processor.js to inject user preferences into tool-specific prompts.
 *
 * @param {Object} params - Settings from job metadata (Turkish values)
 * @param {string} params.atmosphere - Atmosphere selection
 * @param {string} params.materialLanguage - Material language selection
 * @param {string} params.styleStrength - Style strength (low/medium/high)
 * @param {string[]} params.enhancePreserve - Elements to preserve for enhance tool
 * @param {string[]} params.scenePreserveAreas - Areas to preserve for sceneedit tool
 * @param {string} params.revisionType - Revision type for sceneedit
 * @param {string} params.planType - Plan type for plancolor
 * @param {string} params.palette - Color palette for plancolor
 * @param {string} params.presentationStyle - Presentation style for plancolor
 * @param {string} params.reportTone - Report tone for analysis
 * @returns {string} English prompt instructions ready to append to the prompt
 */
function translateSettingsToPromptParams(params = {}) {
  const instructions = [];

  if (params.atmosphere && ATMOSPHERE_TRANSLATIONS[params.atmosphere]) {
    instructions.push(`LIGHTING/ATMOSPHERE: ${ATMOSPHERE_TRANSLATIONS[params.atmosphere]}`);
  }

  if (params.materialLanguage && MATERIAL_TRANSLATIONS[params.materialLanguage]) {
    instructions.push(`MATERIAL LANGUAGE: ${MATERIAL_TRANSLATIONS[params.materialLanguage]}`);
  }

  if (params.styleStrength && STYLE_STRENGTH_TRANSLATIONS[params.styleStrength]) {
    instructions.push(`STYLE APPLICATION: ${STYLE_STRENGTH_TRANSLATIONS[params.styleStrength]}`);
  }

  if (Array.isArray(params.enhancePreserve) && params.enhancePreserve.length > 0) {
    const preserveItems = params.enhancePreserve
      .filter((p) => PRESERVE_TRANSLATIONS[p])
      .map((p) => `- ${PRESERVE_TRANSLATIONS[p]}`);
    if (preserveItems.length > 0) {
      instructions.push(`PRESERVATION REQUIREMENTS:\n${preserveItems.join('\n')}`);
    }
  }

  if (Array.isArray(params.scenePreserveAreas) && params.scenePreserveAreas.length > 0) {
    const areaItems = params.scenePreserveAreas
      .filter((a) => PRESERVE_TRANSLATIONS[a])
      .map((a) => `- ${PRESERVE_TRANSLATIONS[a]}`);
    if (areaItems.length > 0) {
      instructions.push(`SCENE PRESERVATION REQUIREMENTS:\n${areaItems.join('\n')}`);
    }
  }

  if (params.revisionType && REVISION_TYPE_TRANSLATIONS[params.revisionType]) {
    instructions.push(`REVISION SCOPE: ${REVISION_TYPE_TRANSLATIONS[params.revisionType]}`);
  }

  if (params.planType && PLAN_TYPE_TRANSLATIONS[params.planType]) {
    instructions.push(`PLAN TYPE: ${PLAN_TYPE_TRANSLATIONS[params.planType]}`);
  }

  if (params.palette && PALETTE_TRANSLATIONS[params.palette]) {
    instructions.push(`PALETTE: ${PALETTE_TRANSLATIONS[params.palette]}`);
  }

  if (params.presentationStyle && PRESENTATION_TRANSLATIONS[params.presentationStyle]) {
    instructions.push(`PRESENTATION STYLE: ${PRESENTATION_TRANSLATIONS[params.presentationStyle]}`);
  }

  if (params.reportTone && REPORT_TONE_TRANSLATIONS[params.reportTone]) {
    instructions.push(`REPORT TONE: ${REPORT_TONE_TRANSLATIONS[params.reportTone]}`);
  }

  return instructions.join('\n\n');
}

// ══════════════════════════════════════════════════════════════════════════════
// NEGATIVE PROMPT — common anti-quality tokens
// ══════════════════════════════════════════════════════════════════════════════
const NEGATIVE_PROMPT_COMMON = [
  'blurry', 'low quality', 'distorted', 'deformed', 'watermark', 'text overlay', 'signature',
  'cartoon', 'anime', 'painting', 'people', 'cars', 'vehicles', 'animals', 'oversaturated',
  'noise', 'jpeg artifacts', 'pixelated', 'out of focus', 'overexposed', 'underexposed',
  'flat lighting', 'dull colors', 'ugly', 'asymmetrical', 'bad proportions',
  'plastic textures', 'fake reflections', 'floating objects', 'warped geometry',
  'melted edges', 'duplicated vegetation', 'inconsistent glazing', 'cartoon vegetation',
  'fake HDR look', 'showroom glare', 'synthetic lighting drama', 'generic AI luxury styling',
].join(', ');

const NEGATIVE_PROMPT_ARCHITECTURAL = [
  NEGATIVE_PROMPT_COMMON,
  'shifted windows', 'moved doors', 'changed ceiling height', 'warped walls',
  'altered building silhouette', 'inconsistent floor levels', 'wrong number of floors',
  'misplaced columns', 'changed room layout', 'altered facade proportions',
  'perspective drift', 'composition shift', 'camera angle change',
].join(', ');

// ══════════════════════════════════════════════════════════════════════════════
// SCENE EDIT HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function normalizeSceneEditMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  return SCENE_EDIT_MODES.includes(normalized) ? normalized : 'scene-compose';
}

// ══════════════════════════════════════════════════════════════════════════════
// TOOL-SPECIFIC PROMPT BUILDERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Premium Render (img2img) — transform style while preserving architecture
 */
function buildTransformStylePrompt({ style = 'modern', extraNote = '', translatedSettings = '' } = {}) {
  const normalizedStyle = normalizeText(style, 80) || 'modern';
  const stylePrompt = AI_STUDIO_STYLE_PROMPTS[normalizedStyle] || normalizedStyle;
  const safeExtraNote = normalizeText(extraNote, 2000);
  const extraPart = safeExtraNote ? `\nAdditional art-direction requirements: ${safeExtraNote}.` : '';
  const settingsPart = translatedSettings ? `\n\nUSER SETTINGS:\n${translatedSettings}` : '';

  return `You are the visual director of a boutique architectural CGI studio specialized in premium residential, hospitality and developer-grade imagery.

${ARCHILYA_PREMIUM_VISUAL_CORE}

${GEOMETRY_LOCK_HEADER}

PRIMARY OBJECTIVE:
Re-style the image without redesigning the building.

ART DIRECTION TARGET:
${stylePrompt}${extraPart}${settingsPart}

QUALITY TARGET:
- Luxury publication-ready architectural image.
- Sophisticated and restrained premium visual language.
- Elegant editorial composition, never flashy catalog style.
- Tactile materials: mineral matte concrete, natural timber grain, believable low-iron glass, refined metal accents.
- Preserve crisp edge definition and believable microtexture.
- Light must reveal depth and form, not flatten surfaces.

AVOID:
- generic AI luxury styling
- warped windows, melted edges, floating objects, duplicated vegetation, distorted furniture, excessive glow or fake reflections
- text overlays, labels, logos or watermark
${NEGATIVE_PROMPT_ARCHITECTURAL.split(', ').map((t) => `- ${t}`).join('\n')}

Return one single transformed image only.`;
}

/**
 * Reference Style Render (enhance) — enhance render quality with optional reference style
 */
function buildEnhancedRenderPrompt({ extraNote = '', translatedSettings = '' } = {}) {
  const safeExtraNote = normalizeText(extraNote, 2000);
  const extraPart = safeExtraNote ? `\nSPECIAL FOCUS:\n${safeExtraNote}\n` : '';
  const settingsPart = translatedSettings ? `\n\nUSER SETTINGS:\n${translatedSettings}` : '';

  return `You are a world-class architectural visualization director upgrading an ordinary render into a premium boutique-studio image.

${ARCHILYA_PREMIUM_VISUAL_CORE}

${GEOMETRY_LOCK_HEADER}

TASK:
Enhance this render to luxury publication-ready quality while preserving the exact architecture, camera framing and composition.

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

${extraPart}${settingsPart}

AVOID:
${NEGATIVE_PROMPT_ARCHITECTURAL.split(', ').map((t) => `- ${t}`).join('\n')}

Return one premium final image only.`;
}

/**
 * Scene Edit (sceneedit) — surgical scene editing with references
 */
function buildSceneEditPrompt({ editMode = 'scene-compose', references = [], extraNote = '', translatedSettings = '' } = {}) {
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
  const settingsPart = translatedSettings ? `\n\nUSER SETTINGS:\n${translatedSettings}` : '';

  return `You are Archilya Scene Edit Director, a specialist in surgical architectural post-production for premium CGI and architectural photography.

EDIT MODE: ${normalizedMode}
MODE GOAL: ${modeInstructions[normalizedMode]}

${ARCHILYA_PREMIUM_VISUAL_CORE}

${GEOMETRY_LOCK_HEADER}

${REFERENCE_ROLE_SEPARATION}

MISSION:
Apply the requested edit with surgical precision while preserving architectural authorship.

SURGICAL PRECISION:
- Change only requested targets.
- Do not restyle untouched areas.
- Do not introduce unrelated design decisions.
- Do not shift window alignments, proportions or hardscape geometry.
- Integrate changes so they look native to the original scene.
- Keep all edits physically plausible with correct scale, contact and material response.

REFERENCE CATALOG:
${referenceLines || 'No references'}

${userInstruction ? `USER ART DIRECTION:\n${userInstruction}\n` : ''}${settingsPart}

FINAL USER REQUEST:
${userInstruction || 'Use references with maximum precision while preserving the original architecture and camera framing.'}

AVOID:
- warped geometry, mismatched shadows, perspective drift, floating objects, scale errors, duplicated elements
- plastic AI artifacts, fake compositing look, text overlays or watermark
${NEGATIVE_PROMPT_ARCHITECTURAL.split(', ').map((t) => `- ${t}`).join('\n')}

Return one single edited image only.`;
}

/**
 * Floor Plan Coloring (plancolor) — premium plan presentation
 */
function buildPlanColorPrompt({ style = 'modern', extraNote = '', translatedSettings = '' } = {}) {
  const normalizedStyle = normalizeText(style, 80) || 'modern';
  const stylePrompt = AI_STUDIO_PLAN_STYLE_PROMPTS[normalizedStyle] || normalizedStyle;
  const safeExtraNote = normalizeText(extraNote, 2000);
  const extraPart = safeExtraNote ? `\nAdditional presentation requirements: ${safeExtraNote}.` : '';
  const settingsPart = translatedSettings ? `\n\nUSER SETTINGS:\n${translatedSettings}` : '';

  return `You are a premium architectural presentation designer producing luxury real-estate presentation boards from floor plans.

${ARCHILYA_PREMIUM_VISUAL_CORE}

TASK:
Transform this floor plan into an elegant top-down architectural presentation image suitable for a high-end client, investor pack or luxury sales dossier.

STYLE DIRECTION:
${stylePrompt}${extraPart}${settingsPart}

NON-NEGOTIABLE RULES:
- Preserve exact plan geometry — walls, openings, circulation boundaries and room relationships.
- Never distort dimensions, room shapes or architectural layout.
- Preserve all text labels, room names, dimensions and annotations exactly as they appear.
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
- childish saturation, noisy textures, gaming-style graphics, excessive icons
- random decorations, fake perspective, visual clutter, cheap brochure aesthetics
- text overlays or watermark, distorted room shapes, missing walls
${NEGATIVE_PROMPT_COMMON.split(', ').map((t) => `- ${t}`).join('\n')}

Return one single polished presentation image only.`;
}

/**
 * Design Analysis (analysis) — architectural quality assessment
 */
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

/**
 * Scene Edit Parts Builder — assembles the multipart payload for sceneedit tool
 */
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
      text: `SCENE_EDIT_CONTEXT\nPRIMARY_IMAGE (architectural ground truth — defines ALL geometry, perspective and composition)`,
    },
    imagePart,
    {
      text: REFERENCE_ROLE_SEPARATION,
    },
  ];

  if (referenceImages.length > 0) {
    parts.push({
      text: `REFERENCE_IMAGES (style/material/atmosphere inspiration ONLY — do NOT copy geometry or architecture):`,
    });
  }

  referenceImages.forEach((reference, index) => {
    parts.push({
      text: `REFERENCE_IMAGE_${index + 1}\nTYPE: ${String(reference.type || 'object').toUpperCase()} (style/material reference only)\nLABEL: ${reference.label || 'Untitled reference'}${reference.note ? `\nNOTE: ${reference.note}` : ''}\nThis reference is for style/materials/atmosphere only. Do NOT copy its architecture or geometry.`,
    });
    parts.push(reference.imagePart);
  });

  parts.push({
    text: `EDIT_INSTRUCTION\nMODE: ${normalizedWorkflow}\n\n${ARCHILYA_PREMIUM_VISUAL_CORE}\n\n${GEOMETRY_LOCK_HEADER}\n\nUSER REQUEST:\n${prompt}`,
  });

  if (referenceSummary) {
    parts.push({
      text: `REFERENCE_SUMMARY\n${referenceSummary}`,
    });
  }

  return parts;
}

/**
 * Revision Parts Builder — mask-based revision
 */
function buildRevisionParts({ baseImagePart, maskImagePart, prompt }) {
  const safePrompt = normalizeText(prompt, 4000);
  return [
    {
      text: `REGION_REVISION_CONTEXT\n${REFERENCE_ROLE_SEPARATION}\n\n${ARCHILYA_PREMIUM_VISUAL_CORE}\n\n${GEOMETRY_LOCK_HEADER}\n\nYou will receive two images:\n1) BASE_IMAGE (original architectural scene — defines ALL truth)\n2) MASK_IMAGE where WHITE means editable region and BLACK means locked region.\n\nCORE_MISSION:\nApply masked revision with surgical precision and zero collateral change.\n\nNON-NEGOTIABLE_RULES:\n- Strictly edit only WHITE mask regions.\n- Keep BLACK mask regions visually unchanged.\n- Preserve camera perspective, geometry, composition, lighting direction and shadow continuity.\n- Match revised region to surrounding materials and atmosphere seamlessly.\n- Avoid any global style drift or unintended redesign.\n\nReturn exactly one edited image with no text overlay or watermark.`,
    },
    {
      text: 'BASE_IMAGE (source of all architecture)',
    },
    baseImagePart,
    {
      text: 'MASK_IMAGE — WHITE = editable region, BLACK = locked/preserved region',
    },
    maskImagePart,
    {
      text: `USER_REVISION_REQUEST\n${safePrompt || 'Apply a minimal premium architectural revision only inside the white mask.'}`,
    },
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// TURKISH SETTINGS PARSER — fallback when structured metadata is empty
// Parses the Turkish extraNote text that buildToolNote() (frontend) produces.
// Maps Turkish labels back to the English keys used by translateSettingsToPromptParams().
// ══════════════════════════════════════════════════════════════════════════════

// Turkish label → English key mappings
const ATMOSPHERE_TR_MAP = {
  'altın saat': 'golden-hour', 'altin saat': 'golden-hour',
  'doğal gün ışığı': 'natural-daylight', 'dogal gun isigi': 'natural-daylight',
  'alacakaranlık': 'twilight', 'alacakaranlik': 'twilight',
  'kapalı yumuşak': 'overcast-soft', 'kapali yumusak': 'overcast-soft',
  'sıcak iç mekan': 'warm-interior', 'sicak ic mekan': 'warm-interior',
  'soğuk modern': 'cool-modern', 'soguk modern': 'cool-modern',
  'dramatik gölge': 'dramatic-shadow', 'dramatik golge': 'dramatic-shadow',
  'güneşli sabah': 'sunny-morning', 'gunesli sabah': 'sunny-morning',
};

const MATERIAL_TR_MAP = {
  'doğal ahşap': 'natural-wood', 'dogal ahsap': 'natural-wood',
  'taş mermer': 'stone-marble', 'tas mermer': 'stone-marble',
  'metal cam': 'metal-glass',
  'beton minimal': 'concrete-minimal',
  'sıcak tekstil': 'warm-textile', 'sicak tekstil': 'warm-textile',
  'karışık premium': 'mixed-premium', 'karisik premium': 'mixed-premium',
};

const STYLE_STRENGTH_TR_MAP = {
  'düşük': 'low', 'dusuk': 'low',
  'orta': 'medium',
  'yüksek': 'high', 'yuksek': 'high',
};

const PRESERVE_TR_MAP = {
  'perspektif': 'perspective',
  'kütle': 'massing', 'kutle': 'massing',
  'pencere konumu': 'window-position',
  'mobilya düzeni': 'furniture-layout', 'mobilya duzeni': 'furniture-layout',
  'kat ayrımı': 'floor-separation', 'kat ayrimi': 'floor-separation',
  'tavan formu': 'ceiling-form',
};

const PLAN_TYPE_TR_MAP = {
  'kat planı': 'floor-plan', 'kat plani': 'floor-plan',
  'vaziyet planı': 'site-plan', 'vaziyet plani': 'site-plan',
  'kesit': 'section',
  'görünüş': 'elevation', 'gorunus': 'elevation',
};

const PALETTE_TR_MAP = {
  'sıcak premium': 'warm-premium', 'sicak premium': 'warm-premium',
  'monokrom': 'monochrome',
  'pastel mimari': 'pastel-architecture',
  'lüks gayrimenkul': 'luxury-real-estate', 'luks gayrimenkul': 'luxury-real-estate',
};

const PRESENTATION_TR_MAP = {
  'temiz modern': 'clean-modern',
  'mimari pafta': 'architectural-board',
  'gayrimenkul': 'real-estate',
  'minimal çizgi': 'minimal-line', 'minimal cizgi': 'minimal-line',
};

const REPORT_TONE_TR_MAP = {
  'profesyonel': 'professional',
  'eleştirel': 'critical', 'elestirel': 'critical',
  'yapıcı': 'constructive', 'yapici': 'constructive',
  'detaylı': 'detailed', 'detayli': 'detailed',
};

const REVISION_TYPE_TR_MAP = {
  'tavan': 'ceiling',
  'aydınlatma': 'lighting', 'aydinlatma': 'lighting',
  'malzeme': 'material',
  'mobilya': 'furniture',
  'zemin': 'floor',
  'genel': 'general',
};

const ANALYSIS_FOCUS_TR_MAP = {
  'malzeme': 'material',
  'ışık': 'light', 'isik': 'light',
  'kompozisyon': 'composition',
  'fonksiyon': 'function',
  'sunum': 'presentation',
  'revizyon': 'revision',
};

const MULTI_ANGLE_TR_MAP = {
  'ahşap': 'wood', 'ahsap': 'wood',
  'metal': 'metal',
  'aydınlatma': 'lighting', 'aydinlatma': 'lighting',
  'mobilya': 'furniture',
  'duvar': 'wall',
  'atmosfer': 'atmosphere',
};

/**
 * Parses Turkish settings from extraNote text produced by frontend buildToolNote().
 * This is a fallback for when structured metadata fields are not present.
 *
 * Expected patterns (from utils.ts buildToolNote functions):
 * - "Atmosfer: {value}. Malzeme dili: {value}."
 * - "Stil gücü: {value}."
 * - "Korunacak öğeler: {value1}, {value2}."
 * - "Korunacak alanlar: {value1}, {value2}."
 * - "Korunacak stil öğeleri: {value1}, {value2}."
 * - "Revizyon alanı: {value}."
 * - "Plan türü: {value}. Renk paleti: {value}. Sunum stili: {value}."
 * - "Analiz odakları: {value1}, {value2}."
 * - "Rapor tonu: {value}."
 *
 * @param {string} extraNote - Turkish text from buildToolNote()
 * @param {string} toolId - Tool ID for context-aware parsing
 * @returns {Object} Parsed settings with English keys
 */
function parseSettingsFromExtraNote(extraNote, toolId) {
  if (!extraNote || typeof extraNote !== 'string') return {};
  // Use Turkish locale for proper i→ı, I→İ, ş→ş etc. mapping
  const text = typeof extraNote.toLocaleLowerCase === 'function'
    ? extraNote.toLocaleLowerCase('tr-TR')
    : extraNote.toLowerCase();
  const parsed = {};

  // --- Atmosphere ---
  const atmMatch = text.match(/atmosfer:\s*([^.]+)/);
  if (atmMatch) {
    const atmValue = atmMatch[1].trim();
    for (const [tr, en] of Object.entries(ATMOSPHERE_TR_MAP)) {
      if (atmValue.includes(tr)) { parsed.atmosphere = en; break; }
    }
  }

  // --- Material Language ---
  const matMatch = text.match(/malzeme dili:\s*([^.]+)/);
  if (matMatch) {
    const matValue = matMatch[1].trim();
    for (const [tr, en] of Object.entries(MATERIAL_TR_MAP)) {
      if (matValue.includes(tr)) { parsed.materialLanguage = en; break; }
    }
  }

  // --- Style Strength ---
  const strMatch = text.match(/stil gücü:\s*([^.]+)/);
  if (strMatch) {
    const strValue = strMatch[1].trim();
    for (const [tr, en] of Object.entries(STYLE_STRENGTH_TR_MAP)) {
      if (strValue.includes(tr)) { parsed.styleStrength = en; break; }
    }
  }

  // --- Preserve Elements (enhancePreserve) ---
  const preserveMatch = text.match(/korunacak öğeler:\s*([^.]+)/);
  if (preserveMatch) {
    parsed.enhancePreserve = parseCommaList(preserveMatch[1], PRESERVE_TR_MAP);
  }

  // --- Preserve Areas (scenePreserveAreas) ---
  const areasMatch = text.match(/korunacak alanlar:\s*([^.]+)/);
  if (areasMatch) {
    parsed.scenePreserveAreas = parseCommaList(areasMatch[1], PRESERVE_TR_MAP);
  }

  // --- Preserve Style Elements (multiAnglePreserve) ---
  const multiMatch = text.match(/korunacak stil öğeleri:\s*([^.]+)/);
  if (multiMatch) {
    // multiAnglePreserve is only used in the old note, but parse for logging
    parsed.multiAnglePreserve = parseCommaList(multiMatch[1], MULTI_ANGLE_TR_MAP);
  }

  // --- Revision Type ---
  const revMatch = text.match(/revizyon alanı:\s*([^.]+)/);
  if (revMatch) {
    const revValue = revMatch[1].trim();
    for (const [tr, en] of Object.entries(REVISION_TYPE_TR_MAP)) {
      if (revValue.includes(tr)) { parsed.revisionType = en; break; }
    }
  }

  // --- Plan Type ---
  const planMatch = text.match(/plan türü:\s*([^.]+)/);
  if (planMatch) {
    const planValue = planMatch[1].trim();
    for (const [tr, en] of Object.entries(PLAN_TYPE_TR_MAP)) {
      if (planValue.includes(tr)) { parsed.planType = en; break; }
    }
  }

  // --- Palette ---
  const palMatch = text.match(/renk paleti:\s*([^.]+)/);
  if (palMatch) {
    const palValue = palMatch[1].trim();
    for (const [tr, en] of Object.entries(PALETTE_TR_MAP)) {
      if (palValue.includes(tr)) { parsed.palette = en; break; }
    }
  }

  // --- Presentation Style ---
  const presMatch = text.match(/sunum stili:\s*([^.]+)/);
  if (presMatch) {
    const presValue = presMatch[1].trim();
    for (const [tr, en] of Object.entries(PRESENTATION_TR_MAP)) {
      if (presValue.includes(tr)) { parsed.presentationStyle = en; break; }
    }
  }

  // --- Report Tone ---
  const toneMatch = text.match(/rapor tonu:\s*([^.]+)/);
  if (toneMatch) {
    const toneValue = toneMatch[1].trim();
    for (const [tr, en] of Object.entries(REPORT_TONE_TR_MAP)) {
      if (toneValue.includes(tr)) { parsed.reportTone = en; break; }
    }
  }

  // --- Analysis Focus ---
  const focusMatch = text.match(/analiz odakları:\s*([^.]+)/);
  if (focusMatch) {
    parsed.analysisFocus = parseCommaList(focusMatch[1], ANALYSIS_FOCUS_TR_MAP);
  }

  return parsed;
}

/**
 * Parses comma-separated Turkish values and maps to English keys.
 */
function parseCommaList(rawValue, translationMap) {
  return String(rawValue || '')
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((tr) => {
      for (const [key, en] of Object.entries(translationMap)) {
        if (tr.includes(key)) return en;
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Merges structured metadata settings with parsed Turkish note settings.
 * Structured metadata (if present) takes priority over parsed note values.
 */
function mergeSettingsParams(structured, parsedFromNote) {
  const merged = { ...parsedFromNote };
  // Structured metadata values override parsed values
  for (const [key, value] of Object.entries(structured)) {
    if (value !== undefined && value !== null) {
      // For arrays, only override if not empty
      if (Array.isArray(value) && value.length > 0) {
        merged[key] = value;
      } else if (!Array.isArray(value) && value !== '') {
        merged[key] = value;
      }
    }
  }
  return merged;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DISPATCHER — routes to tool-specific prompt builders
// ══════════════════════════════════════════════════════════════════════════════

function buildPromptFromContractV3(contract, job) {
  const toolId = job.tool_id || contract.toolId || 'unknown';
  const sections = [];

  // TASK section
  if (contract.task) {
    const task = contract.task;
    sections.push('=== TASK DEFINITION ===');
    sections.push(`You are performing a ${task.type || 'architectural'} operation on an architectural rendering.`);
    sections.push(`PRIMARY GOAL: ${task.primaryGoal || 'Enhance the architectural visualization.'}`);
    if (task.architecturalMode) sections.push(`ARCHITECTURAL MODE: ${task.architecturalMode}.`);
    if (task.editScope === 'surgical') sections.push('EDIT SCOPE: SURGICAL — only explicitly allowed zones may change.');
  }

  // PRESERVATION section (from architecturalPreservation contract)
  const preservation = contract.architecturalPreservation;
  if (preservation) {
    sections.push('');
    sections.push('=== MANDATORY PRESERVATION (CRITICAL) ===');
    sections.push('These elements MUST remain identical to the input image:');

    if (Array.isArray(preservation.mandatory)) {
      preservation.mandatory.forEach(rule => {
        const priority = rule.priority ? `[${rule.priority.toUpperCase()}]` : '';
        sections.push(`${priority} ${rule.element || rule.description || ''}`);
      });
    }

    if (Array.isArray(preservation.lockedZones) && preservation.lockedZones.length > 0) {
      sections.push('');
      sections.push('LOCKED ZONES (NO CHANGES ALLOWED):');
      preservation.lockedZones.forEach(zone => {
        const name = zone.name || zone;
        const reason = zone.reason ? ` — ${zone.reason}` : '';
        sections.push(`- ${name}${reason}`);
      });
    }

    if (Array.isArray(preservation.editableZones) && preservation.editableZones.length > 0) {
      sections.push('');
      sections.push('EDITABLE ZONES:');
      preservation.editableZones.forEach(zone => {
        const name = zone.name || zone;
        const allowed = Array.isArray(zone.allowedChanges) ? zone.allowedChanges.join(', ') : 'specified changes';
        const intensity = zone.maxChangeIntensity ? ` (max intensity: ${zone.maxChangeIntensity})` : '';
        sections.push(`- ${name}: ${allowed}${intensity}`);
      });
    }
  }

  // FORBIDDEN section
  if (preservation && Array.isArray(preservation.forbidden) && preservation.forbidden.length > 0) {
    sections.push('');
    sections.push('=== FORBIDDEN ACTIONS (BLOCKING VIOLATIONS) ===');
    sections.push('DO NOT under any circumstances:');
    preservation.forbidden.forEach(action => {
      sections.push(`- ${action.action || action}`);
    });
  }

  // STYLE section
  const style = contract.styleDirectives;
  if (style) {
    sections.push('');
    sections.push('=== STYLE DIRECTIVES ===');
    if (style.architecturalStyle) sections.push(`Architectural Style: ${style.architecturalStyle}`);
    if (style.atmosphere) {
      const atm = style.atmosphere;
      const parts = [];
      if (atm.timeOfDay && atm.timeOfDay !== 'unspecified') parts.push(`Time: ${atm.timeOfDay}`);
      if (atm.lightQuality) parts.push(`Light: ${atm.lightQuality}`);
      if (atm.interiorExterior && atm.interiorExterior !== 'unspecified') parts.push(`Setting: ${atm.interiorExterior}`);
      if (atm.shadowIntensity) parts.push(`Shadows: ${atm.shadowIntensity}`);
      if (parts.length) sections.push(`Atmosphere: ${parts.join(', ')}.`);
    }
    if (style.materialLanguage) {
      const mat = style.materialLanguage;
      const parts = [];
      if (mat.primaryMaterialFamily) parts.push(mat.primaryMaterialFamily);
      if (mat.tone) parts.push(mat.tone + ' tones');
      if (mat.finish && mat.finish !== 'natural') parts.push(mat.finish + ' finish');
      if (mat.quality) parts.push(mat.quality + ' quality');
      if (parts.length) sections.push(`Materials: ${parts.join(', ')}.`);
    }
    if (style.styleStrength !== undefined) sections.push(`Style Transfer Strength: ${style.styleStrength} (0=subtle, 1=strong)`);
    if (Array.isArray(style.colorPalette) && style.colorPalette.length > 0) {
      sections.push(`Color Palette: ${style.colorPalette.join(', ')}.`);
    }
  }

  // REFERENCE POLICY section
  const refPolicy = contract.referencePolicy;
  if (refPolicy) {
    sections.push('');
    sections.push('=== REFERENCE POLICY ===');
    sections.push('Reference images are for STYLE AND MATERIAL TRANSFER ONLY.');
    sections.push('They are NOT geometry sources. Do NOT copy camera angles, wall positions, or room proportions from references.');

    if (Array.isArray(refPolicy.references) && refPolicy.references.length > 0) {
      refPolicy.references.forEach((ref, i) => {
        sections.push(`Reference #${i + 1} (type: ${ref.type || 'style'}, weight: ${ref.weight || 0.5}):`);
        if (Array.isArray(ref.allowedTransfer) && ref.allowedTransfer.length) {
          sections.push(`  ALLOWED: ${ref.allowedTransfer.join(', ')}`);
        }
        if (Array.isArray(ref.forbiddenTransfer) && ref.forbiddenTransfer.length) {
          sections.push(`  FORBIDDEN: ${ref.forbiddenTransfer.join(', ')}`);
        }
      });
    }
  }

  // TOOL CONSTRAINTS section (DSL output)
  const toolConstraints = contract.toolConstraints;
  if (toolConstraints && toolConstraints.constraints) {
    sections.push('');
    sections.push(`=== TOOL CONSTRAINTS (${toolConstraints.toolId || toolId} DSL ${toolConstraints.dslVersion || ''}) ===`);
    const c = toolConstraints.constraints;
    if (c.editTarget) sections.push(`EDIT TARGET: ${c.editTarget}`);
    if (Array.isArray(c.lockedZones)) sections.push(`LOCKED ZONES: ${c.lockedZones.join(', ')}`);
    if (Array.isArray(c.allowedScope)) sections.push(`ALLOWED SCOPE: ${c.allowedScope.join(', ')}`);
    if (Array.isArray(c.forbiddenScope)) sections.push(`FORBIDDEN SCOPE: ${c.forbiddenScope.join(', ')}`);
    if (c.referencePolicy) sections.push(`REFERENCE POLICY: ${c.referencePolicy}`);
    if (c.changeIntensity) sections.push(`CHANGE INTENSITY: ${c.changeIntensity}`);
    if (c.styleTransfer) sections.push(`STYLE TRANSFER: ${c.styleTransfer}`);
    if (Array.isArray(c.styleContinuity)) sections.push(`STYLE CONTINUITY: ${c.styleContinuity.join(', ')}`);
    if (c.cameraVariation) sections.push(`CAMERA VARIATION: ${c.cameraVariation}`);
    if (c.graphicStyle) sections.push(`GRAPHIC STYLE: ${c.graphicStyle}`);
    if (c.colorPalette) sections.push(`COLOR PALETTE: ${c.colorPalette}`);
    if (typeof c.roomLabels === 'boolean') sections.push(`ROOM LABELS: ${c.roomLabels ? 'show' : 'hide'}`);
  }

  // USER NOTE section
  if (contract.userNote) {
    sections.push('');
    sections.push('=== USER NOTES ===');
    sections.push(contract.userNote);
  }

  // Always append the premium visual core at the end
  sections.push('');
  sections.push(ARCHILYA_PREMIUM_VISUAL_CORE);

  const prompt = sections.join('\n');
  return {
    prompt,
    templateName: `buildPromptFromContractV3-${toolId}`,
    promptVersion: '3.0.0',
  };
}

/**
 * Builds a tool-specific prompt from job metadata.
 * Replaces the old 10-line generic buildPrompt() in processor.js.
 *
 * @param {Object} job - The job document from Supabase
 * @returns {{ prompt: string, templateName: string, promptVersion: string }}
 */
function buildAiStudioPromptV2(job) {
  const toolId = job.tool_id || (job.metadata && job.metadata.toolId) || 'unknown';
  const metadata = (job.metadata && typeof job.metadata === 'object') ? job.metadata : {};
  const rawExtraNote = job.prompt || metadata.extraNote || '';
  const style = metadata.style || 'modern';
  const sceneEditMode = metadata.sceneEditMode || '';

  // ── V3: Structured Prompt Contract (from WebPanel V3) ──────────────
  const promptContract = metadata.promptContract || null;
  if (promptContract) {
    return buildPromptFromContractV3(promptContract, job);
  }

  // Build reference list for scene edit
  const referenceImages = (metadata.input && Array.isArray(metadata.input.referenceImages)
    ? metadata.input.referenceImages
    : []
  ).map((ref) => ({
    type: ref.type || 'object',
    label: ref.label || '',
    note: ref.note || '',
  }));

  // Extract settings from structured metadata fields (primary source)
  const settingsParams = {
    atmosphere: metadata.atmosphere || metadata.style_settings?.atmosphere,
    materialLanguage: metadata.materialLanguage || metadata.style_settings?.materialLanguage,
    styleStrength: metadata.styleStrength || metadata.style_settings?.styleStrength,
    enhancePreserve: metadata.enhancePreserve || metadata.style_settings?.enhancePreserve,
    scenePreserveAreas: metadata.scenePreserveAreas || metadata.style_settings?.scenePreserveAreas,
    revisionType: metadata.revisionType || metadata.style_settings?.revisionType,
    planType: metadata.planType || metadata.style_settings?.planType,
    palette: metadata.palette || metadata.style_settings?.palette,
    presentationStyle: metadata.presentationStyle || metadata.style_settings?.presentationStyle,
    reportTone: metadata.reportTone || metadata.style_settings?.reportTone,
  };

  // Fallback: if structured metadata is empty, parse settings from Turkish extraNote text
  // This handles the case where express.js doesn't store structured settings (current gap).
  const parsedFromNote = parseSettingsFromExtraNote(rawExtraNote, toolId);
  const finalParams = mergeSettingsParams(settingsParams, parsedFromNote);

  const translatedSettings = translateSettingsToPromptParams(finalParams);

  let prompt;
  let templateName;

  switch (toolId) {
    case 'img2img':
    case 'multi-angle':
      templateName = 'buildTransformStylePrompt';
      prompt = buildTransformStylePrompt({ style, extraNote: rawExtraNote, translatedSettings });
      break;
    case 'enhance':
      templateName = 'buildEnhancedRenderPrompt';
      prompt = buildEnhancedRenderPrompt({ extraNote: rawExtraNote, translatedSettings });
      break;
    case 'plancolor':
      templateName = 'buildPlanColorPrompt';
      prompt = buildPlanColorPrompt({ style, extraNote: rawExtraNote, translatedSettings });
      break;
    case 'sceneedit':
      templateName = 'buildSceneEditPrompt';
      prompt = buildSceneEditPrompt({ editMode: sceneEditMode, references: referenceImages, extraNote: rawExtraNote, translatedSettings });
      break;
    case 'analysis':
      templateName = 'buildAnalysisPrompt';
      prompt = buildAnalysisPrompt(rawExtraNote);
      break;
    default:
      templateName = 'buildTransformStylePrompt';
      prompt = buildTransformStylePrompt({ style: 'modern', extraNote: rawExtraNote, translatedSettings });
  }

  return { prompt, templateName, promptVersion: PROMPT_VERSION };
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
  // Version
  PROMPT_VERSION,

  // Constants
  ARCHILYA_PREMIUM_VISUAL_CORE,
  GEOMETRY_LOCK_HEADER,
  REFERENCE_ROLE_SEPARATION,
  NEGATIVE_PROMPT_COMMON,
  NEGATIVE_PROMPT_ARCHITECTURAL,

  // Style maps
  AI_STUDIO_STYLE_PROMPTS,
  AI_STUDIO_PLAN_STYLE_PROMPTS,
  SCENE_EDIT_MODES,

  // Settings translation
  ATMOSPHERE_TRANSLATIONS,
  MATERIAL_TRANSLATIONS,
  PRESERVE_TRANSLATIONS,
  STYLE_STRENGTH_TRANSLATIONS,
  PLAN_TYPE_TRANSLATIONS,
  PALETTE_TRANSLATIONS,
  PRESENTATION_TRANSLATIONS,
  REPORT_TONE_TRANSLATIONS,
  REVISION_TYPE_TRANSLATIONS,
  translateSettingsToPromptParams,
  parseSettingsFromExtraNote,
  mergeSettingsParams,

  // Tool-specific prompt builders
  buildTransformStylePrompt,
  buildEnhancedRenderPrompt,
  buildSceneEditPrompt,
  buildPlanColorPrompt,
  buildAnalysisPrompt,

  // Parts assemblers
  buildSceneEditParts,
  buildRevisionParts,

  // Main dispatcher
  buildPromptFromContractV3,
  buildAiStudioPromptV2,

  // Helpers
  normalizeSceneEditMode,
};
