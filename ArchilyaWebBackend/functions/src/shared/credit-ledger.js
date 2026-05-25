const { HttpsError } = require('./http-callable');
const { supabase } = require('./supabase');

function normalizeRpcError(error) {
  const message = String(error?.message || 'Kredi islemi tamamlanamadi.');
  const lower = message.toLowerCase();
  if (lower.includes('insufficient credits') || lower.includes('yetersiz')) {
    return new HttpsError('failed-precondition', 'Yetersiz kredi.');
  }
  if (lower.includes('profile not found') || lower.includes('not found')) {
    return new HttpsError('not-found', 'Kullanici profili bulunamadi.');
  }
  return new HttpsError('internal', message);
}

async function runCreditRpc(functionName, params) {
  const { data, error } = await supabase.rpc(functionName, params);
  if (error) throw normalizeRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.success) throw new HttpsError('internal', 'Kredi islemi tamamlanamadi.');
  return row;
}

async function chargeUserCredits({ userId, amount, description, idempotencyKey, metadata = {} }) {
  return runCreditRpc('charge_user_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description || null,
    p_idempotency_key: idempotencyKey || null,
    p_metadata: metadata,
  });
}

async function refundUserCredits({ userId, amount, description, idempotencyKey, metadata = {} }) {
  return runCreditRpc('refund_user_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description || null,
    p_idempotency_key: idempotencyKey || null,
    p_metadata: metadata,
  });
}

module.exports = { chargeUserCredits, refundUserCredits };
