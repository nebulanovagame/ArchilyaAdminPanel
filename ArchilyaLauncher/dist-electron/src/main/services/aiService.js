"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const electron_log_1 = __importDefault(require("electron-log"));
// ════════════════════════════════════════════════════════════
// AI SERVİS — Gerçek API Motoru
// ════════════════════════════════════════════════════════════
class AiService {
    jobs = new Map();
    config;
    win = null;
    constructor() {
        this.config = this.loadConfig();
        electron_log_1.default.info(`[AiService] Initialized. Mock fallback: ${this.config.mockFallback}`);
    }
    setWindow(win) {
        this.win = win;
    }
    loadConfig() {
        return {
            geminiApiKey: process.env.GEMINI_API_KEY,
            replicateToken: process.env.REPLICATE_API_TOKEN,
            firebaseFunctionsUrl: process.env.FIREBASE_FUNCTIONS_URL,
            mockFallback: process.env.AI_MOCK_MODE === 'true',
            mockDelayMs: Number(process.env.AI_MOCK_DELAY_MS) || 3500,
        };
    }
    // ── Job Yönetimi ──────────────────────────────────────────
    async createJob(request) {
        const jobId = (0, crypto_1.randomUUID)();
        const job = {
            jobId,
            request,
            status: 'pending',
            progress: 0,
            creditsUsed: this.estimateCredits(request.toolId),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.jobs.set(jobId, job);
        electron_log_1.default.info(`[AiService] Job created: ${jobId} (tool: ${request.toolId})`);
        // Asenkron olarak işlemi başlat
        this.processJob(jobId);
        // Hemen yanıt dön (asenkron model)
        return {
            success: true,
            jobId,
            creditsUsed: job.creditsUsed,
        };
    }
    getJobStatus(jobId) {
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
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return { success: false };
        if (job.status === 'completed' || job.status === 'failed') {
            return { success: false };
        }
        job.status = 'cancelled';
        job.updatedAt = Date.now();
        if (job.timerRef) {
            clearTimeout(job.timerRef);
        }
        this.jobs.delete(jobId);
        electron_log_1.default.info(`[AiService] Job cancelled: ${jobId}`);
        return { success: true };
    }
    // ── İşlem Motoru ──────────────────────────────────────────
    async processJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        job.status = 'processing';
        job.progress = 10;
        job.updatedAt = Date.now();
        this.emitProgress(jobId, 10, 'processing', 'AI modeli hazırlanıyor...');
        try {
            if (this.config.mockFallback) {
                throw new Error('Mock modu aktif. Gerçek AI provider yapılandırılmamış.');
            }
            await this.runRealJob(jobId);
        }
        catch (err) {
            electron_log_1.default.error(`[AiService] Job ${jobId} failed:`, err);
            job.status = 'failed';
            job.error = err.message || 'Bilinmeyen bir hata oluştu.';
            job.updatedAt = Date.now();
            this.emitComplete(jobId, false, undefined, job.error);
        }
    }
    async runRealJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
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
        throw new Error('AI provider yapılandırılmamış. Lütfen GEMINI_API_KEY veya FIREBASE_FUNCTIONS_URL ortam değişkenini ayarlayın.');
    }
    async callGeminiApi(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        const apiKey = this.config.geminiApiKey;
        const model = 'gemini-2.0-flash-exp-image-generation';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        this.emitProgress(jobId, 30, 'processing', 'Gemini API çağrılıyor...');
        const parts = [{ text: job.request.prompt }];
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
        const imagePart = candidate?.content?.parts?.find((p) => p.inlineData);
        const textPart = candidate?.content?.parts?.find((p) => p.text);
        if (imagePart?.inlineData?.data) {
            const mimeType = imagePart.inlineData.mimeType || 'image/png';
            const imageUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
            job.resultUrl = imageUrl;
        }
        else if (textPart?.text) {
            // Eğer görsel yoksa text yanıtı (rapor vb.)
            job.resultUrl = `data:text/plain;base64,${Buffer.from(textPart.text).toString('base64')}`;
        }
        else {
            throw new Error('API yanıtında beklenen içerik bulunamadı.');
        }
        job.status = 'completed';
        job.progress = 100;
        job.updatedAt = Date.now();
        this.emitComplete(jobId, true, job.resultUrl);
    }
    async callFirebaseFunctions(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
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
        }
        else {
            throw new Error('Firebase yanıtında jobId bulunamadı.');
        }
        job.updatedAt = Date.now();
        this.emitComplete(jobId, true, job.resultUrl);
    }
    // ── Yardımcılar ───────────────────────────────────────────
    estimateCredits(toolId) {
        const costs = {
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
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    emitProgress(jobId, progress, status, message) {
        if (!this.win || this.win.isDestroyed())
            return;
        this.win.webContents.send('ai:progress', { jobId, progress, status, message });
    }
    emitComplete(jobId, success, resultUrl, error) {
        if (!this.win || this.win.isDestroyed())
            return;
        this.win.webContents.send('ai:complete', { jobId, success, resultUrl, error });
    }
    // ── Temizlik ──────────────────────────────────────────────
    shutdown() {
        for (const job of this.jobs.values()) {
            if (job.timerRef)
                clearTimeout(job.timerRef);
        }
        this.jobs.clear();
        electron_log_1.default.info('[AiService] Shutdown complete.');
    }
}
// Singleton instance
const aiService = new AiService();
exports.default = aiService;
