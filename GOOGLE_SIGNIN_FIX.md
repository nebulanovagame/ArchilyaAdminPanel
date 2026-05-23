# Google Sign-In Fix - Play App Signing Edition

## Sorun

Google ile giriş yaparken "Google OAuth ayarlari gecersiz. Android package adi, SHA-1/SHA-256 ve client ID eslesmesini kontrol edin." hatası alınıyor.

## Neden Olur?

Play Store'dan indirilen uygulamalar **Play App Signing** ile imzalanır. Google, senin `archilya-release.keystore` dosyanı kullanmaz — kendi signing key'ini kullanır. Bu yüzden Firebase Console'da **Google'ın key'inin SHA-1'i** kayıtlı olmalıdır.

## Çözüm Adımları

### Hızlı Başlangıç

```bash
cd ArchilyaMobil

# 1. Play Store bundle'larını kontrol et ve eksik SHA-1'leri Firebase'e ekle
node build-google-auth-check.js --check-playstore

# 2. google-services.json'i yenile
node build-google-auth-check.js --fix

# 3. Build et
eas build --profile production --platform android
```

### Detaylı Adımlar

#### 1. Otomatik Kontrol (Önerilen)

```bash
node build-google-auth-check.js --verify
```

Bu komut:
- Yerel keystore'ların SHA-1 hash'lerini çıkarır
- Firebase Console'da kayıtlı hash'leri listeler
- `google-services.json` yapısını doğrular
- Eksik hash'leri raporlar

#### 2. Play Store Bundle Kontrolü

```bash
node build-google-auth-check.js --check-playstore
```

Bu komut:
- Google Play Store API'sine bağlanır
- Tüm yayınlanmış bundle'ların SHA-1 hash'lerini alır
- Eksik olanları otomatik olarak Firebase Console'a ekler
- `google-services.json` dosyasını yeniler

#### 3. Manuel Kontrol

Eğer otomatik çalışmazsa:

**Play Console'dan SHA-1 al:**
1. [Google Play Console](https://play.google.com/console) → Uygulamanı seç
2. **Release** → **Setup** → **App Integrity**
3. **App signing key certificate** bölümündeki SHA-1'i kopyala

**Firebase Console'a ekle:**
1. [Firebase Console](https://console.firebase.google.com/project/nng-toma/settings/general/android:com.archilya.app)
2. **Add fingerprint** → SHA-1 yapıştır
3. **google-services.json** indir → `android/app/` içine at

**Google Cloud Console'da doğrula:**
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=nng-toma)
2. Android OAuth client'larda SHA-1'in güncellendiğinden emin ol

## Araçlar

### `build-google-auth-check.js`

Ana otomasyon script'i. Tüm Google Sign-In SHA-1 kontrol ve düzeltme işlemlerini yapar.

**Kullanım:**
```bash
node build-google-auth-check.js --verify      # Sadece kontrol et
node build-google-auth-check.js --fix         # Eksik hash'leri düzelt
node build-google-auth-check.js --check-playstore   # Play Store bundle'larını kontrol et
node build-google-auth-check.js --check-firebase    # Sadece Firebase'i kontrol et
```

### `check-play-signing.ps1`

PowerShell alternatifi. `google-services.json` içeriğini listeler.

**Kullanım:**
```powershell
.\ArchilyaSkills\check-play-signing.ps1
```

## Yapılan Değişiklikler

### Firebase Console Güncellemeleri
- ✅ 10 adet Play Store bundle SHA-1 hash'i eklendi
- ✅ Debug keystore SHA-1: `5e8f16062ea3cd2c4a0d547876baa6f38cabf625`
- ✅ Release keystore SHA-1: `037c0ec137d50ee9a92e1909bd0388c124326a36`
- ✅ google-services.json yenilendi (10 Android OAuth client)

### Kod Değişiklikleri
- ✅ `googleAuthService.ts` güçlendirildi (offlineAccess, forceCodeForRefreshToken, androidClientId)
- ✅ Hata mesajları daha spesifik hale getirildi
- ✅ `eas.json` yapılandırması güncellendi

### Dokümantasyon
- ✅ `ArchilyaSkills/fix-google-signin.md` genişletildi (Senaryo C: Play App Signing)
- ✅ `build-google-auth-check.js` oluşturuldu (tam otomasyon)
- ✅ `check-play-signing.ps1` oluşturuldu (teşhis aracı)

## Önemli Notlar

### Her Bundle Farklı SHA-1'e Sahip

Play Store'daki her bundle (v2, v4, v5, v6, v7, v9, v10, v11, v12) farklı SHA-1 hash'i ile imzalanmış. Bu normaldir çünkü EAS her build'de yeni keystore kullanıyor.

### Gelecekteki Build'ler İçin

Yeni bir EAS build yaptıktan sonra:

```bash
# Play Store'daki yeni bundle'ların SHA-1'ini Firebase'e ekle
node build-google-auth-check.js --check-playstore
```

Veya daha iyi bir çözüm: **EAS'e sabit keystore kullanmasını söyle.**

```bash
eas credentials:manager
# Android > production > Keystore > "Set up a new keystore"
```

Bu sayede tüm build'ler aynı keystore'u kullanır ve SHA-1 sabit kalır.

### Google Cloud Console Kontrolü

Firebase'e eklenmiş ama Google Cloud Console'da eksik olabilir. Manuel kontrol:

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials?project=nng-toma)
2. Android OAuth client'ları kontrol et
3. Eksik SHA-1 varsa **Edit** ile ekle

## Test

Build tamamlandıktan sonra:

1. Uygulamayı cihaza yükle (Play Store'dan veya `eas build --profile preview` ile)
2. "Google ile Giriş Yap" butonuna tıkla
3. Google hesabı seç
4. Başarılı giriş yap

Hata alırsan:
- `node build-google-auth-check.js --verify` çalıştır
- Eksik hash varsa `node build-google-auth-check.js --fix`
- Hâlâ olmuyorsa Google Cloud Console'daki OAuth client'ları kontrol et

## Sorun Giderme

### "Firebase CLI not found"
```bash
npm install -g firebase-tools
firebase login
```

### "EAS CLI not found"
```bash
npm install -g eas-cli
```

### "keytool not found"
Java JDK kurulu olduğundan emin ol. Path'e eklenmiş olmalı.

### Play Store API Hatası
Service account key (`google-services-key.json`) Android Publisher API erişimine sahip olmalı. [Google Cloud Console](https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com?project=opencode-playstore)'dan etkinleştir.

## Referanslar

- `ArchilyaSkills/fix-google-signin.md` - Ana fix dokümanı
- `ArchilyaMobil/src/services/googleAuthService.ts` - Google Sign-In servisi
- `ArchilyaMobil/android/app/google-services.json` - Firebase yapılandırması
