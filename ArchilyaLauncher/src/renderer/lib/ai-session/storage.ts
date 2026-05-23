export interface AiActiveSession {
  id: string;
  toolId: string;
  promptText: string;
  sourceImage?: string;
  status: 'generating' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  resultImageUrl?: string;
  errorMessage?: string;
}

const STORAGE_KEY = 'archilya-ai-active-session';

export function saveActiveSession(session: AiActiveSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // storage full or disabled
  }
}

export function getActiveSession(): AiActiveSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiActiveSession;
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
