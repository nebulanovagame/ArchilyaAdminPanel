# Archilya Mobil - Eksiklik Analizi ve Geliştirme Raporu

Aşağıdaki rapor, mevcut proje kodlaması (`src`, `app` dizinleri) ve yol haritası (roadmap) dokümanlarının taranması sonucunda, uygulamanın market (App Store & Play Store) seviyesine çıkabilmesi için tamamlanması gereken eksiklikler ve geliştirme tavsiyelerini içermektedir.

## 1. Mimari ve Kod Hijyeni Eksiklikleri 🧹

> [!WARNING]
> Uygulama içerisinde bazı teknik borçlar gözlemlenmiştir. Bu durum, projenin büyümesi ile idamesini zorlaştıracaktır.

* **Aşırı Büyümüş Dosyalar (Fat Components):** `app/(tabs)/ai.tsx` dosyası **55 KB** boyutuna ulaşmıştır. Bu durum Faz 1'deki (Kod tekrarını azaltmak ve hijyen) hedeflere tamamen terstir. Form alanları, ayarlar ve sonuç ekranı alt-bileşenlere (components) bölünmelidir.
* **İsimlendirme Hataları:** Alt sekme isminde `app/(tabs)/two.tsx` dosyası hala kalmış durumda. Projeler sayfasını karşılıyor olmalı; isminin `projects.tsx` gibi açık bir formatla düzeltilmesi gerekmektedir.
* **Component Klasörlemesi:** Modal işlevleri, sheetler ve küçük arayüzler ana sayfaların içinde şişmekte. `src/components` içine daha sıkı bir aktarım yapılması gereklidir.

## 2. Offline Mod ve Kesinti Toleransı (Reliability) 📶

> [!IMPORTANT]
> Faz 10 vizyonunda (Offline cache, upload retry queue) yer alan geliştirmeler şu anda mevcut codebase'de bulunmamaktadır. Saha personeli için bu hususlar kritiktir.

* **Offline Upload Queue:** Büyük resim/dosya yüklemelerinde kullanıcının interneti kesilirse yükleme işlemine sonradan devam etmesini sağlayacak bir kuyruk sistemi (AsyncStorage & Worklet tabanlı) mekanizması eklenmeli.
* **Offline Görüntüleme:** Kullanıcının daha önce girdiği, incelediği dosyalar veya bildirimler internetsizken de okunabilmeli (Zustand-persist vb. bir araçla cache'leme şartı).
* **Push Routing:** Bildirim (Push Notification) tıklanınca uygulamanın direkt belirtilen spesifik projeye ya da AI modeline (Deep Linking) gitme sistemi tam olarak sağlamlaştırılmamış, testleri yapılmamıştır.

## 3. Klasör Yönetimi (Folder Management) 📂

* **Eksik Özellik:** Yol haritasının 3. Faz'ında "Folder management (create/rename/delete)" olarak belirtilmiş ancak `project/[id].tsx` ve `file-preview.tsx` kısmında klasör hiyerarşisi oluşturma deneyimi hala zayıf (veya tamamen uygulanmamış durumda). Kullanıcıların mobilden alt dosya dizinleri oluşturabilmesi için UI/UX entegrasyonu tamamlanmalıdır.

## 4. Ödeme Sistemi ve Store Engelleri (Billing & IAP) 💳

> [!CAUTION]
> Mobil uygulama planlama dahilinde web üzerinde gerçekleşen stripe/kredi kartı ödemesini doğrudan kullanırsa Apple/Google in-app satın alım politikalarından red (reject) yiyecektir.

* `app/credits.tsx` ve `subscription.tsx` mevcut. Fakat `RevenueCat` gibi In-App Purchase (IAP) soyutlama servislerine geçilmemiş durumda. 
* Marketlerde uygulamanın kabul edilmesi için fiziksel olmayan hizmetlerin uygulama içi satın alımla yapılıp arkadan Backend (Callable) ile Firebase'e aktarılması kurgusunun kurulması gereklidir.

## 5. Security ve Callable Migration (Faz 9) 🔒

* **Production Dağıtımı:** İstemci tarafı (`app/` ve `src/`) fonksiyonları `entitlementService.js` tabanlı servise bağlanmış görünüyor. Fakat Delivery Plan dokümanında **"production deploy'u ve negatif test checklistinin tamamlanması"** hala eksik / test bekliyor şeklinde raporlanmıştır. 
* **Negatif Testler:** "Yetkisiz bir kullanıcı bir projeyi silmeye veya modifiye etmeye çalıştığında güvenlik kuralları tam çalışıyor mu?" sorusunun `QA (Kalite Kontrol)` fazına geçmeden önce netleştirilmesi gereklidir.

## 6. Sentry, Test ve Release Operasyonları (Faz 11) 🚀

> [!TIP]
> Çıkış öncesi (Release) en önemli aşamalardır ve şu an boşluklar barındırmaktadır.

* **Crash Reporting:** `package.json` dosyasında `@sentry/react-native` kurulu ancak kapsamlı hata blokajı ve monitoring stratejisi aktif kullanılmıyor. Testlerden başarısız çıkıldığında analiz için Sentry entegrasyonunun konfigürasyon (`app.json` veya `sentry.properties`) edilmesi gerekir.
* **Apple Login / Configler:** Auth işlemlerinde Firebase ve Google Auth (`googleAuthService.ts`) yapılmış. Ortam değişkenlerinin (.env ve eas.json) production konfigürasyonları (Apple ID, ASC App ID, vb.) güncellenip `EAS Production` testi alınmalıdır.

---

### 🔥 İlk Yapılması Gereken Aksiyonlar (Immediate Next Steps)

1. `ai.tsx` dosyasını `src/components/ai/` altına parçalamak ve kod karmaşasını çözmek.
2. `two.tsx` sekmesini projenin anlamlı bir ismine büründürerek router linklerini (`href`) sabitlemek.
3. Offline durumlar (İnternet kesintisi) için dosya indirme/yükleme arızalarını yönetecek basit bir State Manager yapısı planlamak.
4. "In-app-purchase" konusuna teknik bir karar verip `RevenueCat` SDK kurulum hazırlığını yapmak.
