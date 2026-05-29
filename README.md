# Archilya Admin Panel

Archilya AI destekli mimari platformu için **B2B admin paneli**.

## Teknoloji Stack

| Teknoloji | Sürüm |
|---|---|
| Next.js | 16 (App Router) |
| React | 19 |
| TypeScript | 5 |
| Tailwind CSS | 4 |
| Supabase SSR | 0.10 |
| Supabase JS | 2.106 |

## Local Çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Development (Webpack ile — Windows/Turbopack sorunları için)
npm run dev

# Development (Turbopack ile — eğer çalışıyorsa)
npm run dev:turbo

# Production build
npm run build

# Production start
npm start
```

> **Not**: Windows'ta Turbopack sorun çıkarabileceği için varsayılan dev script `next dev --webpack` olarak ayarlanmıştır.

## Ortam Değişkenleri

`.env.example` dosyasını kopyalayıp `.env.local` oluşturun:

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.archilya.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_ADMIN_APP_URL=http://localhost:3001
NEXT_PUBLIC_ADMIN_API_BASE_URL=http://localhost:4000
```

### Production (admin.archilya.com)

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.archilya.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-anon-key>
NEXT_PUBLIC_ADMIN_APP_URL=https://admin.archilya.com
NEXT_PUBLIC_ADMIN_API_BASE_URL=https://api.archilya.com
```

### Asla ekleme (frontend'e kesinlikle koyulmamalı):

- `SUPABASE_SERVICE_ROLE_KEY`
- `FIREBASE_PRIVATE_KEY` / Firebase admin credential
- Herhangi bir `PRIVATE_KEY` veya `SECRET_KEY`

## Vercel Deploy

1. Projeyi Vercel'e bağlayın
2. Aşağıdaki env değişkenlerini Vercel Dashboard > Project Settings > Environment Variables'a ekleyin:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_ADMIN_APP_URL` = `https://admin.archilya.com`
   - `NEXT_PUBLIC_ADMIN_API_BASE_URL` = Backend admin API URL'si
3. Custom domain: `admin.archilya.com`
4. Build komutu otomatik algılanır (`next build`)

## Route Yapısı

| Route | Açıklama |
|---|---|
| `/giris` | Admin giriş sayfası |
| `/dashboard` | Ana dashboard |
| `/users` | Kullanıcı listesi |
| `/users/[id]` | Kullanıcı detayı |
| `/workspaces` | Workspace listesi |
| `/projects` | Proje listesi |
| `/credits` | Kredi işlemleri |
| `/subscriptions` | Abonelikler |
| `/render-jobs` | Render işleri |
| `/ai-jobs` | AI işleri |
| `/legacy/products` | Eski sistem ürünleri |
| `/legacy/plans` | Eski sistem planlar |
| `/legacy/orders` | Eski sistem siparişler |
| `/legacy/licenses` | Eski sistem lisanslar |
| `/legacy/machines` | Eski sistem makineler |
| `/legacy/launcher-releases` | Launcher sürümleri |
| `/audit-logs` | Denetim kaydı |
| `/settings` | Sistem ayarları |

## Güvenlik Modeli

```
Frontend (AdminPanel)                Backend (Admin API)
       │                                   │
       │  Supabase anon key + JWT          │
       │──────────────────────────────────►│
       │                                   │
       │  Bearer token ile istek           │
       │──────────────────────────────────►│
       │                                   │──► JWT verify
       │                                   │──► Admin role check
       │                                   │──► Audit log
       │                                   │──► Service role ops
       │◄──────────────────────────────────│
       │  Sadece UI için yetki kontrolü    │
```

**Kritik kurallar:**

1. **Frontend'de asla service_role key kullanılmaz.** Tüm admin işlemleri backend API üzerinden yapılır.
2. **Admin yetkisi frontend'de sadece UI gösterimi için kontrol edilir.** Gerçek yetkilendirme backend'de yapılır.
3. **Tüm admin API istekleri** kullanıcının Supabase access_token'ını `Authorization: Bearer <token>` olarak taşır.
4. **Backend'de** token doğrulama, admin rol kontrolü, audit log ve rate limit zorunludur.

