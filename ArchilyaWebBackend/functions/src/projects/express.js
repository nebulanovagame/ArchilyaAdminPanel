const { onCall, HttpsError } = require('../shared/http-callable');
const {
  supabase,
  requireAuth,
  normalizeText,
  normalizeEmail,
  ensureUserProfileDoc,
} = require('../shared/supabase-helpers');

function nowIso() {
  return new Date().toISOString();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function defaultFileCount() {
  return { pdf: 0, dwg: 0, img: 0 };
}

function resolveProjectFileTypeKey(type) {
  const value = normalizeText(type, 80).toLowerCase();
  if (value.includes('pdf')) return 'pdf';
  if (value.includes('dwg') || value.includes('cad')) return 'dwg';
  return 'img';
}

function normalizeContentType(value, fallbackName = '') {
  const contentType = normalizeText(value, 160).toLowerCase();
  if (contentType.includes('/')) return contentType;
  const name = normalizeText(fallbackName, 260).toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.dwg')) return 'application/acad';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function buildProjectFolderId(value) {
  const explicit = normalizeText(value, 120);
  if (explicit) return explicit;
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function findProjectFolderByName(folders, name) {
  const normalizedName = normalizeText(name, 120).toLowerCase();
  return folders.find((folder) => normalizeText(folder?.name, 120).toLowerCase() === normalizedName) || null;
}

function ensureUniqueProjectFileName(name, files) {
  const baseName = normalizeText(name, 220) || 'ai-output.png';
  const usedNames = new Set(files.map((file) => normalizeText(file?.name, 220)));
  if (!usedNames.has(baseName)) return baseName;

  const dotIndex = baseName.lastIndexOf('.');
  const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
  const extension = dotIndex > 0 ? baseName.slice(dotIndex) : '';
  let counter = 2;
  while (usedNames.has(`${stem} (${counter})${extension}`)) counter += 1;
  return `${stem} (${counter})${extension}`;
}

function normalizeProjectFileForMutation(rawFile, { aiMode = false } = {}) {
  if (!rawFile || typeof rawFile !== 'object' || Array.isArray(rawFile)) {
    throw new HttpsError('invalid-argument', 'file nesnesi zorunludur.');
  }

  const name = normalizeText(rawFile.name, 220) || (aiMode ? 'ai-output.png' : 'file');
  const url = normalizeText(rawFile.url, 4000);
  if (!url) throw new HttpsError('invalid-argument', 'file.url zorunludur.');

  const rawSize = Number(rawFile.size || 0);
  const size = Number.isFinite(rawSize) && rawSize > 0 ? Math.round(rawSize) : 0;
  const contentType = normalizeContentType(rawFile.contentType || rawFile.type, name);
  const type = normalizeText(rawFile.type, 80).toLowerCase() || resolveProjectFileTypeKey(contentType);

  return {
    name,
    url,
    size,
    type,
    path: normalizeText(rawFile.path, 1200) || null,
    storageProvider: normalizeText(rawFile.storageProvider, 32).toLowerCase() || 'supabase',
    objectKey: normalizeText(rawFile.objectKey, 800) || null,
    contentType,
    folderId: rawFile.folderId === undefined || rawFile.folderId === null
      ? null
      : normalizeText(rawFile.folderId, 120) || null,
    versions: Array.isArray(rawFile.versions) ? rawFile.versions : [],
    aiGenerated: Boolean(aiMode || rawFile.aiGenerated),
    aiMeta: rawFile.aiMeta && typeof rawFile.aiMeta === 'object' ? rawFile.aiMeta : null,
    createdAt: normalizeText(rawFile.createdAt, 80) || nowIso(),
  };
}

function normalizeProject(row) {
  return {
    ...row,
    member_uids: Array.isArray(row?.member_uids) ? row.member_uids : [],
    team: Array.isArray(row?.team) ? row.team : [],
    files: Array.isArray(row?.files) ? row.files : [],
    deleted_files: Array.isArray(row?.deleted_files) ? row.deleted_files : [],
    folders: Array.isArray(row?.folders) ? row.folders : [],
    activity_log: Array.isArray(row?.activity_log) ? row.activity_log : [],
    file_count: row?.file_count && typeof row.file_count === 'object' ? row.file_count : defaultFileCount(),
  };
}

async function getProject(projectId) {
  const id = String(projectId || '').trim();
  if (!id) throw new HttpsError('invalid-argument', 'projectId zorunludur.');

  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
  if (error || !data) throw new HttpsError('not-found', 'Proje bulunamadi.');
  return normalizeProject(data);
}

async function assertProjectMemberAccess(projectId, uid) {
  const project = await getProject(projectId);
  const members = project.member_uids;
  if (project.uid !== uid && project.owner_id !== uid && !members.includes(uid)) {
    throw new HttpsError('permission-denied', 'Bu projeye erisim yetkiniz yok.');
  }
  return project;
}

function hasProjectDeletionAccess(project, uid) {
  if (project.uid === uid || project.owner_id === uid) return true;
  return project.team.some((member) => member?.uid === uid && ['owner', 'admin'].includes(member?.role));
}

async function updateProject(projectId, payload) {
  const { error } = await supabase.from('projects').update(payload).eq('id', projectId);
  if (error) throw new HttpsError('internal', error.message);
}

async function findUserIdByEmail(email) {
  const { data } = await supabase.from('profiles').select('id').eq('email', email).limit(1).maybeSingle();
  return data?.id || null;
}

exports.createProjectSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const email = normalizeEmail(request.auth?.token?.email || request.data?.email || '');
  const displayName = normalizeText(request.auth?.token?.name || request.data?.displayName || email, 120) || email || uid;
  const name = normalizeText(request.data?.name, 180);
  const location = normalizeText(request.data?.location, 240);
  const status = normalizeText(request.data?.status, 80) || 'Aktif';

  if (!name) throw new HttpsError('invalid-argument', 'Proje adi zorunludur.');
  await ensureUserProfileDoc(uid, { email, displayName });

  const timestamp = nowIso();
  const { data, error } = await supabase.from('projects').insert({
    uid,
    owner_id: uid,
    name,
    location: location || '',
    status,
    member_uids: [uid],
    file_count: defaultFileCount(),
    total_size: 0,
    files: [],
    deleted_files: [],
    folders: [],
    team: [{ uid, email: email || '', role: 'owner' }],
    invites: [],
    activity_log: [{ action: 'create', user: displayName, timestamp, details: 'Proje olusturuldu' }],
    is_deleted: false,
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  }).select('id').single();

  if (error || !data) throw new HttpsError('internal', error?.message || 'Proje olusturulamadi.');

  await supabase.from('project_team_members').insert({
    project_id: data.id,
    user_uid: uid,
    email,
    role: 'owner',
  });

  await supabase.from('project_activity_logs').insert({
    project_id: data.id,
    action: 'create',
    actor_id: uid,
    actor_email: email,
    actor_name: displayName,
    target_type: 'project',
    target_id: data.id,
    target_name: name,
    category: 'project',
    metadata: { details: 'Proje olusturuldu', timestamp },
  });

  return { success: true, projectId: data.id };
});

