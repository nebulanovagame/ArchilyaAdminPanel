const { onCall, HttpsError } = require('../shared/http-callable');
const { supabase, normalizeEmail, normalizeText } = require('../shared/supabase-helpers');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

exports.submitContactFormSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const name = normalizeText(request.data?.name, 120);
  const email = normalizeEmail(request.data?.email || '');
  const subject = normalizeText(request.data?.subject || 'Web iletisim formu', 180);
  const message = normalizeText(request.data?.message, 3000);
  const website = normalizeText(request.data?.website, 120);
  if (website) throw new HttpsError('invalid-argument', 'Gecersiz form gonderimi.');
  if (!name || name.length < 2) throw new HttpsError('invalid-argument', 'Isim en az 2 karakter olmalidir.');
  if (!isValidEmail(email)) throw new HttpsError('invalid-argument', 'Gecerli bir e-posta adresi girin.');
  if (!message || message.length < 10) throw new HttpsError('invalid-argument', 'Mesaj en az 10 karakter olmalidir.');

  const forwardedFor = request.rawRequest?.headers?.['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor || '').split(',')[0].trim();
  const ipAddress = normalizeText(forwardedIp || request.rawRequest?.ip || '', 120) || null;
  const userAgent = normalizeText(request.rawRequest?.get?.('user-agent') || '', 500) || null;
  const { data, error } = await supabase.from('contact_submissions').insert({
    name,
    email,
    subject,
    message,
    ip_address: ipAddress,
    user_agent: userAgent,
    is_read: false,
    created_at: new Date().toISOString(),
  }).select('id').single();
  if (error || !data) throw new HttpsError('internal', error?.message || 'Iletisim formu kaydedilemedi.');
  return { success: true, submissionId: data.id, mailStatus: 'stored' };
});
