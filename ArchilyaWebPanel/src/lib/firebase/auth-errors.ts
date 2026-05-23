const authErrorMessages: Record<string, string> = {
  "auth/admin-restricted-operation": "Bu giriş yöntemi şu an etkin değil.",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Firebase API anahtarı geçersiz görünüyor. Panelin ortam ayarlarını kontrol edin.",
  "auth/email-already-in-use": "Bu e-posta adresi zaten kullanımda.",
  "auth/invalid-api-key": "Firebase API anahtarı geçersiz veya yanlış projeye bağlı.",
  "auth/invalid-credential": "E-posta veya şifre hatalı görünüyor.",
  "auth/invalid-email": "Geçerli bir e-posta adresi girin.",
  "auth/missing-password": "Şifrenizi girin.",
  "auth/network-request-failed": "Bağlantı kurulamadı. Lütfen tekrar deneyin.",
  "auth/operation-not-allowed": "Bu işlem şu anda etkin değil veya yeni e-posta doğrulaması gerekiyor.",
  "auth/popup-blocked": "Google giriş popup penceresi engellendi. Popup engelini kaldırıp tekrar deneyin.",
  "auth/popup-closed-by-user": "Google giriş penceresi kapatıldı.",
  "auth/cancelled-popup-request": "Google giriş isteği iptal edildi. Lütfen tekrar deneyin.",
  "auth/credential-already-in-use": "Bu kimlik bilgisi başka bir hesap tarafından kullanılıyor.",
  "auth/invalid-action-code": "İşlem bağlantısı geçersiz veya süresi dolmuş.",
  "auth/too-many-requests": "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.",
  "auth/requires-recent-login": "Bu işlem için lütfen tekrar giriş yapın.",
  "auth/unauthorized-domain": "Bu domain Firebase Authentication içinde yetkili değil.",
  "auth/user-not-found": "Bu e-posta ile eşleşen bir hesap bulunamadı.",
  "auth/user-mismatch": "Doğrulanan kullanıcı mevcut oturumla eşleşmiyor.",
  "auth/weak-password": "Şifre en az 6 karakter olmalıdır.",
  "auth/wrong-password": "E-posta veya şifre hatalı görünüyor.",
};

export function getFirebaseAuthErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    const code = String(error.code);
    return (
      authErrorMessages[code]
      ?? "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin."
    );
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.";
}
