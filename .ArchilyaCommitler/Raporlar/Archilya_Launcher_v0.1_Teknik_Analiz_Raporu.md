# Archilya Launcher v0.1 — Teknik Analiz Raporu

> **Hazırlayan:** Kararga Teknik İstihbarat  
> **İnceleme Tarihi:** 02 Mayıs 2026  
> **İnceleme Alanı:** `C:\NNG\proje61\Archilya\ArchilyaLauncher`  
> **Metodoloji:** Kaynak kod bizzat okundu. Hiçbir harici ekosistem raporuna başvurulmadı.

---

## 1. ALTYAPI TESPİTİ

### 1.1 Temel Teknoloji Yığını

| Katman | Teknoloji | Sürüm | Not |
|--------|-----------|-------|-----|
| **Çerçeve (Framework)** | Electron | `^40.0.0` | Güncel, Chromium tabanlı masaüstü kabuk |
| **Paketleyici** | electron-builder | `^26.4.0` | NSIS Windows installer, auto-update destekli |
| **Frontend Runtime** | React | `^19.2.0` | En son kararlı sürüm |
| **Build Aracı** | Vite | `^7.2.4` | Hızlı HMR ve üretim derlemesi |
| **Dil** | TypeScript | `~5.9.3` | Ana süreç + renderer ayrı tsconfig'lerle |
| **Stil** | Tailwind CSS | `^4.1.18` | Utility-first CSS |

### 1.2 Misyon Kritik Bağımlılıklar

- **`electron-updater`** `^6.7.3` → Otomatik güncelleme (GitHub Releases üzerinden).
- **`electron-store`** `^8.1.0` → Yerel persist (oturum, kullanıcı ayarları).
- **`electron-log`** `^5.4.3` → Yapılandırılmış loglama (dosya + konsol).
- **`firebase`** `^12.10.0` → Auth, Firestore, Functions, Storage SDK.
- **`axios`** `^1.13.2` → HTTP istemcisi (indirme, API çağrıları).
- **`extract-zip`** `^2.0.1` → 4GB+ zip64 destekli çıkarma.
- **`keytar`** `^7.9.0` → Sistem anahtar zinciri entegrasyonu (mevcut kodda doğrudan kullanılmıyor, depoda).
- **`localtunnel`** `^2.0.2` → Web paylaşım tüneli (pixel-streaming).
- **`chokidar`** `^3.6.0` → Dosya sistemi izleme (senkronizasyon).

### 1.3 Mimari Yapı

```
electron/
  main.ts          → Ana süreç (BrowserWindow, Tray, AutoUpdater, IPC üst düzey)
  preload.ts       → ContextBridge API exposer (güvenli renderer↔main köprüsü)
  projectManager.ts→ VR Proje yönetimi (PAK indirme, başlatma, disk sync)
src/main/
  ipcHandlers.ts   → Tüm IPC handler'ların merkezi kaydı
  firebase.ts      → Firebase SDK init (sabit config, .env'den bağımsız)
  services/
    authService.ts → Email/Google/Guest login, otomatik giriş, şifre yönetimi
    streamingOrchestrator.ts → Pixel Streaming / Web Share altyapısı
    syncService.ts → Proje dosya senkronizasyonu
    ...
src/renderer/
  main.tsx         → React uygulama girişi
```

---

## 2. MEVCUT DURUM ANALİZİ

### 2.1 Uygulama Tipi: Native Launcher (Web Tarayıcı Değil!)

Bu proje, sadece `archilya.com` veya başka bir URL'yi yükleyen basit bir `BrowserWindow` **DEĞİLDİR**. Tam anlamıyla bağımsız, kendi içinde native yeteneklere sahip bir **oyun launcher'ıdır**.

### 2.2 Native Yetenekler ve Ekranlar

Aşağıdaki işlevler doğrudan Electron ana sürecinde (`main.ts`, `ipcHandlers.ts`, `projectManager.ts`) yerel (native) kodla yürütülmektedir:

