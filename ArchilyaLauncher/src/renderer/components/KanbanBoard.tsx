import { useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
type ColumnId = 'konsept' | 'sematik' | 'detay' | 'ihale' | 'insaat';

interface BoardColumn {
  id: ColumnId;
  title: string;
  description: string;
}

interface BoardTask {
  id: string;
  title: string;
  assigneeName: string;
  assigneeInitials: string;
  avatarColor: string;
  fileType: 'DWG' | 'SKP' | '3DS' | 'PDF' | 'RVT' | 'DOC' | 'XLS' | 'IMG' | 'OTHER';
  locked: boolean;
  columnId: ColumnId;
}

type BoardState = Record<ColumnId, BoardTask[]>;

interface KanbanBoardProps {
  isLoading?: boolean;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────
const BOARD_COLUMNS: BoardColumn[] = [
  { id: 'konsept', title: 'Konsept Tasarım', description: 'Fikir ve kroki aşaması' },
  { id: 'sematik', title: 'Şematik Proje', description: 'Onaylı şema ve paftalar' },
  { id: 'detay', title: 'Detay Projesi', description: 'Uygulama ve detay çizimleri' },
  { id: 'ihale', title: 'İhale ve Ruhsat', description: 'Resmi başvuru ve ihale evrakları' },
  { id: 'insaat', title: 'İnşaat', description: 'Şantiye ve uygulama takibi' },
];

const COLUMN_ORDER: ColumnId[] = ['konsept', 'sematik', 'detay', 'ihale', 'insaat'];

const INITIAL_TASKS: BoardTask[] = [
  { id: 't1', title: 'Statik ekipten kolon kesimi onayı bekleniyor', assigneeName: 'Ahmet Yılmaz', assigneeInitials: 'AY', avatarColor: 'bg-blue-500/15 text-blue-200 border-blue-400/20', fileType: 'DWG', locked: false, columnId: 'konsept' },
  { id: 't2', title: 'Cephe malzeme alternatifleri (taş vs kompozit)', assigneeName: 'Ayşe Kaya', assigneeInitials: 'AK', avatarColor: 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/20', fileType: 'PDF', locked: false, columnId: 'konsept' },
  { id: 't3', title: 'Zemin kat vaziyet planı Revizyon B', assigneeName: 'Mehmet Demir', assigneeInitials: 'MD', avatarColor: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20', fileType: 'DWG', locked: true, columnId: 'sematik' },
  { id: 't4', title: '3D kütlesel model — güneş analizi eklenecek', assigneeName: 'Selin Arslan', assigneeInitials: 'SA', avatarColor: 'bg-amber-500/15 text-amber-200 border-amber-400/20', fileType: 'SKP', locked: true, columnId: 'sematik' },
  { id: 't5', title: 'Kesit detayları — yalıtım detayı eksik', assigneeName: 'Deniz Öztürk', assigneeInitials: 'DÖ', avatarColor: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/20', fileType: 'DWG', locked: false, columnId: 'detay' },
  { id: 't6', title: 'Mobilya ve donatım planı onayda', assigneeName: 'Ece Turan', assigneeInitials: 'ET', avatarColor: 'bg-rose-500/15 text-rose-200 border-rose-400/20', fileType: 'RVT', locked: false, columnId: 'detay' },
  { id: 't7', title: 'Belediye ruhsat evrakları hazırlanıyor', assigneeName: 'Burak Şahin', assigneeInitials: 'BŞ', avatarColor: 'bg-violet-500/15 text-violet-200 border-violet-400/20', fileType: 'DOC', locked: false, columnId: 'ihale' },
  { id: 't8', title: 'İhale şartnamesi — elektrik mühendisi onayında', assigneeName: 'Nil Kara', assigneeInitials: 'NK', avatarColor: 'bg-pink-500/15 text-pink-200 border-pink-400/20', fileType: 'XLS', locked: false, columnId: 'ihale' },
  { id: 't9', title: 'Şantiye zemin etüdü raporu teslim edildi', assigneeName: 'Onur Aksoy', assigneeInitials: 'OA', avatarColor: 'bg-lime-500/15 text-lime-200 border-lime-400/20', fileType: 'PDF', locked: false, columnId: 'insaat' },
  { id: 't10', title: 'Demir döküm projesi — imalat başladı', assigneeName: 'Zeynep Koç', assigneeInitials: 'ZK', avatarColor: 'bg-red-500/15 text-red-200 border-red-400/20', fileType: 'DWG', locked: false, columnId: 'insaat' },
];

// ─── File Type Config ───────────────────────────────────────────────────────
const FILE_TYPE_STYLES: Record<BoardTask['fileType'], { border: string; bg: string; text: string }> = {
  DWG:  { border: 'border-blue-400/25',    bg: 'bg-blue-500/[0.08]',    text: 'text-blue-300' },
  SKP:  { border: 'border-red-400/25',    bg: 'bg-red-500/[0.08]',     text: 'text-red-300' },
  '3DS': { border: 'border-purple-400/25', bg: 'bg-purple-500/[0.08]',  text: 'text-purple-300' },
  PDF:  { border: 'border-rose-700/35',    bg: 'bg-rose-900/[0.18]',    text: 'text-rose-300' },
  RVT:  { border: 'border-cyan-300/25',   bg: 'bg-cyan-400/[0.08]',    text: 'text-cyan-200' },
  DOC:  { border: 'border-emerald-400/25', bg: 'bg-emerald-500/[0.08]', text: 'text-emerald-300' },
  XLS:  { border: 'border-emerald-400/25', bg: 'bg-emerald-500/[0.08]', text: 'text-emerald-300' },
  IMG:  { border: 'border-pink-400/25',    bg: 'bg-pink-500/[0.08]',    text: 'text-pink-300' },
  OTHER: { border: 'border-white/[0.06]',  bg: 'bg-white/[0.02]',       text: 'text-archilya-text-dim/50' },
};

// ─── Component ──────────────────────────────────────────────────────────────
export function KanbanBoard({ isLoading = false }: KanbanBoardProps) {
  const [boardState, setBoardState] = useState<BoardState>(() => {
    const state: BoardState = { konsept: [], sematik: [], detay: [], ihale: [], insaat: [] };
    INITIAL_TASKS.forEach(task => { state[task.columnId].push(task); });
    return state;
  });

  const moveTask = (taskId: string, fromColumnId: ColumnId, direction: 'prev' | 'next') => {
    const currentIndex = COLUMN_ORDER.indexOf(fromColumnId);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0 || newIndex >= COLUMN_ORDER.length) return;
    const toColumnId = COLUMN_ORDER[newIndex];
    
    setBoardState(prev => {
      const next: BoardState = { ...prev, [fromColumnId]: [], [toColumnId]: [] };
      (Object.keys(prev) as ColumnId[]).forEach(col => { next[col] = [...prev[col]]; });
      
      const taskIndex = next[fromColumnId].findIndex(t => t.id === taskId);
      if (taskIndex === -1) return prev;
      const [task] = next[fromColumnId].splice(taskIndex, 1);
      
      const updatedTask = { ...task, columnId: toColumnId };
      if (toColumnId === 'detay') updatedTask.locked = true;
      
      next[toColumnId].push(updatedTask);
      return next;
    });
  };

  return (
    <div className="flex h-full gap-4 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4">
      {BOARD_COLUMNS.map(column => {
        const tasks = boardState[column.id];
        const isDetay = column.id === 'detay';
        
        return (
          <div
            key={column.id}
            className={`flex h-full min-w-[250px] max-w-[250px] flex-col rounded-2xl border border-white/[0.06] bg-[#0f0f0f]/75 ${
              isDetay ? 'border-archilya-gold/20 bg-archilya-gold/[0.025]' : ''
            }`}
          >
            {/* Column Header */}
            <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0f0f0f]/95 px-3 py-3 backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-display uppercase tracking-[0.18em] text-archilya-text">
                  {column.title}
                </h3>
                <span className="rounded-full border border-archilya-gold/15 bg-archilya-gold/[0.06] px-2 py-0.5 text-[10px] font-mono text-archilya-gold/80">
                  {tasks.length}
                </span>
              </div>
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-archilya-text-dim/45">
                {column.description}
              </p>
            </div>
            
            {/* Tasks Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-2">
              {isLoading && (
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`skel-${i}`} className="w-full rounded-xl border border-white/[0.06] bg-[#111111]/90 p-3 animate-pulse">
                      <div className="h-3 w-4/5 rounded bg-white/[0.03] mb-3" />
                      <div className="h-3 w-2/3 rounded bg-white/[0.03] mb-3" />
                      <div className="flex items-center justify-between">
                        <div className="h-6 w-6 rounded-full bg-white/[0.03]" />
                        <div className="h-5 w-10 rounded bg-white/[0.03]" />
                      </div>
                    </div>
                  ))}
                </>
              )}
              {!isLoading && tasks.map(task => {
                const ft = FILE_TYPE_STYLES[task.fileType];
                const fromColumnId = task.columnId;
                
                return (
                  <div
                    key={task.id}
                    className="w-full rounded-xl border border-white/[0.06] bg-[#111111]/90 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:border-archilya-gold/25 hover:bg-white/[0.045]"
                  >
                    <p className="text-[12px] font-medium leading-4 text-archilya-text truncate">
                      {task.title}
                    </p>
                    
                    <div className="mt-3 flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* Avatar */}
                        <div className={`h-6 w-6 shrink-0 rounded-full border flex items-center justify-center text-[9px] font-bold tracking-wide ${task.avatarColor}`}>
                          {task.assigneeInitials}
                        </div>
                        {/* File badge */}
                        <span className={`inline-flex h-5 shrink-0 whitespace-nowrap items-center rounded border px-1.5 text-[9px] font-mono tracking-[0.16em] ${ft.border} ${ft.bg} ${ft.text}`}>
                          {task.fileType}
                        </span>
                      </div>
                      {/* Lock icon */}
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
                        className={
                          task.columnId === 'detay'
                            ? 'text-archilya-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.35)]'
                            : task.locked
                            ? 'text-archilya-gold/70'
                            : 'text-archilya-text-dim/35'
                        }
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    
                    {/* Move buttons */}
                    <div className="mt-2 flex items-center justify-between">
                      <button
                        disabled={fromColumnId === 'konsept'}
                        onClick={() => moveTask(task.id, fromColumnId, 'prev')}
                        className={`h-6 w-6 rounded border border-white/[0.06] text-archilya-text-dim/50 hover:text-archilya-gold hover:border-archilya-gold/25 hover:bg-archilya-gold/[0.06] transition-colors flex items-center justify-center text-[10px] ${
                          fromColumnId === 'konsept' ? 'opacity-30 cursor-not-allowed' : ''
                        }`}
                      >
                        ←
                      </button>
                      <button
                        disabled={fromColumnId === 'insaat'}
                        onClick={() => moveTask(task.id, fromColumnId, 'next')}
                        className={`h-6 w-6 rounded border border-white/[0.06] text-archilya-text-dim/50 hover:text-archilya-gold hover:border-archilya-gold/25 hover:bg-archilya-gold/[0.06] transition-colors flex items-center justify-center text-[10px] ${
                          fromColumnId === 'insaat' ? 'opacity-30 cursor-not-allowed' : ''
                        }`}
                      >
                        →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default KanbanBoard;
