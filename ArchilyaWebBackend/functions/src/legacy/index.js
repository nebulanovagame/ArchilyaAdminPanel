const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { FieldValue, buildChunkedBatches, buildChunkedDeleteBatches, db, ensureUserProfileDoc, normalizeEmail, requireAuth, syncMemberRemovalFromWorkspaceProjects } = shared;
exports.ensureUserProfile = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    await ensureUserProfileDoc(uid, request.data || {});
    return { success: true };
  }
);

exports.deleteAccountSecure = onCall(
  { region: 'europe-west1', timeoutSeconds: 300, memory: '1GiB' },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || '');

    const adminWorkspaceSnap = await db.collection('workspaces').where('adminUid', '==', uid).limit(1).get();
    if (!adminWorkspaceSnap.empty) {
      const ws = adminWorkspaceSnap.docs[0].data() || {};
      throw new HttpsError(
        'failed-precondition',
        `Hesap silmeden once yonettiginiz "${ws.name || 'Workspace'}" calisma alanini devretmeli veya silmelisiniz.`
      );
    }

    const memberWorkspacesSnap = await db.collection('workspaces').where('memberUids', 'array-contains', uid).get();
    for (const wsDoc of memberWorkspacesSnap.docs) {
      const wsData = wsDoc.data() || {};
      if (wsData.adminUid === uid) continue;

      const nextMemberUids = (wsData.memberUids || []).filter((memberUid) => memberUid !== uid);
      const nextMemberEmails = (wsData.memberEmails || []).filter((memberEmail) => normalizeEmail(memberEmail) !== email);
      const nextMembers = (wsData.members || []).filter((member) => String(member?.uid || '') !== uid);

      await wsDoc.ref.update({
        memberUids: nextMemberUids,
        memberEmails: nextMemberEmails,
        members: nextMembers,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await syncMemberRemovalFromWorkspaceProjects(wsDoc.id, uid, email);
    }

    const memberProjectsSnap = await db.collection('projects').where('memberUids', 'array-contains', uid).get();
    const projectUpdatesById = new Map();
    const ownedProjectDeletes = [];

    memberProjectsSnap.docs.forEach((projectDoc) => {
      const project = projectDoc.data() || {};
      if (project.uid === uid) {
        ownedProjectDeletes.push(projectDoc);
        return;
      }

      projectUpdatesById.set(projectDoc.id, {
        nextMemberUids: (project.memberUids || []).filter((memberUid) => memberUid !== uid),
        nextTeam: (project.team || []).filter((member) => String(member?.uid || '') !== uid),
      });
    });

    const projectUpdateBatches = buildChunkedBatches(
      memberProjectsSnap.docs.filter((docSnap) => projectUpdatesById.has(docSnap.id)),
      (docSnap) => {
        const entry = projectUpdatesById.get(docSnap.id);
        if (!entry) return null;
        return {
          memberUids: entry.nextMemberUids,
          team: entry.nextTeam,
          updatedAt: FieldValue.serverTimestamp(),
          activityLog: FieldValue.arrayUnion({
            action: 'member_deleted_account',
            user: email,
            timestamp: new Date().toISOString(),
            details: `${email} hesabini sildigi icin projeden kaldirildi`,
          }),
        };
      }
    );
    await Promise.all(projectUpdateBatches.map((batch) => batch.commit()));

    const ownedDeleteBatches = buildChunkedDeleteBatches(ownedProjectDeletes);
    await Promise.all(ownedDeleteBatches.map((batch) => batch.commit()));

    const [
      invitesFromSnap,
      invitesToUidSnap,
      invitesToEmailSnap,
      wsInvitesFromSnap,
      wsInvitesToUidSnap,
      wsInvitesToEmailSnap,
      notifToUidSnap,
      notifToEmailSnap,
      userDocSnap,
    ] = await Promise.all([
      db.collection('invitations').where('fromUid', '==', uid).get(),
      db.collection('invitations').where('toUid', '==', uid).get(),
      db.collection('invitations').where('toEmail', '==', email).get(),
      db.collection('workspaceInvites').where('fromUid', '==', uid).get(),
      db.collection('workspaceInvites').where('toUid', '==', uid).get(),
      db.collection('workspaceInvites').where('toEmail', '==', email).get(),
      db.collection('notifications').where('toUid', '==', uid).get(),
      db.collection('notifications').where('toEmail', '==', email).get(),
      db.collection('users').doc(uid).get(),
    ]);

    const docsToDeleteMap = new Map();
    [
      ...invitesFromSnap.docs,
      ...invitesToUidSnap.docs,
      ...invitesToEmailSnap.docs,
      ...wsInvitesFromSnap.docs,
      ...wsInvitesToUidSnap.docs,
      ...wsInvitesToEmailSnap.docs,
      ...notifToUidSnap.docs,
      ...notifToEmailSnap.docs,
    ].forEach((docSnap) => {
      docsToDeleteMap.set(docSnap.ref.path, docSnap);
    });

    const miscDeleteBatches = buildChunkedDeleteBatches(Array.from(docsToDeleteMap.values()));
    await Promise.all(miscDeleteBatches.map((batch) => batch.commit()));

    if (userDocSnap.exists) {
      await userDocSnap.ref.delete();
    }

    const bucket = admin.storage().bucket();
    await Promise.all([
      bucket.deleteFiles({ prefix: `users/${uid}/` }).catch(() => null),
      bucket.deleteFiles({ prefix: `ai-temp/${uid}/` }).catch(() => null),
    ]);

    await admin.auth().deleteUser(uid);

    return { success: true };
  }
);
