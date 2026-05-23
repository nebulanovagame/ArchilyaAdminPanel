// ════════════════════════════════════════════════════════════
// AI MOTOR TİPLERİ — IPC Köprüsü için Paylaşılan Sözleşme
// ════════════════════════════════════════════════════════════

export type AiToolId =
  | 'text-to-render'
  | 'style-transfer'
  | 'sketchup-render'
  | 'material-list'
  | 'render-quality'
  | 'arch-report'
  | 'plan-color'
  | 'scene-edit'
  | 'enhance';

export type AiOutputType =
  | 'image'           // Tek görsel
  | 'image-pair'      // Before/after çift
  | 'report'          // PDF/Markdown rapor
  | 'material-table'  // Malzeme listesi
  | 'quality-score';  // Kalite skoru + öneriler

export type AiJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/** Renderer → Main: AI üretim isteği */
export interface AiGenerateRequest {
  toolId: AiToolId;
  prompt: string;
  outputType: AiOutputType;
  /** Base64 encoded kaynak görsel (isteğe bağlı) */
  sourceImage?: string;
  /** Araç-özel parametreler */
  params?: Record<string, unknown>;
  /** İlişkili proje ID'si */
  projectId?: string;
  /** Kullanıcı UID (auth'dan otomatik alınır) */
  userId?: string;
}

/** Main → Renderer: AI üretim yanıtı (hem senkron hem asenkron) */
export interface AiGenerateResponse {
  success: boolean;
  /** Asenkron işlem için jobId; senkron başarıda da dönebilir */
  jobId?: string;
  /** Senkron başarıda doğrudan sonuç URL'si */
  resultUrl?: string;
  /** Hata mesajı */
  error?: string;
  /** Harcanan kredi (tahmini) */
  creditsUsed?: number;
  /** Yanıt meta verisi */
  metadata?: {
    model?: string;
    durationMs?: number;
    isMock?: boolean;
  };
}

/** Main → Renderer: İşlem durum sorgusu yanıtı */
export interface AiJobStatusResponse {
  jobId: string;
  status: AiJobStatus;
  /** 0-100 arası ilerleme */
  progress: number;
  /** Tamamlandığında sonuç URL'si */
  resultUrl?: string;
  /** Hata durumunda mesaj */
  error?: string;
  /** Harcanan kredi */
  creditsUsed?: number;
  /** Geçen süre (ms) */
  elapsedMs?: number;
}

/** İşlem ilerleme event payload'ı */
export interface AiJobProgressEvent {
  jobId: string;
  progress: number;
  status: AiJobStatus;
  message?: string;
}

/** İşlem tamamlanma event payload'ı */
export interface AiJobCompleteEvent {
  jobId: string;
  success: boolean;
  resultUrl?: string;
  error?: string;
  creditsUsed?: number;
}

/** AI Hizmet Yapılandırması (main process ortam değişkenlerinden) */
export interface AiServiceConfig {
  /** Google Gemini API anahtarı */
  geminiApiKey?: string;
  /** Replicate API token (legacy/opsiyonel) */
  replicateToken?: string;
  /** Firebase Functions region URL (örn: https://us-central1-nng-toma.cloudfunctions.net) */
  firebaseFunctionsUrl?: string;
  /** Fallback mock modu aktif mi? */
  mockFallback: boolean;
  /** Mock gecikmesi (ms) */
  mockDelayMs: number;
}

/** AI İş kaydı (main process iç belleğinde tutulur) */
export interface AiJobRecord {
  jobId: string;
  request: AiGenerateRequest;
  status: AiJobStatus;
  progress: number;
  resultUrl?: string;
  error?: string;
  creditsUsed: number;
  createdAt: number;
  updatedAt: number;
  /** setTimeout/interval referansı (iptal için) */
  timerRef?: ReturnType<typeof setTimeout>;
}
