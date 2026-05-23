import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Onayla',
  cancelText = 'Vazgec',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] max-w-[92vw] rounded border border-white/10 bg-archilya-panel p-6 shadow-2xl">
        <h3 className="font-display text-lg tracking-wider text-archilya-gold">{title}</h3>
        <p className="mt-3 text-sm text-archilya-text-dim leading-relaxed">{message}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs tracking-widest uppercase border border-white/15 text-archilya-text-dim hover:text-archilya-text hover:border-white/30 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs tracking-widest uppercase border transition-colors ${
              danger
                ? 'border-red-400/40 text-red-300 hover:bg-red-500 hover:text-white'
                : 'border-archilya-gold/40 text-archilya-gold hover:bg-archilya-gold hover:text-black'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
