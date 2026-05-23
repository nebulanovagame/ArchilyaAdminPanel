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