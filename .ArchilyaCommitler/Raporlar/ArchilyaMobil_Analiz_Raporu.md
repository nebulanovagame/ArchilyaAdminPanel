# Archilya Mobil — Detaylı Kod Analiz Raporu

> **Tarih:** 1 Mayıs 2026  
> **Proje:** ArchilyaMobil (`archilyatelefonuygulamasi` v1.0.0)  
> **Stack:** Expo SDK 55 · React Native 0.83.2 · React 19 · TypeScript 5.9 · Firebase · Tailwind CSS v3 (NativeWind)  
> **Analiz Kapsamı:** Mimari yapı, kod kalitesi, güvenlik, performans, test ve eksik kısımlar

---

## 1. Proje Özeti

ArchilyaMobil, mimarlar ve ofisler için geliştirilmiş mobil yönetim uygulamasıdır. Proje yönetimi, dosya arşivleme, AI destekli render (AI Studio), kredi/abonelik yönetimi, workspace bazlı ekip yönetimi, push bildirimler ve çevrimdışı çalışma özelliklerini kapsar.

### 1.1 Kullanılan Teknolojiler

| Katman | Teknoloji | Not |
|--------|-----------|-----|
| Framework | Expo SDK 55 | Expo Router (file-based routing) |
| Runtime | React Native 0.83.2 | React 19.2.0 |
| Styling | NativeWind v2 | Tailwind CSS v3.3.2 sınıfları |
| Auth | Firebase Auth | Email/şifre + Google Sign-In |
| Database | Firebase Firestore | Client-side caching (AsyncStorage) |
| Storage | Firebase Storage + R2 (Cloudflare) | `r2StorageService.js` |
| Backend Logic | Firebase Functions (europe-west1) | `httpsCallable` ile çağrı |
| AI/ML | Gemini (via Firebase Functions) | AI Studio araçları |
| Monitoring | Sentry React Native | `EXPO_PUBLIC_SENTRY_DSN` env |
| Analytics | Custom + Sentry | `trackEvent`, `trackPageView` |
| Push Notifications | expo-notifications | |
| PDF | `@kishannareshpal/expo-pdf` + `react-native-pdf-thumbnail` | |

---

## 2. Güçlü Yönler ✅

### 2.1 Mimari ve Organizasyon
- **Expo Router kullanımı:** File-based routing ile `(tabs)`, `(auth)` grupları net ayrılmış.
- **Modüler yapı:** `src/components/`, `src/hooks/`, `src/services/`, `src/context/`, `src/utils/` olarak organize edilmiş.
- **Secure Callable Pattern:** Tüm kritik işlemler (proje CRUD, kredi düşme, abonelik) Firebase Functions üzerinden `Secure` suffix'lu callable'lar ile yapılıyor. Bu, client-side yetkilendirme zafiyetlerini büyük ölçüde engeller.
- **Offline Cache:** `useProjects` hook'unda AsyncStorage tabanlı proje cache'i mevcut; Firestore verisi önce cache'ten hidrate ediliyor.
- **Error Tracking:** Sentry entegrasyonu kapsamlı — `captureException`, `setUserContext`, `setRouteContext`, `navigationIntegration` mevcut.
- **Analytics:** Sayfa görünümleri ve olaylar izleniyor.
- **Push Notification Handling:** `usePushNotifications` hook'u ile bildirim açma navigasyonu (`project/[id]`, `workspace`, `ai-history`, `inbox`) destekleniyor.
- **AI Prompt Engineering:** `aiStudioService.js` içinde oldukça detaylı ve profesyonel prompt'lar tanımlı; Türkçe/İngilizce ayrımı yapılmış.
- **Image Pipeline:** Görsel ön işleme (resize, compress, base64 dönüşümü), PDF'den görsele çevirme, content URI/remote URI farkındalığı mevcut.
- **File Upload Queue:** `useProjectUploadQueue` ile arka planda dosya yükleme kuyruğu yönetimi.

### 2.2 Güvenlik
- **Firebase Functions Secure Callable'lar:** Tüm iş mantığı sunucuda; client sadece çağrı yapıyor.
- **Error Mesaj Normalizasyonu:** AI servis hataları kullanıcı dostu mesajlara çevriliyor.
- **Sentry Scrubbing:** `__DEV__` kontrolü ile development log'ları ayrılmış.

