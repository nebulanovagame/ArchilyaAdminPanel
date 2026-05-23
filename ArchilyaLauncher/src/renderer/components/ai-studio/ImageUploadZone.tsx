import React, { useCallback, useState } from 'react';

interface ImageUploadZoneProps {
  onFilesDrop: (files: File[]) => void;
  accept?: string;
}

export const ImageUploadZone: React.FC<ImageUploadZoneProps> = ({
  onFilesDrop,
  accept = 'image/*',
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );
      if (files.length > 0) {
        onFilesDrop(files);
      }
    },
    [onFilesDrop]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        onFilesDrop(files);
      }
    },
    [onFilesDrop]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center gap-4
        w-full rounded-xl border-2 border-dashed
        bg-white/[0.02] px-6 py-12
        transition-all duration-300 cursor-pointer
        ${
          isDragging
            ? 'border-archilya-gold/50 bg-archilya-gold/[0.03]'
            : 'border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.03]'
        }
      `}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />

      <div
        className={`
          flex items-center justify-center w-12 h-12 rounded-full
          border border-white/[0.06] bg-white/[0.02]
          transition-colors duration-300
          ${isDragging ? 'text-archilya-gold border-archilya-gold/20' : 'text-archilya-text-dim/50'}
        `}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      </div>

      <p className="text-[12px] text-archilya-text-dim/70 tracking-wide text-center">
        Eskiz veya fotoğrafı buraya sürükleyin
      </p>

      <p className="text-[10px] font-mono text-archilya-text-dim/40 tracking-wider uppercase">
        veya alana tıklayın
      </p>
    </div>
  );
};
