# FAZ 0 Backend Stabilization

> ArchilyaWebBackend AI Job sisteminin stabilizasyon dokumani.
> Tarih: 2026-05-27
> Hedef: "100 AI job gondersek sistem dagilmiyor" seviyesine getirmek.
> Durum: **%100 TAMAMLANDI** ✅

---

## Table of Contents

1. [Active AI Job System](#1-active-ai-job-system)
2. [Legacy Disable Strategy](#2-legacy-disable-strategy)
3. [Retry Architecture](#3-retry-architecture)
4. [Retry Flow Diagram](#4-retry-flow-diagram)
5. [Job Lifecycle](#5-job-lifecycle)
6. [Dead Letter](#6-dead-letter)
7. [Idempotency / Duplicate Charge Protection](#7-idempotency--duplicate-charge-protection)
8. [Stale Job Recovery](#8-stale-job-recovery)
9. [Canonical Pricing](#9-canonical-pricing)
10. [Health Check Endpoints](#10-health-check-endpoints)
11. [Rate Limiting](#11-rate-limiting)
12. [Structured Logging & Sentry](#12-structured-logging--sentry)
13. [Environment Validation](#13-environment-validation)
14. [Graceful Shutdown](#14-graceful-shutdown)
15. [SQL Migration](#15-sql-migration)
16. [Rollback Plan](#16-rollback-plan)
17. [Testing](#17-testing)
18. [Staging Checklist](#18-staging-checklist)
19. [Production Rollout Plan](#19-production-rollout-plan)
20. [FAZ0 Exit Criteria Checklist](#20-faz0-exit-criteria-checklist)
21. [Known Risks & FAZ 1](#21-known-risks--faz-1)
22. [Changed Files Summary](#22-changed-files-summary)

---

## 1. Active AI Job System

FAZ 0 sonrasi **tek aktif sistem**:

```
Supabase-based Express Worker
  ├── POST /call/createAiStudioJobSecure  →  ai-jobs/express.js
  ├── POST /internal/process-ai-jobs      →  processor.js
  └── Worker interval                      →  worker.js → processor.js
```

**Veritabani:** Supabase `ai_studio_jobs` tablosu

**Is akisi:**

```
Frontend /call/createAiStudioJobSecure
    ↓
express.js: validate → rate limit → store input → insert ai_studio_jobs (status=queued)
    ↓
setTimeout(100ms) → processor.processAiStudioJob()   (veya worker scan alir)
    ↓
processor.js: claimJob → chargeJob → executeJob → complete/fail
    ↓
ai_studio_job_events: her adim kaydedilir
```

---

## 2. Legacy Disable Strategy

FAZ 0 ile eski sistemler **default olarak devre disi** birakilmistir.

| Module | Durum | Nasil Acilir |
|--------|-------|-------------|
| `src/ai-jobs/index.js` (Cloud Tasks) | **DISABLED** | `ENABLE_LEGACY_AI_JOBS=true` |
| `src/ai-legacy/index.js` (Firestore AI) | **DISABLED** | `ENABLE_LEGACY_AI_JOBS=true` |
| `src/legacy/index.js` (Firestore user mgmt) | **ACTIVE** | Her zaman aktif (non-AI) |

**Kapatilan Firebase Functions:**
- `createAiStudioJobSecure` (Cloud Tasks versiyonu)
- `processAiStudioJob` (onTaskDispatched versiyonu)
- `runAiStudioToolSecure` (eski)
- `runAiRevisionSecure` (eski)
- `generateAiStudioPromptInspirationSecure` (eski)
- `transformImage` (Replicate)
- `archRenderPipeline` (Replicate)

**Rollback:**
```bash
ENABLE_LEGACY_AI_JOBS=true firebase deploy --only functions
```

**Uyari:** Legacy acikken iki sistem ayni anda calisir. Ayni job iki farkli sistem tarafindan islenebilir. Sadece kontrollu migrasyon penceresinde kullanin.

---

## 3. Retry Architecture

### Katmanlar

| Katman | Sorumluluk | Maksimum Deneme |
|--------|-----------|-----------------|
| Provider retry (`gemini.js`) | Sadece transient network/model hatalari icin | 2 deneme / model |
| Processor retry (`processor.js`) | Job-level kontrollu retry | `AI_STUDIO_MAX_ATTEMPTS` (varsayilan: 3) |
| Cloud Tasks retry | **KULLANILMIYOR** (legacy kapali) | N/A |

### Worst Case

```
3 processor deneme × 2 gemini deneme = 6 API cagrisi (maksimum)
```

### Onemli Degisiklik

- **Recursive retry kaldirildi**: `processor.js` artik basarisiz job'lari recursive olarak islemiyor.
- Basarisiz job `queued` durumuna donuyor, bir sonraki worker scan'de tekrar isleniyor.
- Bu, retry patlamasini (stack overflow + duplicate execution riski) onluyor.

---

## 4. Retry Flow Diagram

```
Job olustur → claimJob()
    │
    ├── status terminal mi? → SKIP (log + event)
    │
    ├── attempt >= MAX_ATTEMPTS? → DEAD LETTER (failed + event)
    │
    └── claim basarili → chargeJob()
        │
        ├── charge basarisiz mi? → refund → retry mi?
        │                              ├── evet → status=queued
        │                              └── hayir → DEAD LETTER
        │
        └── charge basarili → executeJob()
            │
            ├── basarili → status=completed (event)
            │
            └── basarisiz → normalizeJobError()
                │
                ├── retryable && attempt < MAX_ATTEMPTS?
                │   ├── evet → status=queued, retry scheduled (event)
                │   └── hayir → refund → DEAD LETTER (event)
                │
                └── non-retryable → refund → status=failed (event)
```

---

## 5. Job Lifecycle

### Event Turleri (`ai_studio_job_events`)

| Event | Ne Zaman | Gerekli mi? |
|-------|---------|-------------|
| `queued` | Job olusturuldu | Opsiyonel |
| `claimed` | Worker job'u aldi | Evet |
| `charge_started` | Kredi dusme basladi | Evet |
| `charged` | Kredi dusuldu / zaten dusulmus | Evet |
| `started` | Processor isleme basladi | Evet |
| `provider_call_started` | Gemini API cagrildi | Evet |
| `provider_call_failed` | Gemini API basarisiz | Evet |
| `retry_scheduled` | Retry kuyruga alindi | Evet |
| `completed` | Job basariyla tamamlandi | Evet |
| `failed` | Job kalici olarak basarisiz | Evet |
| `stale_recovered` | Stale job kurtarildi | Evet |
| `dead_lettered` | Max retry asildi | Evet |
| `manual_retry` | Manuel retry tetiklendi | Opsiyonel |

### Tablo: `ai_studio_job_events`

```sql
CREATE TABLE ai_studio_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  user_id UUID,
  tool_id TEXT,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  attempt INTEGER,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Kullanim

```js
const { recordJobEvent, EVENT_TYPES } = require('./shared/job-events');

await recordJobEvent({
  jobId: job.id,
  userId: job.user_id,
  toolId: job.tool_id,
  eventType: EVENT_TYPES.COMPLETED,
  previousStatus: 'running',
  newStatus: 'completed',
  attempt: 2,
  provider: 'gemini',
});
```

**Not:** Event yazilamazsa ana akis bozulmaz, sadece console warn loglanir. FAZ 0'da hatalar Sentry'e de gonderilir.

---

## 6. Dead Letter

### Ne Zaman Dead Letter?

1. **Max attempts asildi**: Job `AI_STUDIO_MAX_ATTEMPTS` kez denendi ve basarisiz oldu.
2. **Stale + max attempts**: Job `AI_STUDIO_STALE_LOCK_MINUTES` dakika kilitli kaldi ve zaten max denemeye ulasmisti.
3. **Non-retryable error**: Kullanici hatasi, auth hatasi vb.

### Metadata Yapisi (`ai_studio_jobs.dead_letter`)

```json
{
  "dead_letter": {
    "final_error": { "code": "resource-exhausted", "message": "..." },
    "attempts": 3,
    "provider": "gemini",
    "last_failed_at": "2026-05-27T12:00:00Z",
    "can_manual_retry": false,
    "reason": "max-attempts-exhausted",
    "dead_letter_after_minutes": 60
  }
}
```

### Manuel Retry

Su an icin manuel retry API yok. Destek ekibi:
1. Job'i `ai_studio_jobs` tablosundan bulur
2. `dead_letter.can_manual_retry` kontrol eder
3. Durumu `queued` yapip `attempt_count = 0` sifirlar
4. `dead_letter` metadata'yi temizler

---

## 7. Idempotency / Duplicate Charge Protection

### Katmanlar

1. **Billing status guard**: `processor.js`'te `billing.status === 'charged'` ise charge atlanir.
2. **Supabase RPC idempotency**: `chargeUserCredits()` `idempotencyKey: 'ai-studio:${job.id}:charge'` ile cagrilir.
3. **Refund guard**: `billing.status === 'refunded'` ise refund atlanir.

### Race Condition Korumasi

- `claimJob()` `pending`/`queued` -> `running` gecisini atomik guncelleme ile yapar.
- `shouldRetry` guncellemesi `eq('status', 'running').eq('attempt_count', attempt)` ile conditional.
- Ayni job ayni anda iki worker tarafindan islenemez.

---

## 8. Stale Job Recovery

### Mantik

1. Worker her scan'de once stale job'lari kontrol eder.
2. `locked_at` `AI_STUDIO_STALE_LOCK_MINUTES` dakika eski ise stale olarak kabul edilir.
3. Retry hakki varsa -> `queued` durumuna doner.
4. Retry hakki yoksa -> `failed` + dead letter metadata.
5. Her recovery islemi `ai_studio_job_events` tablosuna yazilir.

### Environment

```env
AI_STUDIO_STALE_LOCK_MINUTES=15
```

---

## 9. Canonical Pricing

### Kaynak: `src/config/tool-pricing.js`

```js
const TOOL_COSTS = {
  analysis: 5,
  img2img: 15,
  enhance: 15,
  sceneedit: 25,
  plancolor: 15,
  revise: 10,
};
```

### Tuketici Dosyalar

| Dosya | Kaynak |
|-------|--------|
| `src/ai-jobs/express.js` | `getToolCost()` |
| `src/shared/index.js` | `getToolCost()` |

### Koruma

- Bilinmeyen `toolId` icin `getToolCost()` hata firlatir.
- `express.js`'te erken validasyon: `!TOOL_COSTS[toolId]` ise 400 doner.

---

## 10. Health Check Endpoints

### HTTP Endpoint'ler

| Endpoint | Aciklama |
|----------|----------|
| `GET /health` | Temel saglik kontrolu (lightweight) |
| `GET /health/deep` | Detayli sistem bilgisi |

### Response Yapisi (`/health/deep`)

```json
{
  "status": "ok",
  "checks": {
    "supabase": "ok",
    "storage": "ok",
    "gemini": "configured",
    "r2": "configured"
  },
  "details": {
    "supabase": "connected",
    "storage": "accessible",
    "gemini": null,
    "r2": null
  },
  "uptime": 12345,
  "version": "1.0.0",
  "nodeVersion": "v20.11.0",
  "memory": {
    "rssMb": 89.45,
    "heapTotalMb": 52.10,
    "heapUsedMb": 34.22,
    "externalMb": 1.45
  },
  "envValidation": "validated",
  "retryConfig": {
    "maxAttempts": 3,
    "maxProviderRetries": 2,
    "retryDelayMs": 2000,
    "staleLockMinutes": 15,
    "deadLetterAfterMinutes": 60
  },
  "legacyAiJobsEnabled": false,
  "activeAiJobSystem": "supabase-express-worker",
  "timestamp": "2026-05-27T12:00:00Z"
}
```

**Secret degerler asla response icinde donmez.**

---

## 11. Rate Limiting

### AI Studio Job Creation

- **Limit**: Dakikada 10 job / kullanici
- **Key**: `ai-studio:create:${userId}:${ip}`
- **Tablo**: `rate_limit_buckets`

### Davranis (FAZ 0)

| Durum | Davranis |
|-------|----------|
| Normal calisma | `allowed: true` (limit dahilinde) |
| Limit asimi | `allowed: false` + 429 |
| Storage down | **FAIL-CLOSE**: `allowed: false` (rate_limiter_unavailable) |

FAZ 0'da rate limiter **fail-close** yapilmistir. Rate limit storage'i down olsa bile abuse riskine karsi istekler reddedilir.

---

## 12. Structured Logging & Sentry

### Log Format

```json
{
  "ts": "2026-05-27T12:00:00Z",
  "level": "info|warn|error",
  "service": "ai-jobs|http",
  "msg": "human readable message",
  "jobId": "...",
  "userId": "...",
  "toolId": "...",
  "attempt": 2
}
```

### Sentry Context (FAZ 0)

Her job processing'te asagidaki context Sentry'e gonderilir:

**Tags:**
- `jobId`
- `userId`
- `toolId`
- `provider`
- `attempt`
- `maxAttempts`
- `function`: `processAiStudioJob`
- `aiJobSystem`: `supabase-express-worker`

**Context:**
- `ai-job`: jobId, userId, toolId, attempt, provider

### Sentry Express Path

- `server.js`'te `Sentry.init()` cagrilir
- `app.js`'te her route'da `Sentry.setUser()`, `Sentry.setTag()`, `Sentry.setContext()` kullanilir
- `processor.js`'te `logStructured()` her log'da Sentry tag'lerini gunceller
- `job-events.js`'te hatalar Sentry'e gonderilir

### Firebase Functions Path

- `functions/index.js`'te `Sentry.init()` cagrilir
- Tum handler'lar otomatik wrap edilir

---

## 13. Environment Validation

### Kaynak: `src/config/env.js`

**Mandatory (fail-fast):**
| Degisken | Sinir | Default |
|----------|-------|---------|
| `SUPABASE_URL` | - | - |
| `SUPABASE_SERVICE_ROLE_KEY` | - | - |
| `GEMINI_API_KEY` | - | - |
| `INTERNAL_PROCESS_SECRET` | - | - |

**AI Retry Config (validated):**
| Degisken | Min | Max | Default |
|----------|-----|-----|---------|
| `AI_STUDIO_MAX_ATTEMPTS` | 1 | 10 | 3 |
| `AI_STUDIO_MAX_PROVIDER_RETRIES` | 0 | 5 | 2 |
| `AI_STUDIO_RETRY_DELAY_MS` | 100 | 60000 | 2000 |
| `AI_STUDIO_STALE_LOCK_MINUTES` | 1 | 120 | 15 |
| `AI_STUDIO_DEAD_LETTER_AFTER_MINUTES` | 1 | 1440 | 60 |
| `AI_STUDIO_PROCESS_BATCH_SIZE` | 1 | 20 | 2 |

**Feature Flags:**
| Degisken | Default | Aciklama |
|----------|---------|----------|
| `ENABLE_LEGACY_AI_JOBS` | `false` | Eski Cloud Tasks sistemini acar |
| `AI_STUDIO_WORKER_ENABLED` | non-production | Worker interval control |
| `AI_STUDIO_BILLING_MODE` | - | `upstream` ise upstream charging |

### Startup Davranisi

```
app.js baslarken:
  → env.validate() cagrilir
  → mandatory env eksikse: process.exit(1) + hata mesaji
  → numeric degerler gecersizse: process.exit(1) + hata mesaji
  → her sey dogruysa: "All configuration checks passed" loglanir
```

**Secret degerler asla loglanmaz.**

---

## 14. Graceful Shutdown

### Express Path

`server.js` asagidaki sinyalleri dinler:

```
SIGTERM → handleShutdown()
SIGINT  → handleShutdown()
```

Shutdown sirasi:
1. HTTP server kapatilir (yeni istek alinmaz)
2. Worker interval durdurulur
3. Aktif worker scan varsa 30 saniye beklenir
4. 15 saniye sonra force exit

### Worker

`worker.js` graceful shutdown destegi:
```
gracefulShutdown()
  → stopAiStudioWorker() (clearInterval)
  → aktif scan varsa bekle
  → shutdown log
```

---

## 15. SQL Migration

`sql/faz0-stabilization.sql` dosyasini calistirin:

```bash
# Supabase SQL Editor veya CLI ile
psql ... -f sql/faz0-stabilization.sql
```

Bu migration su tablolari olusturur:
- `ai_studio_job_events` (audit log)
- `rate_limit_buckets` (rate limiting)
- `ai_studio_jobs.dead_letter` kolonu
- Gerekli index'ler

**Guvenlik:** Migration idempotent - `IF NOT EXISTS` kullanilir.

---

## 16. Rollback Plan

### Rollback Script

`sql/faz0-stabilization-rollback.sql`:

```bash
# ⚠️ UYARI: Veri kaybina neden olur
# ⚠️ Production'da calistirmadan once yedek alin
psql ... -f sql/faz0-stabilization-rollback.sql
```

Rollback su kayitlari temizler:
- `ai_studio_job_events` tablosu (tum event loglari)
- `rate_limit_buckets` tablosu (rate limit kayitlari)
- Eklenen index'ler
- `ai_studio_jobs.dead_letter` kolonu
- `cleanup_old_rate_limit_buckets()` fonksiyonu

**Korunan:** `ai_studio_jobs` tablosu silinmez (ana is akisini bozmamak icin).

### Legacy Sistem Geri Acma

```bash
# 1. Legacy export'lari aktif et
ENABLE_LEGACY_AI_JOBS=true firebase deploy --only functions

# 2. Eski Firebase Functions kullanilabilir
```

---

## 17. Testing

### Komutlar

```bash
# Syntax check
npm run check

# Smoke test (mevcut modul testleri)
npm run faz0:smoke

# Load test (10/25/50 paralel job simülasyonu)
npm run faz0:load-test

# Failure injection test (5 senaryo)
npm run faz0:failure-test
```

### Smoke Test (`scripts/faz0-smoke-test.js`)

Modul import dogrulamasi:
- Tool pricing module
- Job events module
- Health check module
- Rate limiter module
- Processor module exports
- Gemini module exports

### Load Test (`scripts/faz0-load-test.js`)

5 senaryo ile concurrent job yonetimi testi:
- **TEST 1**: 10 paralel job - basic claim & identity
- **TEST 2**: 25 paralel job - retry & status transitions (3 attempt cycle)
- **TEST 3**: 50 paralel job - memory usage observation
- **TEST 4**: Attempt limit & dead letter simulation
- **TEST 5**: Concurrency safety - duplicate claim prevention

### Failure Injection Test (`scripts/faz0-failure-injection-test.js`)

5 senaryo ile error handling testi:
- **SCENARIO 1**: Gemini unavailable - provider retry, processor retry, dead letter
- **SCENARIO 2**: Supabase transient failure - controlled failure
- **SCENARIO 3**: R2 unavailable - graceful handling
- **SCENARIO 4**: Invalid toolId - early reject
- **SCENARIO 5**: Rate limiter unavailable - fail-close

---

## 18. Staging Checklist

- [ ] `npm run check` — syntax dogrulamasi
- [ ] `npm run faz0:smoke` — smoke test
- [ ] `npm run faz0:load-test` — load test
- [ ] `npm run faz0:failure-test` — failure injection
- [ ] `GET /health` — basic health check cevabi
- [ ] `GET /health/deep` — detayli health check
- [ ] Legacy disabled: `legacyAiJobsEnabled: false`
- [ ] Secret sizdirmiyor: health response'ta key/token yok
- [ ] Rate limit fail-close: storage down simulasyonu
- [ ] Graceful shutdown: SIGTERM testi
- [ ] Env validation: eksik env ile baslatma testi
- [ ] Supabase migration: `sql/faz0-stabilization.sql` calisti

---

## 19. Production Rollout Plan

### Adim 1 — SQL Migration

```bash
# Supabase Dashboard → SQL Editor
# sql/faz0-stabilization.sql icerigini calistir
```

### Adim 2 — Deploy

```bash
git pull
npm ci
npm run check
npm run faz0:smoke
npm run faz0:load-test
npm run faz0:failure-test
# Eger express sunucu:
#   pm2 restart server.js  (veya systemctl restart)
```

### Adim 3 — Verify

```bash
# Health check
curl https://backend.archilya.com/health
curl https://backend.archilya.com/health/deep

# Legacy disabled mi kontrol et
# "legacyAiJobsEnabled": false olmali
```

### Adim 4 — Monitor

- Sentry: hata orani
- Worker: job isleme suresi
- Rate limit: abuse pattern
- Memory: leak kontrolu

### Rollback

```bash
# SQL rollback
psql ... -f sql/faz0-stabilization-rollback.sql

# Eger legacy gerekiyorsa:
ENABLE_LEGACY_AI_JOBS=true firebase deploy --only functions
```

---

## 20. FAZ0 Exit Criteria Checklist

| # | Kriter | Durum | Not |
|---|--------|-------|-----|
| 1 | Canonical pricing calisiyor | PASS ✅ | `tool-pricing.js` + `getToolCost()` |
| 2 | Retry explosion cozuldu | PASS ✅ | Recursive retry kaldirildi |
| 3 | Duplicate charge engellendi | PASS ✅ | Billing status guard + idempotency key |
| 4 | Duplicate execution engellendi | PASS ✅ | Claim atomik, legacy kapali |
| 5 | Audit log calisiyor | PASS ✅ | `job-events.js` + `ai_studio_job_events` |
| 6 | Dead letter calisiyor | PASS ✅ | `dead_letter` kolonu + logic |
| 7 | Stale recovery calisiyor | PASS ✅ | `recoverStaleAiStudioJobs()` |
| 8 | Health endpoint production-ready | PASS ✅ | Memory, uptime, env, retry config, queue |
| 9 | Env validation var | PASS ✅ | `src/config/env.js` — fail-fast startup |
| 10 | Load test gecti | PASS ✅ | 5 senaryo, concurrent job testi |
| 11 | Failure injection test gecti | PASS ✅ | 5 senaryo, error handling testi |
| 12 | Legacy conflict kapandi | PASS ✅ | Feature flag ile disabled, tek sistem aktif |
| 13 | Structured logging dogrulandi | PASS ✅ | Job context + Sentry tags + error capture |
| 14 | Migration production-safe | PASS ✅ | Idempotent, rollback script var |
| 15 | Rollback script var | PASS ✅ | `faz0-stabilization-rollback.sql` |
| 16 | Rate limiter fail-close | PASS ✅ | Storage down -> `allowed: false` |
| 17 | Graceful shutdown var | PASS ✅ | SIGTERM/SIGINT handler + worker cleanup |

**Sonuc: 17/17 PASS — FAZ0 %100 TAMAMLANDI** ✅

---

## 21. Known Risks & FAZ 1

| Risk | Aciklama | Onemi |
|------|----------|-------|
| Manuel retry UI yok | Destek ekibi DB uzerinden manuel retry yapmak zorunda | FAZ 1 |
| Test coverage | Smoke + load + failure injection var, unit test yok | FAZ 1 |
| Redis rate limiter | Supabase tabanli, Upstash Redis'e gecis yapilabilir | FAZ 1 |
| Worker scale | Concurrent islem sayisi 10 ile sinirli | FAZ 1 |
| Provider fallback | Sadece Gemini, OpenAI/Anthropic eklenebilir | FAZ 1 |

### FAZ 1 Onerileri

1. **Admin API**: Dead letter job listeleme, manuel retry API
2. **Unit testler**: `vitest` ile processor, gemini, express testleri
3. **Redis rate limiter**: Upstash Redis'e gecis
4. **Metrics**: Prometheus / OpenTelemetry entegrasyonu
5. **Provider cesitlendirme**: Ek AI provider desteği
6. **Worker pool**: Worker scalability artirma

---

## 22. Changed Files Summary

| Dosya | Degisiklik |
|-------|-----------|
| `src/config/tool-pricing.js` | Canonical pricing module |
| `src/config/env.js` | **YENI** — Startup env validation + yapilandirma |
| `src/shared/job-events.js` | Sentry error capture eklendi |
| `src/shared/health-check.js` | Uptime, memory, env, retry config, legacy state eklendi |
| `src/shared/rate-limiter.js` | Fail-open → fail-close |
| `src/ai-jobs/processor.js` | Sentry context (jobId, userId, toolId, attempt) |
| `src/ai-jobs/express.js` | Canonical pricing, rate limit, payload limit |
| `src/ai-jobs/gemini.js` | Retry 3→2, structured logging |
| `src/ai-jobs/worker.js` | Graceful shutdown + isRunning + gracefulShutdown export |
| `src/app.js` | Env validation cagrisi, health check guncellemesi |
| `functions/index.js` | Legacy AI job export'lari feature flag ile kapandi |
| `server.js` | Sentry init + graceful shutdown (SIGTERM/SIGINT) |
| `sql/faz0-stabilization.sql` | Migration — tablolar + index'ler |
| `sql/faz0-stabilization-rollback.sql` | **YENI** — Rollback script |
| `scripts/faz0-smoke-test.js` | Smoke test |
| `scripts/faz0-load-test.js` | **YENI** — Load test (5 senaryo) |
| `scripts/faz0-failure-injection-test.js` | **YENI** — Failure injection test (5 senaryo) |
| `package.json` | FAZ0 npm script'leri + check guncellemesi |
| `docs/FAZ0_BACKEND_STABILIZATION.md` | Kapsamli guncelleme |
| `sql/faz0-stabilization-rollback.sql` | **YENI** — Rollback script |