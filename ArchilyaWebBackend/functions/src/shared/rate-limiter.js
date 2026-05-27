/**
 * Archilya Backend — Basic Rate Limiter
 *
 * Supabase tabanli basit rate limiter.
 * Her endpoint icin ayri bucket kullanilir.
 */

const { supabase } = require('./supabase-helpers');

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 dakika
const DEFAULT_MAX_REQUESTS = 30; // dakikada 30 istek

function getBucketKey(prefix, identifier) {
  const safe = String(identifier || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 120);
  return `${prefix}:${safe}`;
}

async function checkRateLimit({
  prefix,
  identifier,
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
}) {
  if (!prefix || !identifier) {
    return { allowed: true };
  }

  const bucketKey = getBucketKey(prefix, identifier);
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Once eski kayitlari temizle (basit yaklasim)
    await supabase
      .from('rate_limit_buckets')
      .delete()
      .lt('created_at', new Date(windowStart).toISOString())
      .eq('bucket_key', bucketKey);

    // Mevcut sayiyi al
    const { count, error: countError } = await supabase
      .from('rate_limit_buckets')
      .select('*', { count: 'exact', head: true })
      .eq('bucket_key', bucketKey);

    if (countError) {
      console.warn('[rate-limiter] Count error', { bucketKey, error: countError.message });
      return { allowed: true };
    }

    const currentCount = count || 0;
    if (currentCount >= maxRequests) {
      return {
        allowed: false,
        retryAfterMs: windowMs,
        current: currentCount,
        limit: maxRequests,
      };
    }

    // Yeni kayit ekle
    await supabase.from('rate_limit_buckets').insert({
      bucket_key: bucketKey,
      created_at: new Date(now).toISOString(),
    });

    return { allowed: true, current: currentCount + 1, limit: maxRequests };
  } catch (err) {
    console.warn('[rate-limiter] Exception — FAIL CLOSED', { bucketKey, error: err?.message || 'unknown' });
    // FAZ 0: Hata durumunda reddet (fail-close).
    // AI job creation gibi abuse riski yüksek endpoint'ler için
    // rate limit storage'ı down olsa bile sistem kendini korur.
    return {
      allowed: false,
      reason: 'rate_limiter_unavailable',
      retryAfterMs: windowMs,
      current: 0,
      limit: maxRequests,
    };
  }
}

module.exports = { checkRateLimit };
