export type AiGenerationStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';

export type AiFeedback = 'positive' | 'negative' | null;

export interface AiGenerationRecord {
  id: string;
  toolId: string;
  toolName: string;
  category: 'core' | 'conversion' | 'analysis-doc' | 'rd';
  promptText: string;
  imageUrl: string;
  sourceImage?: string;
  createdAt: number;
  status: AiGenerationStatus;
  creditsCost: number;
  feedback: AiFeedback;
  projectId?: string;
  projectName?: string;
}

export type AiGalleryFilter = 'all' | 'core' | 'conversion' | 'analysis-doc' | 'rd';

export type AiGallerySort = 'newest' | 'oldest' | 'highest-credits';

export interface AiGalleryFilters {
  category: AiGalleryFilter;
  searchQuery: string;
  sort: AiGallerySort;
}
