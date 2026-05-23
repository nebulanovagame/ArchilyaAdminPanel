# Google Play Console — Abonelik Avantajları (Benefits) Ekleme Rehberi

> Bu rehber, Play Console'da `pro_monthly`, `pro_annual`, `studio_monthly`, `studio_annual`, `solo_monthly`, `solo_annual` aboneliklerine "Abonelik Avantajları" (Benefits) eklemeni adım adım anlatır.

---

## ÖNEMLİ NOTLAR

- **Abonelik Avantajları** sadece **Subscriptions** (abonelik) ürünlerinde vardır.
- **In-app Products** (kredi paketleri — `boost_500_std`, `boost_1500_std` vb.) için bu alan yoktur. Onlara sadece **Ad** ve **Açıklama** yazılır.
- Avantajlar kullanıcıya Play Store'da ürün sayfasında gösterilir. Pazarlama metni gibidir.
- Teknik limitler (5 kişi, 100 GB, 2200 kredi) buraya yazılması zorunlu değildir. Kullanıcıyı ikna eden özellikler yazılır.

---

## 1. Play Console'a Giriş

1. Tarayıcıda aç: `https://play.google.com/console/developers`
2. Giriş yap (Google hesabınla).
3. Sol üstte `Archilya` uygulamasını seç.

---

## 2. Abonelikler Sayfasına Git

1. Sol menüden: **`Monetize`** tıkla.
2. Açılan alt menüden: **`Products`** → **`Subscriptions`** tıkla.

> Ekranda şu an sadece `pro_monthly` görünüyor olabilir. Diğerlerini henüz oluşturmadıysan, önce [REVENUECAT_PLAYSTORE_SETUP.md](./REVENUECAT_PLAYSTORE_SETUP.md) rehberindeki adımları takip et.

---

## 3. Her Abonelik İçin Avantaj Ekleme

Her abonelik için aynı adımları tekrarlayacaksın. Başlayalım:

### Adım 3.1 — Aboneliği Aç

1. Subscriptions listesinden bir aboneliğe tıkla (örn: `pro_monthly`).
2. Üstte **"Subscription details"** sekmesi açılacak.
3. Sayfayı aşağı kaydır. **"Add subscription benefits (recommended)"** yazan bir alan göreceksin.
4. **`Add benefits`** butonuna tıkla.

### Adım 3.2 — Avantajları Yaz

Açılan pencerede **"Benefits"** başlığı altına aşağıdaki metinleri gir.

> **Not:** Her bir maddeyi ayrı bir satıra yaz. Google genellikle 3-5 madde önerir.

---

### **A. `pro_monthly` ve `pro_annual` İçin Avantajlar**

**Başlık alanına yaz:** `Pro Paket Avantajları`

**Benefits (avantajlar) kutusuna her satıra bir tane olacak şekilde yaz:**

```
Premium AI Stüdyo araçlarına sınırsız erişim
VR ve üretim hizmetlerinde %20 abone indirimi
Filigransız yüksek kaliteli indirme
Öncelikli render kuyruğu ve hızlı işlem
5 kişilik ekip workspace yönetimi
100 GB bulut depolama alanı
```

**Kaydet:** Sağ alt köşedeki **`Save`** butonuna tıkla.

---

### **B. `studio_monthly` ve `studio_annual` İçin Avantajlar**

**Başlık alanına yaz:** `Studio Paket Avantajları`

**Benefits kutusuna yaz:**

```
Tüm Pro özellikleri dahil
20 kişilik geniş ekip workspace yönetimi
750 GB paylaşımlı bulut depolama
Özel proje yöneticisi desteği
White-label ve API modülleri için hazır altyapı
Tam gün AI & VR kurulum ve ekip eğitimi
```

**Kaydet:** `Save` butonuna tıkla.

---

### **C. `solo_monthly` ve `solo_annual` İçin Avantajlar**

**Başlık alanına yaz:** `Solo Paket Avantajları`

**Benefits kutusuna yaz:**

```
Premium AI Stüdyo araçlarına erişim
Filigransız yüksek kaliteli indirme
Aylık 1.000 işlem kredisi
30 GB bulut depolama
Abone indirimli ek kredi paketleri
Standart kurulum rehberi ve onboarding videoları
```

**Kaydet:** `Save` butonuna tıkla.

---

## 4. Aboneliği Aktif Hale Getir (Eğer Pasifse)

Her aboneliğin sağ üst köşesinde veya liste görünümünde bir **durum** göstergesi olur.

- Eğer abonelik **`Draft`** (Taslak) durumundaysa:
  1. Aboneliğin sayfasına git.
  2. Sağ üstte **`Activate`** (Aktif Et) butonuna tıkla.
  3. Gelen onay penceresinde tekrar **`Activate`** tıkla.

- Eğer zaten **`Active`** yazıyorsa, bir şey yapmana gerek yok.

> **Önemli:** Ürün ancak aktif olduğunda RevenueCat tarafından okunabilir ve satın alınabilir.

---

## 5. Kredi Paketleri (In-app Products) İçin Not

Play Console → `Monetize` → `Products` → `In-app products`

Bu ürünlerde **"Benefits"** alanı yoktur. Sadece şunları doldurman yeterli:

- **Name:** (örn: `1.500 Kredi Paketi`)
- **Description:** (örn: `1.500 işlem kredisi — abone olmayanlar için`)
- **Price:** TRY 1.150,00
- **Product type:** Consumable

Hepsi bu kadar. Kaydet ve aktif et.

---

## 6. Son Kontrol Listesi

Her şeyi yaptıktan sonra aşağıdaki listeden tek tek kontrol et:

- [ ] Play Console'da toplam **6 abonelik** oluşturuldu (`solo_monthly`, `solo_annual`, `pro_monthly`, `pro_annual`, `studio_monthly`, `studio_annual`).
- [ ] Her aboneliğin **Benefits** alanı dolduruldu.
- [ ] Her abonelik **Aktif** durumda.
- [ ] Play Console'da toplam **6 kredi paketi** (In-app product) oluşturuldu.
- [ ] Her kredi paketi **Aktif** durumda ve türü **Consumable**.
- [ ] RevenueCat Dashboard'ta tüm 12 ürün **yeşil tik (✅)** ile gözüküyor.

---

## 7. Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|---|---|
| "Add benefits" butonu gri ve tıklanmıyor | Abonelik henüz aktif değildir. Önce "Activate" yap. |
| Avantajları yazdım ama kaydetmiyor | Metinde özel karakter (`<`, `>`) olabilir. Düz metin kullan. |
| RevenueCat'te ürün kırmızı X gösteriyor | Play Console'da ürün ID'si tam olarak aynı değil. Büyük-küçük harf kontrol et. |
| "Activate" butonu yok | Abonelik zaten aktiftir veya bazı zorunlu alanlar (fiyat, periyot) eksiktir. |

---

## Yardım mı Lazım?

- Bir adımda takılırsan veya ekran görüntüsü alıp gönderirsen, o ekrana özel yönlendirme yapabilirim.
- RevenueCat Dashboard'ta eşleştirme sorunu yaşarsan, `Projects` → `Archilya` → `Products` sayfasındaki durumu kontrol edelim.
