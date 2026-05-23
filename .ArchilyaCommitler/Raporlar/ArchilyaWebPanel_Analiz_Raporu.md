# Archilya Web Panel — Detaylı Kod Analiz Raporu

> **Tarih:** 1 Mayıs 2026  
> **Proje:** ArchilyaWebPanel (`archilya-web-panel` v0.1.0)  
> **Stack:** Next.js 16.2.4 · React 19.2.4 · TypeScript 5 · Tailwind CSS v4 · Firebase  
> **Analiz Kapsamı:** Mimari yapı, kod kalitesi, güvenlik, performans, test ve eksik kısımlar

---

## 1. Proje Özeti

ArchilyaWebPanel, mimarlar ve ofisler için geliştirilmiş bir yönetim panelidir. Proje yönetimi, dosya arşivleme (PDF/DWG/Görsel), AI destekli render (AI Studyo), abonelik yönetimi, workspace bazlı ekip yönetimi ve marka özelleştirme özelliklerini kapsar.

### 1.1 Kullanılan Teknolojiler

| Katman | Teknoloji | Not |
|--------|-----------|-----|
| Framework | Next.js 16 (App Router) | React 19 concurrent features |
| Styling | Tailwind CSS v4 | `@tailwindcss/postcss` |
| UI Animasyon | Framer Motion | |
| Auth | Firebase Auth + Custom JWT Session | `jose` ile HS256 |
| Database | Firebase Firestore | Client-side persistence enabled |
| Storage | Firebase Storage | |
| Backend Logic | Firebase Functions + Next.js API Routes | |
| i18n | `next-intl` | Cookie bazlı locale (tr/en) |
| Monitoring | Sentry | |
| Testing | Vitest + Playwright | |
| Validasyon | Zod | |

---

## 2. Güçlü Yönler ✅

### 2.1 Mimari ve Organizasyon
- **App Router kullanımı:** Modern Next.js yapısı, `(auth)` ve `(dashboard)` route grupları ile iyi organize edilmiş.
- **Modüler yapı:** `lib/`, `hooks/`, `components/`, `services/`, `types/` olarak net ayrılmış.
- **RBAC (Rol Tabanlı Erişim Kontrolü):** `owner/admin/editor/viewer` hiyerarşisi ile iyi tanımlanmış izin matrisi.
- **Feature Flags:** `localStorage` bazlı feature flag sistemi mevcut; geliştirme/test süreçlerini kolaylaştırır.
- **Rate Limiting:** Her API route'unda `withRateLimit` wrapper'ı kullanılıyor.

### 2.2 Güvenlik
- **JWT Session Yönetimi:** Firebase ID token'ı custom JWT'ye çevrilip `httpOnly` cookie olarak saklanıyor.
- **Content Security Policy:** `next.config.ts` üzerinde CSP header'ları tanımlı.
- **Zod Validasyonu:** Tüm API body'leri Zod ile doğrulanıyor.
- **Re-authentication:** Hassas işlemler (şifre değiştirme, hesap silme) için yeniden kimlik doğrulama zorunlu.
- **Rate Limit:** API route'larında brute-force koruması mevcut.

### 2.3 Kullanıcı Deneyimi
- **PWA Desteği:** Manifest, service worker, Apple web app meta tag'leri mevcut.
- **Onboarding:** İlk girişte karşılama modali (`WelcomeModal`).
- **Klavye Kısayolları:** `KeyboardShortcutsHandler` bileşeni ile klavye desteği.
- **Responsive:** Tailwind breakpoint'leri ile mobil-uyumlu layout.
- **Real-time:** Firestore `onSnapshot` ile canlı proje listesi.
- **Soft Delete:** Projeler kalıcı silinmek yerine `isDeleted` flag'i ile çöp kutusuna taşınıyor (30 gün retention).

### 2.4 Kod Kalitesi
- **TypeScript Strict Mode:** `strict: true` aktif.
- **Path Aliases:** `@/*` ile temiz import'lar.
- **Converter Pattern:** Firestore converter kullanımı (`projectConverter`).
- **Error Boundaries:** `error.tsx` dosyaları mevcut.
- **Activity Logging:** Proje ve dosya işlemleri için activity log kaydı tutuluyor.

