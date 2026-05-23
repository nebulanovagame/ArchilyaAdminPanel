import React from 'react';
import { KanbanBoard } from '../components/KanbanBoard';

export const BoardsView: React.FC = () => {
  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl tracking-[0.18em] text-archilya-text uppercase">Panolar</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.35em] text-archilya-gold/80">
            Mimari proje fazlarına göre görev takibi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-archilya-text-dim/40 uppercase tracking-wider">
            Villa Proje Alpha
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-text-dim/30">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <KanbanBoard />
      </div>
    </div>
  );
};
