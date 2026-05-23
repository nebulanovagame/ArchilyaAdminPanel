# Yapilanlar Ozeti (2026-03-26)

## Genel Durum
- Mobil uygulama web tarafina daha yakin hale getirildi ve demo icin kritik akislarda stabilizasyon yapildi.
- AI, dosya yonetimi, giris (Google dahil), davet/inbox/workspace ve build surecleri uzerinde ilerleme tamamlandi.

## Tamamlanan Ana Isler
- AI backend entegrasyonu web ile hizalandi (`runAiStudioToolSecure`) ve AI ekran akislari buna gore guncellendi.
- AI gorsel isleme boru hatti guclendirildi:
  - `content://` ve `ph://` URI destegi iyilestirildi.
  - Kirilgan `fetch(uri)` fallback yaklasimi kaldirildi.
  - AI sonucu kaydetmede `uploadString(data_url)` yoluna gecildi.
- Proje dosya yukleme akisi guclendirildi:
  - `fetch -> blob -> uploadBytes` basarisiz olursa `uploadString(data_url)` fallback eklendi.
  - Dosya boyutu/metadata guncellemeleri korundu.
- Dosya onizleme ekrani iyilestirildi:
  - Gorsel olmayan dosyalar icin daha guvenli fallback ve acma secenekleri eklendi.
  - PDF icin tarayici tabanli onizleme akisi eklendi.
  - Gorsel dosyayi AI Studio'ya gonderme kisayolu eklendi.
- Google Sign-In akisi guclendirildi:
  - Ortak servis eklendi (`src/services/googleAuthService.ts`).
  - Login/Register ekranlari yeni servisle duzenlendi.
  - Android OAuth hata durumlari icin daha acik yonlendirme mesaji eklendi.
  - `app.json` icine `expo.extra.googleAuth.nativeScheme` alani eklendi.
- Inbox, davetler, workspace ve proje detay akislarinda onceki turlarda eklenen gelistirmeler korundu.

## Kontroller ve Build Ciktilari
- Tip kontrolu basarili: `npx tsc --noEmit` (hata yok).
- Android preview APK build tamamlandi.
  - Build ID: `194fdcf3-911d-468d-a1e0-fe23216ed54f`
  - Artifact URL: `https://expo.dev/artifacts/eas/48hBNiJ5KxizuNqVarDnxv.apk`
  - Lokal dosya: `C:\NNG\proje61\ArchilyaMobil\ArchilyaMobil-preview-v4.apk`

