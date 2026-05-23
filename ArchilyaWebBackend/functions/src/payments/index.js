const { onCall, HttpsError } = require('firebase-functions/v2/https');
const onRequest = require('firebase-functions/v2/https').onRequest;
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { FieldValue, PLAN_CREDITS, callIyzicoApi, createCreditTransactionPayload, db, decodeCheckoutFormContent, ensureUserProfileDoc, finalizeIyzicoPayment, getRequestIp, getRequestOrigin, getSubscriptionPlanConfig, isValidEmail, normalizeEmail, normalizeText, requireAuth, splitFullName, syncOwnedWorkspacePlanState } = shared;
const revenueCatCatalog = require('./revenueCatCatalog');
const { isSubscriptionProduct, isCreditTopupProduct, getPlanIdFromProduct, getCreditTopupFromProduct } = revenueCatCatalog;
exports.upgradeSubscription = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const newPlan = String(request.data?.planId || '').trim();
    const isVerifiedPayment = request.data?.paymentVerified === true;

    if (!['solo', 'pro', 'studio'].includes(newPlan)) {
      throw new HttpsError('invalid-argument', 'Gecersiz plan secimi.');
    }

    if (!isVerifiedPayment) {
      throw new HttpsError('failed-precondition', 'Odeme dogrulamasi olmadan plan yukseltilemez.');
    }

    const creditBoost = PLAN_CREDITS[newPlan] || 0;
    const userRef = db.collection('users').doc(uid);
    await ensureUserProfileDoc(uid, { email: request.auth?.token?.email || '' });

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data() || {};

      tx.update(userRef, {
        plan: newPlan,
        credits: Number(data.credits || 0) + creditBoost,
        totalEarned: Number(data.totalEarned || 0) + creditBoost,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const txRef = db.collection('users').doc(uid).collection('transactions').doc();
      tx.set(txRef, {
        type: 'earn',
        amount: creditBoost,
        description: `${newPlan} abonelik gecisi`,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    await syncOwnedWorkspacePlanState(uid, newPlan);

    return { success: true, plan: newPlan, addedCredits: creditBoost };
  }
);

exports.createIyzicoCheckoutForm = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const planConfig = getSubscriptionPlanConfig(request.data?.planId);
    const requestedUserId = normalizeText(request.data?.userId, 120);
    const userEmail = normalizeEmail(request.data?.userEmail || request.auth?.token?.email || '');
    const userName = normalizeText(request.data?.userName || request.auth?.token?.name || '', 120);

    if (requestedUserId && requestedUserId !== uid) {
      throw new HttpsError('permission-denied', 'Kullanici eslesmesi gecersiz.');
    }

    if (!isValidEmail(userEmail)) {
      throw new HttpsError('invalid-argument', 'Gecerli bir e-posta gereklidir.');
    }

    const { name, surname, fullName } = splitFullName(userName);
    const conversationId = `iyzico-${uid}-${Date.now()}`;
    const callbackUrl = `${getRequestOrigin(request)}/dashboard/abonelik?iyzicoCallback=1&conversationId=${encodeURIComponent(conversationId)}`;
    const ipAddress = getRequestIp(request);

    const payload = {
      locale: 'tr',
      conversationId,
      price: String(planConfig.price),
      paidPrice: String(planConfig.price),
      currency: 'TRY',
      basketId: `subscription-${planConfig.planId}`,
      paymentGroup: 'SUBSCRIPTION',
      callbackUrl,
      enabledInstallments: [1],
      buyer: {
        id: uid,
        name,
        surname,
        gsmNumber: '+905555555555',
        email: userEmail,
        identityNumber: '74300864791',
        lastLoginDate: new Date().toISOString(),
        registrationDate: new Date().toISOString(),
        registrationAddress: 'Archilya Kullanici Adresi',
        ip: ipAddress,
        city: 'Istanbul',
        country: 'Turkey',
        zipCode: '34000',
      },
      shippingAddress: {
        contactName: fullName,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Archilya Dijital Hizmetler',
        zipCode: '34000',
      },
      billingAddress: {
        contactName: fullName,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Archilya Dijital Hizmetler',
        zipCode: '34000',
      },
      basketItems: [
        {
          id: `subscription-${planConfig.planId}`,
          name: `${planConfig.label} Abonelik`,
          category1: 'Subscription',
          itemType: 'VIRTUAL',
          price: String(planConfig.price),
        },
      ],
    };

    const response = await callIyzicoApi({
      path: '/payment/iyzipos/checkoutform/initialize/auth/ecom',
      payload,
    });

    if (!response.ok || String(response.data?.status || '').toLowerCase() !== 'success') {
      throw new HttpsError(
        'aborted',
        normalizeText(response.data?.errorMessage || response.data?.errorCode || 'Iyzico oturumu olusturulamadi.', 500)
      );
    }

    const token = normalizeText(response.data?.token, 200);
    if (!token) {
      throw new HttpsError('internal', 'Iyzico token yaniti eksik.');
    }

    const paymentSessionPayload = {
      userId: uid,
      userEmail,
      userName: fullName,
      planId: planConfig.planId,
      amount: planConfig.price,
      credits: planConfig.credits,
      status: 'pending',
      conversationId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await Promise.all([
      db.collection('paymentSessions').doc(token).set(paymentSessionPayload, { merge: true }),
      db.collection('creditTransactions').doc(token).set({
        ...createCreditTransactionPayload({
          userId: uid,
          planConfig,
          status: 'pending',
          token,
          conversationId,
        }),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
    ]);

    return {
      token,
      checkoutFormContent: decodeCheckoutFormContent(response.data?.checkoutFormContent),
    };
  }
);

exports.verifyIyzicoPayment = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const token = normalizeText(request.data?.token, 200);
    const conversationId = normalizeText(request.data?.conversationId, 200);

    if (!token && !conversationId) {
      throw new HttpsError('invalid-argument', 'Token veya conversationId zorunludur.');
    }

    let paymentSessionRef = token ? db.collection('paymentSessions').doc(token) : null;
    let paymentSessionSnap = paymentSessionRef ? await paymentSessionRef.get() : null;

    if ((!paymentSessionSnap || !paymentSessionSnap.exists) && conversationId) {
      const paymentSessionByConversation = await db.collection('paymentSessions')
        .where('conversationId', '==', conversationId)
        .limit(1)
        .get();

      if (!paymentSessionByConversation.empty) {
        paymentSessionSnap = paymentSessionByConversation.docs[0];
        paymentSessionRef = paymentSessionSnap.ref;
      }
    }

    if (!paymentSessionSnap.exists) {
      throw new HttpsError('not-found', 'Odeme oturumu bulunamadi.');
    }

    const resolvedToken = normalizeText(paymentSessionSnap.id, 200);

    const paymentSession = paymentSessionSnap.data() || {};
    if (paymentSession.userId !== uid) {
      throw new HttpsError('permission-denied', 'Bu odeme oturumu size ait degil.');
    }

    if (paymentSession.status === 'completed') {
      return {
        success: true,
        status: 'completed',
        planId: paymentSession.planId,
        addedCredits: Number(paymentSession.credits || PLAN_CREDITS[paymentSession.planId] || 0),
      };
    }

    const response = await callIyzicoApi({
      path: '/payment/iyzipos/checkoutform/auth/ecom/detail',
      payload: {
        locale: 'tr',
        conversationId: paymentSession.conversationId || '',
        token: resolvedToken,
      },
    });

    const providerResult = response.data || {};
    const providerStatus = String(providerResult.paymentStatus || providerResult.status || '').toLowerCase();
    const isSuccess = response.ok
      && String(providerResult.status || '').toLowerCase() === 'success'
      && ['success', 'callbackthree ds', 'callbackthree-ds', 'completed'].includes(providerStatus);

    if (isSuccess) {
      const finalized = await finalizeIyzicoPayment({
        token: resolvedToken,
        paymentSessionRef,
        paymentSession,
        providerResult,
      });

      return {
        ...finalized,
        status: 'completed',
      };
    }

    const planConfig = getSubscriptionPlanConfig(paymentSession.planId);
    await Promise.all([
      paymentSessionRef.set({
        status: 'failed',
        providerStatus: normalizeText(providerResult.paymentStatus || providerResult.status, 80),
        updatedAt: FieldValue.serverTimestamp(),
        rawResult: providerResult,
      }, { merge: true }),
      db.collection('creditTransactions').doc(token).set({
        ...createCreditTransactionPayload({
          userId: paymentSession.userId,
          planConfig,
          status: 'failed',
          token: resolvedToken,
          paymentId: providerResult.paymentId || '',
          conversationId: paymentSession.conversationId || '',
        }),
        failedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
    ]);

    return {
      success: false,
      status: 'failed',
      message: normalizeText(providerResult.errorMessage || 'Odeme alinamadi, lutfen tekrar deneyin.', 500),
    };
  }
);

exports.revenueCatWebhook = onRequest(
  {
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: ['REVENUECAT_WEBHOOK_AUTH_PASSWORD'],
  },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const expectedPassword = process.env.REVENUECAT_WEBHOOK_AUTH_PASSWORD || '';
      const authorization = req.get('authorization') || '';
      const basicPrefix = 'Basic ';

      if (!expectedPassword || !authorization.startsWith(basicPrefix)) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const decodedAuth = Buffer.from(authorization.slice(basicPrefix.length), 'base64').toString('utf8');
      const separatorIndex = decodedAuth.indexOf(':');
      const username = separatorIndex >= 0 ? decodedAuth.slice(0, separatorIndex) : '';
      const password = separatorIndex >= 0 ? decodedAuth.slice(separatorIndex + 1) : '';

      if (username !== 'revenuecat' || password !== expectedPassword) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      let body = req.body;
      if (!body || Buffer.isBuffer(body) || typeof body === 'string') {
        const rawBody = Buffer.isBuffer(req.rawBody)
          ? req.rawBody.toString('utf8')
          : Buffer.isBuffer(body)
            ? body.toString('utf8')
            : String(body || '');
        body = rawBody ? JSON.parse(rawBody) : {};
      }

      const event = body?.event;
      const eventId = String(event?.id || '').trim();
      const uid = String(event?.app_user_id || '').trim();
      // RevenueCat, Google Play ürünlerini "solo_monthly:solo-monthly" formatında gönderebilir.
      // ":" sonrasındaki base plan suffix'ini temizleyerek catalog aramasını doğru yaptırıyoruz.
      const rawProductId = String(event?.product_id || '').trim();
      const productId = rawProductId.split(':')[0];
      const eventType = String(event?.type || '').trim();

      if (!event || !eventId || !eventType || !uid || !productId) {
        return res.status(400).json({ success: false, error: 'Invalid RevenueCat event payload' });
      }

      const eventRef = db.collection('revenueCatWebhookEvents').doc(eventId);
      const eventSnap = await eventRef.get();

      if (eventSnap.exists) {
        return res.status(200).json({ success: true, idempotent: true });
      }

      if (isCreditTopupProduct(productId)) {
        const supportedTopupEvents = ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE'];

        if (!supportedTopupEvents.includes(eventType)) {
          return res.status(200).json({ success: true });
        }

        const topUp = getCreditTopupFromProduct(productId);
        const userRef = db.collection('users').doc(uid);

        await ensureUserProfileDoc(uid);

        const processed = await db.runTransaction(async (tx) => {
          const duplicateSnap = await tx.get(eventRef);
          if (duplicateSnap.exists) {
            return false;
          }

          await tx.get(userRef);
          tx.set(userRef, {
            credits: FieldValue.increment(topUp.credits),
            totalEarned: FieldValue.increment(topUp.credits),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          const txRef = db.collection('users').doc(uid).collection('transactions').doc();
          tx.set(txRef, {
            type: 'earn',
            amount: topUp.credits,
            description: topUp.description,
            source: 'revenuecat',
            eventType,
            productId,
            createdAt: FieldValue.serverTimestamp(),
          });
          tx.set(eventRef, {
            processedAt: FieldValue.serverTimestamp(),
            uid,
            productId,
            eventType,
            type: 'credit_topup',
            credits: topUp.credits,
          });

          return true;
        });

        if (!processed) {
          return res.status(200).json({ success: true, idempotent: true });
        }

        return res.status(200).json({ success: true });
      }

      if (!isSubscriptionProduct(productId)) {
        return res.status(200).json({ success: true, ignored: true });
      }

      const planId = getPlanIdFromProduct(productId);
      const activationEvents = ['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE', 'UNCANCELLATION'];
      const deactivationEvents = ['EXPIRATION'];
      const userRef = db.collection('users').doc(uid);

      await ensureUserProfileDoc(uid);

      if (activationEvents.includes(eventType)) {
        const creditBoost = PLAN_CREDITS[planId] || 0;
        const updatePayload = {
          plan: planId,
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (['INITIAL_PURCHASE', 'RENEWAL'].includes(eventType)) {
          updatePayload.credits = FieldValue.increment(creditBoost);
        }

        const processed = await db.runTransaction(async (tx) => {
          const duplicateSnap = await tx.get(eventRef);
          if (duplicateSnap.exists) {
            return false;
          }

          await tx.get(userRef);
          tx.set(userRef, updatePayload, { merge: true });

          if (['INITIAL_PURCHASE', 'RENEWAL'].includes(eventType)) {
            const txRef = db.collection('users').doc(uid).collection('transactions').doc();
            tx.set(txRef, {
              type: 'earn',
              amount: creditBoost,
              description: 'Google Play abonelik',
              source: 'revenuecat',
              eventType,
              productId,
              createdAt: FieldValue.serverTimestamp(),
            });
          }

          tx.set(eventRef, {
            processedAt: FieldValue.serverTimestamp(),
            uid,
            productId,
            eventType,
            type: 'subscription',
          });

          return true;
        });

        if (!processed) {
          return res.status(200).json({ success: true, idempotent: true });
        }

        await syncOwnedWorkspacePlanState(uid, planId);

        return res.status(200).json({ success: true });
      }

      if (deactivationEvents.includes(eventType)) {
        const processed = await db.runTransaction(async (tx) => {
          const duplicateSnap = await tx.get(eventRef);
          if (duplicateSnap.exists) {
            return false;
          }

          await tx.get(userRef);
          tx.set(userRef, {
            plan: 'free',
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          const txRef = db.collection('users').doc(uid).collection('transactions').doc();
          tx.set(txRef, {
            type: 'spend',
            amount: 0,
            description: 'RevenueCat abonelik free plana dusuruldu',
            source: 'revenuecat',
            eventType,
            createdAt: FieldValue.serverTimestamp(),
          });
          tx.set(eventRef, {
            processedAt: FieldValue.serverTimestamp(),
            uid,
            productId,
            eventType,
            type: 'subscription',
          });

          return true;
        });

        if (!processed) {
          return res.status(200).json({ success: true, idempotent: true });
        }

        await syncOwnedWorkspacePlanState(uid, 'free');

        return res.status(200).json({ success: true });
      }

      await eventRef.set({
        processedAt: FieldValue.serverTimestamp(),
        uid,
        productId,
        eventType,
        type: 'subscription',
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('RevenueCat webhook error:', error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'RevenueCat webhook failed',
      });
    }
  }
);

Object.assign(module.exports, revenueCatCatalog);
