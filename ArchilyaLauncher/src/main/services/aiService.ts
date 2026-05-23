import { randomUUID } from 'crypto';
import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiJobStatusResponse,
  AiJobRecord,
  AiServiceConfig,
  AiJobStatus,
} from '../../shared/aiTypes';
import type { BrowserWindow } from 'electron';
import log from 'electron-log';

// ════════════════════════════════════════════════════════════
// AI SERVİS — Gerçek API Motoru
// ════════════════════════════════════════════════════════════

class AiService {
  private jobs = new Map<string, AiJobRecord>();
  private config: AiServiceConfig;
  private win: BrowserWindow | null = null;

  constructor() {
    this.config = this.loadConfig();
    log.info(`[AiService] Initialized. Mock fallback: ${this.config.mockFallback}`);
  }

  setWindow(win: BrowserWindow): void {
    this.win = win;
  }

  private loadConfig(): AiServiceConfig {
    return {
      geminiApiKey: process.env.GEMINI_API_KEY,
      replicateToken: process.env.REPLICATE_API_TOKEN,
      firebaseFunctionsUrl: process.env.FIREBASE_FUNCTIONS_URL,
      mockFallback: process.env.AI_MOCK_MODE === 'true',
      mockDelayMs: Number(process.env.AI_MOCK_DELAY_MS) || 3500,
    };
  }

  // ── Job Yönetimi ──────────────────────────────────────────

  async createJob(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const jobId = randomUUID();
    const job: AiJobRecord = {
      jobId,
      request,
      status: 'pending',
      progress: 0,
      creditsUsed: this.estimateCredits(request.toolId),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.jobs.set(jobId, job);
    log.info(`[AiService] Job created: ${jobId} (tool: ${request.toolId})`);

    // Asenkron olarak işlemi başlat
    this.processJob(jobId);

    // Hemen yanıt dön (asenkron model)
    return {
      success: true,
      jobId,
      creditsUsed: job.creditsUsed,
    };
  }

  getJobStatus(jobId: string): AiJobStatusResponse {
    const job = this.jobs.get(jobId);
    if (!job) {
      return {
        jobId,
        status: 'failed',
        progress: 0,
        error: 'İşlem bulunamadı.',
      };
    }

    return {
      jobId,
      status: job.status,
      progress: job.progress,
      resultUrl: job.resultUrl,
      error: job.error,
      creditsUsed: job.creditsUsed,
      elapsedMs: Date.now() - job.createdAt,
    };
  }

  cancelJob(jobId: string): { success: boolean } {
    const job = this.jobs.get(jobId);
    if (!job) return { success: false };
    if (job.status === 'completed' || job.status === 'failed') {
      return { success: false };
    }

    job.status = 'cancelled';
    job.updatedAt = Date.now();
    if (job.timerRef) {
      clearTimeout(job.timerRef);
    }
    this.jobs.delete(jobId);
    log.info(`[AiService] Job cancelled: ${jobId}`);
    return { success: true };
  }

  // ── İşlem Motoru ──────────────────────────────────────────

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    job.progress = 10;
    job.updatedAt = Date.now();
    this.emitProgress(jobId, 10, 'processing', 'AI modeli hazırlanıyor...');

    try {
      if (this.config.mockFallback) {
        throw new Error('Mock modu aktif. Gerçek AI provider yapılandırılmamış.');
      }
      await this.runRealJob(jobId);
    } catch (err: any) {
      log.error(`[AiService] Job ${jobId} failed:`, err);
      job.status = 'failed';
      job.error = err.message || 'Bilinmeyen bir hata oluştu.';
      job.updatedAt = Date.now();
      this.emitComplete(jobId, false, undefined, job.error);
    }
  }

  private async runRealJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // GEMINI API entegrasyonu (gerçek üretim)
    if (this.config.geminiApiKey) {
      await this.callGeminiApi(jobId);
      return;
    }

