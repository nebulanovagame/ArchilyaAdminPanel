# Skill: Fix Google Sign-In / Firebase OAuth Config Mismatch

## Description
Self-healing skill to diagnose and fix Google Sign-In failures on Android caused by missing or mismatched SHA-1/SHA-256 fingerprints in Firebase Console.

## Trigger Keywords
- "google sign in not working"
- "google login error"
- "developer_error"
- "config mismatch"
- "Google OAuth ayarlari gecersiz"
- "SHA-1 mismatch"
- "12501"
- "google auth hatasi"

## Context
- Mobile app: `ArchilyaMobil/` (Expo 55 + React Native)
- Package: `com.archilya.app`
- Firebase: `nng-toma`
- Debug keystore: `android/app/debug.keystore` (SHA1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`)
- Release keystore: `android/app/archilya-release.keystore` (SHA1: `03:7C:0E:C1:37:D5:0E:E9:A9:2E:19:09:BD:03:88:C1:24:32:6A:36`)

## Root Cause
Firebase Console only had the **release** SHA-1 registered. Debug builds (local development, `expo run:android`) use the **debug keystore** whose SHA-1 was missing. Google Sign-In SDK verifies package name + SHA-1 at runtime; if no matching OAuth client exists, it returns `DEVELOPER_ERROR` (status 10).

## Diagnostic Steps

### 1. Identify Error Source
Check error message in app logs:
```
Google OAuth ayarlari gecersiz.
Android package adi, SHA-1/SHA-256 ve client ID eslesmesini kontrol edin.
```
This means `developer_error` — SHA-1/package name mismatch.

### 2. Extract All Keystore Fingerprints
```bash
cd ArchilyaMobil/android/app

# Debug keystore
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android

# Release keystore
keytool -list -v -keystore archilya-release.keystore -alias 82db165e9d4b4742e31d2398d22eb368 -storepass 321169352d7157e61999e733390622fe

# Or from built AAB/APK
keytool -printcert -jarfile app-release.aab
```

### 3. Verify google-services.json
Check that `oauth_client[]` array contains entries for **both** debug and release SHA-1 hashes:
```json
"oauth_client": [
  {
    "client_type": 1,
    "android_info": {
      "package_name": "com.archilya.app",
      "certificate_hash": "5e8f16062ea3cd2c4a0d547876baa6f38cabf625"
    }
  },
  {
    "client_type": 1,
    "android_info": {
      "package_name": "com.archilya.app",
      "certificate_hash": "037c0ec137d50ee9a92e1909bd0388c124326a36"
    }
  },
  {
    "client_type": 3
  }
]
```
If missing, proceed to fix.

### 4. Check Firebase Console Fingerprints
```bash
firebase apps:android:sha:list "ANDROID_APP_ID" --project nng-toma
```
Expected to see both:
- `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (debug)
- `03:7C:0E:C1:37:D5:0E:E9:A9:2E:19:09:BD:03:88:C1:24:32:6A:36` (release)

## Fix Steps

### Add Missing SHA-1 to Firebase
```bash
cd ArchilyaMobil

# Replace APP_ID with full Android app ID (e.g., 1:782938691094:android:c872ea938f1e1bbf54c737)
firebase apps:android:sha:create "APP_ID" "DEBUG_SHA1_HERE" --project nng-toma --non-interactive

# Also add SHA-256 if needed
firebase apps:android:sha:create "APP_ID" "DEBUG_SHA256_HERE" --project nng-toma --non-interactive
```

### Refresh google-services.json
```bash
rm android/app/google-services.json
firebase apps:sdkconfig android "APP_ID" --out "android/app/google-services.json" --project nng-toma --non-interactive
```

### Verify the Fix
Open `android/app/google-services.json` and confirm both `oauth_client` entries with `client_type: 1` exist.

## Scenario C: Play App Signing (Play Store Yayını)

**Bu SENARYO en yaygın hatadır.** Uygulama Play Store'dan indiriliyorsa veya `eas build --profile production` ile AAB olarak build edilip Play Console'a yükleniyorsa, Google kendi signing key'i ile yeniden imzalar. **Senin release keystore'un değil, Google'ın "App signing key certificate" SHA-1'i geçerlidir.**

### Neden Bu Hata Olur?

1. Sen AAB'yi kendi `archilya-release.keystore` ile imzalarsın (SHA-1: `03:7C:0E:C1...`)
2. Play Console'a yüklersin
3. Google AAB'yi kendi key'i ile yeniden imzalar (farklı SHA-1)
4. Kullanıcı Play Store'dan indirir → APK Google'ın key'i ile imzalıdır
5. Google Sign-In SDK bu SHA-1'i Firebase Console'da bulamaz → `DEVELOPER_ERROR`

### Çözüm Adımları

#### Adım 1: Play Console'dan App Signing Key SHA-1 Al

1. [Google Play Console](https://play.google.com/console) → Uygulamanı seç
2. Sol menü: **Release** → **Setup** → **App Integrity**
3. **App signing key certificate** bölümündeki SHA-1'i kopyala
   ```
   Örnek format: A1:B2:C3:D4:E5:F6:... (20 byte = 40 hex karakter)
   ```
4. **NOT:** Bu SHA-1, senin `archilya-release.keystore` SHA-1'inden FARKLI olmalıdır. Eğer aynıysa Play App Signing etkin değildir.

#### Adım 2: Firebase Console'a Ekle

1. [Firebase Console](https://console.firebase.google.com/project/nng-toma/settings/general/android:com.archilya.app)
2. **SHA certificate fingerprints** bölümünde **Add fingerprint** butonuna tıkla
3. Play Console'dan kopyaladığın SHA-1'i yapıştır
4. **Aynı şekilde SHA-256'yı da ekle** (Google artık SHA-256 gerektiriyor)
5. Kaydet

#### Adım 3: Google Cloud Console'da Doğrula

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=nng-toma)
2. **OAuth 2.0 Client IDs** bölümünde Android tipindeki client'ları bul:
   - `782938691094-aovg2r9d70pnkk5j57hrj9j5mv5ln5to` (release client)
   - `782938691094-5qv6vkdkdejbb5oqt2f6un2l5c2i2egf` (debug client)
3. Her Android client'a tıkla → **Restrictions** → **SHA-1 certificate fingerprint**
4. Eğer Play App Signing SHA-1 burada yoksa, **Edit** ile ekle

#### Adım 4: google-services.json Yenile

```bash
cd ArchilyaMobil
rm android/app/google-services.json
firebase apps:sdkconfig android "1:782938691094:android:c872ea938f1e1bbf54c737" --out "android/app/google-services.json" --project nng-toma --non-interactive
```

Veya Firebase Console'dan manuel indir: Project Settings → General → Android app → google-services.json indir → `android/app/` içine at.

#### Adım 5: Doğrula

`android/app/google-services.json` içinde **3 adet** `client_type: 1` entry olmalı:
```json
"oauth_client": [
  { "client_type": 1, "android_info": { "package_name": "com.archilya.app", "certificate_hash": "5e8f1606..." } },  // Debug
  { "client_type": 1, "android_info": { "package_name": "com.archilya.app", "certificate_hash": "037c0ec1..." } },  // Release (senin keystore)
  { "client_type": 1, "android_info": { "package_name": "com.archilya.app", "certificate_hash": "PLAY_SIGNING_SHA1..." } },  // Play App Signing (Google'ın key'i)
  { "client_type": 3 }
]
```

### Önemli Notlar

- **Eski release SHA-1'i silme** — `archilya-release.keystore` SHA-1'i (037c0ec1...) hâlâ `eas build --profile preview` (internal APK) için gereklidir
- **Upload key certificate SHA-1** Play Console'da ayrıca görünür ama Firebase'e eklenmesi gerekmez; sadece senin build/upload sürecin için kullanılır
- **Aynı package_name ile farklı SHA-1'ler** sorun olmaz; Firebase/Google Cloud her hash için ayrı OAuth client oluşturur
- Eğer Play App Signing SHA-1'i eklendikten sonra hâlâ hata alınıyorsa, kullanıcının uygulamayı **Play Store'dan yeniden indirmesi** gerekebilir (yerel cache temizlenmesi için)

## Verification Commands Summary
```bash
# Extract SHA from keystore
keytool -list -v -keystore <keystore> -alias <alias>

# Extract SHA from built AAB
keytool -printcert -jarfile app-release.aab

# List Firebase fingerprints
firebase apps:android:sha:list <appId> --project nng-toma

# Add fingerprint
firebase apps:android:sha:create <appId> <shaHash> --project nng-toma

# Download fresh config
firebase apps:sdkconfig android <appId> --out android/app/google-services.json --project nng-toma
```

## Files Modified by This Skill
- `android/app/google-services.json` — replaced with fresh download containing all fingerprints

## See Also
- `build-and-submit.md` — for the full build + submit pipeline
