import React, { useState, useEffect } from 'react';

export interface PromptHistoryEntry {
  id: string;
  toolId: string;
  text: string;
  timestamp: number;
}

const STORAGE_KEY = 'archilya-ai-prompt-history';
const MAX_HISTORY = 20;

export function loadPromptHistory(): PromptHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PromptHistoryEntry[];
  } catch {
    return [];
  }
}

export function savePromptHistory(entries: PromptHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // storage full or disabled
  }
}

export function addToPromptHistory(toolId: string, text: string) {
  const entries = loadPromptHistory();
  const newEntry: PromptHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    toolId,
    text,
    timestamp: Date.now(),
  };
  // Avoid duplicates at top
  const filtered = entries.filter((e) => !(e.toolId === toolId && e.text === text));
  savePromptHistory([newEntry, ...filtered]);
}

export function removeFromPromptHistory(entryId: string) {
  const entries = loadPromptHistory().filter((e) => e.id !== entryId);
  savePromptHistory(entries);
}

export function clearPromptHistory(toolId?: string) {
  if (toolId) {
    const entries = loadPromptHistory().filter((e) => e.toolId !== toolId);
    savePromptHistory(entries);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

interface PromptHistoryPanelProps {
  toolId: string;
  onSelect: (text: string) => void;
}

export const PromptHistoryPanel: React.FC<PromptHistoryPanelProps> = ({
  toolId,
  onSelect,
}) => {
  const [entries, setEntries] = useState<PromptHistoryEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const refresh = () => {
    setEntries(loadPromptHistory().filter((e) => e.toolId === toolId));
  };

  useEffect(() => {
    refresh();
  }, [toolId]);

  const handleDelete = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    removeFromPromptHistory(entryId);
    refresh();
  };

  const handleClear = () => {
    clearPromptHistory(toolId);
    refresh();
    setShowClearConfirm(false);
  };

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
          Son Kullanılan Promptlar ({entries.length})
        </p>
        <div className="flex items-center gap-2">
          {!showClearConfirm ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowClearConfirm(true);
              }}
              className="text-[9px] text-red-400/40 hover:text-red-400 transition-colors"
              title="Tümünü temizle"
            >
              Temizle
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="text-[9px] text-red-400 hover:text-red-300 transition-colors"
              >
                Eminim
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowClearConfirm(false);
                }}
                className="text-[9px] text-archilya-text-dim/30 hover:text-archilya-text-dim/60 transition-colors"
              >
                Vazgeç
              </button>
            </div>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-archilya-text-dim/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="group flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:border-white/[0.10] hover:bg-white/[0.03] transition-all duration-200"
            >
              <button
                onClick={() => onSelect(entry.text)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-[11px] text-archilya-text-dim/70 truncate">{entry.text}</p>
                <p className="text-[9px] font-mono text-archilya-text-dim/30 mt-1">
                  {new Date(entry.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </button>
              <button
                onClick={(e) => handleDelete(e, entry.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-archilya-text-dim/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
                title="Sil"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
