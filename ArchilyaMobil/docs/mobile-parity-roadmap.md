# Archilya Mobil - Web Parity + Native Powerups Roadmap

Bu dokuman, `C:\NNG\proje61\archilya-web` urun kapsamini mobilde tamamlamak ve mobil-native ozellikleri eklemek icin faz bazli uygulama planidir.

## 0. Hedef ve Kapsam

### Ana hedef
- Web uygulamasindaki ana kullanici akislarini mobilde birebir kapsamak.
- Mobilin dogal guclerini eklemek: kamera, galeri, push, paylasim, offline.
- Production release seviyesine ulasmak: guvenlik, test, crash, analytics, store hazirligi.

### Basari kriterleri
- Feature parity matrix icindeki P0/P1 maddelerin tamamlanmasi.
- AI ve file workflows icin end-to-end mobil senaryolarinin calismasi.
- Kritik akislarda regressionsiz release adayi cikmasi.

## 1. Fazlar ve Teslimatlar

## Faz 1 - Mimari Birlesme ve Kod Hijyeni

### Amac
Tekrarlayan ekran mantigini azaltmak, servis katmanini netlestirmek, kritik write akislarini merkezi hale getirmek.

### Is kalemleri
- Ortak UI parcalari: proje olusturma, ortak aksiyon sheetleri, ortak bos/loading state.
- Domain/service katmanlari: projects, files, ai, invites, notifications, workspace, credits.
- Mevcut duplicate akislarin birlestirilmesi.

### Kabul kriterleri
- Ayni islev farkli ekranlarda ayni component/servis uzerinden calsin.
- Kod tekrari gozle gorulur bicimde azalsin.

### Durum
- Basladi: `src/components/ProjectCreateModal.tsx`

---

## Faz 2 - Core Product Parity (Dashboard + Projects + Project Detail + Trash)

### Amac
Mobilin gunluk ana kullanimini web seviyesine yaklastirmak.

### Is kalemleri
- Dashboard: kredi, son projeler, notification/invite ozet, hizli aksiyonlar.
- Projects: arama, filtre/siralama, CRUD, durum etiketleri.
- Project detail: dosya listesi, upload, paylas, ac, soft delete.
- Trash: proje ve dosya restore/permanent delete.

### Kabul kriterleri
- Kullanici mobilden proje yaratip dosya yukleyip duzenleyebilsin.
- Silme/geri yukleme akislari tutarli calissin.

### Durum
- Kismen tamamlandi.

---

## Faz 3 - File Experience 2.0 (Preview + Folder + Version)

### Amac
Dosya deneyimini sadece upload olmaktan cikarip proje-icinde calisma seviyesine getirmek.

### Is kalemleri
- In-app file preview ekranlari (image, pdf).
- File action menuleri: ac, paylas, indir, projeye kaydet.
- Folder management (create/rename/delete).
- AI ciktilarini mevcut dosyaya version olarak kaydetme.

### Kabul kriterleri
- Kullanici proje dosyalarini app icinde preview edebilsin.
- Dosya aksiyonlari tekil ve tutarli bir menu ile sunulsun.

### Durum
- Basladi: project detail upload + open/share gelistirildi.

---

## Faz 4 - Inbox, Notifications, Invitations, Collaboration

### Amac
Ekipli kullanimi mobilde tamamlamak.

### Is kalemleri
- Inbox ekrani (notification + invitation).
- Mark as read / mark all as read.
- Invite kabul/red akislari.
- Project ve workspace davet tiplerinin ayrisimi.

### Kabul kriterleri
- Bildirimden ilgili ekrana deep-link calissin.
- Kullanici davet akislarini tamamen mobilden yonetebilsin.

### Durum
- Basladi: `app/(tabs)/inbox.tsx`, tab badge aktif.

---

## Faz 5 - AI Studio Full Parity

### Amac
Web AI Studio degerini mobilde de saglamak.

### Is kalemleri
- Tool parity: analysis, img2img, enhance, plancolor, sceneedit.
- Tool-specific formlar ve reference akislar.
- Result UX: retry, variation, save, share, projecte kaydet.
- Prompt presets + history.

### Kabul kriterleri
- AI akislari tek secure endpoint (`runAiStudioToolSecure`) uzerinden calissin.
- Kullanici ayni girdiyi tekrar ve varyasyonla uretebilsin.

### Durum
- Basladi: secure AI migration tamamlandi.

