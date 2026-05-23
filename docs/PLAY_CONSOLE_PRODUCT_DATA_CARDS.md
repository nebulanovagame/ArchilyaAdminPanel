# Google Play Console — Abonelik Oluşturma Veri Kartları

> Bu rehber, Play Console'da her bir abonelik için tüm alanların eksiksiz olarak ne yazılacağını gösterir. Tablo formatında, kopyala-yapıştır yaparak hızlıca girebilirsin.

---

## GENEL AYARLAR (Tüm abonelikler için aynı)

| Alan | Değer |
|---|---|
| **Grace period** | `3 days` |
| **Account hold** | `Enabled` (Açık) |
| **Pause** | `Disabled` (Kapalı) |
| **Resubscribe** | `Enabled` (Açık) |
| **Proration mode** | `Immediate and charge full price` |

---

## 1. SOLO AYLIK — `solo_monthly`

### Adım 1 — Ürün Oluştur
Play Console'da `Create subscription` dedikten sonra ilk ekran:

| Alan | Değer |
|---|---|
| **Product ID** | `solo_monthly` |
| **Name (Ad)** | Solo Aylık Abonelik |
| **Description (Açıklama)** | Aylık 1.000 işlem kredisi, 30 GB depolama ve 15 proje ile profesyonel AI stüdyo deneyimi. |
| **Benefits (Avantajlar)** | Aşağıdaki metni kopyala-yapıştır |

```
Premium AI Stüdyo araçlarına erişim
Filigransız yüksek kaliteli indirme
Aylık 1.000 işlem kredisi
30 GB bulut depolama
Abone indirimli ek kredi paketleri
Standart kurulum rehberi ve onboarding videoları
```

**Kaydet (Save)** dedikten sonra, abonelik sayfası açılır. Şimdi içine **temel plan** ekleyeceksin.

### Adım 2 — Temel Plan Ekle (Add base plan)
Abonelik sayfasında göreceğin buton: **`Add base plan`**

Açılan formu şöyle doldur:

| Alan | Değer |
|---|---|
| **Base plan ID** | `solo-monthly` |
| **Tags (Etiketler)** | Boş bırak veya `tr` yaz |
| **Auto-renewing (Otomatik yenileme)** | ✅ Seçili olsun (tek seçenek zaten) |
| **Billing period (Faturalama periyodu)** | `Monthly` |
| **Price (Fiyat)** | **TRY 699,00** |

**Teklif ekle (Add offer)** → Şimdilik **boş bırak** (Skip / Cancel). Sonra kaydet.

---

---

## 2. SOLO YILLIK — `solo_annual`

### Temel Bilgiler
| Alan | Değer |
|---|---|
| **Product ID** | `solo_annual` |
| **Name (Ad)** | Solo Yıllık Abonelik |
| **Description (Açıklama)** | Aynı Solo avantajları yıllık ödemeyle — 2 ay ücretsiz kazanın. |

### Base Plan (Temel Plan)
| Alan | Değer |
|---|---|
| **Temel plan kimliği (Base plan ID)** | `solo-annual` |
| **Tür** | **Otomatik yenileme** (Auto-renewing) |
| **Etiketler** | Boş bırak veya `tr` |
| **Faturalama periyodu (Billing period)** | `Annual` |
| **Fiyat (Price)** | **TRY 6.588,00** |

### Benefits (Avantajlar)
```
Premium AI Stüdyo araçlarına erişim
Filigransız yüksek kaliteli indirme
Aylık 1.000 işlem kredisi
30 GB bulut depolama
Abone indirimli ek kredi paketleri
Standart kurulum rehberi ve onboarding videoları
```

---

## 3. PRO AYLIK — `pro_monthly`

### Temel Bilgiler
| Alan | Değer |
|---|---|
| **Product ID** | `pro_monthly` |
| **Name (Ad)** | Pro Aylık Abonelik |
| **Description (Açıklama)** | Aylık 2.200 işlem kredisi, 100 GB depolama, 5 kişilik ekip workspace'i ve VR hizmetlerinde %20 indirim. |

