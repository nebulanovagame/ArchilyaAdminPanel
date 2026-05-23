import { useCallback, useEffect, useState } from 'react';
import type { WebShareStatus } from '../../shared/streamingTypes';

const DEFAULT_STATUS: WebShareStatus = {
  state: 'idle',
  publicUrl: null,
  playerPort: 8080,
  streamerPort: 8888,
  connectivityLevel: 'checking',
  internetReachable: false,
};

export function useStreamingSession() {
  const [status, setStatus] = useState<WebShareStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await window.api.getWebShareStatus();
      setStatus(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Paylaşım durumu alınamadı.');
    }
  }, []);

  const start = useCallback(async (mapName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.startWebShare({ mapName });
      if (!result.success) {
        setError(result.message || 'Web ile paylaşım başlatılamadı.');
      } else if (result.message) {
        setError(result.message.includes('shared TURN') ? result.message : null);
      }
      await refreshStatus();
      return result;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const stop = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.stopWebShare();
      if (!result.success) {
        setError(result.message || 'Web ile paylaşım durdurulamadı.');
      }
      await refreshStatus();
      return result;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const copyPublicUrl = useCallback(async () => {
    const url = status.publicUrl || status.lastSuccessfulUrl;
    if (!url) {
      return;
    }

    await navigator.clipboard.writeText(url);
  }, [status.lastSuccessfulUrl, status.publicUrl]);

  useEffect(() => {
    void refreshStatus();
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshStatus]);

  return {
    status,
    loading,
    error,
    start,
    stop,
    refreshStatus,
    copyPublicUrl,
  };
}
