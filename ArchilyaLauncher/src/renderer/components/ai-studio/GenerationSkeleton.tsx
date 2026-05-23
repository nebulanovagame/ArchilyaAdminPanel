import React from 'react';

interface GenerationSkeletonProps {
  text?: string;
}

export const GenerationSkeleton: React.FC<GenerationSkeletonProps> = ({
  text = 'Yapay zeka render üretiyor...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-10">
      <p className="text-[11px] font-mono text-archilya-gold/70 tracking-widest uppercase animate-pulse">
        {text}
      </p>

      <div className="w-full grid grid-cols-4 gap-3">
        <div className="skeleton-shimmer rounded-lg h-24" />
        <div className="skeleton-shimmer rounded-lg h-24" />
        <div className="skeleton-shimmer rounded-lg h-24" />
        <div className="skeleton-shimmer rounded-lg h-24" />
      </div>

      <div className="w-full space-y-2">
        <div className="skeleton-shimmer rounded h-3 w-3/4" />
        <div className="skeleton-shimmer rounded h-3 w-1/2" />
      </div>
    </div>
  );
};
