const SUPABASE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  "invalid-credentials": "E-posta veya şifre hatalı.",
  "user-not-found": "Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.",
  "wrong-password": "Şifre hatalı.",
  "email-already-in-use": "Bu e-posta adresi zaten kullanılıyor.",
  "weak-password": "Şifre çok zayıf. En az 6 karakter olmalı.",
  "invalid-email": "Geçersiz e-posta adresi.",
  "user-disabled": "Bu hesap devre dışı bırakılmış.",
  "too-many-requests": "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.",
  "network-request-failed": "Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.",
  "popup-closed-by-user": "Giriş penceresi kapatıldı.",
  "cancelled-popup-request": "Giriş isteği iptal edildi.",
  "account-exists-with-different-credential": "Bu e-posta adresi farklı bir giriş yöntemiyle kayıtlı.",
  "requires-recent-login": "Bu işlem için yeniden giriş yapmanız gerekiyor.",
  "invalid-verification-code": "Geçersiz doğrulama kodu.",
  "invalid-verification-id": "Geçersiz doğrulama ID'si.",
  "missing-verification-code": "Doğrulama kodu eksik.",
  "missing-verification-id": "Doğrulama ID'si eksik.",
  "phone-number-already-exists": "Bu telefon numarası zaten kullanılıyor.",
  "invalid-phone-number": "Geçersiz telefon numarası.",
  "provider-already-linked": "Bu hesap zaten bağlı.",
  "credential-already-in-use": "Bu kimlik bilgileri zaten kullanılıyor.",
  "user-mismatch": "Kullanıcı eşleşmiyor.",
  "operation-not-allowed": "Bu işlem şu anda devre dışı.",
  "expired-action-code": "İşlem kodunun süresi dolmuş.",
  "invalid-action-code": "Geçersiz işlem kodu.",
};

export function getSupabaseAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code ?? "";
    const message = SUPABASE_AUTH_ERROR_MESSAGES[code];
    if (message) return message;

    const lowerMessage = error.message.toLowerCase();
    if (lowerMessage.includes("invalid login credentials")) {
      return "E-posta veya şifre hatalı.";
    }
    if (lowerMessage.includes("email not confirmed")) {
      return "E-posta adresiniz henüz doğrulanmamış.";
    }
    if (lowerMessage.includes("user already registered")) {
      return "Bu e-posta adresi zaten kayıtlı.";
    }
    if (lowerMessage.includes("signup requires a valid password")) {
      return "Geçerli bir şifre girmelisiniz.";
    }
    if (lowerMessage.includes("password")) {
      return "Şifre gereksinimleri karşılanmıyor.";
    }
    return error.message;
  }

  return "Bilinmeyen bir hata oluştu.";
}
