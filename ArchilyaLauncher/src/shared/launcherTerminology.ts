export const LAUNCHER_TERMS = {
  productName: 'Archilya',
  primaryAction: 'Başlat',
  vrAction: 'VR ile Başlat',
  webShareAction: 'Web ile Paylaş',
  streamStartAction: 'Yayını Başlat',
  streamStopAction: 'Yayını Durdur',
} as const;

export type LauncherTermKey = keyof typeof LAUNCHER_TERMS;
