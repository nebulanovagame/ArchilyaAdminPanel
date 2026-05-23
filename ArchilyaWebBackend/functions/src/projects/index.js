const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { FieldValue, assertProjectMemberAccess, buildChunkedBatches, buildProjectFolderId, db, ensureUniqueProjectFileName, ensureUserProfileDoc, findProjectFolderByName, hasProjectDeletionAccess, isValidEmail, normalizeContentType, normalizeEmail, normalizeProjectFileForMutation, normalizeText, requireAuth, resolveProjectFileTypeKey } = shared;
exports.createProjectSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || request.data?.email || '');
    const displayName = normalizeText(request.auth?.token?.name || request.data?.displayName || email, 120) || email || uid;
    const name = normalizeText(request.data?.name, 180);
    const location = normalizeText(request.data?.location, 240);
    const status = normalizeText(request.data?.status, 80) || 'Aktif';

    if (!name) {
      throw new HttpsError('invalid-argument', 'Proje adi zorunludur.');
    }

    await ensureUserProfileDoc(uid, { email, displayName });

    const nowIso = new Date().toISOString();
    const projectRef = db.collection('projects').doc();
    await projectRef.set({
      name,
      location: location || '',
      uid,
      ownerId: uid,
      memberUids: [uid],
      fileCount: { pdf: 0, dwg: 0, img: 0 },
      totalSize: 0,
      files: [],
      deletedFiles: [],
      folders: [],
      activityLog: [{
        action: 'create',
        user: displayName,
        timestamp: nowIso,
        details: 'Proje olusturuldu',
      }],
      team: [{ uid, email: email || '', role: 'owner' }],
      invites: [],
      status,
      isDeleted: false,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      projectId: projectRef.id,
    };
  }
);

exports.updateProjectSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const { projectRef } = await assertProjectMemberAccess(request.data?.projectId, uid);
    const rawData = request.data?.data;

    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
      throw new HttpsError('invalid-argument', 'data nesnesi zorunludur.');
    }

    const payload = {};

    if (Object.prototype.hasOwnProperty.call(rawData, 'name')) {
      const name = normalizeText(rawData.name, 180);
      if (!name) {
        throw new HttpsError('invalid-argument', 'Proje adi bos birakilamaz.');
      }
      payload.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(rawData, 'location')) {
      payload.location = normalizeText(rawData.location, 240);
    }

    if (Object.prototype.hasOwnProperty.call(rawData, 'status')) {
      payload.status = normalizeText(rawData.status, 80) || 'Aktif';
    }

    if (Object.prototype.hasOwnProperty.call(rawData, 'workspaceId')) {
      payload.workspaceId = rawData.workspaceId === null
        ? null
        : (normalizeText(rawData.workspaceId, 120) || null);
    }

    if (Object.prototype.hasOwnProperty.call(rawData, 'workspaceName')) {
      payload.workspaceName = rawData.workspaceName === null
        ? null
        : (normalizeText(rawData.workspaceName, 180) || null);
    }

    if (!Object.keys(payload).length) {
      return { success: true, skipped: true };
    }

    payload.updatedAt = FieldValue.serverTimestamp();
    await projectRef.update(payload);
    return { success: true };
  }
);

