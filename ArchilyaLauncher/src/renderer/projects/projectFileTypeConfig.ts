export type ArchFileExtension = 'DWG' | 'SKP' | '3DS' | 'PDF' | 'RVT' | 'IFC' | 'DOC' | 'XLS' | 'IMG' | 'OTHER';

export interface FileTypeConfig {
  label: string;
  border: string;
  bg: string;
  text: string;
}

export const FILE_TYPE_CONFIG: Record<ArchFileExtension, FileTypeConfig> = {
  DWG:  { label: 'DWG',  border: 'border-cyan-400/25',    bg: 'bg-cyan-500/[0.08]',    text: 'text-cyan-300' },
  SKP:  { label: 'SKP',  border: 'border-red-400/25',    bg: 'bg-red-500/[0.08]',     text: 'text-red-300' },
  '3DS': { label: '3DS',  border: 'border-purple-400/25', bg: 'bg-purple-500/[0.08]',  text: 'text-purple-300' },
  PDF:  { label: 'PDF',  border: 'border-rose-700/35',    bg: 'bg-rose-900/[0.18]',    text: 'text-rose-300' },
  RVT:  { label: 'RVT',  border: 'border-indigo-400/25',  bg: 'bg-indigo-500/[0.08]',  text: 'text-indigo-300' },
  IFC:  { label: 'IFC',  border: 'border-amber-400/25',   bg: 'bg-amber-500/[0.08]',   text: 'text-amber-300' },
  DOC:  { label: 'DOC',  border: 'border-emerald-400/25', bg: 'bg-emerald-500/[0.08]', text: 'text-emerald-300' },
  XLS:  { label: 'XLS',  border: 'border-emerald-400/25', bg: 'bg-emerald-500/[0.08]', text: 'text-emerald-300' },
  IMG:  { label: 'IMG',  border: 'border-pink-400/25',    bg: 'bg-pink-500/[0.08]',    text: 'text-pink-300' },
  OTHER: { label: 'OTHER', border: 'border-white/[0.06]', bg: 'bg-white/[0.02]',       text: 'text-archilya-text-dim/50' },
};

const EXTENSION_MAP: Record<string, ArchFileExtension> = {
  '.dwg': 'DWG',  '.dxf': 'DWG',
  '.skp': 'SKP',
  '.3ds': '3DS',  '.max': '3DS',
  '.pdf': 'PDF',
  '.rvt': 'RVT',  '.rfa': 'RVT',
  '.ifc': 'IFC',
  '.doc': 'DOC',  '.docx': 'DOC', '.txt': 'DOC', '.rtf': 'DOC',
  '.xls': 'XLS',  '.xlsx': 'XLS', '.csv': 'XLS',
  '.jpg': 'IMG',  '.jpeg': 'IMG', '.png': 'IMG', '.gif': 'IMG',
  '.webp': 'IMG', '.bmp': 'IMG', '.tif': 'IMG', '.tiff': 'IMG',
};

export function getFileTypeFromName(filename: string): ArchFileExtension {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return 'OTHER';
  const ext = filename.slice(dotIndex).toLowerCase();
  return EXTENSION_MAP[ext] ?? 'OTHER';
}