### Base Plan (Temel Plan)
| Alan | Değer |
|---|---|
| **Temel plan kimliği (Base plan ID)** | `pro-monthly` |
| **Tür** | **Otomatik yenileme** (Auto-renewing) |
| **Etiketler** | Boş bırak veya `tr` |
| **Faturalama periyodu (Billing period)** | `Monthly` |
| **Fiyat (Price)** | **TRY 1.499,00** |

### Benefits (Avantajlar)
```
Premium AI Stüdyo araçlarına sınırsız erişim
VR ve üretim hizmetlerinde %20 abone indirimi
Filigransız yüksek kaliteli indirme
Öncelikli render kuyruğu ve hızlı işlem
5 kişilik ekip workspace yönetimi
100 GB bulut depolama alanı
```

---

## 4. PRO YILLIK — `pro_annual`

### Temel Bilgiler
| Alan | Değer |
|---|---|
| **Product ID** | `pro_annual` |
| **Name (Ad)** | Pro Yıllık Abonelik |
| **Description (Açıklama)** | Aynı Pro avantajları yıllık ödemeyle — 2 ay ücretsiz kazanın. |

### Base Plan (Temel Plan)
| Alan | Değer |
|---|---|
| **Temel plan kimliği (Base plan ID)** | `pro-annual` |
| **Tür** | **Otomatik yenileme** (Auto-renewing) |
| **Etiketler** | Boş bırak veya `tr` |
| **Faturalama periyodu (Billing period)** | `Annual` |
| **Fiyat (Price)** | **TRY 14.388,00** |

### Benefits (Avantajlar)
```
Premium AI Stüdyo araçlarına sınırsız erişim
VR ve üretim hizmetlerinde %20 abone indirimi
Filigransız yüksek kaliteli indirme
Öncelikli render kuyruğu ve hızlı işlem
5 kişilik ekip workspace yönetimi
100 GB bulut depolama alanı
```

---

## 5. STUDIO AYLIK — `studio_monthly`

### Temel Bilgiler
| Alan | Değer |
|---|---|
| **Product ID** | `studio_monthly` |
| **Name (Ad)** | Studio Aylık Abonelik |
| **Description (Açıklama)** | Aylık 7.000 işlem kredisi, 750 GB depolama, 20 kişilik ekip, özel proje yöneticisi ve white-label API desteği. |

### Base Plan (Temel Plan)
| Alan | Değer |
|---|---|
| **Temel plan kimliği (Base plan ID)** | `studio-monthly` |
| **Tür** | **Otomatik yenileme** (Auto-renewing) |
| **Etiketler** | Boş bırak veya `tr` |
| **Faturalama periyodu (Billing period)** | `Monthly` |
| **Fiyat (Price)** | **TRY 4.999,00** |

### Benefits (Avantajlar)
```
Tüm Pro özellikleri dahil
20 kişilik geniş ekip workspace yönetimi
750 GB paylaşımlı bulut depolama
Özel proje yöneticisi desteği
White-label ve API modülleri için hazır altyapı
Tam gün AI & VR kurulum ve ekip eğitimi
```

---

## 6. STUDIO YILLIK — `studio_annual`

### Temel Bilgiler
| Alan | Değer |
|---|---|
| **Product ID** | `studio_annual` |
| **Name (Ad)** | Studio Yıllık Abonelik |
| **Description (Açıklama)** | Aynı Studio avantajları yıllık ödemeyle — 2 ay ücretsiz kazanın. |

### Base Plan (Temel Plan)
| Alan | Değer |
|---|---|
| **Temel plan kimliği (Base plan ID)** | `studio-annual` |
| **Tür** | **Otomatik yenileme** (Auto-renewing) |
| **Etiketler** | Boş bırak veya `tr` |
| **Faturalama periyodu (Billing period)** | `Annual` |
| **Fiyat (Price)** | **TRY 47.988,00** |

### Benefits (Avantajlar)
```
Tüm Pro özellikleri dahil
20 kişilik geniş ekip workspace yönetimi
750 GB paylaşımlı bulut depolama
Özel proje yöneticisi desteği
White-label ve API modülleri için hazır altyapı
Tam gün AI & VR kurulum ve ekip eğitimi
```

---

## KREDİ PAKETLERİ (In-app Products — Consumable)

Play Console → `Monetize` → `Products` → `In-app products` → `Create product`

Bu ürünlerde "Benefits" alanı yoktur. Sadece aşağıdaki alanları doldur:

### 1. `boost_500_std`
| Alan | Değer |
|---|---|
| **Product ID** | `boost_500_std` |
| **Name** | 500 Kredi Paketi |
| **Description** | 500 işlem kredisi — standart fiyat. |
| **Product type** | **Consumable** (çok önemli!) |
| **Price** | **TRY 450,00** |

### 2. `boost_500_sub`
| Alan | Değer |
|---|---|
| **Product ID** | `boost_500_sub` |
| **Name** | 500 Kredi Paketi (Abone) |
| **Description** | 500 işlem kredisi — abone indirimli fiyat. |
| **Product type** | **Consumable** |
| **Price** | **TRY 350,00** |

### 3. `boost_1500_std`
| Alan | Değer |
|---|---|
| **Product ID** | `boost_1500_std` |
| **Name** | 1.500 Kredi Paketi |
| **Description** | 1.500 işlem kredisi — standart fiyat. |
| **Product type** | **Consumable** |
| **Price** | **TRY 1.150,00** |

### 4. `boost_1500_sub`
| Alan | Değer |
|---|---|
| **Product ID** | `boost_1500_sub` |
| **Name** | 1.500 Kredi Paketi (Abone) |
| **Description** | 1.500 işlem kredisi — abone indirimli fiyat. |
| **Product type** | **Consumable** |
| **Price** | **TRY 900,00** |

### 5. `boost_4000_std`
| Alan | Değer |
|---|---|
| **Product ID** | `boost_4000_std` |
| **Name** | 4.000 Kredi Paketi |
| **Description** | 4.000 işlem kredisi — standart fiyat. |
| **Product type** | **Consumable** |
| **Price** | **TRY 2.700,00** |

### 6. `boost_4000_sub`
| Alan | Değer |
|---|---|
| **Product ID** | `boost_4000_sub` |
| **Name** | 4.000 Kredi Paketi (Abone) |
| **Description** | 4.000 işlem kredisi — abone indirimli fiyat. |
| **Product type** | **Consumable** |
| **Price** | **TRY 2.200,00** |

---

## SON KONTROL LİSTESİ

Tümünü doldurduktan sonra tek tek kontrol et:

**Abonelikler (Subscriptions) — 6 adet:**
- [ ] `solo_monthly` oluşturuldu, fiyat TRY 699,00, avantajlar yazıldı, **Aktif**
- [ ] `solo_annual` oluşturuldu, fiyat TRY 6.588,00, avantajlar yazıldı, **Aktif**
- [ ] `pro_monthly` oluşturuldu, fiyat TRY 1.499,00, avantajlar yazıldı, **Aktif**
- [ ] `pro_annual` oluşturuldu, fiyat TRY 14.388,00, avantajlar yazıldı, **Aktif**
- [ ] `studio_monthly` oluşturuldu, fiyat TRY 4.999,00, avantajlar yazıldı, **Aktif**
- [ ] `studio_annual` oluşturuldu, fiyat TRY 47.988,00, avantajlar yazıldı, **Aktif**

**Kredi Paketleri (In-app Products) — 6 adet:**
- [ ] `boost_500_std` oluşturuldu, fiyat TRY 450,00, tür **Consumable**, **Aktif**
- [ ] `boost_500_sub` oluşturuldu, fiyat TRY 350,00, tür **Consumable**, **Aktif**
- [ ] `boost_1500_std` oluşturuldu, fiyat TRY 1.150,00, tür **Consumable**, **Aktif**
- [ ] `boost_1500_sub` oluşturuldu, fiyat TRY 900,00, tür **Consumable**, **Aktif**
- [ ] `boost_4000_std` oluşturuldu, fiyat TRY 2.700,00, tür **Consumable**, **Aktif**
- [ ] `boost_4000_sub` oluşturuldu, fiyat TRY 2.200,00, tür **Consumable**, **Aktif**

**RevenueCat Dashboard Kontrol:**
- [ ] Tüm 12 ürün RevenueCat'te yeşil tik (✅) gösteriyor.
- [ ] `default` offering içinde 12 package oluşturuldu.
- [ ] 3 entitlement (`solo`, `pro`, `studio`) oluşturuldu.

Hepsi tamamsa: Yeni bir build al (`eas build --profile production --platform android`) ve test et.