exports.updateProjectSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);
  const rawData = request.data?.data;
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    throw new HttpsError('invalid-argument', 'data nesnesi zorunludur.');
  }

  const payload = {};
  if (Object.prototype.hasOwnProperty.call(rawData, 'name')) {
    const name = normalizeText(rawData.name, 180);
    if (!name) throw new HttpsError('invalid-argument', 'Proje adi bos birakilamaz.');
    payload.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(rawData, 'location')) payload.location = normalizeText(rawData.location, 240);
  if (Object.prototype.hasOwnProperty.call(rawData, 'status')) payload.status = normalizeText(rawData.status, 80) || 'Aktif';
  if (Object.prototype.hasOwnProperty.call(rawData, 'workspaceId')) {
    payload.workspace_id = rawData.workspaceId === null ? null : (normalizeText(rawData.workspaceId, 120) || null);
  }
  if (Object.prototype.hasOwnProperty.call(rawData, 'workspaceName')) {
    payload.workspace_name = rawData.workspaceName === null ? null : (normalizeText(rawData.workspaceName, 180) || null);
  }
  if (!Object.keys(payload).length) return { success: true, skipped: true };

  payload.updated_at = nowIso();
  await updateProject(project.id, payload);
  return { success: true };
});

exports.sendProjectInviteSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const toEmail = normalizeEmail(request.data?.toEmail || '');
  const role = String(request.data?.role || 'member').trim();
  const fromEmail = normalizeEmail(request.auth?.token?.email || '');
  const fromName = normalizeText(request.auth?.token?.name || request.data?.fromName || fromEmail, 120) || fromEmail;
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);

  if (!toEmail || !isValidEmail(toEmail)) throw new HttpsError('invalid-argument', 'Gecerli bir e-posta adresi girin.');
  if (toEmail === fromEmail) throw new HttpsError('invalid-argument', 'Kendinizi davet edemezsiniz.');
  if (!['member', 'editor', 'viewer'].includes(role)) throw new HttpsError('invalid-argument', 'Gecersiz davet rolu.');
  if (project.workspace_id) throw new HttpsError('failed-precondition', 'Workspace projelerinde proje daveti kapalidir.');
  if (project.team.some((member) => normalizeEmail(member?.email) === toEmail)) {
    throw new HttpsError('already-exists', 'Bu kisi zaten projenin uyesi.');
  }

  const { data: duplicate } = await supabase
    .from('project_invitations')
    .select('id')
    .eq('project_id', project.id)
    .eq('to_email', toEmail)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();
  if (duplicate) throw new HttpsError('already-exists', 'Bu kisiye zaten bekleyen bir davet gonderilmis.');

  const toUid = await findUserIdByEmail(toEmail);
  const timestamp = nowIso();
  const { data: invite, error } = await supabase.from('project_invitations').insert({
    project_id: project.id,
    from_user_id: uid,
    to_user_id: toUid,
    to_email: toEmail,
    role,
    status: 'pending',
    created_at: timestamp,
    updated_at: timestamp,
  }).select('id').single();
  if (error || !invite) throw new HttpsError('internal', error?.message || 'Davet olusturulamadi.');

  await supabase.from('notifications').insert({
    user_id: toUid,
    email: toEmail,
    to_email: toEmail,
    to_uid: toUid,
    type: 'invite',
    title: 'Projeye davet edildiniz',
    body: `${fromName} sizi "${project.name || 'Proje'}" projesine davet etti.`,
    project_id: project.id,
    project_name: project.name || 'Proje',
    invite_id: invite.id,
    is_read: false,
    read: false,
    created_at: timestamp,
  });

  project.activity_log.push({ action: 'invite_sent', user: fromName, timestamp, details: `${toEmail} projeye davet edildi (${role})` });
  await updateProject(project.id, { activity_log: project.activity_log, updated_at: timestamp });
  return { success: true, inviteId: invite.id };
});

