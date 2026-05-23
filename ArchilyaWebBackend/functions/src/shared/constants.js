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