---

## 3. Kritik Sorunlar ve Güvenlik Açıkları 🚨

### 3.1 Sabit Geliştirme Sırrı (CRITICAL)
**Konum:** `src/lib/auth/session.ts:18`

```typescript
const DEV_SESSION_SECRET = "archilya-web-panel-local-session-secret-change-me";
```

**Risk:** Eğer `PANEL_SESSION_SECRET` env değişkeni üretim ortamında tanımlanmazsa, bu sabit değer kullanılır ve JWT'ler kırılabilir.  
**Öneri:** Uygulama başlangıcında secret kontrolü yapılmalı; eksikse uygulama başlatılmamalı.

### 3.2 Rate Limiting — Bellek Tabanlı (CRITICAL)
**Konum:** `src/lib/api/rate-limit.ts:13`

```typescript
const store = new Map<string, RateLimitEntry>();
```

**Risk:** Vercel gibi serverless ortamlarda her istek farklı bir instance tarafından işlenir. `Map` bellekte saklandığı için rate limiting **hiçbir işe yaramaz**.  
**Öneri:** Redis (Upstash Redis gibi) veya Vercel KV'ye geçilmeli.

### 3.3 Viewer Rolü İzin Hatası (HIGH)
**Konum:** `src/lib/rbac/permissions.ts:63-66`

```typescript
viewer: [
  "project.update",   // ❌ Sadece görüntüleme yapmalı
  "settings.view",
],
```

**Risk:** `viewer` rolüne verilen `project.update` izni, salt okunur kullanıcıların proje verilerini değiştirmesine olanak tanır.  
**Öneri:** `viewer` rolünden `"project.update"` kaldırılmalı.

### 3.4 Dosya İsim Sanitizasyonu Yetersiz (HIGH)
**Konum:** `src/lib/projects/service.ts:50-52`

```typescript
function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
```

**Risk:** `..`, `~`, boşluk karakterleri ve unicode traversal karakterleri filtrelenmiyor.  
**Öneri:** Daha kapsamlı bir sanitizasyon veya `path.basename()` + güçlü regex kullanılmalı.

### 3.5 Eksik Auth Kontrolü API Route'larında (MEDIUM)
**Konum:** Bazı API route'ları (örneğin `ai-studio/jobs/`, `health/` hariç)

**Risk:** Subscription ve credits API'ları sadece `idToken` doğruluyor; kullanıcının gerçekten ilgili workspace'e yetkisi olup olmadığı kontrol edilmiyor.  
**Öneri:** Her API route'unda `requireSessionUser()` + workspace membership kontrolü eklenmeli.

---

## 4. Mimari ve Kod Kalitesi Sorunları ⚠️

### 4.1 Monolitik Sayfa Bileşenleri
**Konum:** `src/app/(dashboard)/page.tsx` — **727 satır**

Bu dosya içinde şu bileşenler tanımlı:
- `DetailModal`
- `AddProjectModal`
- `UploadModal`
- `DeleteModal`
- `BulkDeleteModal`
- `SectionHeader`
- `DashboardPage` (ana sayfa)

**Sorun:** Tek dosyada birden faz bileşen; bakım zorluğu, test edilemezlik, kod tekrarı.  
**Öneri:** Her modal `components/dashboard/modals/` altına ayrı dosyalara taşınmalı. Ortak bir `ModalShell` bileşeni oluşturulmalı.

### 4.2 Tekrar Eden Utility Fonksiyonları
Aşağıdaki fonksiyonlar `page.tsx` içinde tanımlı ama genel kullanıma uygun:
- `formatBytes(bytes: number)`
- `timeAgo(value: unknown)`

**Öneri:** `src/lib/utils/format.ts` gibi bir dosyaya taşınmalı.

### 4.3 Hata Yönetimi — Sessiz Başarısızlıklar
**Konum:** `src/hooks/use-projects.ts:81`

```typescript
catch {
  // Silently fail
}
```

Activity log kaydedilemezse hata hiçbir yere gitmiyor. Debug edilemez.  
**Öneri:** En azından `console.error` ile loglanmalı; tercihen Sentry'ye gönderilmeli.