exports.acceptProjectInviteSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const inviteId = String(request.data?.inviteId || '').trim();
  const email = normalizeEmail(request.auth?.token?.email || '');
  if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId zorunludur.');

  const { data: invite, error } = await supabase.from('project_invitations').select('*').eq('id', inviteId).single();
  if (error || !invite) throw new HttpsError('not-found', 'Davet bulunamadi.');
  if (String(invite.status || '') !== 'pending') throw new HttpsError('failed-precondition', 'Bu davet artik aktif degil.');

  const allowedByUid = invite.to_user_id && invite.to_user_id === uid;
  const allowedByEmail = normalizeEmail(invite.to_email) === email;
  if (!allowedByUid && !allowedByEmail) throw new HttpsError('permission-denied', 'Bu daveti kabul etme yetkiniz yok.');

  const project = await getProject(invite.project_id);
  if (project.workspace_id) throw new HttpsError('failed-precondition', 'Workspace projelerinde proje daveti kullanilmaz.');

  const acceptedRole = ['member', 'editor', 'viewer'].includes(invite.role) ? invite.role : 'member';
  const alreadyMember = project.team.some((member) => normalizeEmail(member?.email) === email) || project.member_uids.includes(uid);
  if (!alreadyMember) {
    project.team.push({ uid, email, role: acceptedRole });
    project.member_uids.push(uid);
    project.activity_log.push({ action: 'member_join', user: email, timestamp: nowIso(), details: `${email} projeye katildi (${acceptedRole})` });
    await updateProject(project.id, {
      team: project.team,
      member_uids: project.member_uids,
      activity_log: project.activity_log,
      updated_at: nowIso(),
    });
    await supabase.from('project_team_members').upsert({ project_id: project.id, user_uid: uid, email, role: acceptedRole }, { onConflict: 'project_id,user_uid' });
  }

  await supabase.from('project_invitations').update({ status: 'accepted', to_user_id: uid, updated_at: nowIso() }).eq('id', inviteId);
  await supabase.from('notifications').update({ read: true, is_read: true, read_at: nowIso() }).eq('invite_id', inviteId);
  return { success: true };
});