| # | Yetenek | Durum | Açıklama |
|---|---------|-------|----------|
| 1 | **Oyun İndirme / Güncelleme** | ✅ Aktif | Turbo V2 çoklu segment indirme (8 eşzamanlı worker). MD5 hash doğrulama. `userData/Archilya` altına kurulum. |
| 2 | **VR Proje (PAK) Yönetimi** | ✅ Aktif | Firestore'dan yetkilendirilmiş projeleri çeker, PAK dosyalarını indirir, `Archilya/Content/Paks/` altına kurar, `Archilya.exe` üzerinden harita ile başlatır. |
| 3 | **Pixel Streaming / Web Share** | ✅ Aktif | Signalling sunucusu, TURN sunucusu, Cloudflare/localtunnel tüneli. Harici tarayıcıdan oynanabilir link üretir. |
| 4 | **Firebase Authentication** | ✅ Aktif | Email/şifre, Google OAuth (PKCE + loopback), Guest (anonim). Şifre `safeStorage` ile şifrelenip `electron-store`'da saklanır. Otomatik giriş (Auto-login) mevcut. |
| 5 | **Dosya Senkronizasyonu** | ✅ Aktif | `SyncService` ile yerel klasör ↔ bulut senkronizasyonu. `chokidar` ile dosya değişiklikleri izlenir. |
| 6 | **Remote Komut Dinleyici** | ✅ Aktif | `launcherCommands` Firestore koleksiyonunu dinler. Uzak başlatma/durdurma komutlarını işler. |
| 7 | **Sistem Tepsisi (Tray)** | ✅ Aktif | `Tray` + `nativeImage`. Çift tıklama ile göster/gizle. Çıkış menüsü. |
| 8 | **Auto-Update** | ✅ Aktif | `electron-updater`. Her saat arka planda kontrol. İndirme tamamlanınca sessizce kurulum (quitAndInstall). |
| 9 | **Pencere Kontrolü** | ✅ Aktif | Frameless pencere (kendi başlık çubuğu). Kapatma → gizle (quit değil). Minimize, sürükle-bırak desteği. |
| 10 | **Single Instance Lock** | ✅ Aktif | İkinci örnek başlatılırsa mevcut pencere öne getirilir. |

### 2.3 Geliştirme / Üretim Modu Davranışı

- **Geliştime:** `http://localhost:5173` (Vite dev server) yüklenir.
- **Üretim:** `dist/index.html` yerel dosyası yüklenir (`file://` protokolü üzerinden).
- Base URL `./` olarak ayarlanmıştır (Vite `base: './'`).

---

## 3. KURUMSAL EKSİKLİKLER VE GÜVENLİK ANALİZİ

### 3.1 ✅ Olumlu Güvenlik Uygulamaları

| Kontrol | Durum | Kanıt (Kod) |
|---------|-------|-------------|
| `contextIsolation: true` | ✅ Güvenli | `electron/main.ts:266` |
| `nodeIntegration: false` | ✅ Güvenli | `electron/main.ts:265` |
| Preload kullanımı | ✅ Var | `electron/preload.ts` tüm API'yi `contextBridge` ile expose ediyor. |
| `singleInstanceLock` | ✅ Var | `electron/main.ts:81-91` |
| `safeStorage` kullanımı | ✅ Var | `authService.ts:encryptPassword/decryptPassword` işletim sistemi düzeyinde şifreleme. |
| IPC handler temizliği | ✅ Var | `removeIpcHandlers()` tüm kanalları kaldırıyor. `app.on('before-quit')` içinde çağrılıyor. |
| Otomatik güncelleme | ✅ Kurulu | `electron-updater ^6.6.7` aktif. GitHub Releases feed'i yapılandırılmış. |
| Tray entegrasyonu | ✅ Var | `createTray()` ikon, tooltip, context menü. |

### 3.2 ⚠️ Orta Riskli Eksiklikler