## Son Turda Guncellenen Dosyalar
- `src/services/googleAuthService.ts`
- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`
- `app/file-preview.tsx`
- `app/project/[id].tsx`
- `src/services/aiStudioService.js`
- `app/(tabs)/ai.tsx`
- `app.json`

## Son Gelismeler (2026-04-12)
- AI History replay akisi eklendi:
  - `app/ai-history.tsx` uzerinden `Tekrar Uret` / `Varyasyon Uret` aksiyonlari tanimlandi.
  - `app/(tabs)/ai.tsx` gecmis kaydindan payload yukleyip otomatik uretim baslatacak sekilde guncellendi.
  - `src/hooks/useAiHistory.js` kayit modeline `promptRaw`, `sourceImageUri`, `sourceProjectId`, `sceneReferences` alanlari eklendi.
- Dosya deneyimi tekillestirildi:
  - `src/utils/fileUtils.js` ile dosya uzanti/mime/kategori/boyut mantigi merkezilestirildi.
  - `app/project/[id].tsx` ve `app/file-preview.tsx` bu ortak mantiga tasindi.
- PDF deneyimi iyilestirildi:
  - `app/file-preview.tsx` icinde in-app PDF onizleme (WebView) ve guvenli tarayici fallback eklendi.
  - `react-native-webview` bagimliligi projeye eklendi.
- Yeni proje olusturma modal route'u standart hale getirildi:
  - `app/modal.tsx` dogrudan write yerine `useProjects().addProject` akisini kullanacak sekilde duzenlendi.
- Abonelik ekrani gercek akisa yaklastirildi:
  - `app/subscription.tsx` plan degisikligi icin `upgradeSubscriptionSecure` kullanimina alindi.
  - Kredi satin alma icin `expo.extra.billing.checkoutUrl` tabanli checkout acilisi eklendi.
  - `app.json` icine `expo.extra.billing.checkoutUrl` alani eklendi.
- Plan dokumani detaylandirildi:
  - `docs/mobile-delivery-plan.md` olusturuldu.
- Kontrol:
  - `npx tsc --noEmit` basarili (hata yok).

## Son Gelismeler (2026-04-12 - Devam)
- AI Studio sonuc kaydetme akislari web parity'ye yaklastirildi (`app/(tabs)/ai.tsx`):
  - Yeni dosya / yeni versiyon kaydetme secenekleri eklendi.
  - `AI Ciktilari` klasoru otomatik olusturma mantigi eklendi.
  - Sonucu ana sahne yapma ve sceneedit icin referansa ekleme aksiyonlari eklendi.
  - Prompt history secure (get/save) entegrasyonu eklendi; son promptlar paneli olusturuldu.
  - Native dosya paylasimi icin `expo-sharing` ile guvenli paylasim akisina gecildi.
- AI sonuc kaydetme modal bileşeni eklendi:
  - `src/components/AiSaveResultModal.tsx`
- Entitlement servis genisletildi:
  - `src/services/entitlementService.js` icine `getAiPromptHistorySecure` ve `saveAiPromptHistorySecure` wrapper'lari eklendi.
- R2 hibrit depolama mobil tarafa tasindi:
  - `src/services/r2StorageService.js` eklendi (signed upload/download/delete).
  - `app/project/[id].tsx` yukleme akisinda R2 route (size/ext/type) ve provider metadata eklendi.
  - `app/file-preview.tsx` R2 dosyalar icin signed download URL cozumleme destegi eklendi.
  - `app/trash.tsx` kalici silmede R2 object silme destegi eklendi.
- Kontrol:
  - `npx tsc --noEmit` tekrar calistirildi ve basarili.

## Son Gelismeler (2026-04-12 - Security Hardening Devam)
- Project/trash/AI kaydetme mutasyonlarinda secure callable kapsami genisletildi.
- Mobil wrapper genisletmeleri (`src/services/entitlementService.js`):
  - `createProjectFolderSecure`
  - `addProjectFileSecure`
  - `moveProjectFileToTrashSecure`
  - `saveAiOutputToProjectSecure`
- Proje detayinda kritik mutasyonlar callable tabanina tasindi (`app/project/[id].tsx`):
  - Dosya metadata kaydi (`addProjectFileSecure`)
  - Klasor olusturma (`createProjectFolderSecure`)
  - Dosya cop kutusuna tasima (`moveProjectFileToTrashSecure`)
- AI Studio sonuc kaydetme mutasyonu callable tabanina tasindi (`app/(tabs)/ai.tsx`):
  - `AI Ciktilari` klasoru olusturma `createProjectFolderSecure` ile
  - Yeni dosya/versiyon metadata guncellemesi `saveAiOutputToProjectSecure` ile
- Backend callable'lar eklendi (`C:\NNG\proje61\archilya-web\functions\index.js`):
  - `createProjectFolderSecure`
  - `addProjectFileSecure`
  - `moveProjectFileToTrashSecure`
  - `saveAiOutputToProjectSecure`
  - (onceki turdaki) `softDeleteProjectSecure`, `restoreProjectSecure`, `hardDeleteProjectSecure`, `restoreProjectFileSecure`, `permanentlyDeleteProjectFileSecure`
- Kontroller:
  - Mobil: `npx tsc --noEmit` basarili.
  - Functions: `node --check index.js` basarili.

## Son Gelismeler (2026-04-12 - Security Hardening Devam 2)
- Proje olusturma callable tabanina tasindi:
  - Mobil: `useProjects.addProject` -> `createProjectSecure`
  - Backend: `createProjectSecure`, `updateProjectSecure`
- Bildirim mutasyonlari callable tabanina tasindi:
  - Mobil: `useNotifications.markAsRead/markAllAsRead`
  - Backend: `markNotificationReadSecure`, `markAllNotificationsReadSecure`
- Push token kaydi callable tabanina tasindi:
  - Mobil: `usePushNotifications` -> `registerPushTokenSecure`
  - Backend: `registerPushTokenSecure`
- AI history write mutasyonlari callable tabanina tasindi:
  - Mobil: `useAiHistory.logAiHistory/updateAiHistoryEntry`
  - Backend: `logAiHistoryEntrySecure`, `updateAiHistoryEntrySecure`
- Son durum:
  - Mobil `src/` altinda dogrudan Firestore write (`addDoc/updateDoc/deleteDoc/setDoc`) kalmadi.
  - Kontrol: `npx tsc --noEmit` ve `node --check index.js` tekrar basarili.

## Son Gelismeler (2026-04-12 - Billing Akisi Duzenleme)
- Abonelik ekrani yalanci plan gecisi denemesinden cikarildi (`app/subscription.tsx`).
- Plan secimi artik odeme adimina yonlendiriyor (`checkoutUrl?type=subscription&planId=...`).
- Kredi paketleri checkout akisi korunarak devam ediyor.
- Sonuc: odeme dogrulamasi olmadan plan yukseltme denemesi frontendde tetiklenmiyor.

## Son Gelismeler (2026-04-12 - Deploy + Production Build)
- Firebase Functions canli deploy basariyla tamamlandi (`project: nng-toma`).
- Yeni callable endpoint'ler production'da aktif.
- Android production AAB build alindi (EAS):
  - Build ID: `5a40d1a8-bf9b-4264-b642-da6ee5aa781d`
  - Artifact URL: `https://expo.dev/artifacts/eas/c9pgWbTvR15ER4quJHYapk.aab`
