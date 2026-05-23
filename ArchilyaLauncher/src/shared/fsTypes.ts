// ════════════════════════════════════════════════════════════
// DOSYA SİSTEMİ TİPLERİ — IPC Köprüsü için Paylaşılan Sözleşme
// ════════════════════════════════════════════════════════════

export interface FsItem {
  name: string;
  /** Klasöre göreli yol */
  relativePath: string;
  /** Tam mutlak yol */
  absolutePath: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: string;
  createdAt: string;
}

export interface FsListResponse {
  success: boolean;
  items: FsItem[];
  error?: string;
}

export type FsWatchEventType = 'add' | 'unlink' | 'change';

export interface FsWatchEvent {
  eventType: FsWatchEventType;
  /** Klasöre göreli yol */
  relativePath: string;
  /** Tam mutlak yol */
  absolutePath: string;
  isDirectory: boolean;
  stats?: {
    size: number;
    modifiedAt: string;
  };
}

export interface FsWatchRequest {
  directoryPath: string;
}

export interface FsWatchResult {
  success: boolean;
  error?: string;
}



// ════════════════════════════════════════════════════════════
// OTO-MAtik KİLİT TİPLERİ (FAZ 2.3)
// ════════════════════════════════════════════════════════════

export type FileLockStatus = 'locked' | 'unlocked';

export interface FileLockEvent {
  /** Kilitlenen dosyanın göreli yolu (örn: "Zemin_Kat.dwg") */
  relativePath: string;
  /** Kilitlenen dosyanın mutlak yolu */
  absolutePath: string;
  /** 'locked' = başka biri düzenliyor, 'unlocked' = serbest */
  status: FileLockStatus;
  /** Kilidi alan kişi (bilgisayar kullanıcı adı) */
  lockedBy?: string;
}
