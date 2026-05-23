import { useEffect, useState, useCallback, useRef } from 'react';
import type { AiGenerateRequest, AiJobProgressEvent, AiJobCompleteEvent } from '../../shared/aiTypes';
import type { AiToolId, AiOutputType } from '../../shared/aiTypes';
import {
  saveActiveSession,
  getActiveSession,
  clearActiveSession,
} from '../lib/ai-session/storage';

function inferOutputType(toolId: AiToolId): AiOutputType {
  switch (toolId) {
    case 'style-transfer':
    case 'enhance':
      return 'image-pair';
    case 'material-list':
      return 'material-table';
    case 'render-quality':
      return 'quality-score';
    case 'arch-report':
      return 'report';
    default:
      return 'image';
  }
}

interface UseAiSessionOptions {
  toolId: AiToolId;
  enabled: boolean;
}

interface UseAiSessionReturn {
  isGenerating: boolean;
  progress: number;
  statusMessage: string;
  resultUrl: string | null;
  error: string | null;
  jobId: string | null;
  startSession: (data: {
    promptText: string;
    sourceImage?: string;
    params?: Record<string, unknown>;
    projectId?: string;
  }) => Promise<void>;
  cancelSession: () => Promise<void>;
  clearSession: () => void;
  recoverSession: () => ReturnType<typeof getActiveSession>;
  hasRecovered: boolean;
}

export function useAiSession({ toolId, enabled }: UseAiSessionOptions): UseAiSessionReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [hasRecovered, setHasRecovered] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setHasRecovered(true);
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const startSession = useCallback(
    async (data: {
      promptText: string;
      sourceImage?: string;
      params?: Record<string, unknown>;
      projectId?: string;
    }) => {
      if (!enabled) return;

      // Önceki listener'ları temizle
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      setIsGenerating(true);
      setProgress(0);
      setStatusMessage('AI modeli hazırlanıyor...');
      setResultUrl(null);
      setError(null);
      setJobId(null);

      const request: AiGenerateRequest = {
        toolId,
        prompt: data.promptText,
        outputType: inferOutputType(toolId),
        sourceImage: data.sourceImage,
        params: data.params,
        projectId: data.projectId,
      };

      try {
        const response = await window.api.createAiJob(request);

        if (!response.success || !response.jobId) {
          throw new Error(response.error || 'AI işlemi başlatılamadı.');
        }

        const currentJobId = response.jobId;
        setJobId(currentJobId);

        saveActiveSession({
          id: currentJobId,
          toolId,
          promptText: data.promptText,
          sourceImage: data.sourceImage,
          status: 'generating',
          startTime: Date.now(),
        });

        // Progress listener
        const unsubscribeProgress = window.api.onAiJobProgress((event: AiJobProgressEvent) => {
          if (event.jobId !== currentJobId) return;
          setProgress(event.progress);
          if (event.message) setStatusMessage(event.message);
        });

        // Complete listener
        const unsubscribeComplete = window.api.onAiJobComplete((event: AiJobCompleteEvent) => {
          if (event.jobId !== currentJobId) return;
          setIsGenerating(false);
          if (event.success && event.resultUrl) {
            setResultUrl(event.resultUrl);
            setProgress(100);
            setStatusMessage('Tamamlandı!');
            saveActiveSession({
              id: currentJobId,
              toolId,
              promptText: data.promptText,
              sourceImage: data.sourceImage,
              status: 'completed',
              startTime: Date.now(),
              endTime: Date.now(),
              resultImageUrl: event.resultUrl,
            });
          } else {
            setError(event.error || 'Bir hata oluştu.');
            setStatusMessage('Hata');
            saveActiveSession({
              id: currentJobId,
              toolId,
              promptText: data.promptText,
              sourceImage: data.sourceImage,
              status: 'failed',
              startTime: Date.now(),
              endTime: Date.now(),
              errorMessage: event.error || 'Bir hata oluştu.',
            });
          }
        });

        cleanupRef.current = () => {
          unsubscribeProgress();
          unsubscribeComplete();
        };
      } catch (err: any) {
        setIsGenerating(false);
        setError(err.message || 'Bağlantı hatası.');
        setStatusMessage('Hata');
        setProgress(0);
      }
    },
    [toolId, enabled]
  );

  const cancelSession = useCallback(async () => {
    if (!jobId) return;
    try {
      await window.api.cancelAiJob(jobId);
    } catch (err) {
      console.error('[useAiSession] İptal hatası:', err);
    }
    setIsGenerating(false);
    setProgress(0);
    setStatusMessage('İptal edildi');
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, [jobId]);

  const clearSession = useCallback(() => {
    const session = getActiveSession();
    if (session && session.toolId === toolId) {
      clearActiveSession();
    }
    setIsGenerating(false);
    setProgress(0);
    setStatusMessage('');
    setResultUrl(null);
    setError(null);
    setJobId(null);
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, [toolId]);

  const recoverSession = useCallback(() => {
    const session = getActiveSession();
    if (!session || session.toolId !== toolId) return null;
    return session;
  }, [toolId]);

  return {
    isGenerating,
    progress,
    statusMessage,
    resultUrl,
    error,
    jobId,
    startSession,
    cancelSession,
    clearSession,
    recoverSession,
    hasRecovered,
  };
}