- Android submit denemesi yapildi:
  - Blokaj: Google Play Service Account anahtari non-interactive modda tanimli degil.
  - Not: Submission icin EAS Submit credentials kurulumu gerekli.

## Son Gelismeler (2026-04-12 - Kritik Hata Duzeltmeleri)
- Giris/Kayit ekranlari:
  - Parola input'larina klavye ve autofill stabilizasyonu eklendi (`keyboardShouldPersistTaps`, `autoComplete`, `textContentType`, `autoCorrect=false`).
  - Google auth request config guclendirildi (`clientId` fallback + `responseType: id_token`).
  - Google hata mesajlari detaylandirildi (`redirect_uri_mismatch`, `invalid-credential` vb.).
- Dosya onizleme:
  - R2 URL'den objectKey fallback cozumlemesi eklendi (`r2://...` kayitlar icin).
  - Gorsel onizlemede hata halinde local cache fallback eklendi (indirip local URI ile tekrar deneme).
  - Onizleme hata state'leri dosya degisiminde sifirlaniyor.
- AI prompt parity:
  - Mobil AI prompt metinleri webdeki premium prompt stratejisine yaklastirildi (analysis/img2img/enhance/plancolor/sceneedit).
- AI sonucu paylas:
  - Paylasim sonrasi gecici dosya silme non-blocking hale getirildi (donma riskini azaltmak icin).
  - `expo-sharing` yoksa native `Share` fallback eklendi.
- Test:
  - `npx tsc --noEmit` basarili.
- Yeni test APK:
  - Build ID: `324865e9-b8cc-4bae-a3b2-68732dd3fe4a`
  - APK: `https://expo.dev/artifacts/eas/7d8wLWzG8FFf4qRJ9S1zgy.apk`

## Son Gelismeler (2026-04-12 - Auth + Stabilite Tur 2)
- Uygulama adi duzeltildi:
  - Expo app name: `Archilya`
  - Android launcher name: `Archilya`
- Kalici oturum (beni hatirla) eklendi:
  - `src/config/firebase.js` icinde React Native auth persistence aktif edildi (`initializeAuth + AsyncStorage`).
- Login/Register klavye stabilizasyonu guclendirildi:
  - `keyboardShouldPersistTaps="always"`, `keyboardDismissMode="none"`
  - input focus zinciri (`onSubmitEditing`, `returnKeyType`, `blurOnSubmit=false`) eklendi.
- Google OAuth invalid_request duzeltmeleri:
  - Redirect URI formati `:/oauthredirect` olacak sekilde duzeltildi.
  - Android client ID Firebase Android app'ten gelen gecerli client ile guncellendi.
  - Android manifest'e ilgili redirect scheme'ler eklendi.
- Firebase tarafi tamamlandi (`project: nng-toma`):
  - Android app olusturuldu: `1:782938691094:android:c872ea938f1e1bbf54c737`
  - Release SHA-1 ve SHA-256 Firebase Android app'e eklendi.
- AI ekran donma riskini azaltan iyilestirmeler:
  - Generate/paylas akislari icin concurrency lock eklendi (double-tap korumasi).
  - Sonuc gorseli preview icin local cache dosyasina alinip render hafifletildi.
  - Arka plana geciste kilit/busy state reset guvencesi eklendi.
- Kontrol:
  - `npx tsc --noEmit` basarili.
- Yeni test APK:
  - Build ID: `e1284234-ca16-40c2-bbac-424f58c9c166`
  - APK: `https://expo.dev/artifacts/eas/tNAyLkm6ZNhgNiyAqVyAnd.apk`
