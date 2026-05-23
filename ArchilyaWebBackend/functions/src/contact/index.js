const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const shared = require('../shared');
const { FieldValue, RESEND_API_KEY, db, enforceContactRateLimit, isValidEmail, normalizeEmail, normalizeText, sendContactSubmissionEmails } = shared;
exports.submitContactFormSecure = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [RESEND_API_KEY],
  },
  async (request) => {
    const name = normalizeText(request.data?.name, 120);
    const email = normalizeEmail(request.data?.email || '');
    const message = normalizeText(request.data?.message, 3_000);
    const website = normalizeText(request.data?.website, 120);

    if (website) {
      throw new HttpsError('invalid-argument', 'Gecersiz form gonderimi.');
    }

    if (!name || name.length < 2) {
      throw new HttpsError('invalid-argument', 'Isim en az 2 karakter olmalidir.');
    }
    if (!isValidEmail(email)) {
      throw new HttpsError('invalid-argument', 'Gecerli bir e-posta adresi girin.');
    }
    if (!message || message.length < 10) {
      throw new HttpsError('invalid-argument', 'Mesaj en az 10 karakter olmalidir.');
    }

    const forwardedFor = request.rawRequest?.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : String(forwardedFor || '').split(',')[0].trim();
    const ip = normalizeText(forwardedIp || request.rawRequest?.ip || '', 120) || null;
    const userAgent = normalizeText(request.rawRequest?.get('user-agent') || '', 500);
    const uid = request.auth?.uid || null;

    await enforceContactRateLimit({ email, ip });

    const ref = db.collection('contactSubmissions').doc();
    await ref.set({
      name,
      email,
      message,
      source: 'website',
      status: 'new',
      uid,
      ip,
      userAgent,
      mailProvider: 'resend',
      mailStatus: 'pending',
      adminMailSent: false,
      userMailSent: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    let mailResult;
    try {
      mailResult = await sendContactSubmissionEmails({
        name,
        email,
        message,
        submissionId: ref.id,
        source: 'website',
        ip,
        userAgent,
      });
    } catch (err) {
      console.error('[submitContactFormSecure] resend error', {
        submissionId: ref.id,
        errorMessage: err?.message || String(err),
      });
      mailResult = {
        admin: { sent: false, error: err?.message || 'unknown', id: null },
        user: { sent: false, error: err?.message || 'unknown', id: null },
      };
    }

    const adminSent = Boolean(mailResult?.admin?.sent);
    const userSent = Boolean(mailResult?.user?.sent);
    const allSent = adminSent && userSent;

    await ref.set({
      status: allSent ? 'new' : 'mail_partial',
      mailStatus: allSent ? 'sent' : (adminSent || userSent ? 'partial' : 'failed'),
      adminMailSent: adminSent,
      userMailSent: userSent,
      adminMailId: mailResult?.admin?.id || null,
      userMailId: mailResult?.user?.id || null,
      mailError: {
        admin: mailResult?.admin?.error || null,
        user: mailResult?.user?.error || null,
      },
      updatedAt: FieldValue.serverTimestamp(),
      emailedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      success: true,
      submissionId: ref.id,
      adminMailSent: adminSent,
      emailConfirmationSent: userSent,
      mailStatus: allSent ? 'sent' : (adminSent || userSent ? 'partial' : 'failed'),
    };
  }
);