### 4.4 Firestore Array Limiti Riski
**Konum:** `src/lib/projects/service.ts:136-143`

```typescript
activityLog: [
  {
    action: "create",
    user: ownerName || ownerEmail || "Kullanıcı",
    timestamp: createdAt.toISOString(),
    details: "Proje oluşturuldu.",
  },
],
```

Firestore doküman boyutu **1MB** ile sınırlıdır. Yoğun kullanımda `activityLog` ve `files` array'leri bu limiti aşabilir.  
**Öneri:** Activity log'ları ayrı bir `project_activities` koleksiyonunda subcollection olarak tutulmalı.

### 4.5 İsimlendirme Tutarsızlığı
- `ai-studio/` (API route)
- `ai-studyo/` (dashboard route ve API route)

Türkçe/İngilizce karışımı. URL yapısı tutarsız.

### 4.6 Form Yönetimi
Tüm formlar manuel state yönetimi ile (`useState`) kontrol ediliyor.  
**Öneri:** `react-hook-form` + `@hookform/resolvers/zod` entegrasyonu düşünülmeli.

---

## 5. Eksikler ve Geliştirilmesi Gereken Alanlar 🔧

### 5.1 Test Kapsamı (Çok Yetersiz)

| Test Türü | Mevcut | Gerekli |
|-----------|--------|---------|
| Unit Test | 2 dosya | 20+ |
| E2E Test | 0 (e2e/ klasörü boş) | Temel akışlar için minimum 5-10 |
| Integration Test | 0 | API route'ları için |

**Mevcut testler:**
- `src/lib/rbac/permissions.test.ts` ✅
- `src/lib/feature-flags/config.test.ts` ✅

**Eksik test alanları:**
- `lib/auth/session.ts` (JWT oluşturma/doğrulama)
- `lib/projects/service.ts` (tüm CRUD operasyonları)
- `lib/api/rate-limit.ts`
- `hooks/` altındaki tüm custom hook'lar
- `components/` bileşenleri (React Testing Library)
- API route'ları

### 5.2 Cache ve State Yönetimi
- **React Query / SWR kullanımı yok:** Firestore verileri için caching, background refetch, optimistic updates gibi özellikler manuel implemente edilmiş.
- **Server Cache:** `unstable_cache` veya `fetch` cache stratejisi görünmüyor.
- **Zustand / Redux:** Küresel state yönetimi için sadece React Context kullanılıyor; büyük ölçekte yetersiz kalabilir.

### 5.3 Erişilebilirlik (a11y)
- `maximumScale: 1` ve `userScalable: false` erişilebilirlik ihlali (WCAG 1.4.4, 1.4.10).
- Bazı `img` etiketleri `next/image` yerine düz `<img>` kullanıyor.
- Modal bileşenlerinde `aria-labelledby`, `aria-describedby` eksik.
- Form hatalarında `aria-invalid` ve `aria-errormessage` kullanımı yok.

### 5.4 PWA ve Offline
- Service worker kaydı mevcut ama offline-first strateji yok.
- Firestore `persistentLocalCache` aktif ama offline UI indicator yok.

### 5.5 İşletme Sürekliliği
- Firestore `onSnapshot` dinleyicilerinde yeniden bağlanma (reconnect) mekanizması yok.
- Bağlantı kesilme durumunda kullanıcı bilgilendirilmiyor.

### 5.6 API Endpoint Güvenlik Zırhı
Aşağıdaki endpoint'lerde eksiklikler:

| Endpoint | Eksiklik |
|----------|----------|
| `POST /api/ai-studio/jobs` | Workspace yetki kontrolü |
| `POST /api/credits/deduct` | Idempotency key yok (çift çekme riski) |
| `POST /api/subscription/change` | Transaction yok (race condition) |
| `POST /api/branding/update` | Sadece idToken, workspace admin kontrolü eksik |

### 5.7 Veritabanı İndeksleri
`firestore.indexes.json` dosyası boş olabilir. `projects` koleksiyonundaki `memberUids` + `createdAt` composite index'i gerekli.