### 2.3 Kullanıcı Deneyimi
- **PWA/Web Desteği:** `expo-web-browser`, `react-native-web` ile web çıktısı mevcut.
- **Splash Screen Yönetimi:** Font yüklenene kadar splash screen gösteriliyor.
- **Platform Farkındalığı:** iOS/Android için tab bar yüksekliği farklı (`Platform.OS === 'ios'`).
- **Dark Theme:** `@react-navigation/native` `DarkTheme` kullanılıyor.
- **Google Sign-In:** `@react-native-google-signin/google-signin` ile native Google girişi.

---

## 3. Kritik Sorunlar ve Güvenlik Açıkları 🚨

### 3.1 Firebase API Key ve Config Açık (MEDIUM)
**Konum:** `src/config/firebase.ts:7-13`

```typescript
const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCfmz3gjf_x3iQ5Ud_mJ-kHjOTpEmDYQtM',
  // ...
};
```

**Risk:** Firebase API key'ler client-side'da görünür olmak zorundadır, ancak bu config dosyasında `databaseURL` gibi ek alanlar olmadığı için sınırlıdır. Yine de, kötü niyetli kullanıcılar bu key'i kendi projelerinde kullanabilir (quota tüketimi).  
**Öneri:** Firebase Console üzerinden API key kısıtlamaları (app fingerprint, referrer kısıtlaması) eklenmeli.

### 3.2 Google OAuth Client ID'leri Açık (MEDIUM)
**Konum:** `app.json:62-66`

```json
"googleAuth": {
  "expoClientId": "782938691094-0m2snmr1a19jegdl6curi1teh3j8a5tp.apps.googleusercontent.com",
  "androidClientId": "782938691094-aovg2r9d70pnkk5j57hrj9j5mv5ln5to.apps.googleusercontent.com",
  "webClientId": "..."
}
```

**Risk:** Android client ID reverse-engineering ile elde edilebilir; bu kaçınılmazdır ama Google Console'da SHA-1 fingerprint kısıtlaması yapılmalı.

### 3.3 Sentry DSN Env Değişkeni (LOW)
**Konum:** `src/services/errorTracking.ts:4`

```typescript
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
```

**Risk:** `EXPO_PUBLIC_` prefix'li değişkenler build sırasında client-side'a gömülür. Sentry DSN'ler genelde public'tir ama kötü niyetli kullanıcılar bu DSN'ye fake event gönderebilir.  
**Öneri:** Sentry projesinde rate limiting ve domain kısıtlaması yapılmalı.

### 3.4 AI Studio İmaj Dönüşümünde Güvenli Eksiklik (LOW)
**Konum:** `src/services/aiStudioService.js:234-241`

```typescript
function buildTempFilePath(extension = 'jpg') {
  const ext = String(extension || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  return `${cacheDir}ai-input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}