exports.declineProjectInviteSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const inviteId = String(request.data?.inviteId || '').trim();
  const email = normalizeEmail(request.auth?.token?.email || '');
  if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId zorunludur.');

  const { data: invite, error } = await supabase.from('project_invitations').select('*').eq('id', inviteId).single();
  if (error || !invite) throw new HttpsError('not-found', 'Davet bulunamadi.');
  const allowedByUid = invite.to_user_id && invite.to_user_id === uid;
  const allowedByEmail = normalizeEmail(invite.to_email) === email;
  if (!allowedByUid && !allowedByEmail) throw new HttpsError('permission-denied', 'Bu daveti reddetme yetkiniz yok.');

  await supabase.from('project_invitations').update({ status: 'declined', updated_at: nowIso() }).eq('id', inviteId);
  await supabase.from('notifications').update({ read: true, is_read: true, read_at: nowIso() }).eq('invite_id', inviteId);
  return { success: true };
});

exports.createProjectFolderSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const folderName = normalizeText(request.data?.folderName, 120);
  if (!folderName) throw new HttpsError('invalid-argument', 'folderName zorunludur.');
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);
  if (project.is_deleted) throw new HttpsError('failed-precondition', 'Silinmis projede klasor islemi yapilamaz.');

  const existingFolder = findProjectFolderByName(project.folders, folderName);
  if (existingFolder?.id) return { success: true, existing: true, folder: existingFolder };

  const actor = normalizeText(request.auth?.token?.name || request.auth?.token?.email || uid, 120) || uid;
  const folder = { id: buildProjectFolderId(request.data?.folderId), name: folderName, createdAt: nowIso(), createdBy: uid, parentId: null };
  project.folders.push(folder);
  project.activity_log.push({ action: 'folder_create', user: actor, timestamp: nowIso(), details: `${folder.name} klasoru olusturuldu` });
  await updateProject(project.id, { folders: project.folders, activity_log: project.activity_log, updated_at: nowIso() });
  return { success: true, existing: false, folder };
});

exports.addProjectFileSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const actor = normalizeText(request.auth?.token?.name || request.auth?.token?.email || uid, 120) || uid;
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);
  if (project.is_deleted) throw new HttpsError('failed-precondition', 'Silinmis projeye dosya eklenemez.');

  const file = normalizeProjectFileForMutation(request.data?.file, { aiMode: false });
  if (project.files.some((item) => normalizeText(item?.url, 4000) === file.url)) return { success: true, skipped: true, file };

  const typeKey = resolveProjectFileTypeKey(file.type);
  const fileCount = { ...defaultFileCount(), ...project.file_count, [typeKey]: Number(project.file_count[typeKey] || 0) + 1 };
  project.files.push(file);
  project.activity_log.push({ action: 'upload', user: actor, timestamp: nowIso(), details: `${file.name} dosyasi yuklendi` });
  await updateProject(project.id, {
    files: project.files,
    file_count: fileCount,
    total_size: Number(project.total_size || 0) + file.size,
    activity_log: project.activity_log,
    updated_at: nowIso(),
  });
  return { success: true, file };
});

