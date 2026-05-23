# Archilya Mobil Store Release Checklist

Bu dokuman, mobil uygulamayi magazaya yayinlamadan once zorunlu kalan adimlari tek sayfada toplar.

## 1) Bugun Tamamlananlar

- [x] Kritik proje/dosya/trash mutasyonlari secure callable tabanina tasindi.
- [x] AI cikti kaydetme mutasyonlari secure callable tabanina tasindi.
- [x] Bildirim mark-as-read ve push token kaydi secure callable tabanina tasindi.
- [x] Mobil `app/` ve `src/` tarafinda dogrudan Firestore write kalmadi.

## 2) Canliya Cikis Oncesi Zorunlu Adimlar

- [ ] Cloud Functions deploy:
  - `archilya-web/functions/index.js` icindeki yeni callable'lar canliya alinmali.
- [ ] Odeme ayarlari:
  - `app.json > expo.extra.billing.checkoutUrl` production checkout adresi ile doldurulmali.
- [ ] iOS OAuth ayarlari (iOS hedefleniyorsa):
  - `app.json > expo.extra.googleAuth.iosClientId` doldurulmali.
- [ ] Store metinleri:
  - gizlilik politikasi URL
  - kullanici destek e-postasi ve web adresi
  - store aciklamalari ve ekran goruntuleri

## 3) Yayin Oncesi Son Test Paketi (Gercek Cihaz)

- [ ] Kayit/giris (e-posta + Google)
- [ ] Proje olusturma, dosya yukleme, dosya onizleme
- [ ] AI uretim, tekrar uretim, varyasyon, projeye kaydetme
- [ ] Cop kutusuna tasima, geri yukleme, kalici silme
- [ ] Bildirim ekraninda tekli/tumunu okundu
- [ ] Push bildirime tiklayinca dogru ekrana yonlenme
- [ ] Abonelik/kredi checkout sayfasina yonlenme

## 4) Build ve Submission

- [ ] Android production build (`eas build -p android --profile production`)
- [ ] Android submit (`eas submit -p android --profile production`)
- [ ] iOS production build (hedef varsa)
- [ ] iOS submit (hedef varsa)
