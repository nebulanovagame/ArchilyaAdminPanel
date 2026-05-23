import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiJobStatusResponse,
  AiJobProgressEvent,
  AiJobCompleteEvent,
} from '../../shared/aiTypes';

// ════════════════════════════════════════════════════════════
// FRONTEND AI SERVİS — Renderer Process
// window.api üzerinden Main Process'e köprü kurar
// ════════════════════════════════════════════════════════════

export interface AiJobCallbacks {
  onProgress?: (progress: number, message?: string) => void;
  onComplete?: (resultUrl: string) => void;
  onError?: (error: string) => void;
}

class FrontendAiService {
  private unsubProgress: (() => void) | null = null;
  private unsubComplete: (() => void) | null = null;

  /** AI üretim işi başlat */
  async createJob(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    return window.api.createAiJob(request);
  }

  /** İş durumunu sorgula */
  async checkStatus(jobId: string): Promise<AiJobStatusResponse> {
    return window.api.checkAiJobStatus(jobId);
  }

  /** İşi iptal et */
  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    return window.api.cancelAiJob(jobId);
  }

  /** Event dinleyicileri kur ve tek bir promise olarak sonucu bekle */
  async waitForJob(
    jobId: string,
    callbacks?: AiJobCallbacks,
    pollIntervalMs = 1000
  ): Promise<{ success: boolean; resultUrl?: string; error?: string }> {
    return new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        settled = true;
        if (this.unsubProgress) {
          this.unsubProgress();
          this.unsubProgress = null;
        }
        if (this.unsubComplete) {
          this.unsubComplete();
          this.unsubComplete = null;
        }
      };

      // Progress dinleyicisi
      this.unsubProgress = window.api.onAiJobProgress((data: AiJobProgressEvent) => {
        if (data.jobId !== jobId || settled) return;
        callbacks?.onProgress?.(data.progress, data.message);
      });

      // Tamamlanma dinleyicisi
      this.unsubComplete = window.api.onAiJobComplete((data: AiJobCompleteEvent) => {
        if (data.jobId !== jobId || settled) return;
        cleanup();
        if (data.success && data.resultUrl) {
          callbacks?.onComplete?.(data.resultUrl);
          resolve({ success: true, resultUrl: data.resultUrl });
        } else {
          callbacks?.onError?.(data.error || 'İşlem başarısız oldu.');
          resolve({ success: false, error: data.error || 'İşlem başarısız oldu.' });
        }
      });

      // Güvenlik: Eğer event gelmezse polling ile kontrol et
      const poll = setInterval(async () => {
        if (settled) {
          clearInterval(poll);
          return;
        }
        try {
          const status = await this.checkStatus(jobId);
          if (status.status === 'completed' && status.resultUrl) {
            cleanup();
            clearInterval(poll);
            callbacks?.onComplete?.(status.resultUrl);
            resolve({ success: true, resultUrl: status.resultUrl });
          } else if (status.status === 'failed') {
            cleanup();
            clearInterval(poll);
            callbacks?.onError?.(status.error || 'İşlem başarısız oldu.');
            resolve({ success: false, error: status.error || 'İşlem başarısız oldu.' });
          }
        } catch {
          // Polling hatası yutulur, event dinleyici ana mekanizmadır
        }
      }, pollIntervalMs);

      // Timeout: 5 dakika
      setTimeout(() => {
        if (!settled) {
          cleanup();
          clearInterval(poll);
          const timeoutError = 'İşlem zaman aşımına uğradı (5 dk).';
          callbacks?.onError?.(timeoutError);
          resolve({ success: false, error: timeoutError });
        }
      }, 5 * 60 * 1000);
    });
  }

  /** Tüm dinleyicileri temizle */
  dispose(): void {
    if (this.unsubProgress) {
      this.unsubProgress();
      this.unsubProgress = null;
    }
    if (this.unsubComplete) {
      this.unsubComplete();
      this.unsubComplete = null;
    }
  }
}

export const frontendAiService = new FrontendAiService();
export default frontendAiService;