| # | Eksiklik | Risk Seviyesi | Detay |
|---|----------|---------------|-------|
| **E1** | **CSP (Content-Security-Policy) Eksik** | ⚠️ Orta | `webPreferences`'ta `contentSecurityPolicy` tanımlı değil. Renderer'da yüklenen HTML/JS içinde `meta` CSP tag'i yok. XSS riski sınırlı (contextIsolation var) ama inline script/remote resource yüklenmesi engellenmemiş. |
| **E2** | **`sandbox: true` Açıkça Belirtilmemiş** | ⚠️ Orta | Electron 20+ varsayılan olarak `sandbox: true` kullanır ancak `createWindow` içinde explicit olarak yazılmamış. Kod okunabilirliği ve güvenlik denetimleri açısından explicit tanımlanmalıdır. |
| **E3** | **`allowRunningInsecureContent` Kontrolü** | ⚠️ Orta | Default `false` olmasına rağmen, explicit olarak `webSecurity: true` ve `allowRunningInsecureContent: false` tanımlanmamış. |
| **E4** | **Hardcoded API Key (Fallback)** | ⚠️ Orta | `FALLBACK_API_KEY = 'AIzaSyC...'` `main.ts:564` ve `firebase.ts:10`'da sabit kodlanmış. `.env` yoksa bu key aktif olur. Tersine mühendislikle çıkarılabilir. |
| **E5** | **`.env` Dosyası `extraResources` İçinde** | ⚠️ Orta | `package.json:76-79`'de `.env` dosyası paket içine `extraResources` olarak dahil ediliyor. Üretim build'inde `.env` uygulama dizinine kopyalanır, bu da tersine mühendislikle okunabilir. Hassas verilerin `electron-store` + `safeStorage` ile yönetilmesi önerilir. |
| **E6** | **IPC Input Validasyonu Zayıf** | ⚠️ Orta | Birçok IPC handler'da `any` tipi kullanılıyor (örn. `project: any`, `data: any`). `ipcMain.on('start-game-update', ...)` event'i `manifest` objesini doğrulamıyor. Kötü niyetli crafted manifest gönderilebilir (zip slip / path traversal riski sınırlı ancak indirme URL'si manipüle edilebilir). |
| **E7** | **HTTPS Agent `rejectUnauthorized`** | ⚠️ Orta | `https.Agent` yapılandırılırken `rejectUnauthorized` explicit olarak `true` yapılmamış. Default `true` olsa da, araya girme (MITM) saldırılarına karşı explicit doğrulama önerilir. |
| **E8** | **Auto-Update Sessiz Kurulum** | ⚠️ Orta | `update-downloaded` event'inde `setTimeout(() => autoUpdater.quitAndInstall(true, true), 3000)` kullanılıyor. Kullanıcıya sadece 3 saniye süre verilip sessizce kurulum yapılıyor. Kurumsal ortamlarda kullanıcı onaylı güncelleme tercih edilmelidir. |
| **E9** | **Log Seviyesi `info`** | ⚠️ Düşük | `log.transports.file.level = 'info'`. Üretimde `warn` veya `error` seviyesine çekilmesi, hassas bilgilerin (token, uid, email) log dosyasına düşme riskini azaltır. |

### 3.3 🔴 Yüksek Riskli Eksiklikler (KRİTİK)

| # | Eksiklik | Risk Seviyesi | Detay |
|---|----------|---------------|-------|
| **K1** | **Native Bildirim (Notification API) Eksik** | 🔴 Düşük-Kritik | `new Notification()` kullanımına rastlanmadı. Oyun indirme tamamlandığında, güncelleme hazır olduğunda veya uzaktan komut alındığında OS native bildirim gösterilmiyor. Kullanıcı uygulama tepsisine bakmadığı durumlarda önemli olayları kaçırabilir. Tray tooltip yetersiz kalır. |
| **K2** | **İndirme URL Filtreleme Yetersizliği** | 🔴 Kritik | `start-game-update` içinde `manifest.downloadParts` URL'leri için sadece `startsWith('http')` kontrolü var. `file://`, `ftp://`, `http://internal` gibi protokoller veya iç ağ IP'lerine (SSRF) yönelik filtreleme yok. Manifest üzerinden sunucu tarafından kontrol edilse bile, `game-manifest.json`'ın GitHub Raw üzerinden çekilmesi tek nokta hatası (SPOF) oluşturur. |
| **K3** | **ZIP Çıkarma Path Traversal Riski** | 🔴 Kritik | `extract-zip` kullanılıyor ancak `strip` veya `path` sanitize kontrolü görülmedi. Manifest'teki `zipHash` doğru olsa bile, ZIP içinde `../` içeren dosya yolları hedef dizin dışına çıkabilir. `extract-zip` kütüphanesinin kendi içinde koruma var mı bağımsız olarak doğrulanmalıdır. |
| **K4** | **Process Spawn Argüman Enjeksiyonu** | 🔴 Kritik | `launch-game` ve `launchProject` içinde kullanıcıdan/toplantıdan gelen `mapName` ve `authArgs` doğrudan `spawn(exePath, args)` içine konuluyor. `mapName` üzerinde quote escape veya shell metakarakter filtrelemesi yapılmıyor. Kötü niyetli harita adı ile komut enjeksiyonu mümkün olabilir (örn. `mapName: '"; calc.exe; "'`). |

---

## 4. KOD MANTIĞI DETAYLARI

### 4.1 Ana Süreç Yaşam Döngüsü

```
app.whenReady()
  ├── createWindow()         → BrowserWindow (1480x920, frameless, contextIsolation)
  ├── createTray()           → Tray icon + context menu
  ├── ProjectManager init    → PAK yönetimi
  ├── registerIpcHandlers()  → Tüm IPC kanalları kaydı
  ├── RemoteCommandListener  → Firestore dinleyici başlat
  ├── autoUpdater.setup()    → Feed URL + event listeners
  ├── startLauncherUpdateWatcher() → Her 1 saat kontrol
  └── startGameUpdateWatcher()     → Her 10 dakika kontrol

app.on('before-quit')
  ├── IPC handler'ları kaldır
  ├── RemoteCommandListener durdur
  ├── Streaming altyapısını kapat
  └── isQuitting = true
```

### 4.2 Oyun Güncelleme Akışı (Turbo V2)

```
check-game-update → fetchRemoteManifest() [GitHub Raw]
  ├── Manifest yoksa → offline-ready veya error
  ├── Bakım modu → maintenance
  ├── Yüklü değil → not-installed
  ├── Versiyon farklı → update-available
  └── Aynı → ready

start-game-update
  ├── Multi-part segmentasyon (4 segment / dosya)
  ├── 8 eşzamanlı worker (Range header ile paralel indirme)
  ├── Segment birleştirme (part → zip)
  ├── MD5 Hash doğrulama
  ├── extract-zip ile çıkarma
  ├── local-manifest.json yaz
  └── game-update-complete event
```

### 4.3 Authentication Akışı

```
Renderer (React)
  ├── login(email, password, rememberMe)
  │     └── IPC → authService.loginWithEmail()
  │           └── Firebase Auth SDK → signInWithEmailAndPassword()
  │           └── Firestore → ensureUserProfile (500 kredi)
  │           └── rememberMe ? safeStorage encrypt → electron-store
  │
  ├── loginWithGoogle()
  │     └── IPC → authService.loginWithGoogle()
  │           └── Loopback HTTP server (127.0.0.1:47193)
  │           └── shell.openExternal(Google OAuth URL)
  │           └── PKCE (verifier + challenge)
  │           └── exchange code → id_token
  │           └── Firebase signInWithCredential
  │
  └── checkSession()
        └── IPC → authService.checkSession()
              └── onAuthStateChanged
              └── rememberMe + encryptedPassword → auto-login
```

### 4.4 Streaming / Web Share Akışı

```
streaming:start
  ├── TURN altyapısı kontrolü (local / managed / shared-fallback)
  ├── Local TURN sunucusu başlat (isteğe bağlı)
  ├── Signalling Web Server başlat (Node.js, player:8080, streamer:8888)
  ├── Archilya.exe başlat (PixelStreaming args)
  ├── Tunnel aç (Cloudflare / localtunnel)
  └── Public URL üret (StreamerId + AutoConnect)
```

---

## 5. ÖZET KARARGAH RAPORU

### 5.1 Durum Özeti

| Metrik | Değer |
|--------|-------|
| **Proje Tipi** | Native Electron Oyun Launcher (WebView değil) |
| **Karmaşıklık** | Yüksek — 6+ native alt sistem entegre |
| **Güvenlik Temeli** | Orta-Yüksek — Context isolation, preload, safeStorage mevcut |
| **Üretim Hazırlığı** | Orta — Auto-update, tray, single instance var; CSP ve input validasyon eksik |

### 5.2 Güçlü Yönler

1. **Modern yığın:** Electron 40, React 19, Vite 7, TypeScript 5.9 — güncel ve desteklenen teknolojiler.
2. **Gelişmiş indirme altyapısı:** Parçalı, paralel, kaldığı yerden devam edebilen, hash doğrulamalı oyun indiricisi.
3. **Çoklu kimlik doğrulama:** Email, Google OAuth (PKCE loopback), Guest — tam kapsamlı.
4. **Pixel Streaming entegrasyonu:** TURN + Signalling + Tunnel ile uçtan uca web paylaşım.
5. **Auto-Update:** GitHub Releases üzerinden tam otomatik, periyodik kontrollü.

### 5.3 Acil Müdahale Gerektiren Konular

1. **E5 (.env paket içinde):** `.env`'i `extraResources` dışına alın, `safeStorage` ile kritik değerleri saklayın.
2. **K4 (Argüman enjeksiyonu):** `mapName` ve `authArgs` üzerinde kesinlikle shell escape ve whitelist validasyonu eklenmeli.
3. **K3 (ZIP Path Traversal):** `extract-zip` çıkarma öncesi ZIP içeriği taranıp `../` içeren girişler sanitize edilmeli.
4. **E1 (CSP):** `webPreferences` içinde `contentSecurityPolicy` veya `index.html`'de `<meta http-equiv="Content-Security-Policy">` tanımlanmalı.
5. **K2 (SSRF Filtreleme):** İndirme URL'leri için whitelist (sadece HTTPS + bilinen domainler) uygulanmalı.

### 5.4 Önerilen Hızlı Eylem Planı

| Öncelik | Görev | Hedef Dosya(lar) |
|---------|-------|------------------|
| P0 | `mapName` ve dinamik spawn argümanları üzerinde shell escape | `ipcHandlers.ts`, `projectManager.ts`, `launchProfileService.ts` |
| P0 | ZIP çıkarma path traversal koruması | `main.ts` (extract-zip çağrısı öncesi) |
| P1 | CSP policy ekleme | `main.ts` (webPreferences) veya `index.html` |
| P1 | `.env`'i paket dışına al, fallback API key'i kaldır | `package.json`, `firebase.ts`, `main.ts` |
| P1 | İndirme URL'si whitelist filtreleme | `main.ts` (`start-game-update` içinde) |
| P2 | `sandbox: true` explicit ekle | `main.ts` (`createWindow`) |
| P2 | Native bildirim entegrasyonu | `main.ts` (indirme tamamlandığında, güncelleme hazırda) |
| P2 | Log seviyesini `warn` yap (üretimde) | `main.ts` |

---

> **SONUÇ:** Archilya Launcher, basit bir webview kabuğu olmanın çok ötesinde, kendi içinde oyun yönetimi, streaming, kimlik doğrulama ve dosya senkronizasyonu barındıran tam teşekküllü bir native uygulamadır. Temel güvenlik ayarları doğru yapılmıştır ancak input validasyonu, paket içeriği ve yetkilendirme filtreleme konularında kritik sertleştirmeler gerekmektedir.

---
*Rapor Sonu*
