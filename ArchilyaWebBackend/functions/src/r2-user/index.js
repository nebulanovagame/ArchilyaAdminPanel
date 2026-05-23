const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { R2_ACCESS_KEY_ID, R2_DOWNLOAD_URL_TTL_SECONDS, R2_MAX_UPLOAD_BYTES, R2_SECRET_ACCESS_KEY, R2_UPLOAD_URL_TTL_SECONDS, assertProductReadAccess, assertProjectMemberAccess, buildR2ObjectKey, hasProjectDeletionAccess, normalizeContentType, normalizeText, productContainsObjectKey, requireAuth, resolveR2Target, sanitizeFileName, shouldRouteToR2 } = shared;
exports.createR2UploadUrlSecure = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY],
  },
  async (request) => {
    const uid = requireAuth(request);
    const projectId = normalizeText(request.data?.projectId, 120);
    const originalFileName = normalizeText(request.data?.fileName, 220);
    const fileSize = Number(request.data?.fileSize || 0);
    const contentType = normalizeContentType(request.data?.contentType, originalFileName);

    if (!projectId) {
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

    await assertProjectMemberAccess(projectId, uid);

    if (!shouldRouteToR2(originalFileName, fileSize, contentType)) {
      throw new HttpsError(
        'failed-precondition',
        'Bu dosya R2 route kriterini karsilamiyor. Firebase Storage kullanin.'
      );
    }

    const objectKey = buildR2ObjectKey({ uid, projectId, fileName: originalFileName });
    const safeFileName = sanitizeFileName(originalFileName);

    const { client: s3, bucketName } = await resolveR2Target();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType,
      Metadata: {
        project_id: projectId,
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

exports.createR2DownloadUrlSecure = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY],
  },
  async (request) => {
    const uid = requireAuth(request);
    const projectId = normalizeText(request.data?.projectId, 120);
    const objectKey = normalizeText(request.data?.objectKey, 400);
    const fileName = sanitizeFileName(request.data?.fileName, 180);
    const disposition = String(request.data?.disposition || 'attachment').toLowerCase() === 'inline'
      ? 'inline'
      : 'attachment';

    if (!projectId || !objectKey) {
      throw new HttpsError('invalid-argument', 'projectId ve objectKey zorunludur.');
    }

    await assertProjectMemberAccess(projectId, uid);

    const { client: s3, bucketName } = await resolveR2Target();
    const contentDisposition = `${disposition}; filename="${fileName || 'download'}"`;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ResponseContentDisposition: contentDisposition,
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: R2_DOWNLOAD_URL_TTL_SECONDS });

    return {
      success: true,
      storageProvider: 'r2',
      downloadUrl,
      expiresInSeconds: R2_DOWNLOAD_URL_TTL_SECONDS,
    };
  }
);

exports.createR2ProductDownloadUrlSecure = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY],
  },
  async (request) => {
    const uid = requireAuth(request);
    const productId = normalizeText(request.data?.productId || request.data?.projectId, 120);
    const objectKey = normalizeText(request.data?.objectKey, 500);
    const fileName = sanitizeFileName(request.data?.fileName, 180);
    const disposition = String(request.data?.disposition || 'attachment').toLowerCase() === 'inline'
      ? 'inline'
      : 'attachment';

    if (!productId || !objectKey) {
      throw new HttpsError('invalid-argument', 'productId ve objectKey zorunludur.');
    }

    const { product } = await assertProductReadAccess(productId, uid);
    if (!productContainsObjectKey(product, objectKey)) {
      throw new HttpsError('permission-denied', 'Bu dosya urun kaydinda bulunamadi.');
    }

    const { client: s3, bucketName } = await resolveR2Target();
    const contentDisposition = `${disposition}; filename="${fileName || 'download'}"`;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ResponseContentDisposition: contentDisposition,
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: R2_DOWNLOAD_URL_TTL_SECONDS });

    return {
      success: true,
      storageProvider: 'r2',
      downloadUrl,
      expiresInSeconds: R2_DOWNLOAD_URL_TTL_SECONDS,
    };
  }
);

exports.deleteR2ObjectSecure = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY],
  },
  async (request) => {
    const uid = requireAuth(request);
    const projectId = normalizeText(request.data?.projectId, 120);
    const objectKey = normalizeText(request.data?.objectKey, 400);

    if (!projectId || !objectKey) {
      throw new HttpsError('invalid-argument', 'projectId ve objectKey zorunludur.');
    }

    const { project } = await assertProjectMemberAccess(projectId, uid);
    if (!hasProjectDeletionAccess(project, uid)) {
      throw new HttpsError('permission-denied', 'Bu dosyayi kalici silme yetkiniz yok.');
    }

    const { client: s3, bucketName } = await resolveR2Target();
    await s3.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }));

    return { success: true };
  }
);
