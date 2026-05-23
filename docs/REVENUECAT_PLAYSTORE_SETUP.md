# RevenueCat + Google Play Store Abonelik Yapılandırma Rehberi

> **Son Güncelleme:** 2026-05-12  
> **Package Name:** `com.archilya.app`  
> **Backend Webhook:** `https://europe-west1-nng-toma.cloudfunctions.net/revenueCatWebhook`

---

## 0. Özet — Neler Oluşturulacak?

### Google Play Console'da (Toplam 12 Ürün)

**Abonelikler (Subscriptions) — 6 adet:**

| Ürün ID | Plan | Periyot | Fiyat (TRY) |
|---|---|---|---|
| `solo_monthly` | Solo | Aylık | ₺699 |
| `solo_annual` | Solo | Yıllık | ₺6.588 |
| `pro_monthly` | Pro | Aylık | ₺1.499 |
| `pro_annual` | Pro | Yıllık | ₺14.388 |
| `studio_monthly` | Studio | Aylık | ₺4.999 |
| `studio_annual` | Studio | Yıllık | ₺47.988 |

**Tek Seferlik Satın Alımlar (In-app Products → Consumables) — 6 adet:**

| Ürün ID | Kredi | Fiyat (TRY) | Kimler İçin |
|---|---|---|---|
| `boost_500_std` | 500 | ₺450 | Abone olmayanlar |
| `boost_500_sub` | 500 | ₺350 | Aboneler (indirimli) |
| `boost_1500_std` | 1.500 | ₺1.150 | Abone olmayanlar |
| `boost_1500_sub` | 1.500 | ₺900 | Aboneler (indirimli) |
| `boost_4000_std` | 4.000 | ₺2.700 | Abone olmayanlar |
| `boost_4000_sub` | 4.000 | ₺2.200 | Aboneler (indirimli) |

### RevenueCat Dashboard'ta