```

**Risk:** `Math.random()` ile dosya adı oluşturulması teorik olarak çakışma riski taşır (çok düşük ihtimal).  
**Öneri:** `crypto.randomUUID()` veya `expo-crypto` kullanılmalı.

---

## 4. Mimari ve Kod Kalitesi Sorunları ⚠️

### 4.1 TypeScript / JavaScript Karışımı
Proje `tsconfig.json` ile TypeScript strict mode aktif olmasına rağmen birçok dosya `.js` uzantılı:
- `src/context/AuthContext.js`
- `src/hooks/useProjects.js`
- `src/hooks/useCredits.js`
- `src/hooks/useNotifications.js`
- `src/hooks/useInvitations.js`
- `src/hooks/useWorkspace.js`
- `src/hooks/useAiHistory.js`
- `src/hooks/useFileUpload.js`
- `src/hooks/usePushNotifications.js`
- `src/services/aiService.js`
- `src/services/aiStudioService.js`
- `src/services/aiTransformService.js`
- `src/services/entitlementService.js`
- `src/services/mediaService.js`
- `src/services/pdfService.js`
- `src/services/pushNotificationService.js`
- `src/services/r2StorageService.js`

**Sorun:** Type safety yok; runtime hataları derleme aşamasında yakalanamıyor.  
**Öneri:** Tüm `.js` dosyaları `.ts` / `.tsx`'e dönüştürülmeli.

### 4.2 `any` Kullanımı (TypeScript Anti-Pattern)
**Konum:** `app/(tabs)/_layout.tsx:12`, `app/(tabs)/index.tsx:25`, `app/_layout.tsx:37`, vb.

```typescript
const { workspaceInvites } = useWorkspace() as any;
const { userData, logout } = useAuth() as any;
const { user, userData, loading } = useAuth() as any;
```

**Sorun:** `as any` kullanımı TypeScript'in temel amacını ortadan kaldırıyor.  
**Öneri:** Tüm context ve hook'lar için tip tanımları oluşturulmalı.

### 4.3 Monolitik Dashboard Sayfası
**Konum:** `app/(tabs)/index.tsx` — **206 satır**

Bu dosya içinde:
- Stats hesaplama
- Proje listesi render
- Modal yönetimi
- Hızlı işlemler grid'i
- Masaüstü uygulama indirme butonu

**Sorun:** Birden fazla sorumluluk tek dosyada.  
**Öneri:** `components/dashboard/` altına `StatsCards`, `QuickActionsGrid`, `RecentProjectsList` gibi bileşenler çıkarılmalı.

### 4.4 Firestore Snapshot Memory Leak Riski
**Konum:** `src/hooks/useProjects.js:92-114`

```typescript
const unsubOwner = onSnapshot(ownerQ, ...);
const unsubMember = onSnapshot(memberQ, ...);
```

**Sorun:** İki ayrı `onSnapshot` dinleyici aynı anda çalışıyor. Component unmount olduğunda cleanup yapılıyor ama; eğer kullanıcı hızlıca giriş/çıkış yaparsa veya network değişirse, snapshot listener'lar birikme yapabilir.  
**Öneri:** Tek bir composite query (örneğin `where('memberUids', 'array-contains', user.uid)` ile owner'ı da içeren bir alan) veya Firestore transaction kullanılmalı.

### 4.5 AsyncStorage Cache — Veri Tutarsızlığı Riski
**Konum:** `src/hooks/useProjects.js:47-61`

```typescript
AsyncStorage.getItem(cacheKey)
  .then((cached) => {
    if (!cached) return;
    const rows = JSON.parse(cached);
    // ...
    setProjects(hydrated);
    setLoading(false);
  })
  .catch(() => null);
