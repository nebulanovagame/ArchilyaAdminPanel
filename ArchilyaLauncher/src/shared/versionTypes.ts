// ════════════════════════════════════════════════════════════
// DOSYA VERSİYON TİPLERİ — IPC Köprüsü için Paylaşılan Sözleşme
// ════════════════════════════════════════════════════════════

/** Tek bir dosya versiyonu */
export interface FileVersionRecord {
  id: string;
  /** Hangi dosyaya ait (files[].id ile eşleşir) */
  fileId: string;
  /** Versiyon dosya adı */
  name: string;
  /** İndirme URL'si (Firebase Storage veya R2) */
  url: string;
  /** Firebase Storage path veya R2 objectKey */
  path: string | null;
  /** Dosya boyutu (byte) */
  size: number;
  /** Uzantı (dwg, pdf, jpg, ...) */
  type: string;
  /** Sağlayıcı: firebase | r2 */
  storageProvider: 'firebase' | 'r2';
  /** R2 için objectKey */
  objectKey?: string | null;
  /** MIME type */
  contentType: string;
  /** Oluşturulma tarihi (ISO) */
  createdAt: string;
  /** Kim yükledi */
  uploadedBy: string;
  /** Revizyon notu (opsiyonel) */
  changeNote?: string;
  /** Versiyon sıra numarası (1, 2, 3, ...) */
  versionNumber: number;
}

/** Versiyon listeleme yanıtı */
export interface VersionListResponse {
  success: boolean;
  versions: FileVersionRecord[];
  error?: string;
}

/** Versiyon geri yükleme yanıtı */
export interface VersionRestoreResponse {
  success: boolean;
  /** Geri yüklenen dosyanın yeni indirme URL'si */
  restoredUrl?: string;
  error?: string;
}

/** Revizyon notu güncelleme isteği */
export interface VersionNoteRequest {
  projectId: string;
  versionId: string;
  changeNote: string;
}

/** Versiyon oluşturma olayı (upload tamamlandığında renderer'a) */
export interface VersionCreatedEvent {
  fileId: string;
  projectId: string;
  version: FileVersionRecord;
}
