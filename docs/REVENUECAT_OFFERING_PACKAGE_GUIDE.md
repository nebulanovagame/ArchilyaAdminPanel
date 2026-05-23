# RevenueCat Dashboard — Offering & Package Oluşturma (Adım Adım)

> Bu rehber, RevenueCat Dashboard'ta `default` offering içine 12 adet package eklemeyi adım adım anlatır.

---

## Offering ve Package Nedir? (Basitçe)

- **Offering** = Mağaza vitrini gibi düşün. Uygulamaya "hangi ürünleri göstereyim?" diye sorduğunda, RevenueCat bu vitrinden ürünleri getirir.
- **Package** = Vitrindeki tek tek ürünler. Her package, Play Console'daki bir ürünle eşleşir.

Uygulamada `Purchases.getOfferings()` çağrıldığında, **"default"** adlı offering'deki tüm package'lar gelir.

---

## Adım 1 — Offering Sayfasına Git

1. RevenueCat Dashboard açık: https://app.revenuecat.com/projects
2. Sol menüden: **`Products`** tıkla.
3. Açılan alt menüden: **`Offerings`** tıkla.
4. Ekranda **`default`** adlı bir offering göreceksin (önceden oluşturulmuştu). Üzerine tıkla.

> Eğer `default` yoksa: `+ New Offering` butonuna tıkla → Identifier: `default` → Save.

---

## Adım 2 — Package Ekleme

`default` offering sayfası açıldı. Şimdi içine package ekleyeceksin.

**Her package için aynı işlemi tekrarlayacaksın.** Toplam 12 package.

### Tek bir package nasıl eklenir:

1. Sayfada **`+ New Package`** butonuna tıkla.
2. Açılan pencerede:
   - **Identifier:** Package adını yaz (tablodan kopyala)
   - **Product:** `+ Add product` butonuna tıkla → listeden ilgili product'ı seç
   - (Sadece subscription package'ları için) **Entitlement:** `+ Add entitlement` butonuna tıkla → listeden entitlement'ı seç
3. **`Save`** butonuna tıkla.

---

## Tüm 12 Package Listesi

Aşağıdaki tabloyu tek tek takip et. Her satır = bir package.

### Abonelik Package'ları (6 adet — Entitlement'lı)

| Sıra | Package Identifier | Product (Seç) | Entitlement (Seç) |
|---|---|---|---|
| 1 | `solo_monthly` | `solo_monthly` | `solo` |
| 2 | `solo_annual` | `solo_annual` | `solo` |
| 3 | `pro_monthly` | `pro_monthly` | `pro` |
| 4 | `pro_annual` | `pro_annual` | `pro` |
| 5 | `studio_monthly` | `studio_monthly` | `studio` |
| 6 | `studio_annual` | `studio_annual` | `studio` |

### Kredi Package'ları (6 adet — Entitlementsiz)

| Sıra | Package Identifier | Product (Seç) | Entitlement |
|---|---|---|---|
| 7 | `boost_500_std` | `boost_500_std` | **Boş bırak** |
| 8 | `boost_500_sub` | `boost_500_sub` | **Boş bırak** |
| 9 | `boost_1500_std` | `boost_1500_std` | **Boş bırak** |
| 10 | `boost_1500_sub` | `boost_1500_sub` | **Boş bırak** |
| 11 | `boost_4000_std` | `boost_4000_std` | **Boş bırak** |
| 12 | `boost_4000_sub` | `boost_4000_sub` | **Boş bırak** |

> **Önemli:** Kredi package'larına **entitlement eklenmez**. Onlar sadece tek seferlik satın alım (consumable) olduğu için plan değiştirmezler.

---

## Adım 3 — Kontrol

Tüm 12 package'ı ekledikten sonra `default` offering sayfasında şunu görmelisin:

- **6 subscription package** (yanlarında `solo`, `pro`, `studio` etiketleri)
- **6 credit package** (yanlarında etiket yok)

Hepsi yeşil tik (✅) ile gözüküyorsa tamamdır.

---

## Sık Sorulan Sorular

**S: "Identifier zaten kullanılıyor" hatası alıyorum.**
C: O package zaten eklenmiş demektir. Listeye dönüp kontrol et.

**S: Product listesinde ürün gözükmüyor.**
C: Önce `Products` sekmesinden o product'ı oluşturman gerekli. [REVENUECAT_PLAYSTORE_SETUP.md](./REVENUECAT_PLAYSTORE_SETUP.md) rehberine bak.

**S: Entitlement seçeneği yok.**
C: Sadece subscription product'larında entitlement seçilir. Kredi product'larında bu alan görünmez.

**S: Package ekledim ama uygulamada gözükmüyor.**
C: 1) Play Console ürünü aktif mi? 2) RevenueCat'te product yanında yeşil tik var mı? 3) Offering identifier `default` mı?

---

## Sonraki Adımlar

Hepsi tamamsa:
1. **Build al:** `eas build --profile production --platform android`
2. **Play Console Internal Testing'e yükle**
3. **Test kullanıcısı ekle**
4. **Telefondan indirip satın almayı dene**