```

**Sorun:** Cache'ten okunan veri `Date` objesine çevriliyor ama eğer cache bozulursa (`JSON.parse` hatası) sessizce fail oluyor. Ayrıca, Firestore'dan gelen güncel veri cache'ten eski verinin üzerine yazılıyor ama kullanıcı cache verisini görüyor.  
**Öneri:** Cache invalidation stratejisi (timestamp, version) eklenmeli.

### 4.6 Offline-First Eksikliği
Firestore `onSnapshot` kullanılıyor ama:
- `persistentLocalCache` veya `enableIndexedDbPersistence` aktif değil (mobil için `AsyncStorage` kullanılıyor ama bu Firestore'un native offline cache'i değil).
- Network durum değişikliklerinde kullanıcı bilgilendirilmiyor.
- `@react-native-community/netinfo` bağımlılığı var ama offline UI indicator yok.

### 4.7 Image Manipulator Hata Yönetimi
**Konum:** `src/services/aiStudioService.js:332-357`

```typescript
for (let i = 0; i < AI_IMAGE_TRANSFORM_STEPS.length; i += 1) {
  try {
    const transformed = await ImageManipulator.manipulateAsync(...);
    // ...
  } catch (error) {
    lastError = error;
  }
}
```

**Sorun:** Her adımda hata yakalanıyor ama hangi adımın neden başarısız olduğu loglanmıyor.  
**Öneri:** Her adım için `captureException` ile Sentry'ye bilgi gönderilmeli.

### 4.8 Push Notification Token Kaydı — Hata Yönetimi
**Konum:** `src/services/pushNotificationService.js` (varsayımsal — dosya mevcut ama içerik incelenmedi)

Push token kaydedilemezse (network hatası, permission reddi) kullanıcı bilgilendirilmiyor.

### 4.9 Hardcoded URL'ler
**Konum:** `app/(tabs)/index.tsx:22`

```typescript
const LAUNCHER_URL = 'https://github.com/nebulanovagame/ArchilyaLauncher/releases/latest/download/Archilya-Launcher-Setup.exe';
```

**Sorun:** URL değişirse uygulama store'a yeniden gönderilmeli.  
**Öneri:** Remote config (Firebase Remote Config) veya API'den çekilmeli.

### 4.10 İsimlendirme Tutarsızlığı
- `aiStudioService.js` (servis) vs `ai-history.tsx` (sayfa) — İngilizce/Türkçe karışımı.
- `src/components/SearchModal.tsx` vs `src/components/ai/` (klasör yapısı tutarsız).

---

## 5. Eksikler ve Geliştirilmesi Gereken Alanlar 🔧

### 5.1 Test Kapsamı (Çok Yetersiz)

| Test Türü | Mevcut | Gerekli |
|-----------|--------|---------|
| Unit Test | `jest` preset'i tanımlı | Hooks ve servisler için test yok |
| Component Test | `@testing-library/react-native` bağımlılığı var | 0 test |
| E2E Test | 0 | Maestro / Detox ile temel akışlar |

**Eksik test alanları:**
- `useProjects` (cache, snapshot, CRUD)
- `useAuth` (giriş, çıkış, Google Sign-In)
- `aiStudioService` (prompt build, image transform)
- `entitlementService` (tüm secure callable'lar)
- `errorTracking` (Sentry wrapper'ları)
- Bileşenler (`SearchModal`, `ProjectCreateModal`, vb.)

### 5.2 State Yönetimi
- **Zustand / Redux / Jotai yok:** Tüm state React Context + `useState` ile yönetiliyor.
- **Global Loading State:** Her hook kendi `loading` state'ini tutuyor; global bir loading indicator yönetimi yok.
- **Optimistic Updates:** Proje ekleme/silme işlemlerinde UI hemen güncellenmiyor; Firebase Functions cevabı bekleniyor.

### 5.3 Form Yönetimi
Tüm formlar manuel state yönetimi ile (`useState`) kontrol ediliyor:
- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`
- `src/components/ProjectCreateModal.tsx`

**Öneri:** `react-hook-form` + `@hookform/resolvers/zod` entegrasyonu.

### 5.4 i18n (Ulusallaştırma)
Tüm metinler hardcoded Türkçe. Web panelinde `next-intl` kullanılıyor ama mobilde hiçbir i18n kütüphanesi yok.

### 5.5 Erişilebilirlik (a11y)
- `TouchableOpacity` bileşenlerinde `accessibilityLabel` ve `accessibilityHint` eksik.
- Form input'larında `accessibilityRole` tanımlı değil.
- Screen reader desteği (TalkBack/VoiceOver) test edilmemiş.

### 5.6 Performans
- **Re-renders:** `useProjects` içindeki `normalize` fonksiyonu her snapshot'ta yeni array oluşturuyor; `useMemo` ile optimize edilebilir.
- **Image Caching:** Remote görseller için `expo-image` veya `react-native-fast-image` kullanılmıyor.
- **Bundle Size:** `lucide-react-native` tüm ikonları import ediyor; tree-shaking kontrol edilmeli.
- **AI Prompt'lar:** `aiStudioService.js` 817 satır; bu dosya lazy load edilebilir.

### 5.7 Deep Linking
- `scheme: "archilya"` tanımlı ama deep link handler'ları (`expo-linking`) incelenemedi.
- Push notification ile gelen `projectId` navigasyonu var ama universal links (iOS/Android) yapılandırması belirsiz.