    // FIREBASE FUNCTIONS entegrasyonu (alternatif)
    if (this.config.firebaseFunctionsUrl) {
      await this.callFirebaseFunctions(jobId);
      return;
    }

    // Hiçbir AI provider yapılandırılmamış
    throw new Error(
      'AI provider yapılandırılmamış. Lütfen GEMINI_API_KEY veya FIREBASE_FUNCTIONS_URL ortam değişkenini ayarlayın.'
    );
  }

  private async callGeminiApi(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const apiKey = this.config.geminiApiKey!;
    const model = 'gemini-2.0-flash-exp-image-generation';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    this.emitProgress(jobId, 30, 'processing', 'Gemini API çağrılıyor...');

    const parts: any[] = [{ text: job.request.prompt }];

    if (job.request.sourceImage) {
      // Base64 görseli inline data olarak ekle
      const base64Data = job.request.sourceImage.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data,
        },
      });
    }

    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['Text', 'Image'],
        responseMimeType: 'text/plain',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API hatası: ${response.status} — ${errText}`);
    }

    const data = await response.json();

    // Yanıttan görseli çıkar
    const candidate = data.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);
    const textPart = candidate?.content?.parts?.find((p: any) => p.text);

    if (imagePart?.inlineData?.data) {
      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      const imageUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
      job.resultUrl = imageUrl;
    } else if (textPart?.text) {
      // Eğer görsel yoksa text yanıtı (rapor vb.)
      job.resultUrl = `data:text/plain;base64,${Buffer.from(textPart.text).toString('base64')}`;
    } else {
      throw new Error('API yanıtında beklenen içerik bulunamadı.');
    }

    job.status = 'completed';
    job.progress = 100;
    job.updatedAt = Date.now();
    this.emitComplete(jobId, true, job.resultUrl);
  }

  private async callFirebaseFunctions(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.emitProgress(jobId, 30, 'processing', 'Firebase Functions çağrılıyor...');

    const url = `${this.config.firebaseFunctionsUrl}/createAiStudioJobSecure`;

    const payload = {
      toolId: job.request.toolId,
      promptText: job.request.prompt,
      outputType: job.request.outputType,
      imagePart: job.request.sourceImage,
      sceneReferences: job.request.projectId ? [job.request.projectId] : undefined,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Firebase Functions hatası: ${response.status} — ${errText}`);
    }

    const data = await response.json();

    if (data.jobId) {
      // Asenkron işlem — polling gerekli (şimdilik basit)
      job.resultUrl = data.downloadUrl || data.resultUrl;
      job.status = 'completed';
      job.progress = 100;
    } else {
      throw new Error('Firebase yanıtında jobId bulunamadı.');
    }

    job.updatedAt = Date.now();
    this.emitComplete(jobId, true, job.resultUrl);
  }

  // ── Yardımcılar ───────────────────────────────────────────

  private estimateCredits(toolId: string): number {
    const costs: Record<string, number> = {
      'text-to-render': 40,
      'style-transfer': 60,
      'sketchup-render': 50,
      'material-list': 20,
      'render-quality': 20,
      'arch-report': 30,
      'plan-color': 40,
      'scene-edit': 50,
      'enhance': 25,
    };
    return costs[toolId] || 30;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private emitProgress(jobId: string, progress: number, status: AiJobStatus, message?: string): void {
    if (!this.win || this.win.isDestroyed()) return;
    this.win.webContents.send('ai:progress', { jobId, progress, status, message });
  }

  private emitComplete(jobId: string, success: boolean, resultUrl?: string, error?: string): void {
    if (!this.win || this.win.isDestroyed()) return;
    this.win.webContents.send('ai:complete', { jobId, success, resultUrl, error });
  }

  // ── Temizlik ──────────────────────────────────────────────

  shutdown(): void {
    for (const job of this.jobs.values()) {
      if (job.timerRef) clearTimeout(job.timerRef);
    }
    this.jobs.clear();
    log.info('[AiService] Shutdown complete.');
  }
}

// Singleton instance
const aiService = new AiService();
export default aiService;
