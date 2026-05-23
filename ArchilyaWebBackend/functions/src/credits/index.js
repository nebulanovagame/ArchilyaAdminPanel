const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { FieldValue, assertPositiveInt, db, ensureUserProfileDoc, getAuthorizedWorkspaceForUser, normalizeText, requireAuth } = shared;
exports.deductCredits = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const amount = Number(request.data?.amount);
    const description = normalizeText(request.data?.description || 'AI islemi', 240);
    assertPositiveInt(amount, 'amount');

    const userRef = db.collection('users').doc(uid);
    await ensureUserProfileDoc(uid, { email: request.auth?.token?.email || '' });

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data() || {};
      const currentCredits = Number(data.credits || 0);

      if (currentCredits < amount) {
        throw new HttpsError('failed-precondition', `Yetersiz kredi. Mevcut: ${currentCredits}, gereken: ${amount}.`);
      }

      tx.update(userRef, {
        credits: currentCredits - amount,
        totalSpent: Number(data.totalSpent || 0) + amount,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const txRef = db.collection('users').doc(uid).collection('transactions').doc();
      tx.set(txRef, {
        type: 'spend',
        amount,
        description,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  }
);

exports.refundCredits = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const amount = Number(request.data?.amount);
    const description = normalizeText(request.data?.description || 'AI islem iadesi', 240);
    assertPositiveInt(amount, 'amount');

    const userRef = db.collection('users').doc(uid);
    await ensureUserProfileDoc(uid, { email: request.auth?.token?.email || '' });

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data() || {};

      tx.update(userRef, {
        credits: Number(data.credits || 0) + amount,
        totalSpent: Math.max(0, Number(data.totalSpent || 0) - amount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const txRef = db.collection('users').doc(uid).collection('transactions').doc();
      tx.set(txRef, {
        type: 'refund',
        amount,
        description,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  }
);

exports.deductWorkspacePoolCredits = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    const amount = Number(request.data?.amount);
    assertPositiveInt(amount, 'amount');

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');
    }

    const { wsRef } = await getAuthorizedWorkspaceForUser(workspaceId, uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(wsRef);
      const ws = snap.data() || {};
      const currentPool = Number(ws.poolCredits || 0);
      if (currentPool < amount) {
        throw new HttpsError('failed-precondition', `Yetersiz havuz kotasi. Mevcut: ${currentPool}, gereken: ${amount}.`);
      }

      tx.update(wsRef, {
        poolCredits: currentPool - amount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  }
);

exports.refundWorkspacePoolCredits = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    const amount = Number(request.data?.amount);
    assertPositiveInt(amount, 'amount');

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');
    }

    const { wsRef } = await getAuthorizedWorkspaceForUser(workspaceId, uid);
    await wsRef.update({
      poolCredits: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);