### 5.8 App Store / Play Store Hazırlığı
- `app.json` içinde `ios` yapılandırması çok az (`supportsTablet: true` dışında bir şey yok).
- `infoPlist` ayarları eksik (örneğin `NSPhotoLibraryUsageDescription` zaten `expo-image-picker` plugin'inde ama diğer izinler belirsiz).
- `android` için `permissions` listesi tanımlı değil.

### 5.9 Backup ve Veri Taşınabilirliği
- Kullanıcı verilerini dışa aktarma (export) özelliği yok.
- Proje ve AI geçmişi yedekleme mekanizması yok.

### 5.10 Kredi ve Abonelik Yönetimi
- `useCredits` hook'u mevcut ama kredi bakiyesi negatif olabilir mi? (server-side kontrol var ama client-side gösterimde ek kontrol yok).
- Abonelik iptali (cancel) flow'u mobilde mevcut mu belirsiz.

### 5.11 EAS (Expo Application Services) Yapılandırması
- `eas.json` mevcut ama içeriği incelenemedi.
- `android/app/google-services.json` dosyası `.gitignore`'da mı? (güvenlik riski)

---

## 6. Önerilen Öncelik Sırası

### Aşama 1: Temel Kalite ve Güvenlik (Acil — 1-2 Hafta)
1. Tüm `.js` dosyaları `.ts` / `.tsx`'e dönüştürülecek.
2. `as any` kullanımları kaldırılacak; tip tanımları oluşturulacak.
3. Firebase API key kısıtlamaları (app fingerprint) eklenecek.
4. `android/app/google-services.json` `.gitignore`'a alınacak (değilse).
5. Sentry DSN rate limiting yapılandırılacak.

### Aşama 2: Mimari İyileştirme (2-4 Hafta)
6. Dashboard `index.tsx` bileşenlere bölünecek.
7. `useProjects` içindeki `normalize` fonksiyonu `useMemo` ile optimize edilecek.
8. Global state yönetimi (Zustand) değerlendirilecek.
9. `react-hook-form` entegrasyonu başlatılacak.
10. Offline-first strateji (Firestore `persistentLocalCache` + NetInfo indicator) eklenecek.

### Aşama 3: Test ve Kalite (4-6 Hafta)
11. Unit test coverage %50+ hedeflenecek.
12. `@testing-library/react-native` ile bileşen testleri yazılacak.
13. E2E testleri (Maestro/Detox) planlanacak.
14. Image manipulator hata log'ları Sentry'ye gönderilecek.

### Aşama 4: Kullanıcı Deneyimi ve Performans (6-8 Hafta)
15. i18n altyapısı kurulacak (`react-i18next` veya `i18n-js`).
16. Erişilebilirlik attribute'ları eklenecek.
17. Image caching (`expo-image`) entegrasyonu.
18. Deep linking ve universal links tamamlanacak.
19. Bundle size analizi ve optimizasyonu.

---

## 7. Özet Tablo

| Kategori | Durum | Puan (1-10) |
|----------|-------|-------------|
| Mimari Yapı | Expo Router iyi ama JS/TS karışımı, `any` kullanımı fazla | 6 |
| Güvenlik | Secure callable pattern güçlü ama API key kısıtlaması eksik | 7 |
| Kod Kalitesi | Prompt engineering çok iyi ama tip güvenliği zayıf | 5 |
| Test Kapsamı | Jest preset'i var ama test yok | 1 |
| Performans | Cache ve queue mevcut ama optimize edilebilir | 6 |
| Erişilebilirlik | Temel eksiklikler var (label, role) | 3 |
| Offline Çalışma | AsyncStorage cache var ama native offline desteği yetersiz | 4 |
| i18n | Tamamen hardcoded Türkçe | 2 |
| DX (Developer Experience) | Sentry, analytics iyi ama TS strict değil | 5 |

**Genel Değerlendirme:** ArchilyaMobil, Expo ve Firebase ekosisteminde modern bir mobil uygulama olarak iyi bir temele sahip. AI Studio servisinin prompt engineering kalitesi ve secure callable pattern'ı projenin en güçlü yönleri. Ancak TypeScript kullanımının yetersizliği (`as any`, `.js` dosyaları), test kapsamının sıfıra yakın olması ve i18n/a11y eksiklikleri nedeniyle üretim öncesi ciddi bir refactor ve test yazım süreci gerekiyor.

---

*Rapor hazırlayan: Cline (AI Software Engineer)*  
*Not: Bu rapor statik kod analizine dayanır. Runtime davranışları ve iş gereksinimleri için ek inceleme önerilir.*
