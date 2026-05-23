export const mockResultImages = [
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzE4MTgxOCIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2Q0YWYzNyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlJFTkRFUiBTT05VQyAxPC90ZXh0Pjwvc3ZnPg==',
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzE0MTQxNCIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2Q0YWYzNyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlJFTkRFUiBTT05VQyAyPC90ZXh0Pjwvc3ZnPg==',
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzFhMWEyMCIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2Q0YWYzNyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlJFTkRFUiBTT05VQyAzPC90ZXh0Pjwvc3ZnPg==',
];

export const mockInpaintingResults = [
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzE4MTgxOCIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzM0ZDM5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkvEsExMSSBSSVZJWkVZTyAxPC90ZXh0Pjwvc3ZnPg==',
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzE0MTQxNCIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzM0ZDM5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkvEsExMSSBSSVZJWkVZTyAyPC90ZXh0Pjwvc3ZnPg==',
];

export interface RenderSettings {
  style: 'realistic' | 'sketch' | 'watercolor' | 'minimal';
  lighting: 'natural' | 'studio' | 'dramatic' | 'night';
  quality: 'draft' | 'standard' | 'high';
  resolution: '512x512' | '1024x1024' | '2048x2048';
}

export const defaultRenderSettings: RenderSettings = {
  style: 'realistic',
  lighting: 'natural',
  quality: 'standard',
  resolution: '1024x1024',
};

export const styleOptions: { value: RenderSettings['style']; label: string }[] = [
  { value: 'realistic', label: 'Gerçekçi' },
  { value: 'sketch', label: 'Kroki' },
  { value: 'watercolor', label: 'Suluboya' },
  { value: 'minimal', label: 'Minimal' },
];

export const lightingOptions: { value: RenderSettings['lighting']; label: string }[] = [
  { value: 'natural', label: 'Doğal Işık' },
  { value: 'studio', label: 'Stüdyo' },
  { value: 'dramatic', label: 'Dramatik' },
  { value: 'night', label: 'Gece' },
];

export const qualityOptions: { value: RenderSettings['quality']; label: string }[] = [
  { value: 'draft', label: 'Taslak' },
  { value: 'standard', label: 'Standart' },
  { value: 'high', label: 'Yüksek' },
];

export const resolutionOptions: { value: RenderSettings['resolution']; label: string }[] = [
  { value: '512x512', label: '512 × 512' },
  { value: '1024x1024', label: '1024 × 1024' },
  { value: '2048x2048', label: '2048 × 2048' },
];

export const mockGenerationMessages = [
  'Analiz ediliyor...',
  'Derin öğrenme modeli çalıştırılıyor...',
  'Render detayları oluşturuluyor...',
  'Son dokunuşlar yapılıyor...',
];