---

## Faz 6 - Kamera ve Mobil-Native AI Akislari

### Amac
Saha kullaniminda webden daha guclu bir mobil deneyim vermek.

### Is kalemleri
- Kamera capture mode (ic/dis/facade/plan).
- Galeri ve dokuman secimi.
- Hedefe gore otomatik optimize upload (compression/resize).
- Sahadan AI workflow: cek -> isle -> projeye kaydet.

### Kabul kriterleri
- Kamera ve galeri secimi tum kritik AI ve upload akislarda aktif olsun.

### Durum
- Basladi: `src/services/mediaService.js` ile temel pipeline aktif.

---

## Faz 7 - Workspace / Team Parity

### Amac
Studio plani ekip yonetimini mobilde tamamlama.

### Is kalemleri
- Workspace olusturma.
- Workspace uye daveti, kabul/red, uye cikar.
- Pool credits ve pool storage gorunumu.
- Workspace odakli notification tipleri.

### Kabul kriterleri
- Admin mobilde workspace yonetebilsin.
- Uye mobilde workspace davetini kabul/red yapabilsin.

---

## Faz 8 - Billing, Subscription, Credits

### Amac
Ticari akislarin mobilde production seviyesine cikmasi.

### Is kalemleri
- Plan secimi, kredi paketleri.
- Satin alma stratejisi: in-app purchase / web checkout.
- Islem gecmisi ve plan gecis loglari.
- Credits history ekrani.

### Kabul kriterleri
- Kredi ve plan degisimi backendde dogru islenmeli.
- Kullanici neyi aldigini ve ne harcadigini izleyebilmeli.

### Durum
- Basladi: `app/credits.tsx` eklendi, `useCredits` genisletildi.

---

## Faz 9 - Guvenlik ve Backend Contract Hardening

### Amac
Client tarafindaki kritik write akislarini secure callable fonksiyonlara tasimak.

### Is kalemleri
- project invite akislari secure callables ile.
- workspace akislari secure callables ile.
- subscription/credits secure callables ile.
- rules ve permission audit.

### Kabul kriterleri
- Kritik mutationlarda dogrudan Firestore write minimize edilmeli.
- Client yetki bypass riski olmamali.

---

## Faz 10 - Push, Offline, Reliability

### Amac
Saha kosullarinda stabil ve guvenilir uygulama.

### Is kalemleri
- Push token toplama ve yonlendirme.
- Notification response deep-link.
- Offline cache (son projeler, son bildirimler).
- Upload retry queue.

### Kabul kriterleri
- Bildirime tiklayinca ilgili ekran acilsin.
- Zayif ag kosullarinda temel akislarda veri kaybi olmasin.

### Durum
- Basladi: push registration temeli eklendi.

---

## Faz 11 - QA, Observability, Release

### Amac
Store submission ve canliya cikis kalitesi.

### Is kalemleri
- Unit/integration smoke test seti.
- Crash reporting ve analytics.
- Release checklist: permissions, privacy, screenshots, store metinleri.

### Kabul kriterleri
- Kritik akislarda test gecisleri.
- Crash/analytics eventi dogru akiyor.

## 2. Oncelik Sirasi (Uygulama)

1) Faz 3 + Faz 5: file preview + AI history/retry/variation.
2) Faz 9: invitation ve workspace secure callable migration.
3) Faz 7: workspace UI parity.
4) Faz 10: push deep-link routing + offline temeli.
5) Faz 8: billing stratejisi ve gercek satin alma akisi.

## 3. Teknik Notlar

- AI tarafinda tek dogru kaynak `runAiStudioToolSecure` hattidir.
- Firestore doc size riskinden dolayi AI image sonucu tam dataUrl saklanmamalidir.
- Kredi ve plan islemlerinde server-side authority korunmalidir.

## 4. Haftalik Ornek Zamanlama

- Hafta 1-2: Faz 3 + Faz 5 (result UX + history + preview).
- Hafta 3: Faz 9 ilk gecis (project invite secure).
- Hafta 4: Faz 7 (workspace UI + invite flows).
- Hafta 5: Faz 10 (push deep-link + offline temel).
- Hafta 6: Faz 8 (billing kararina gore uygulama).
- Hafta 7: Faz 11 (test + hardening).

Bu plan dinamik tutulmali ve her sprint sonunda kabul kriterleri bazinda revize edilmelidir.
