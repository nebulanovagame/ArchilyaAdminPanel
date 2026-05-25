const crypto = require('crypto');
const { HttpsError } = require('../shared/http-callable');
const { supabase } = require('../shared/supabase-helpers');

const AI_STUDIO_BUCKET = process.env.SUPABASE_AI_STUDIO_BUCKET || 'ai-studio';
let bucketReady = false;

function extensionForMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  return 'bin';
}

function requireInlineImage(imagePart) {
  const data = String(imagePart?.inlineData?.data || '');
  const mimeType = String(imagePart?.inlineData?.mimeType || '').toLowerCase();
  if (!data || !mimeType.startsWith('image/')) {
    throw new HttpsError('invalid-argument', 'Gecerli bir gorsel zorunludur.');
  }
  return { data, mimeType };
}

async function uploadBuffer(path, buffer, contentType) {
  await ensureBucket();
  const { error } = await supabase.storage.from(AI_STUDIO_BUCKET).upload(path, buffer, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new HttpsError('internal', `AI Studio depolama hatasi: ${error.message}`);
}

async function ensureBucket() {
  if (bucketReady) return;
  const { data, error } = await supabase.storage.getBucket(AI_STUDIO_BUCKET);
  if (!error && data) {
    bucketReady = true;
    return;
  }
  const { error: createError } = await supabase.storage.createBucket(AI_STUDIO_BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  });
  if (createError && !String(createError.message || '').toLowerCase().includes('already exists')) {
    throw new HttpsError('internal', `AI Studio bucket hazirlanamadi: ${createError.message}`);
  }
  bucketReady = true;
}

async function storeInputImage({ uid, jobId, imagePart, label }) {
  const image = requireInlineImage(imagePart);
  const buffer = Buffer.from(image.data, 'base64');
  const ext = extensionForMimeType(image.mimeType);
  const suffix = crypto.randomBytes(4).toString('hex');
  const safeLabel = String(label || 'input').replace(/[^a-z0-9_-]/gi, '-').slice(0, 40) || 'input';
  const path = `${uid}/jobs/${jobId}/inputs/${safeLabel}-${suffix}.${ext}`;
  await uploadBuffer(path, buffer, image.mimeType);
  return { bucket: AI_STUDIO_BUCKET, path, mimeType: image.mimeType, sizeBytes: buffer.length };
}

async function downloadStoredImage(storedImage) {
  if (!storedImage?.path || !storedImage?.mimeType) {
    throw new HttpsError('failed-precondition', 'AI job girdi gorseli eksik.');
  }
  const { data, error } = await supabase.storage.from(storedImage.bucket || AI_STUDIO_BUCKET).download(storedImage.path);
  if (error) throw new HttpsError('internal', `AI Studio girdi gorseli okunamadi: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return {
    inlineData: {
      mimeType: storedImage.mimeType,
      data: Buffer.from(arrayBuffer).toString('base64'),
    },
  };
}

async function storeOutputImage({ uid, jobId, toolId, inlineData }) {
  const mimeType = String(inlineData?.mimeType || '').toLowerCase();
  const base64 = String(inlineData?.data || '');
  if (!mimeType.startsWith('image/') || !base64) {
    throw new HttpsError('internal', 'AI gorsel cikti verisi gecersiz.');
  }
  const buffer = Buffer.from(base64, 'base64');
  const ext = extensionForMimeType(mimeType);
  const safeTool = String(toolId || 'result').replace(/[^a-z0-9_-]/gi, '-').slice(0, 40) || 'result';
  const path = `${uid}/jobs/${jobId}/outputs/${safeTool}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  await uploadBuffer(path, buffer, mimeType);
  const { data: signed, error: signedError } = await supabase.storage
    .from(AI_STUDIO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signedError) throw new HttpsError('internal', `AI Studio cikti URL'i olusturulamadi: ${signedError.message}`);
  return { bucket: AI_STUDIO_BUCKET, path, mimeType, sizeBytes: buffer.length, url: signed?.signedUrl || null };
}

module.exports = { AI_STUDIO_BUCKET, storeInputImage, downloadStoredImage, storeOutputImage };
