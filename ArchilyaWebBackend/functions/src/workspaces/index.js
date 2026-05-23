const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { FieldValue, buildChunkedBatches, db, ensureUserProfileDoc, getAuthorizedWorkspaceForUser, getWorkspacePlanConfig, getWorkspaceProjects, normalizeEmail, normalizeMember, normalizeText, requireAuth, syncMemberIntoWorkspaceProjects, syncMemberRemovalFromWorkspaceProjects } = shared;
exports.createWorkspaceSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || request.data?.email || '');
    const displayName = normalizeText(request.data?.displayName || '', 120) || email;
    const requestedName = normalizeText(request.data?.name || '', 140);
    const workspaceName = requestedName || `${displayName}'in Calisma Alani`;

    const userRef = db.collection('users').doc(uid);
    const workspacesRef = db.collection('workspaces');
    await ensureUserProfileDoc(uid, { email, displayName });

    const [adminSnap, memberSnap, userSnap] = await Promise.all([
      workspacesRef.where('adminUid', '==', uid).limit(1).get(),
      workspacesRef.where('memberUids', 'array-contains', uid).limit(1).get(),
      userRef.get(),
    ]);

    if (!adminSnap.empty || !memberSnap.empty) {
      throw new HttpsError('failed-precondition', 'Zaten bir calisma alanina baglisiniz.');
    }

    const userPlan = userSnap.data()?.plan || 'free';
    const workspacePlanConfig = getWorkspacePlanConfig(userPlan);
    if (!workspacePlanConfig) {
      throw new HttpsError('permission-denied', 'Calisma alani olusturmak icin Solo, Pro veya Studio paketi gerekir.');
    }

    const wsRef = workspacesRef.doc();
    await wsRef.set({
      name: workspaceName,
      adminUid: uid,
      adminEmail: email,
      plan: userPlan,
      memberUids: [uid],
      memberEmails: [email],
      members: [{
        uid,
        email,
        displayName,
        role: 'admin',
        joinedAt: new Date().toISOString(),
      }],
      poolCredits: workspacePlanConfig.poolCredits,
      poolStorage: workspacePlanConfig.poolStorage,
      usedStorage: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, workspaceId: wsRef.id };
  }
);

exports.inviteWorkspaceMemberSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    const toEmail = normalizeEmail(request.data?.toEmail || '');
    const fromEmail = normalizeEmail(request.auth?.token?.email || '');
    const fromName = normalizeText(request.auth?.token?.name || request.data?.fromName || fromEmail, 120) || fromEmail;

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');
    }
    if (!toEmail) {
      throw new HttpsError('invalid-argument', 'Gecerli bir e-posta girin.');
    }
    if (toEmail === fromEmail) {
      throw new HttpsError('invalid-argument', 'Kendinizi davet edemezsiniz.');
    }

    const wsRef = db.collection('workspaces').doc(workspaceId);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) throw new HttpsError('not-found', 'Calisma alani bulunamadi.');

    const ws = wsSnap.data() || {};
    if (ws.adminUid !== uid) {
      throw new HttpsError('permission-denied', 'Sadece workspace yoneticisi davet gonderebilir.');
    }

    const members = Array.isArray(ws.members) ? ws.members : [];
    const workspacePlanConfig = getWorkspacePlanConfig(ws.plan);
    const maxMembers = Number(workspacePlanConfig?.maxMembers || 0);
    if (!maxMembers) {
      throw new HttpsError('failed-precondition', 'Bu workspace planinda ekip daveti aktif degil.');
    }
    if (members.length >= maxMembers) {
      throw new HttpsError('failed-precondition', `Maksimum uye sinirina ulasildi. Bu plan en fazla ${maxMembers} kisi destekler.`);
    }
    if (members.some((m) => normalizeEmail(m.email) === toEmail)) {
      throw new HttpsError('failed-precondition', 'Bu kisi zaten workspace uyesi.');
    }

    const pendingSnap = await db.collection('workspaceInvites')
      .where('workspaceId', '==', workspaceId)
      .where('toEmail', '==', toEmail)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!pendingSnap.empty) {
      throw new HttpsError('already-exists', 'Bu kisiye zaten bekleyen bir davet var.');
    }

    let toUid = null;
    const userByEmailSnap = await db.collection('users').where('email', '==', toEmail).limit(1).get();
    if (!userByEmailSnap.empty) {
      toUid = userByEmailSnap.docs[0].id;
      const otherWorkspaceSnap = await db.collection('workspaces').where('memberUids', 'array-contains', toUid).limit(2).get();
      const hasOther = otherWorkspaceSnap.docs.some((d) => d.id !== workspaceId);
      if (hasOther) {
        throw new HttpsError('failed-precondition', 'Bu kullanici zaten baska bir calisma alanina bagli.');
      }
    }

    const inviteRef = db.collection('workspaceInvites').doc();
    const notifRef = db.collection('notifications').doc();
    const batch = db.batch();

    batch.set(inviteRef, {
      workspaceId,
      workspaceName: ws.name || 'Workspace',
      fromUid: uid,
      fromEmail,
      fromName,
      toEmail,
      toUid,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(notifRef, {
      toEmail,
      toUid,
      type: 'workspace_invite',
      title: 'Calisma Alanina Davet',
      body: `${fromName} sizi "${ws.name || 'Workspace'}" calisma alanina davet etti.`,
      workspaceId,
      workspaceName: ws.name || 'Workspace',
      inviteId: inviteRef.id,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return { success: true, inviteId: inviteRef.id };
  }
);
exports.acceptWorkspaceInviteSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const inviteId = String(request.data?.inviteId || '').trim();
    const email = normalizeEmail(request.auth?.token?.email || '');

    if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId zorunludur.');

    const inviteRef = db.collection('workspaceInvites').doc(inviteId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) throw new HttpsError('not-found', 'Davet bulunamadi.');

    const invite = inviteSnap.data() || {};
    const currentStatus = String(invite.status || '');
    if (!['pending', 'accepted_sync_pending', 'accepted'].includes(currentStatus)) {
      throw new HttpsError('failed-precondition', 'Bu davet aktif degil.');
    }

    const allowedByUid = invite.toUid && invite.toUid === uid;
    const allowedByEmail = normalizeEmail(invite.toEmail) === email;
    if (!allowedByUid && !allowedByEmail) {
      throw new HttpsError('permission-denied', 'Bu daveti kabul etme yetkiniz yok.');
    }

    const workspaceId = String(invite.workspaceId || '');
    if (!workspaceId) throw new HttpsError('failed-precondition', 'Davet workspace bilgisi eksik.');

    const wsRef = db.collection('workspaces').doc(workspaceId);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) throw new HttpsError('not-found', 'Calisma alani bulunamadi.');
    const ws = wsSnap.data() || {};

    const existingMemberships = await db.collection('workspaces').where('memberUids', 'array-contains', uid).limit(2).get();
    const hasOtherWorkspace = existingMemberships.docs.some((d) => d.id !== workspaceId);
    if (hasOtherWorkspace) {
      throw new HttpsError('failed-precondition', 'Zaten baska bir calisma alanina baglisiniz.');
    }

    const memberEntry = normalizeMember({
      uid,
      email,
      displayName: request.auth?.token?.name || email,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    await db.runTransaction(async (tx) => {
      const [liveInviteSnap, liveWsSnap] = await Promise.all([tx.get(inviteRef), tx.get(wsRef)]);
      if (!liveInviteSnap.exists) throw new HttpsError('not-found', 'Davet bulunamadi.');
      if (!liveWsSnap.exists) throw new HttpsError('not-found', 'Calisma alani bulunamadi.');

      const liveInvite = liveInviteSnap.data() || {};
      const status = String(liveInvite.status || '');
      if (!['pending', 'accepted_sync_pending', 'accepted'].includes(status)) {
        throw new HttpsError('failed-precondition', 'Bu davet aktif degil.');
      }

      const liveWs = liveWsSnap.data() || {};
      const liveMembers = Array.isArray(liveWs.members) ? liveWs.members : [];
      const workspacePlanConfig = getWorkspacePlanConfig(liveWs.plan);
      const maxMembers = Number(workspacePlanConfig?.maxMembers || 0);
      const alreadyMember = (Array.isArray(liveWs.memberUids) ? liveWs.memberUids : []).includes(uid);

      if (!maxMembers) {
        throw new HttpsError('failed-precondition', 'Bu workspace planinda ekip daveti aktif degil.');
      }

      if (!alreadyMember && liveMembers.length >= maxMembers) {
        throw new HttpsError('failed-precondition', `Workspace maksimum uye kapasitesine ulasmis. Bu plan en fazla ${maxMembers} kisi destekler.`);
      }

      if (!alreadyMember) {
        tx.update(wsRef, {
          memberUids: FieldValue.arrayUnion(uid),
          memberEmails: FieldValue.arrayUnion(email),
          members: FieldValue.arrayUnion(memberEntry),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      tx.update(inviteRef, {
        status: 'accepted_sync_pending',
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedUid: uid,
        toUid: uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    try {
      await syncMemberIntoWorkspaceProjects(workspaceId, memberEntry);
      await inviteRef.update({
        status: 'accepted',
        syncedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const notifSnap = await db.collection('notifications').where('inviteId', '==', inviteId).get();
      const notifBatches = buildChunkedBatches(notifSnap.docs, () => ({
        read: true,
      }));
      await Promise.all(notifBatches.map((b) => b.commit()));
    } catch (err) {
      await inviteRef.update({
        status: 'accepted_sync_pending',
        syncError: normalizeText(err.message || 'project sync failed', 400),
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw new HttpsError('aborted', 'Davet kabul edildi fakat proje erisimleri senkronize edilemedi. Tekrar deneyin.');
    }

    return { success: true };
  }
);
exports.declineWorkspaceInviteSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const inviteId = String(request.data?.inviteId || '').trim();
    const email = normalizeEmail(request.auth?.token?.email || '');
    if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId zorunludur.');

    const inviteRef = db.collection('workspaceInvites').doc(inviteId);
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
    const notifBatches = buildChunkedBatches(notifSnap.docs, () => ({
      read: true,
    }));
    await Promise.all(notifBatches.map((b) => b.commit()));

    return { success: true };
  }
);
exports.removeWorkspaceMemberSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    const memberUid = String(request.data?.memberUid || '').trim();
    if (!workspaceId || !memberUid) {
      throw new HttpsError('invalid-argument', 'workspaceId ve memberUid zorunludur.');
    }
    if (memberUid === uid) {
      throw new HttpsError('invalid-argument', 'Kendinizi kaldiramazsiniz.');
    }

    const wsRef = db.collection('workspaces').doc(workspaceId);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) throw new HttpsError('not-found', 'Calisma alani bulunamadi.');

    const ws = wsSnap.data() || {};
    if (ws.adminUid !== uid) {
      throw new HttpsError('permission-denied', 'Sadece workspace yoneticisi uye cikarabilir.');
    }

    const members = Array.isArray(ws.members) ? ws.members : [];
    const member = members.find((m) => String(m?.uid || '') === memberUid);
    if (!member) return { success: true, skipped: true };

    await wsRef.update({
      memberUids: FieldValue.arrayRemove(memberUid),
      memberEmails: FieldValue.arrayRemove(normalizeEmail(member.email || '')),
      members: FieldValue.arrayRemove(member),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await syncMemberRemovalFromWorkspaceProjects(workspaceId, memberUid, member.email || '');

    return { success: true };
  }
);
exports.deleteWorkspaceSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    if (!workspaceId) throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');

    const wsRef = db.collection('workspaces').doc(workspaceId);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) return { success: true, skipped: true };

    const ws = wsSnap.data() || {};
    if (ws.adminUid !== uid) {
      throw new HttpsError('permission-denied', 'Sadece workspace yoneticisi silebilir.');
    }

    const workspaceMemberUids = Array.isArray(ws.memberUids) ? ws.memberUids : [];
    const projects = await getWorkspaceProjects(workspaceId);
    const projectBatches = buildChunkedBatches(projects, (projDoc) => {
      const proj = projDoc.data() || {};
      const ownerUid = proj.uid;
      const removableUids = new Set(workspaceMemberUids.filter((id) => id !== ownerUid));

      const nextMemberUids = (Array.isArray(proj.memberUids) ? proj.memberUids : []).filter((id) => !removableUids.has(id));
      if (ownerUid && !nextMemberUids.includes(ownerUid)) nextMemberUids.push(ownerUid);
      const nextTeam = (Array.isArray(proj.team) ? proj.team : []).filter((member) => !removableUids.has(member.uid));

      return {
        workspaceId: null,
        workspaceName: null,
        memberUids: nextMemberUids,
        team: nextTeam,
        activityLog: FieldValue.arrayUnion({
          action: 'workspace_deleted',
          user: request.auth?.token?.email || uid,
          timestamp: new Date().toISOString(),
          details: `Workspace silindigi icin proje bagimsiz moda gecirildi`,
        }),
        updatedAt: FieldValue.serverTimestamp(),
      };
    });

    await Promise.all(projectBatches.map((b) => b.commit()));

    const invitesSnap = await db.collection('workspaceInvites').where('workspaceId', '==', workspaceId).where('status', '==', 'pending').get();
    const inviteBatches = buildChunkedBatches(invitesSnap.docs, () => ({
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    }));
    await Promise.all(inviteBatches.map((b) => b.commit()));

    await wsRef.delete();
    return { success: true };
  }
);
exports.adjustWorkspaceStorage = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    const bytesDelta = Number(request.data?.bytesDelta);

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');
    }

    if (!Number.isFinite(bytesDelta) || bytesDelta === 0) {
      throw new HttpsError('invalid-argument', 'bytesDelta sifir disinda sayi olmalidir.');
    }

    const { wsRef } = await getAuthorizedWorkspaceForUser(workspaceId, uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(wsRef);
      const ws = snap.data() || {};
      const usedStorage = Math.max(0, Number(ws.usedStorage || 0) + bytesDelta);
      const poolStorage = Number(ws.poolStorage || 0);

      if (poolStorage > 0 && usedStorage > poolStorage) {
        throw new HttpsError('failed-precondition', 'Calisma alani depolama limiti asildi.');
      }

      tx.update(wsRef, {
        usedStorage,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  }
);
