/**
 * AdminPanel için merkezi hata mesajı dönüşüm utility.
 * Kullanıcıya teknik detay içermeyen, kurumsal Türkçe mesajlar döndürür.
 *
 * Kullanım:
 *   import { getErrorMessage } from "@/lib/errors";
 *   toast.error(getErrorMessage(error, "Hata."));
 */

export function getErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  // Ağ bağlantısı hataları
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("econnrefused") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror")
  ) {
    return "İnternet bağlantınızı kontrol edip tekrar deneyin.";
  }

  // Zaman aşımı
  if (lower.includes("timeout") || lower.includes("abort")) {
    return "Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.";
  }

  // Oturum/auth hataları
  if (
    lower.includes("oturum") ||
    lower.includes("giris") ||
    lower.includes("unauthorized") ||
    lower.includes("unauthenticated") ||
    lower.includes("jwt") ||
    lower.includes("token")
  ) {
    return "Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.";
  }

  // API/sunucu hataları
  if (
    lower.includes("internal server") ||
    lower.includes("500") ||
    lower.includes("sunucu") ||
    lower.includes("backend")
  ) {
    return "İşleminiz tamamlanamadı. Lütfen daha sonra tekrar deneyin.";
  }

  // Yetki hataları
  if (
    lower.includes("yetki") ||
    lower.includes("yetkiniz") ||
    lower.includes("permission") ||
    lower.includes("forbidden")
  ) {
    return "Bu işlem için yetkiniz bulunmuyor.";
  }

  return fallback;
}
