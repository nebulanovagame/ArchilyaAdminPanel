const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { FieldValue, buildChunkedBatches, db, ensureUserProfileDoc, normalizeEmail, normalizeText, requireAuth } = shared;
exports.registerPushTokenSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || '');
    const token = normalizeText(request.data?.token, 240);

    if (!token) {
      throw new HttpsError('invalid-argument', 'Push token zorunludur.');
    }

    await ensureUserProfileDoc(uid, { email });

    await db.collection('users').doc(uid).set({
      expoPushTokens: FieldValue.arrayUnion(token),
      pushEnabled: true,
      pushTokenUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true };
  }
);

exports.markNotificationReadSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const notifId = normalizeText(request.data?.notifId, 120);
    const email = normalizeEmail(request.auth?.token?.email || '');

    if (!notifId) {
      throw new HttpsError('invalid-argument', 'notifId zorunludur.');
    }

    const notifRef = db.collection('notifications').doc(notifId);
    const notifSnap = await notifRef.get();
    if (!notifSnap.exists) {
      return { success: true, skipped: true };
    }

    const notif = notifSnap.data() || {};
    const allowedByUid = normalizeText(notif.toUid, 120) === uid;
    const allowedByEmail = normalizeEmail(notif.toEmail) === email;

    if (!allowedByUid && !allowedByEmail) {
      throw new HttpsError('permission-denied', 'Bu bildirimi guncelleme yetkiniz yok.');
    }

    if (notif.read === true) {
      return { success: true, alreadyRead: true };
    }

    await notifRef.update({
      read: true,
      readAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);

exports.markAllNotificationsReadSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || '');

    const promises = [
      db.collection('notifications').where('toUid', '==', uid).get(),
    ];

    if (email) {
      promises.push(
        db.collection('notifications').where('toEmail', '==', email).get(),
      );
    }

    const snapshots = await Promise.all(promises);
    const byId = new Map();
    snapshots.forEach((snap) => {
      snap.docs.forEach((docSnap) => {
        byId.set(docSnap.id, docSnap);
      });
    });

    const targets = [...byId.values()].filter((docSnap) => docSnap.data()?.read !== true);
    if (!targets.length) {
      return { success: true, updated: 0 };
    }

    const batches = buildChunkedBatches(targets, () => ({
      read: true,
      readAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }));

    await Promise.all(batches.map((batch) => batch.commit()));
    return { success: true, updated: targets.length };
  }
);