exports.moveProjectFileToTrashSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const fileUrl = normalizeText(request.data?.fileUrl, 4000);
  if (!fileUrl) throw new HttpsError('invalid-argument', 'fileUrl zorunludur.');
  const actor = normalizeText(request.auth?.token?.name || request.auth?.token?.email || uid, 120) || uid;
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);
  if (project.is_deleted) throw new HttpsError('failed-precondition', 'Silinmis projede dosya tasima islemi yapilamaz.');

  const index = project.files.findIndex((item) => normalizeText(item?.url, 4000) === fileUrl);
  if (index < 0) return { success: true, skipped: true };
  const target = project.files[index];
  const size = Number.isFinite(Number(target.size)) ? Number(target.size) : 0;
  const typeKey = resolveProjectFileTypeKey(target.type);
  const fileCount = { ...defaultFileCount(), ...project.file_count, [typeKey]: Math.max(0, Number(project.file_count[typeKey] || 0) - 1) };
  project.files.splice(index, 1);
  project.deleted_files.push({ ...target, deletedAt: nowIso() });
  project.activity_log.push({ action: 'file_soft_delete', user: actor, timestamp: nowIso(), details: `${normalizeText(target.name, 220) || 'Dosya'} cop kutusuna tasindi` });
  await updateProject(project.id, {
    files: project.files,
    deleted_files: project.deleted_files,
    file_count: fileCount,
    total_size: Math.max(0, Number(project.total_size || 0) - size),
    activity_log: project.activity_log,
    updated_at: nowIso(),
  });
  return { success: true, fileName: normalizeText(target.name, 220) || '' };
});

exports.saveAiOutputToProjectSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const actor = normalizeText(request.auth?.token?.name || request.auth?.token?.email || uid, 120) || uid;
  const mode = normalizeText(request.data?.saveMode, 24).toLowerCase() === 'version' ? 'version' : 'new';
  const versionTargetName = normalizeText(request.data?.versionTargetName, 220);
  const explicitFolderId = request.data?.folderId === undefined ? undefined : (request.data?.folderId === null ? null : normalizeText(request.data?.folderId, 120) || null);
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);
  if (project.is_deleted) throw new HttpsError('failed-precondition', 'Silinmis projeye AI cikti kaydedilemez.');

  const incomingFile = normalizeProjectFileForMutation(request.data?.file, { aiMode: true });
  let savedFile = null;
  let countDelta = 0;
  let sizeDelta = 0;

  if (mode === 'version') {
    if (!versionTargetName) throw new HttpsError('invalid-argument', 'versionTargetName zorunludur.');
    const targetIndex = project.files.findIndex((file) => normalizeText(file?.name, 220) === versionTargetName);
    if (targetIndex < 0) throw new HttpsError('not-found', 'Versiyonlanacak dosya bulunamadi.');
    const oldFile = project.files[targetIndex] || {};
    const oldSize = Number.isFinite(Number(oldFile.size)) ? Number(oldFile.size) : 0;
    const oldVersions = Array.isArray(oldFile.versions) ? oldFile.versions : [];
    savedFile = {
      ...oldFile,
      name: normalizeText(oldFile.name, 220) || incomingFile.name,
      url: incomingFile.url,
      path: incomingFile.path,
      size: incomingFile.size,
      type: normalizeText(oldFile.type, 24).toLowerCase() || incomingFile.type,
      folderId: explicitFolderId === undefined ? (oldFile.folderId ?? incomingFile.folderId ?? null) : explicitFolderId,
      versions: [...oldVersions, {
        url: normalizeText(oldFile.url, 4000),
        path: normalizeText(oldFile.path, 1200) || null,
        storageProvider: normalizeText(oldFile.storageProvider, 32).toLowerCase() || 'supabase',
        objectKey: normalizeText(oldFile.objectKey, 800) || null,
        contentType: normalizeContentType(oldFile.contentType, oldFile.name || ''),
        size: oldSize,
        createdAt: normalizeText(oldFile.createdAt, 80) || nowIso(),
        version: oldVersions.length + 1,
      }],
      aiGenerated: true,
      aiMeta: incomingFile.aiMeta,
      contentType: incomingFile.contentType,
      storageProvider: incomingFile.storageProvider,
      objectKey: incomingFile.objectKey,
      createdAt: nowIso(),
    };
    project.files[targetIndex] = savedFile;
    sizeDelta = incomingFile.size - oldSize;
  } else {
    savedFile = {
      ...incomingFile,
      name: ensureUniqueProjectFileName(incomingFile.name, project.files),
      folderId: explicitFolderId === undefined ? incomingFile.folderId : explicitFolderId,
      versions: [],
      aiGenerated: true,
      createdAt: nowIso(),
    };
    project.files.push(savedFile);
    countDelta = 1;
    sizeDelta = incomingFile.size;
  }

  const fileCount = { ...defaultFileCount(), ...project.file_count };
  if (countDelta !== 0) {
    const typeKey = resolveProjectFileTypeKey(savedFile.type);
    fileCount[typeKey] = Number(fileCount[typeKey] || 0) + countDelta;
  }
  project.activity_log.push({ action: mode === 'version' ? 'ai_save_version' : 'ai_save_output', user: actor, timestamp: nowIso(), details: `${savedFile.name} AI Studyo cikti olarak kaydedildi` });
  await updateProject(project.id, {
    files: project.files,
    file_count: fileCount,
    total_size: Math.max(0, Number(project.total_size || 0) + sizeDelta),
    activity_log: project.activity_log,
    updated_at: nowIso(),
  });
  return { success: true, mode, file: savedFile };
});