- **3 Entitlement:** `solo`, `pro`, `studio`
- **1 Offering:** `default`
- **12 Product:** Play Console'daki tüm ürünler
- **12 Package:** Her ürün için 1 package (isimleri ürün ID'si ile aynı)
- **Webhook:** Basic Auth ile backend'e bağlı

---

## 1. Google Play Console Hazırlığı

### 1.1 Ön Şart
- Uygulamanın Play Console'da yayınlanmış ve en az **bir Internal Testing sürümü** yüklenmiş olmalı.
- Bu zaten yapıldı (v7, Internal Testing track'te).

### 1.2 Abonelik Ürünleri Oluştur (6 adet)

**Adım:** Play Console → `Monetize` (sol menü) → `Products` → `Subscriptions`

Her biri için aşağıdaki bilgileri gir:

**A. `solo_monthly`**
- Ürün ID: `solo_monthly`
- Ad: `Solo Aylık Abonelik`
- Açıklama: `Aylık 1.000 işlem, 30 GB depolama, 15 proje`
- Benefits: `Premium AI Araçları`, `Filigransız İndirme`, `E-posta Desteği`
- Fiyat: **TRY 699.00**
- Periyot: **Aylık**
- Grace period: `3 gün` (önerilir)
- Account hold: `Açık` (önerilir)
- Durum: **Aktif**

**B. `solo_annual`**
- Ürün ID: `solo_annual`
- Ad: `Solo Yıllık Abonelik`
- Fiyat: **TRY 6.588,00**
- Periyot: **Yıllık**
- Aynı benefits
- Durum: **Aktif**

**C. `pro_monthly`**
- Ürün ID: `pro_monthly`
- Ad: `Pro Aylık Abonelik`
- Açıklama: `Aylık 2.200 işlem, 100 GB depolama, 5 kişilik ekip`
- Benefits: `Tüm Solo özellikleri`, `VR Hizmetleri`, `Öncelikli Render`, `Workspace Yönetimi`
- Fiyat: **TRY 1.499,00**
- Periyot: **Aylık**
- Durum: **Aktif**

**D. `pro_annual`**
- Ürün ID: `pro_annual`
- Ad: `Pro Yıllık Abonelik`
- Fiyat: **TRY 14.388,00**
- Periyot: **Yıllık**
- Durum: **Aktif**

**E. `studio_monthly`**
- Ürün ID: `studio_monthly`
- Ad: `Studio Aylık Abonelik`
- Açıklama: `Aylık 7.000 işlem, 750 GB, 20 kişilik ekip, white-label`
- Benefits: `Tüm Pro özellikleri`, `Özel Proje Yöneticisi`, `White-label API`, `Öncelikli Destek`
- Fiyat: **TRY 4.999,00**
- Periyot: **Aylık**
- Durum: **Aktif**

**F. `studio_annual`**
- Ürün ID: `studio_annual`
- Ad: `Studio Yıllık Abonelik`
- Fiyat: **TRY 47.988,00**
- Periyot: **Yıllık**
- Durum: **Aktif**

> **Kritik Uyarı:** Ürün ID'leri yukarıdaki gibi **tam olarak** (küçük harf, alt çizgi) yazılmalıdır. Backend kodu bu ID'leri birebir bekliyor.

### 1.3 Tek Seferlik Ürünler Oluştur (Consumables — 6 adet)

**Adım:** Play Console → `Monetize` → `Products` → `In-app products`

Burada **"Create product"** butonuna tıkla. Her biri için:

**A. `boost_500_std`**
- Ürün ID: `boost_500_std`
- Ad: `500 Kredi Paketi`
- Açıklama: `500 işlem kredisi (standart fiyat)`
- Fiyat: **TRY 450,00**
- Product type: **Consumable** (tek seferlik, tüketilebilir)
- Durum: **Aktif**

**B. `boost_500_sub`**
- Ürün ID: `boost_500_sub`
- Ad: `500 Kredi Paketi (Abone)`
- Açıklama: `500 işlem kredisi (abone indirimli)`
- Fiyat: **TRY 350,00**
- Product type: **Consumable**
- Durum: **Aktif**

**C. `boost_1500_std`**
- Ürün ID: `boost_1500_std`
- Ad: `1.500 Kredi Paketi`
- Fiyat: **TRY 1.150,00**
- Product type: **Consumable**
- Durum: **Aktif**

**D. `boost_1500_sub`**
- Ürün ID: `boost_1500_sub`
- Ad: `1.500 Kredi Paketi (Abone)`
- Fiyat: **TRY 900,00**
- Product type: **Consumable**
- Durum: **Aktif**

**E. `boost_4000_std`**
- Ürün ID: `boost_4000_std`
- Ad: `4.000 Kredi Paketi`
- Fiyat: **TRY 2.700,00**
- Product type: **Consumable**
- Durum: **Aktif**

**F. `boost_4000_sub`**
- Ürün ID: `boost_4000_sub`
- Ad: `4.000 Kredi Paketi (Abone)`
- Fiyat: **TRY 2.200,00**
- Product type: **Consumable**
- Durum: **Aktif**

> **Kritik Uyarı:** Consumable seçeneğini unutma! Eğer "Non-consumable" seçersen kullanıcı bir kez alır, tekrar alamaz.

### 1.4 Service Account Kontrolü (RevenueCat için)

Bu zaten yapıldı ama kontrol et:

1. Play Console → `Users and permissions` → `Service accounts`
2. `revenuecat@opencode-playstore.iam.gserviceaccount.com` listede olmalı.
3. İzinler: **"View app information"**, **"View financial data"**, **"Manage orders and subscriptions"** olmalı.

Eğer yoksa:
- Google Cloud Console → IAM & Admin → Service Accounts
- `revenuecat@opencode-playstore.iam.gserviceaccount.com` → Keys → Add Key → JSON
- İnen JSON dosyasını RevenueCat Dashboard'a yükle (aşağıda anlatılıyor).

---

## 2. RevenueCat Dashboard Yapılandırması

### 2.1 Giriş
https://app.revenuecat.com/projects

Proje: `Archilya` (zaten oluşturulmuş olmalı)

### 2.2 Play Store Credentials Yükle / Güncelle

**Adım:** RevenueCat Dashboard → Project Settings → Play Store Credentials

- Eğer yüklü değilse: **Google Play** sekmesi → **Add credentials**
- İndirdiğin JSON service account key dosyasını yükle.
- Package name: `com.archilya.app`

### 2.3 Entitlements Oluştur (3 adet)

**Adım:** RevenueCat Dashboard → `Products` (sol menü) → `Entitlements` → `+ New`

| Entitlement ID | Açıklama |
|---|---|
| `solo` | Solo plan erişimi |
| `pro` | Pro plan erişimi |
| `studio` | Studio plan erişimi |

### 2.4 Products Ekle (12 adet)

**Adım:** RevenueCat Dashboard → `Products` → `+ New`

Her ürün için ayrı ayrı ekle:

**Abonelik Products (6 adet):**

| Product Identifier | Ürün Türü | İlişkili Play Console Ürünü |
|---|---|---|
| `solo_monthly` | Subscription | `solo_monthly` |
| `solo_annual` | Subscription | `solo_annual` |
| `pro_monthly` | Subscription | `pro_monthly` |
| `pro_annual` | Subscription | `pro_annual` |
| `studio_monthly` | Subscription | `studio_monthly` |
| `studio_annual` | Subscription | `studio_annual` |

**Kredi Products (6 adet):**

| Product Identifier | Ürün Türü | İlişkili Play Console Ürünü |
|---|---|---|
| `boost_500_std` | Non-Subscription | `boost_500_std` |
| `boost_500_sub` | Non-Subscription | `boost_500_sub` |
| `boost_1500_std` | Non-Subscription | `boost_1500_std` |
| `boost_1500_sub` | Non-Subscription | `boost_1500_sub` |
| `boost_4000_std` | Non-Subscription | `boost_4000_std` |
| `boost_4000_sub` | Non-Subscription | `boost_4000_sub` |

> Her product eklerken "Store" olarak **Google Play** seç, sonra listeden ilgili Play Console ürününü bağla.

### 2.5 Offering ve Packages Oluştur

**Adım:** RevenueCat Dashboard → `Products` → `Offerings` → `default` (zaten varsa düzenle, yoksa oluştur)

`default` offering'in içine aşağıdaki **Packages**'ları ekle:

| Package Identifier | İçerdiği Product | Bağlı Entitlement |
|---|---|---|
| `solo_monthly` | `solo_monthly` | `solo` |
| `solo_annual` | `solo_annual` | `solo` |
| `pro_monthly` | `pro_monthly` | `pro` |
| `pro_annual` | `pro_annual` | `pro` |
| `studio_monthly` | `studio_monthly` | `studio` |
| `studio_annual` | `studio_annual` | `studio` |
| `boost_500_std` | `boost_500_std` | — (krediler entitlement gerektirmez) |
| `boost_500_sub` | `boost_500_sub` | — |
| `boost_1500_std` | `boost_1500_std` | — |
| `boost_1500_sub` | `boost_1500_sub` | — |
| `boost_4000_std` | `boost_4000_std` | — |
| `boost_4000_sub` | `boost_4000_sub` | — |

> Her package eklerken: `+ New Package` → Identifier gir → `+ Add product` → Product seç → Save.
> Subscription package'ları için "Override default" işaretli kalabilir.

### 2.6 Webhook Kontrolü

**Adım:** RevenueCat Dashboard → Project Settings → Integrations → Webhooks

Aşağıdaki webhook zaten yapılandırılmış olmalı:

- **URL:** `https://europe-west1-nng-toma.cloudfunctions.net/revenueCatWebhook`
- **Authorization:** Basic Auth
- **Username:** `revenuecat`
- **Password:** `Archilya2025!Secure`
- **Event Types:**
  - `INITIAL_PURCHASE`
  - `RENEWAL`
  - `CANCELLATION`
  - `EXPIRATION`
  - `UNCANCELLATION`
  - `NON_RENEWING_PURCHASE`

Eğer eksikse yukarıdaki bilgilerle ekle/güncelle.

---

## 3. Ortam Değişkenleri (Zaten Yapıldı)

### Backend (`ArchilyaWebBackend/functions/.env`)
```
REVENUECAT_WEBHOOK_AUTH_PASSWORD=Archilya2025!Secure
```

### Mobil (`ArchilyaMobil/.env.local`)
```
EXPO_PUBLIC_RC_GOOGLE_API_KEY=goog_XvXaeARjEJcoSnLrzBIpjmZueqn
```

---

## 4. Test Adımları

1. Play Console'da tüm ürünleri oluştur ve **Aktif** yap.
2. RevenueCat Dashboard'ta tüm products, packages ve entitlements'i oluştur.
3. RevenueCat Dashboard'ta `Products` sayfasında her ürünün yanında yeşil tik (✅) görmelisin — bu Play Console ile eşleştiği anlamına gelir.
4. Yeni bir build al (`eas build --profile production --platform android`).
5. Play Console Internal Testing'e yükle.
6. Test kullanıcısı cihazında Play Store'dan uygulamayı indir.
7. Uygulamada `Abonelik` ekranına git — tüm planlar ve kredi paketleri görünmeli.
8. Bir plan satın al — gerçek para çekilmeyecek (test kullanıcısı).
9. Satın alma sonrası RevenueCat Dashboard → Customers → test kullanıcısının UID'sini ara.
10. Firebase Console → Firestore → `users` koleksiyonu → kullanıcı dokümanı → `plan` ve `credits` alanları güncellenmiş olmalı.

---

## 5. Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|---|---|
| RevenueCat'te ürün yanında kırmızı X var | Play Console'da ürün ID'si RevenueCat'teki ile birebir aynı değil. Veya Service Account yetkisi eksik. |
| Uygulamada "Mağazada yok" yazıyor | RevenueCat `default` offering içinde package oluşturulmamış. Veya Play Console'da ürün henüz aktif değil. |
| Satın alma başarısız oluyor | Test kullanıcısı Play Console Internal Testing listesinde değil. Veya uygulama imzası (keystore) eşleşmiyor. |
| Webhook 401 | RevenueCat Dashboard'taki şifre ile backend `.env`'deki şifre aynı değil. |
| Kredi eklenmiyor | RevenueCat'te consumable product yanlış türde (non-consumable yerine) oluşturulmuş olabilir. |
| Plan güncellenmiyor | Entitlement ID (`solo`, `pro`, `studio`) backend mapping ile uyuşmuyor. RevenueCat Dashboard'ta entitlement ID'leri kontrol et. |

---

## 3. Ortam Değişkenleri

### Backend (`ArchilyaWebBackend/functions/.env`)
```
REVENUECAT_WEBHOOK_AUTH_PASSWORD=your-strong-password-here
```

### Mobil (`ArchilyaMobil/.env.local`)
```
EXPO_PUBLIC_RC_GOOGLE_API_KEY=goog_YOUR_REVENUECAT_KEY
```

### EAS Build Secrets (production için)
```bash
eas secret:create --name RC_GOOGLE_API_KEY --value "goog_..."
```

---

## 4. Deploy Adımları

### Backend Deploy
```bash
cd ArchilyaWebBackend/functions
npx firebase deploy --only functions
```

### Mobil Build
```bash
cd ArchilyaMobil
eas build --profile preview --platform android
# veya production için:
eas build --profile production --platform android
```

---

## 5. Test Akışı

### Play Store Internal Testing
1. Play Console → Internal Testing track'e test kullanıcıları ekleyin.
2. Test kullanıcısı cihazında Play Store'da "Lisans testi" aktif olmalı.
3. Uygulamayı Internal Testing'den indirin.

### RevenueCat Sandbox
1. RevenueCat Dashboard → Customers bölümünde test kullanıcısını takip edin.
2. Satın alma yapın — gerçek para çekilmeyecektir (test kartları kullanılır).
3. Webhook event'lerinin backend'e ulaştığını Firebase Functions loglarından kontrol edin:
   ```bash
   npx firebase functions:log --only revenueCatWebhook
   ```

### Beklenen Sonuç
- Satın alma sonrası mobilde plan aktif gözükmeli.
- Backend'de `users` dokümanında `plan: 'pro'` ve kredi artışı olmalı.
- `creditHistory` dizisinde `source: 'revenuecat'` entry görünmeli.

---

## 6. Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|---|---|
| "Bu ürün uygulamanızda mevcut değil" | Play Console'da ürün ID'leri tam olarak doğru yazılmalı. Uygulama imzası (keystore) Play Console ile eşleşmeli. |
| Webhook 401 | `REVENUECAT_WEBHOOK_AUTH_PASSWORD` backend'e deploy edilmiş mi kontrol edin. RevenueCat Dashboard'taki şifre ile aynı mı? |
| Webhook 500 | Firebase Functions loglarını kontrol edin. Kullanıcı `app_user_id`'si Firebase UID ile eşleşiyor mu? |
| Plan güncellenmiyor | RevenueCat entitlement ID'leri (`pro`, `studio`) backend mapping ile uyuşuyor mu kontrol edin. |

---

## 7. İleride Eklenebilecekler

- **iOS App Store:** RevenueCat Dashboard'a Apple uygulaması ekle, App Store Connect API key yükle.
- **Promosyon kodları:** Play Console ve RevenueCat üzerinden promo kodlar tanımlanabilir.
- **Trial / Introductory Pricing:** Play Console'da tanımlanır, RevenueCat otomatik işler.
