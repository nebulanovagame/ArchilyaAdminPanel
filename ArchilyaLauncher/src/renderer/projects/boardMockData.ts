import type { ArchFileExtension } from './projectFileTypeConfig';

export type ColumnId = 'konsept' | 'sematik' | 'detay' | 'ihale' | 'insaat';

export interface BoardColumn {
  id: ColumnId;
  title: string;
  description: string;
}

export interface BoardTask {
  id: string;
  title: string;
  assigneeName: string;
  assigneeInitials: string;
  avatarColor: string;
  fileType: ArchFileExtension;
  locked: boolean;
  columnId: ColumnId;
}

export type BoardState = Record<ColumnId, BoardTask[]>;

export const BOARD_COLUMNS: BoardColumn[] = [
  { id: 'konsept', title: 'Konsept Tasarım', description: 'Fikir ve kroki aşaması' },
  { id: 'sematik', title: 'Şematik Proje', description: 'Onaylı şema ve paftalar' },
  { id: 'detay', title: 'Detay Projesi', description: 'Uygulama ve detay çizimleri' },
  { id: 'ihale', title: 'İhale ve Ruhsat', description: 'Resmi başvuru ve ihale evrakları' },
  { id: 'insaat', title: 'İnşaat', description: 'Şantiye ve uygulama takibi' },
];

export const COLUMN_ORDER: ColumnId[] = ['konsept', 'sematik', 'detay', 'ihale', 'insaat'];

export const BOARD_TASKS: BoardTask[] = [
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

export function createInitialBoardState(): BoardState {
  return BOARD_TASKS.reduce<BoardState>(
    (state, task) => {
      state[task.columnId].push(task);
      return state;
    },
    {
      konsept: [],
      sematik: [],
      detay: [],
      ihale: [],
      insaat: [],
    },
  );
}
