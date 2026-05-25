# Archilya WebPanel

Archilya müşteri paneli — Supabase Auth tabanlı, Next.js 16 App Router projesi.

## Gereksinimler

- Node.js 20
- npm 10+

## Ortam Değişkenleri

Proje kökünde bir `.env.local` dosyası oluşturun:

```env
# Supabase (Zorunlu)
NEXT_PUBLIC_SUPABASE_URL=https://supabase.archilya.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>

# Supabase Service Role (Sadece server-side API route'lar)
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# WebBackend API
NEXT_PUBLIC_BACKEND_API_URL=https://backend.archilya.com

# Uygulama
NEXT_PUBLIC_APP_URL=https://panel.archilya.com

# Sentry (Opsiyonel)
SENTRY_AUTH_TOKEN=<sentry_token>
SENTRY_DSN=<sentry_dsn>
SENTRY_ORG=<sentry_org>
SENTRY_PROJECT=<sentry_project>

# Upstash Redis (Rate limiting, opsiyonel)
UPSTASH_REDIS_REST_URL=<redis_url>
UPSTASH_REDIS_REST_TOKEN=<redis_token>
```

**Güvenlik notları:**
- `SUPABASE_SERVICE_ROLE_KEY` asla client bundle'a sızmamalıdır
- Sadece `NEXT_PUBLIC_*` ön ekli değişkenler client tarafında kullanılabilir
- Firebase yok — proje tamamen Supabase Auth ve backend API kullanır

## Geliştirme

```bash
npm run dev        # Webpack ile (önerilen)
npm run dev:turbo  # Turbopack ile
```

## Test

```bash
npm run test          # Unit test (Vitest)
npm run test:e2e      # E2E test (Playwright)
npm run test:e2e:ui   # E2E UI modu
```

## Build

```bash
npm run build
npm run analyze  # Bundle analizi
```

## Lint

```bash
npm run lint
```

## Mimari

- **Auth**: Supabase Auth (client: `@/lib/supabase/client`, server: `@/lib/supabase/server`, admin: `@/lib/supabase/admin`)
- **Backend çağrıları**: Server-side API route'lar üzerinden, Supabase access token ile
- **Veritabanı**: Supabase PostgreSQL (Realtime, Row-Level Security)
- **State**: React context + Supabase Realtime hooks
- **i18n**: next-intl (Türkçe varsayılan, İngilizce destek)
- **Hata izleme**: Sentry

## Deploy

Proje Vercel'e deploy edilir. Vercel environment variables yukarıdaki `.env.local` şablonuna göre ayarlanmalıdır.