exports.sendProjectInviteSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const toEmail = normalizeEmail(request.data?.toEmail || '');
    const projectId = String(request.data?.projectId || '').trim();
    const role = String(request.data?.role || 'member').trim();
    const fromEmail = normalizeEmail(request.auth?.token?.email || '');
    const fromName = normalizeText(request.auth?.token?.name || request.data?.fromName || fromEmail, 120) || fromEmail;

    if (!toEmail || !isValidEmail(toEmail)) {
      throw new HttpsError('invalid-argument', 'Gecerli bir e-posta adresi girin.');
    }
    if (!projectId) {
      throw new HttpsError('invalid-argument', 'projectId zorunludur.');
    }
    if (toEmail === fromEmail) {
      throw new HttpsError('invalid-argument', 'Kendinizi davet edemezsiniz.');
    }
    if (!['member', 'editor', 'viewer'].includes(role)) {
      throw new HttpsError('invalid-argument', 'Gecersiz davet rolu.');
    }

    const projectRef = db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      throw new HttpsError('not-found', 'Proje bulunamadi.');
    }

    const project = projectSnap.data() || {};
    const memberUids = Array.isArray(project.memberUids) ? project.memberUids : [];
    if (!memberUids.includes(uid)) {
      throw new HttpsError('permission-denied', 'Bu projeye davet gonderme yetkiniz yok.');
    }
    if (project.workspaceId) {
      throw new HttpsError('failed-precondition', 'Workspace projelerinde proje daveti kapalidir.');
    }

    const team = Array.isArray(project.team) ? project.team : [];
    if (team.some((m) => normalizeEmail(m.email) === toEmail)) {
      throw new HttpsError('already-exists', 'Bu kisi zaten projenin uyesi.');
    }

    const duplicateSnap = await db.collection('invitations')
      .where('projectId', '==', projectId)
      .where('toEmail', '==', toEmail)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!duplicateSnap.empty) {
      throw new HttpsError('already-exists', 'Bu kisiye zaten bekleyen bir davet gonderilmis.');
    }

    let toUid = null;
    const userByEmailSnap = await db.collection('users').where('email', '==', toEmail).limit(1).get();
    if (!userByEmailSnap.empty) {
      toUid = userByEmailSnap.docs[0].id;
    }

    const inviteRef = db.collection('invitations').doc();
    const notifRef = db.collection('notifications').doc();
    const projectName = String(project.name || request.data?.projectName || 'Proje');

    const batch = db.batch();
    batch.set(inviteRef, {
      fromUid: uid,
      fromEmail,
      fromName,
      toEmail,
      toUid,
      projectId,
      projectName,
      role,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(notifRef, {
      toEmail,
      toUid,
      type: 'invite',
      title: 'Projeye davet edildiniz',
      body: `${fromName} sizi "${projectName}" projesine davet etti.`,
      projectId,
      projectName,
      inviteId: inviteRef.id,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.update(projectRef, {
      activityLog: FieldValue.arrayUnion({
        action: 'invite_sent',
        user: fromName,
        timestamp: new Date().toISOString(),
        details: `${toEmail} projeye davet edildi (${role})`,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return { success: true, inviteId: inviteRef.id };
  }
);

exports.acceptProjectInviteSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const inviteId = String(request.data?.inviteId || '').trim();
    const email = normalizeEmail(request.auth?.token?.email || '');
    if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId zorunludur.');

    const inviteRef = db.collection('invitations').doc(inviteId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) throw new HttpsError('not-found', 'Davet bulunamadi.');

    const invite = inviteSnap.data() || {};
    if (String(invite.status || '') !== 'pending') {
      throw new HttpsError('failed-precondition', 'Bu davet artik aktif degil.');
    }

    const allowedByUid = invite.toUid && invite.toUid === uid;
    const allowedByEmail = normalizeEmail(invite.toEmail) === email;
    if (!allowedByUid && !allowedByEmail) {
      throw new HttpsError('permission-denied', 'Bu daveti kabul etme yetkiniz yok.');
    }

    const projectId = String(invite.projectId || '');
    const projectRef = db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) throw new HttpsError('not-found', 'Proje bulunamadi veya silinmis.');
    const project = projectSnap.data() || {};
    if (project.workspaceId) {
      throw new HttpsError('failed-precondition', 'Workspace projelerinde proje daveti kullanilmaz.');
    }

    const acceptedRole = ['member', 'editor', 'viewer'].includes(invite.role) ? invite.role : 'member';
    const alreadyMember = (Array.isArray(project.team) ? project.team : []).some((m) => normalizeEmail(m.email) === email);

    const batch = db.batch();
    if (!alreadyMember) {
      batch.update(projectRef, {
        team: FieldValue.arrayUnion({ uid, email, role: acceptedRole }),
        memberUids: FieldValue.arrayUnion(uid),
        activityLog: FieldValue.arrayUnion({
          action: 'member_join',
          user: email,
          timestamp: new Date().toISOString(),
          details: `${email} projeye katildi (${acceptedRole})`,
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    batch.update(inviteRef, {
      status: 'accepted',
      acceptedAt: FieldValue.serverTimestamp(),
      acceptedUid: uid,
      toUid: uid,
    });

    const notifSnap = await db.collection('notifications').where('inviteId', '==', inviteId).get();
    notifSnap.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });

    await batch.commit();
    return { success: true };
  }
);

exports.declineProjectInviteSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const inviteId = String(request.data?.inviteId || '').trim();
    const email = normalizeEmail(request.auth?.token?.email || '');
    if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId zorunludur.');

    const inviteRef = db.collection('invitations').doc(inviteId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) throw new HttpsError('not-found', 'Davet bulunamadi.');

    const invite = inviteSnap.data() || {};
    const allowedByUid = invite.toUid && invite.toUid === uid;
    const allowedByEmail = normalizeEmail(invite.toEmail) === email;
    if (!allowedByUid && !allowedByEmail) {
      throw new HttpsError('permission-denied', 'Bu daveti reddetme yetkiniz yok.');
    }

    await inviteRef.update({
      status: 'declined',
      declinedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const notifSnap = await db.collection('notifications').where('inviteId', '==', inviteId).get();
    const notifBatches = buildChunkedBatches(notifSnap.docs, () => ({ read: true }));
    await Promise.all(notifBatches.map((b) => b.commit()));

    return { success: true };
  }
);

exports.createProjectFolderSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const folderName = normalizeText(request.data?.folderName, 120);
    if (!folderName) {
      throw new HttpsError('invalid-argument', 'folderName zorunludur.');
    }

    const actor = normalizeText(request.auth?.token?.name || request.auth?.token?.email || uid, 120) || uid;
    const { projectRef, project } = await assertProjectMemberAccess(request.data?.projectId, uid);

    if (project.isDeleted) {
      throw new HttpsError('failed-precondition', 'Silinmis projede klasor islemi yapilamaz.');
    }

    const folders = Array.isArray(project.folders) ? project.folders : [];
    const existingFolder = findProjectFolderByName(folders, folderName);
    if (existingFolder?.id) {
      return { success: true, existing: true, folder: existingFolder };
    }

    const folder = {
      id: buildProjectFolderId(request.data?.folderId),
      name: folderName,
      createdAt: new Date().toISOString(),
      createdBy: uid,
      parentId: null,
    };

    await projectRef.update({
      folders: FieldValue.arrayUnion(folder),
      activityLog: FieldValue.arrayUnion({
        action: 'folder_create',
        user: actor,
        timestamp: new Date().toISOString(),
        details: `${folder.name} klasoru olusturuldu`,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, existing: false, folder };
  }
);

exports.addProjectFileSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const actor = normalizeText(request.auth?.token?.name || request.auth?.token?.email || uid, 120) || uid;
    const { projectRef, project } = await assertProjectMemberAccess(request.data?.projectId, uid);

    if (project.isDeleted) {
      throw new HttpsError('failed-precondition', 'Silinmis projeye dosya eklenemez.');
    }

    const file = normalizeProjectFileForMutation(request.data?.file, { aiMode: false });
    const currentFiles = Array.isArray(project.files) ? project.files : [];
    const alreadyExists = currentFiles.some(
      (item) => normalizeText(item?.url, 4000) === file.url,
    );

    if (alreadyExists) {
      return { success: true, skipped: true, file };
    }

    const typeKey = resolveProjectFileTypeKey(file.type);

    await projectRef.update({
      files: FieldValue.arrayUnion(file),
      [`fileCount.${typeKey}`]: FieldValue.increment(1),
      totalSize: FieldValue.increment(file.size),
      activityLog: FieldValue.arrayUnion({
        action: 'upload',
        user: actor,
        timestamp: new Date().toISOString(),
        details: `${file.name} dosyasi yuklendi`,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, file };
  }
);

exports.moveProjectFileToTrashSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const fileUrl = normalizeText(request.data?.fileUrl, 4000);
    if (!fileUrl) {
      throw new HttpsError('invalid-argument', 'fileUrl zorunludur.');
    }

    const actor = normalizeText(request.auth?.token?.name || request.auth?.token?.email || uid, 120) || uid;
    const { projectRef, project } = await assertProjectMemberAccess(request.data?.projectId, uid);

    if (project.isDeleted) {
      throw new HttpsError('failed-precondition', 'Silinmis projede dosya tasima islemi yapilamaz.');
    }

    const files = Array.isArray(project.files) ? project.files : [];
    const target = files.find((item) => normalizeText(item?.url, 4000) === fileUrl);
    if (!target) {
      return { success: true, skipped: true };
    }

    const targetSizeRaw = Number(target.size || 0);
    const targetSize = Number.isFinite(targetSizeRaw) && targetSizeRaw > 0 ? Math.round(targetSizeRaw) : 0;
    const typeKey = resolveProjectFileTypeKey(target.type);

    await projectRef.update({
      files: FieldValue.arrayRemove(target),
      deletedFiles: FieldValue.arrayUnion({ ...target, deletedAt: new Date().toISOString() }),
      [`fileCount.${typeKey}`]: FieldValue.increment(-1),
      totalSize: FieldValue.increment(-targetSize),
      activityLog: FieldValue.arrayUnion({
        action: 'file_soft_delete',
        user: actor,
        timestamp: new Date().toISOString(),
        details: `${normalizeText(target.name, 220) || 'Dosya'} cop kutusuna tasindi`,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      fileName: normalizeText(target.name, 220) || '',
    };
  }
);

exports.saveAiOutputToProjectSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const actor = normalizeText(request.auth?.token?.name || request.auth?.token?.email || uid, 120) || uid;
    const mode = normalizeText(request.data?.saveMode, 24).toLowerCase() === 'version' ? 'version' : 'new';
    const versionTargetName = normalizeText(request.data?.versionTargetName, 220);
    const explicitFolderId = request.data?.folderId === undefined
      ? undefined
      : (request.data?.folderId === null ? null : normalizeText(request.data?.folderId, 120) || null);

    const { projectRef, project } = await assertProjectMemberAccess(request.data?.projectId, uid);
    if (project.isDeleted) {
      throw new HttpsError('failed-precondition', 'Silinmis projeye AI cikti kaydedilemez.');
    }

    const incomingFile = normalizeProjectFileForMutation(request.data?.file, { aiMode: true });
    const files = Array.isArray(project.files) ? project.files : [];
    const nowIso = new Date().toISOString();
    const nextFiles = [...files];

    let savedFile = null;
    let countDelta = 0;
    let sizeDelta = 0;

    if (mode === 'version') {
      if (!versionTargetName) {
        throw new HttpsError('invalid-argument', 'versionTargetName zorunludur.');
      }

      const targetIndex = files.findIndex((file) => normalizeText(file?.name, 220) === versionTargetName);
      if (targetIndex < 0) {
        throw new HttpsError('not-found', 'Versiyonlanacak dosya bulunamadi.');
      }

      const oldFile = files[targetIndex] || {};
      const oldSizeRaw = Number(oldFile.size || 0);
      const oldSize = Number.isFinite(oldSizeRaw) && oldSizeRaw > 0 ? Math.round(oldSizeRaw) : 0;
      const oldVersions = Array.isArray(oldFile.versions) ? oldFile.versions : [];

      const oldVersion = {
        url: normalizeText(oldFile.url, 4000),
        path: normalizeText(oldFile.path, 1200) || null,
        storageProvider: normalizeText(oldFile.storageProvider, 32).toLowerCase() || 'firebase',
        objectKey: normalizeText(oldFile.objectKey, 800) || null,
        contentType: normalizeContentType(oldFile.contentType, oldFile.name || ''),
        size: oldSize,
        createdAt: normalizeText(oldFile.createdAt, 80) || nowIso,
        version: oldVersions.length + 1,
      };

      const resolvedType = normalizeText(oldFile.type, 24).toLowerCase() || incomingFile.type;
      const resolvedFolderId = explicitFolderId === undefined
        ? (oldFile.folderId ?? incomingFile.folderId ?? null)
        : explicitFolderId;

      savedFile = {
        ...oldFile,
        name: normalizeText(oldFile.name, 220) || incomingFile.name,
        url: incomingFile.url,
        path: incomingFile.path,
        size: incomingFile.size,
        type: resolvedType,
        folderId: resolvedFolderId,
        versions: [...oldVersions, oldVersion],
        aiGenerated: true,
        aiMeta: incomingFile.aiMeta,
        contentType: incomingFile.contentType,
        storageProvider: incomingFile.storageProvider,
        objectKey: incomingFile.objectKey,
        createdAt: nowIso,
      };

      nextFiles[targetIndex] = savedFile;
      sizeDelta = incomingFile.size - oldSize;
    } else {
      const finalName = ensureUniqueProjectFileName(incomingFile.name, files);
      const resolvedFolderId = explicitFolderId === undefined ? incomingFile.folderId : explicitFolderId;

      savedFile = {
        ...incomingFile,
        name: finalName,
        folderId: resolvedFolderId,
        versions: [],
        aiGenerated: true,
        aiMeta: incomingFile.aiMeta,
        createdAt: nowIso,
      };

      nextFiles.push(savedFile);
      countDelta = 1;
      sizeDelta = incomingFile.size;
    }

    const safeSizeDelta = Number.isFinite(sizeDelta) ? sizeDelta : 0;
    const updatePayload = {
      files: nextFiles,
      totalSize: FieldValue.increment(safeSizeDelta),
      activityLog: FieldValue.arrayUnion({
        action: mode === 'version' ? 'ai_save_version' : 'ai_save_output',
        user: actor,
        timestamp: nowIso,
        details: `${savedFile.name} AI Studyo cikti olarak kaydedildi`,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (countDelta !== 0) {
      updatePayload[`fileCount.${resolveProjectFileTypeKey(savedFile.type)}`] = FieldValue.increment(countDelta);
    }

    await projectRef.update(updatePayload);

    return {
      success: true,
      mode,
      file: savedFile,
    };
  }
);

exports.softDeleteProjectSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const { projectRef, project } = await assertProjectMemberAccess(request.data?.projectId, uid);

    if (!hasProjectDeletionAccess(project, uid)) {
      throw new HttpsError('permission-denied', 'Bu projeyi silme yetkiniz yok.');
    }

    await projectRef.update({
      isDeleted: true,
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);

exports.restoreProjectSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const { projectRef, project } = await assertProjectMemberAccess(request.data?.projectId, uid);

    if (!hasProjectDeletionAccess(project, uid)) {
      throw new HttpsError('permission-denied', 'Bu projeyi geri yukleme yetkiniz yok.');
    }

    await projectRef.update({
      isDeleted: false,
      deletedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);

exports.hardDeleteProjectSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const { projectRef, project } = await assertProjectMemberAccess(request.data?.projectId, uid);

    if (!hasProjectDeletionAccess(project, uid)) {
      throw new HttpsError('permission-denied', 'Bu projeyi kalici silme yetkiniz yok.');
    }

    await projectRef.delete();
    return { success: true };
  }
);

exports.restoreProjectFileSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const fileUrl = normalizeText(request.data?.fileUrl, 1600);
    const { projectRef, project } = await assertProjectMemberAccess(request.data?.projectId, uid);

    if (!hasProjectDeletionAccess(project, uid)) {
      throw new HttpsError('permission-denied', 'Bu proje dosyasini geri yukleme yetkiniz yok.');
    }
    if (!fileUrl) {
      throw new HttpsError('invalid-argument', 'fileUrl zorunludur.');
    }

    const deletedFiles = Array.isArray(project.deletedFiles) ? project.deletedFiles : [];
    const target = deletedFiles.find((item) => normalizeText(item?.url, 1600) === fileUrl);
    if (!target) {
      throw new HttpsError('not-found', 'Dosya cop kutusunda bulunamadi.');
    }

    const { deletedAt, ...cleanFile } = target;
    const typeKey = resolveProjectFileTypeKey(target.type);
    const size = Number(target.size || 0);

    await projectRef.update({
      deletedFiles: deletedFiles.filter((item) => normalizeText(item?.url, 1600) !== fileUrl),
      files: FieldValue.arrayUnion(cleanFile),
      [`fileCount.${typeKey}`]: FieldValue.increment(1),
      totalSize: FieldValue.increment(Number.isFinite(size) ? size : 0),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);

exports.permanentlyDeleteProjectFileSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const fileUrl = normalizeText(request.data?.fileUrl, 1600);
    const { projectRef, project } = await assertProjectMemberAccess(request.data?.projectId, uid);

    if (!hasProjectDeletionAccess(project, uid)) {
      throw new HttpsError('permission-denied', 'Bu proje dosyasini kalici silme yetkiniz yok.');
    }
    if (!fileUrl) {
      throw new HttpsError('invalid-argument', 'fileUrl zorunludur.');
    }

    const deletedFiles = Array.isArray(project.deletedFiles) ? project.deletedFiles : [];
    const exists = deletedFiles.some((item) => normalizeText(item?.url, 1600) === fileUrl);
    if (!exists) {
      return { success: true, skipped: true };
    }

    await projectRef.update({
      deletedFiles: deletedFiles.filter((item) => normalizeText(item?.url, 1600) !== fileUrl),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);