## Admin API Client

API layer `src/lib/api/` içinde soyutlanmıştır:

- **`admin-client.ts`** — Tüm API çağrılarını yönetir. `NEXT_PUBLIC_ADMIN_API_BASE_URL` ayarlıysa gerçek backend'e istek atar.
- **`types.ts`** — API veri tipleri.
- **`mock-data.ts`** — Backend hazır olmadığında kullanılan mock veriler.

### Mock'tan Gerçek API'ye Geçiş

1. Backend Admin API'yi geliştirin ve deploy edin
2. `NEXT_PUBLIC_ADMIN_API_BASE_URL`'i backend URL'ine ayarlayın
3. `admin-client.ts` otomatik olarak gerçek API'yi kullanmaya başlar
4. Mock veri düşme durumunda fallback olarak kalır (API yanıt vermezse mock kullanılır)
5. Hiçbir frontend kodu değişikliği gerekmez

## Backend Admin API Beklentileri

Backend'de olması gereken endpoint'ler:

| Endpoint | Metot | Açıklama |
|---|---|---|
| `/admin/me` | GET | Mevcut admin bilgisi |
| `/admin/dashboard/stats` | GET | Dashboard istatistikleri |
| `/admin/users` | GET | Kullanıcı listesi |
| `/admin/users/:id` | GET | Kullanıcı detayı |
| `/admin/workspaces` | GET | Workspace listesi |
| `/admin/projects` | GET | Proje listesi |
| `/admin/credits` | GET | Kredi işlemleri |
| `/admin/subscriptions` | GET | Abonelik listesi |
| `/admin/render-jobs` | GET | Render işleri |
| `/admin/audit-logs` | GET | Denetim kaydı |
| `/admin/legacy/*` | GET | Legacy veriler |

Her endpoint **JWT doğrulaması**, **admin yetki kontrolü** ve **audit log** içermelidir.

## Proje Yapısı

```
src/
├── app/
│   ├── (auth)/
│   │   └── giris/
│   │       └── page.tsx          # Login sayfası
│   ├── (admin)/
│   │   ├── layout.tsx            # Admin layout (auth guard + shell)
│   │   ├── dashboard/page.tsx
│   │   ├── users/page.tsx
│   │   ├── users/[id]/page.tsx
│   │   ├── workspaces/page.tsx
│   │   ├── projects/page.tsx
│   │   ├── credits/page.tsx
│   │   ├── subscriptions/page.tsx
│   │   ├── render-jobs/page.tsx
│   │   ├── ai-jobs/page.tsx
│   │   ├── legacy/
│   │   ├── audit-logs/page.tsx
│   │   └── settings/page.tsx
│   ├── error.tsx
│   ├── layout.tsx                # Root layout (fontlar)
│   └── globals.css
├── components/
│   ├── auth/
│   │   ├── admin-auth-provider.tsx
│   │   ├── admin-auth-guard.tsx
│   │   └── login-form.tsx
│   ├── layout/
│   │   ├── admin-sidebar.tsx
│   │   ├── admin-topbar.tsx
│   │   └── admin-shell.tsx
│   └── ui/
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── table.tsx
│       ├── badge.tsx
│       ├── empty-state.tsx
│       └── loading-state.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   └── server.ts             # Server Supabase client
│   ├── api/
│   │   ├── types.ts              # API veri tipleri
│   │   ├── admin-client.ts       # Admin API client
│   │   └── mock-data.ts          # Mock veriler
│   └── auth/
│       └── admin-session.ts      # Server-side session utilities
```

## Geliştirme Notları

- Proje **sıfırdan** oluşturulmuştur — eski AdminPanel ile bağlantısı yoktur.
- Firebase veya Firestore kullanılmaz.
- Tüm auth Supabase üzerinden yapılır.
- Admin yetkilendirmesi backend API üzerinden kontrol edilmelidir.
- Vercel deploy'a hazırdır.
- Dark luxury tema WebPanel ile uyumludur (renk paleti aynıdır).
