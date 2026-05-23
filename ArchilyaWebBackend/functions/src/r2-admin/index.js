const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { R2_ACCESS_KEY_ID, R2_MAX_UPLOAD_BYTES, R2_REGION, R2_SECRET_ACCESS_KEY, R2_UPLOAD_URL_TTL_SECONDS, assertAdminPanelAccess, buildAdminProductObjectKey, buildAdminProductObjectPrefix, normalizeContentType, normalizeText, requireAuth, resolveR2Target, sanitizeFileName, shouldRouteToR2 } = shared;
exports.createR2UploadUrlAdminSecure = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY],
  },
  async (request) => {
    const uid = requireAuth(request);
    await assertAdminPanelAccess(uid);

    const productId = normalizeText(request.data?.projectId || request.data?.productId, 120);
    const originalFileName = normalizeText(request.data?.fileName, 220);
    const fileSize = Number(request.data?.fileSize || 0);
    const contentType = normalizeContentType(request.data?.contentType, originalFileName);

    if (!productId) {
      throw new HttpsError('invalid-argument', 'projectId zorunludur.');
    }
    if (!originalFileName) {
      throw new HttpsError('invalid-argument', 'fileName zorunludur.');
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new HttpsError('invalid-argument', 'fileSize pozitif olmali.');
    }
    if (fileSize > R2_MAX_UPLOAD_BYTES) {
      throw new HttpsError('invalid-argument', 'Dosya boyutu R2 limiti uzerinde.');
    }

    if (!shouldRouteToR2(originalFileName, fileSize, contentType)) {
      throw new HttpsError(
        'failed-precondition',
        'Bu dosya R2 route kriterini karsilamiyor. Firebase Storage kullanin.'
      );
    }

    const objectKey = buildAdminProductObjectKey({ productId, fileName: originalFileName });
    const safeFileName = sanitizeFileName(originalFileName);

    const { client: s3, bucketName } = await resolveR2Target();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType,
      Metadata: {
        source: 'admin_panel',
        product_id: productId,
        uploader_uid: uid,
      },
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: R2_UPLOAD_URL_TTL_SECONDS });

    return {
      success: true,
      storageProvider: 'r2',
      uploadUrl,
      objectKey,
      fileName: safeFileName,
      contentType,
      expiresInSeconds: R2_UPLOAD_URL_TTL_SECONDS,
      pseudoUrl: `r2://${objectKey}`,
      bucketName,
    };
  }
);

exports.deleteR2ObjectAdminSecure = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY],
  },
  async (request) => {
    const uid = requireAuth(request);
    await assertAdminPanelAccess(uid);

    const productId = normalizeText(request.data?.projectId || request.data?.productId, 120);
    const objectKey = normalizeText(request.data?.objectKey, 500);

    if (!productId || !objectKey) {
      throw new HttpsError('invalid-argument', 'projectId ve objectKey zorunludur.');
    }

    const expectedPrefix = `${buildAdminProductObjectPrefix(productId)}/`;
    if (!objectKey.startsWith(expectedPrefix)) {
      throw new HttpsError('permission-denied', 'Bu objectKey bu urune ait degil.');
    }

    const { client: s3, bucketName } = await resolveR2Target();
    await s3.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }));

    return { success: true };
  }
);

exports.resolveR2TargetAdminSecure = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY],
  },
  async (request) => {
    const uid = requireAuth(request);
    await assertAdminPanelAccess(uid);

    const target = await resolveR2Target(true);
    return {
      success: true,
      endpoint: target.endpoint,
      bucketName: target.bucketName,
      region: R2_REGION,
    };
  }
);