### 5.8 Loglama ve Gözlemlenebilirlik
- Structured logging yok.
- API route'larında request/response loglama yok.
- Sadece client-side Sentry mevcut; server-side Sentry entegrasyonu var ama API route hataları için custom scope yok.

### 5.9 Performans
- Bundle analizi (`npm run analyze`) script'i var ama düzenli kullanılıp kullanılmadığı belirsiz.
- `framer-motion` tüm sayfada kullanılıyor; `lazy` import ile code-splitting yapılabilir.
- Dashboard sayfası `use client` — Server Component kullanımı artırılabilir.

### 5.10 Masaüstü Uygulama Butonu
Dashboard'da "Masaüstü Uygulama" butonu var ama herhangi bir indirme/link fonksiyonelliği yok.

### 5.11 Şifre Politikası
`validatePasswordPolicy` sadece kayıtta (`signup`) kullanılıyor. Şifre değiştirme (`updateUserPassword`) aynı politikayı zorlamıyor.

### 5.12 i18n Tamamlanmamışlık
Dashboard sayfasındaki tüm metinler hardcoded Türkçe. `messages/tr.json` ve `messages/en.json` dosyaları kullanılıyor ama dashboard içeriği bunlardan beslenmiyor.

---

## 6. Önerilen Öncelik Sırası

### Aşama 1: Kritik Güvenlik (Acil — 1-2 Hafta)
1. `DEV_SESSION_SECRET` kaldırılacak; uygulama secret olmadan başlamayacak.
2. Rate limiting Redis'e taşınacak.
3. `viewer` rolünden `"project.update"` izni kaldırılacak.
4. `sanitizeFileName` güçlendirilecek.
5. API route'larına workspace yetki kontrolü eklenecek.

### Aşama 2: Mimari İyileştirme (2-4 Hafta)
6. Dashboard `page.tsx` bileşenlere bölünecek.
7. Activity log subcollection'a taşınacak.
8. `formatBytes`, `timeAgo` gibi utility'ler ortaklaştırılacak.
9. `ai-studio` / `ai-studyo` isimlendirme tutarlı hale getirilecek.
10. `react-hook-form` entegrasyonu başlatılacak.

### Aşama 3: Test ve Kalite (4-6 Hafta)
11. Unit test coverage %60+ hedeflenecek.
12. E2E testleri yazılacak (login, proje CRUD, dosya yükleme).
13. API route integration testleri yazılacak.
14. `playwright.config.js` kaldırılacak (`.ts` ile duplicate).

### Aşama 4: Performans ve DX (6-8 Hafta)
15. Server Component kullanımı artırılacak.
16. React Query / SWR entegrasyonu değerlendirilecek.
17. Bundle size optimizasyonu.
18. i18n tamamlanacak (tüm string'ler `messages/` dosyalarına taşınacak).
19. Erişilebilirlik düzenlemeleri (viewport scale, aria attribute'ları).

---

## 7. Özet Tablo

| Kategori | Durum | Puan (1-10) |
|----------|-------|-------------|
| Mimari Yapı | İyi organize ama monolitik bileşenler var | 7 |
| Güvenlik | JWT + CSP + Rate Limit var ama kritik açıklar mevcut | 5 |
| Kod Kalitesi | TypeScript strict, güzel ayrım ama tekrarlar var | 6 |
| Test Kapsamı | Çok yetersiz | 2 |
| Performans | PWA + caching var ama optimize edilebilir | 6 |
| Erişilebilirlik | Temel eksiklikler var | 4 |
| Dokümantasyon | README varsayılan create-next-app metni | 3 |
| i18n | Altyapı var ama içerik tamamlanmamış | 4 |

**Genel Değerlendirme:** Proje modern bir stack üzerine kurulmuş, iyi bir temel mimariye sahip. Ancak kritik güvenlik açıkları (sabit secret, bellek-tabanlı rate limiting), yetersiz test kapsamı ve monolitik bileşenler nedeniyle üretime geçmeden önce Aşama 1 ve Aşama 2 iyileştirmeleri şiddetle tavsiye edilir.

---

*Rapor hazırlayan: Cline (AI Software Engineer)*  
*Not: Bu rapor statik kod analizine dayanır. Runtime davranışları ve iş gereksinimleri için ek inceleme önerilir.*
