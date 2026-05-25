const { onCall, HttpsError } = require('../shared/http-callable');
const { supabase, requireAuth, normalizeEmail, normalizeText } = require('../shared/supabase-helpers');

exports.markNotificationReadSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const notifId = normalizeText(request.data?.notifId || request.data?.notificationId, 120);
  const email = normalizeEmail(request.auth?.token?.email || '');
  if (!notifId) throw new HttpsError('invalid-argument', 'notifId zorunludur.');

  const { data: notification, error } = await supabase.from('notifications').select('*').eq('id', notifId).single();
  if (error || !notification) return { success: true, skipped: true };

  const allowedByUid = [notification.user_id, notification.to_uid].filter(Boolean).includes(uid);
  const allowedByEmail = normalizeEmail(notification.email || notification.to_email || '') === email;
  if (!allowedByUid && !allowedByEmail) throw new HttpsError('permission-denied', 'Bu bildirimi guncelleme yetkiniz yok.');

  if (notification.is_read === true || notification.read === true) return { success: true, alreadyRead: true };
  const { error: updateError } = await supabase
    .from('notifications')
    .update({ is_read: true, read: true, read_at: new Date().toISOString() })
    .eq('id', notifId);
  if (updateError) throw new HttpsError('internal', updateError.message);
  return { success: true };
});

exports.markAllNotificationsReadSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const email = normalizeEmail(request.auth?.token?.email || '');
  const filters = [`user_id.eq.${uid}`, `to_uid.eq.${uid}`];
  if (email) filters.push(`email.eq.${email}`, `to_email.eq.${email}`);

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id')
    .or(filters.join(','))
    .or('is_read.eq.false,read.eq.false');
  if (error) throw new HttpsError('internal', error.message);

  const ids = (notifications || []).map((notification) => notification.id);
  if (!ids.length) return { success: true, updated: 0 };
  const { error: updateError } = await supabase
    .from('notifications')
    .update({ is_read: true, read: true, read_at: new Date().toISOString() })
    .in('id', ids);
  if (updateError) throw new HttpsError('internal', updateError.message);
  return { success: true, updated: ids.length };
});

exports.registerPushTokenSecure = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = requireAuth(request);
  const token = normalizeText(request.data?.token, 240);
  if (!token) throw new HttpsError('invalid-argument', 'Push token zorunludur.');
  const { data: profile } = await supabase
    .from('profiles')
    .select('ai_prompt_history')
    .eq('id', uid)
    .single();
  const history = profile?.ai_prompt_history && typeof profile.ai_prompt_history === 'object'
    ? profile.ai_prompt_history
    : {};
  const { error } = await supabase
    .from('profiles')
    .update({
      ai_prompt_history: { ...history, pushToken: token, pushEnabled: true, pushTokenUpdatedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq('id', uid);
  if (error) throw new HttpsError('internal', error.message);
  return { success: true };
});