exports.softDeleteProjectSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);
  if (!hasProjectDeletionAccess(project, uid)) throw new HttpsError('permission-denied', 'Bu projeyi silme yetkiniz yok.');
  await updateProject(project.id, { is_deleted: true, deleted_at: nowIso(), updated_at: nowIso() });
  return { success: true };
});

exports.restoreProjectSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);
  if (!hasProjectDeletionAccess(project, uid)) throw new HttpsError('permission-denied', 'Bu projeyi geri yukleme yetkiniz yok.');
  await updateProject(project.id, { is_deleted: false, deleted_at: null, updated_at: nowIso() });
  return { success: true };
});

exports.hardDeleteProjectSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);
  if (!hasProjectDeletionAccess(project, uid)) throw new HttpsError('permission-denied', 'Bu projeyi kalici silme yetkiniz yok.');
  const paths = [...project.files, ...project.deleted_files].map((file) => file?.path).filter(Boolean);
  if (paths.length) await supabase.storage.from('projects').remove(paths);
  const { error } = await supabase.from('projects').delete().eq('id', project.id);
  if (error) throw new HttpsError('internal', error.message);
  return { success: true };
});

exports.restoreProjectFileSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const fileUrl = normalizeText(request.data?.fileUrl, 1600);
  if (!fileUrl) throw new HttpsError('invalid-argument', 'fileUrl zorunludur.');
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);
  if (!hasProjectDeletionAccess(project, uid)) throw new HttpsError('permission-denied', 'Bu proje dosyasini geri yukleme yetkiniz yok.');

  const index = project.deleted_files.findIndex((item) => normalizeText(item?.url, 1600) === fileUrl);
  if (index < 0) throw new HttpsError('not-found', 'Dosya cop kutusunda bulunamadi.');
  const target = project.deleted_files[index];
  const { deletedAt, ...cleanFile } = target;
  const size = Number.isFinite(Number(target.size)) ? Number(target.size) : 0;
  const typeKey = resolveProjectFileTypeKey(target.type);
  const fileCount = { ...defaultFileCount(), ...project.file_count, [typeKey]: Number(project.file_count[typeKey] || 0) + 1 };
  project.deleted_files.splice(index, 1);
  project.files.push(cleanFile);
  await updateProject(project.id, {
    deleted_files: project.deleted_files,
    files: project.files,
    file_count: fileCount,
    total_size: Number(project.total_size || 0) + size,
    updated_at: nowIso(),
  });
  return { success: true };
});

exports.permanentlyDeleteProjectFileSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const fileUrl = normalizeText(request.data?.fileUrl, 1600);
  if (!fileUrl) throw new HttpsError('invalid-argument', 'fileUrl zorunludur.');
  const project = await assertProjectMemberAccess(request.data?.projectId, uid);
  if (!hasProjectDeletionAccess(project, uid)) throw new HttpsError('permission-denied', 'Bu proje dosyasini kalici silme yetkiniz yok.');
  const nextDeletedFiles = project.deleted_files.filter((item) => normalizeText(item?.url, 1600) !== fileUrl);
  if (nextDeletedFiles.length === project.deleted_files.length) return { success: true, skipped: true };
  await updateProject(project.id, { deleted_files: nextDeletedFiles, updated_at: nowIso() });
  return { success: true };
});
