# Archilya Mobil Delivery Plan (Professional Parity)

Bu plan, web urunundeki tum ana akislarin mobilde production seviyesinde calismasi icin uygulanacak teslim planidir.
Dokuman sprint bazli islenir, her sprint sonunda kabul kriterlerine gore guncellenir.

## 1) Hedef

- Web parity: dashboard, project, file, ai, inbox, workspace, billing akislarinin mobilde eksiksiz calismasi
- Native powerups: kamera, galeri, push, deep-link, offline/retry guvenilirligi
- Production readiness: guvenlik, gozlemlenebilirlik, test, release checklist

## 2) Basari Kriterleri

- P0 akislarda regressionsiz calisma (login, proje, dosya, ai, davet, workspace)
- Kritik mutationlarin secure callable uzerinden calismasi
- AI ve dosya akislarinda en az 20 senaryolik smoke test setinin tam gecmesi
- Android release adayi build + store checklist tamamlama

## 3) Fazlar ve Is Paketi

### Faz A - File + AI parity closure (aktif)

Kapsam:
- AI history kaydindan tekrar uretim ve varyasyon uretim
- File metadata/preview aksiyonlarinin tek mantikta birlestirilmesi
- PDF in-app preview + tarayici fallback
- Yeni proje olusturma akislarinin tek data kontratina alinmasi

Kabul:
- Kullanici gecmisten tek dokunusla AI retry/variation baslatabilmeli
- PDF dosyalari mobil icinde onizlenebilmeli, hata durumunda fallback net olmali
- Farkli ekranlardan acilan ayni dosya ayni kategori/mime mantigiyla davranmali

### Faz B - Security hardening (kritik)

Kapsam:
- Project/file/trash mutationlarini secure callable migration
- Client-side dogrudan write alanlarini minimuma indirme
- Rules audit + yetki bypass risklerinin kapatilmasi

Kabul:
- Kritik mutationlarda direct Firestore write kullanilmamali
- Yetkisiz kullanici ile negatif testlerde tum mutationlar reddedilmeli

Durum (2026-04-12):
- Mobil `app/` + `src/` tarafindaki proje/dosya/ai/trash/bildirim/push/aiHistory mutasyonlari secure callable tabanina alindi.
- Kalan adim: yeni callable'larin production deploy'u ve negatif test checklistinin tamamlanmasi.

### Faz C - Workspace + Inbox parity

Kapsam:
- Invite tip ayrisimi, mark-as-read, deep-link davranis tamamlama
- Workspace admin/member akislarinda edge-case duzeltmeleri

Kabul:
- Davet/notification akislarinda ilgili ekrana yonlenme tutarli olmali

### Faz D - Billing + Credits production

Kapsam:
- Gercek plan degistirme ve kredi satin alma entegrasyonu
- Islem gecmisi ve plan degisim audit gorunumu

Kabul:
- Satin alma sonucu server-side dogrulama ile kredi/plan guncellenmeli
- Kullanici tarafinda gecmis ve bakiye tutarli gorunmeli

### Faz E - Reliability + release

Kapsam:
- Push deep-link routing hardening
- Offline cache + upload retry queue
- Crash/analytics + release checklist

Kabul:
- Zayif ag kosullarinda veri kaybi olmadan temel akislar tamamlanmali

## 4) Tahmini Takvim (is gucu)

- Faz A: 3-5 is gunu
- Faz B: 5-8 is gunu (backend callable kapsamina bagli)
- Faz C: 2-4 is gunu
- Faz D: 4-7 is gunu (odeme saglayici ve backend kontratina bagli)
- Faz E: 3-5 is gunu

Toplam: 17-29 is gunu (entegrasyon ve QA dahil).

## 5) Riskler

- Backend callable eksigi: migration hizini dusurur
- Billing kontrati belirsizligi: Faz D gecikme riski
- Platform farklari: Android/iOS dosya URI farklarinda ek test ihtiyaci

## 6) Isletim Kurali

- Her merge sonrasi: type-check + cihaz smoke test
- Her faz sonunda: kabul kriteri checklisti doldurulur
- Guvenlik odakli degisikliklerde fallback yerine fail-closed tercih edilir
