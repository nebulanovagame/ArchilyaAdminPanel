#!/usr/bin/env node

const { Storage } = require('@google-cloud/storage');
const { supabase } = require('../src/shared/supabase');

const sourceBucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.GCS_BUCKET || '';
const dryRun = process.env.DRY_RUN !== 'false';
const verifyOnly = process.env.VERIFY_ONLY === 'true';

const bucketMappings = [
  { sourcePrefix: 'branding/', targetBucket: 'branding', stripPrefix: 'branding/' },
  { sourcePrefix: 'projects/', targetBucket: 'projects', stripPrefix: 'projects/' },
  { sourcePrefix: 'ai-studio/', targetBucket: 'ai-studio', stripPrefix: 'ai-studio/' },
  { sourcePrefix: 'users/', targetBucket: 'users', stripPrefix: 'users/' },
];

function resolveMapping(fileName) {
  return bucketMappings.find((mapping) => fileName.startsWith(mapping.sourcePrefix));
}

function toTargetPath(fileName, mapping) {
  const stripped = fileName.slice(mapping.stripPrefix.length);
  return stripped.replace(/^\/+/, '');
}

async function ensureBucket(bucketName) {
  const { data, error } = await supabase.storage.getBucket(bucketName);
  if (!error && data) return;

  if (dryRun) {
    console.info(`[dry-run] create bucket ${bucketName}`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  });

  if (createError && !createError.message?.includes('already exists')) {
    throw createError;
  }
}

function assertMigrationEnvironment() {
  if (!sourceBucketName) {
    throw new Error('FIREBASE_STORAGE_BUCKET or GCS_BUCKET is required. Example: FIREBASE_STORAGE_BUCKET=nng-toma.firebasestorage.app');
  }

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  if (!credentialPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required. Set it to the Firebase/GCP service account JSON path.');
  }
}

async function migrateFile(file, mapping) {
  const [metadata] = await file.getMetadata();
  const targetPath = toTargetPath(file.name, mapping);
  const contentType = metadata.contentType || 'application/octet-stream';

  if (!targetPath) return { skipped: true, reason: 'empty-target-path' };

  if (dryRun || verifyOnly) {
    console.info(`[${verifyOnly ? 'verify-only' : 'dry-run'}] ${file.name} -> ${mapping.targetBucket}/${targetPath}`);
    return { migrated: false, dryRun: true, verified: verifyOnly };
  }

  const [buffer] = await file.download();
  const { error } = await supabase.storage
    .from(mapping.targetBucket)
    .upload(targetPath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw error;
  console.info(`[migrated] ${file.name} -> ${mapping.targetBucket}/${targetPath}`);
  return { migrated: true };
}

async function main() {
  assertMigrationEnvironment();

  const storage = new Storage();
  const sourceBucket = storage.bucket(sourceBucketName);
  const totals = { scanned: 0, migrated: 0, skipped: 0, verified: 0 };

  for (const mapping of bucketMappings) {
    await ensureBucket(mapping.targetBucket);
  }

  for await (const file of sourceBucket.getFilesStream()) {
    totals.scanned += 1;
    const mapping = resolveMapping(file.name);
    if (!mapping) {
      totals.skipped += 1;
      console.info(`[skip] no mapping for ${file.name}`);
      continue;
    }

    const result = await migrateFile(file, mapping);
    if (result?.skipped) totals.skipped += 1;
    else if (result?.verified) totals.verified += 1;
    else if (!dryRun) totals.migrated += 1;
  }

  console.info(JSON.stringify({ dryRun, verifyOnly, sourceBucketName, totals }, null, 2));
}

main().catch((error) => {
  console.error('[storage-migration] failed:', error);
  process.exitCode = 1;
});
