export interface StyleOption {
  id: string;
  name: string;
  description: string;
  previewUrl: string;
}

export interface LightingPreset {
  id: string;
  name: string;
}

export interface ReportType {
  id: string;
  name: string;
  description: string;
}

export interface EnhancementType {
  id: string;
  name: string;
  description: string;
}

export interface RoomColorPreset {
  id: string;
  name: string;
  colors: Record<string, string>;
}

export interface AiTool {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'conversion' | 'analysis-doc' | 'rd';
  active: boolean;
  engineShort: string;
  creditCost: number;
  iconSvg: string;
}

export const AI_TOOL_CATEGORY_LABELS = {
  core: 'Üretim',
  conversion: 'Dönüşüm',
  'analysis-doc': 'Analiz & Dokümantasyon',
  rd: 'Ar-Ge',
} as const;

export const AI_TOOLS: AiTool[] = [
  // === ÜRETİM ===
  {
    id: 'render-from-scratch',
    name: 'Metinden Render',
    description: 'Metin promptu ile sıfırdan mimari görsel üretin. Konsept aşaması için ideal.',
    category: 'core',
    active: true,
    engineShort: 'Stable Diffusion XL',
    creditCost: 20,
    iconSvg: 'M12 3v18 M3 12h18',
  },
  {
    id: 'sketchup-render',
    name: 'SketchUp Render',
    description: 'SketchUp ekran görüntüsünü veya basit 3D görseli photorealistic rendera dönüştürün.',
    category: 'core',
    active: true,
    engineShort: 'ControlNet + SDXL',
    creditCost: 15,
    iconSvg: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  },

  // === DÖNÜŞÜM ===
  {
    id: 'style-transfer',
    name: 'Stil Dönüşümü',
    description: 'Mevcut renderınızın mimari stilini değiştirin. Modernden Art Decoya, klasikten futuriste.',
    category: 'conversion',
    active: true,
    engineShort: 'Img2Img + ControlNet',
    creditCost: 15,
    iconSvg: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
  },
  {
    id: 'enhance',
    name: 'Render İyileştirme',
    description: 'Düşük kaliteli, gürültülü veya yetersiz ışıklı renderları profesyonel kaliteye yükseltin.',
    category: 'conversion',
    active: true,
    engineShort: 'Real-ESRGAN + Retouch',
    creditCost: 10,
    iconSvg: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  },
  {
    id: 'scene-edit',
    name: 'Sahne Düzenleme',
    description: 'Renderınızdaki nesneleri ekle, çıkar veya değiştir. "Balkonu kapat", "Havuz ekle" gibi komutlar.',
    category: 'conversion',
    active: true,
    engineShort: 'Inpainting + LLM',
    creditCost: 18,
    iconSvg: 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  },
  {
    id: 'plancolor',
    name: 'Plan Boyama',
    description: 'Teknik çizim veya wireframe planı renklendirilmiş, malzeme atamalı mimari plana dönüştürün.',
    category: 'conversion',
    active: true,
    engineShort: 'Segmentation + Colorize',
    creditCost: 12,
    iconSvg: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
  },

  // === ANALİZ & DOKÜMANTASYON ===
  {
    id: 'arch-report',
    name: 'Mimari Rapor',
    description: 'Proje görsellerini analiz ederek program analizi, mekansal kalite, sürdürülebilirlik raporu üretin.',
    category: 'analysis-doc',
    active: true,
    engineShort: 'Gemini Vision Pro',
    creditCost: 25,
    iconSvg: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  },
  {
    id: 'render-quality',
    name: 'Render Kalite Analizi',
    description: 'Renderınızı mimari vizualizasyon standartlarına göre puanlayın. Gerçekçilik, kompozisyon, ışık analizi.',
    category: 'analysis-doc',
    active: true,
    engineShort: 'Gemini Vision Pro',
    creditCost: 8,
    iconSvg: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
  },
  {
    id: 'material-list',
    name: 'Malzeme Listesi',
    description: 'Render veya plan görselinden otomatik malzeme tespiti ve önerilen malzeme listesi oluşturun.',
    category: 'analysis-doc',
    active: true,
    engineShort: 'Gemini Vision Pro',
    creditCost: 15,
    iconSvg: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
  },

  // === AR-GE ===
  {
    id: 'dxf-render',
    name: 'DXF Render',
    description: '2D DXF/AutoCAD çizimini 3D render görseline dönüştürün.',
    category: 'rd',
    active: false,
    engineShort: 'ControlNet',
    creditCost: 20,
    iconSvg: 'M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4 M14 2v6h6 M2 15h10',
  },
  {
    id: 'presentation-sheet',
    name: 'Sunum Paftası',
    description: 'Proje görsellerini otomatik olarak sunum paftası düzenine yerleştirin. A3, A1 formatları.',
    category: 'rd',
    active: false,
    engineShort: 'Layout AI',
    creditCost: 12,
    iconSvg: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
  },
  {
    id: 'exploded-diagram',
    name: 'Patlatılmış Diyagram',
    description: '3D model veya renderden patlatılmış (exploded) aksonometrik diyagram oluşturun.',
    category: 'rd',
    active: false,
    engineShort: 'Depth Estimation',
    creditCost: 22,
    iconSvg: 'M12 2l-9.53 6.35 9.53 6.35 9.53-6.35L12 2z M2 12l10 6.67L22 12',
  },
  {
    id: 'climate-sun',
    name: 'İklim & Güneş Analizi',
    description: 'Konum ve bina parametrelerine göre güneş yolu, gölge analizi ve enerji verimlilik raporu.',
    category: 'rd',
    active: false,
    engineShort: 'Parametric',
    creditCost: 18,
    iconSvg: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  },
  {
    id: 'concept-process',
    name: 'Konsept Süreç Paftası',
    description: 'Eskizden son rendera kadar tüm süreci otomatik olarak konsept paftasına dizin.',
    category: 'rd',
    active: false,
    engineShort: 'Layout AI',
    creditCost: 15,
    iconSvg: 'M9.663 17h4.673M12 3v1M6.343 4.343l-.707-.707M18.364 4.343l.707-.707M12 21v1M6.343 19.657l-.707.707M18.364 19.657l.707.707',
  },
];

export const STYLE_OPTIONS: StyleOption[] = [
  { id: 'modern', name: 'Modern', description: 'Temiz çizgiler, geniş cam yüzeyler ve çağdaş estetik.', previewUrl: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=80' },
  { id: 'minimalist', name: 'Minimalist', description: 'Az detay, fazla boşluk ve sade formlar.', previewUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80' },
  { id: 'brutalist', name: 'Brütalist', description: 'Ham beton, ağır kütler ve endüstriyel dokunuşlar.', previewUrl: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=400&q=80' },
  { id: 'organic', name: 'Organik (Zaha Hadid)', description: 'Akışkan formlar, eğrisel çizgiler ve doğadan ilham.', previewUrl: 'https://images.unsplash.com/photo-1506158669146-619067006800?w=400&q=80' },
  { id: 'art-deco', name: 'Art Deco', description: 'Geometrik desenler, zengin malzemeler ve retro lüks.', previewUrl: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=400&q=80' },
  { id: 'classical', name: 'Klasik', description: 'Simetri, sütunlar ve geleneksel oranlar.', previewUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80' },
  { id: 'industrial', name: 'Endüstriyel', description: 'Çelik konstrüksiyon, açık tesisat ve loft estetiği.', previewUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80' },
  { id: 'scandinavian', name: 'Skandinav', description: 'Açık renkler, doğal ahşap ve hygge konforu.', previewUrl: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&q=80' },
  { id: 'japanese', name: 'Japon (Wabi-Sabi)', description: 'Doğal malzemeler, asgari düzen ve huzur.', previewUrl: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&q=80' },
  { id: 'futuristic', name: 'Fütüristik', description: 'Parametrik formlar, akıllı malzemeler ve ileri teknoloji.', previewUrl: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&q=80' },
];

export const LIGHTING_PRESETS: LightingPreset[] = [
  { id: 'golden-hour', name: 'Altın Saat' },
  { id: 'overcast', name: 'Kapalı Hava' },
  { id: 'night', name: 'Gece' },
  { id: 'studio', name: 'Stüdyo' },
  { id: 'blue-hour', name: 'Mavi Saat' },
  { id: 'midday', name: 'Öğlen Güneşi' },
];

export const REPORT_TYPES: ReportType[] = [
  { id: 'program-analysis', name: 'Program Analizi', description: 'Fonksiyon dağılımı, mekan büyüklükleri ve kullanıcı akışı analizi.' },
  { id: 'spatial-quality', name: 'Mekansal Kalite', description: 'Oranlar, perspektif, görsel ilişkiler ve mekansal hiyerarşi değerlendirmesi.' },
  { id: 'sustainability', name: 'Sürdürülebilirlik', description: 'Enerji verimliliği, çevresel etki ve yeşil alan analizi.' },
  { id: 'accessibility', name: 'Erişilebilirlik', description: 'Engelli erişimi, sirkülasyon ve güvenlik standartları değerlendirmesi.' },
  { id: 'contextual', name: 'Bağlamsal Analiz', description: 'Çevre dokusu, kent dokusu uyumu ve komşuluk ilişkileri.' },
];

export const ENHANCEMENT_TYPES: EnhancementType[] = [
  { id: 'upscale', name: 'Çözünürlük Artırma', description: 'Düşük çözünürlüklü renderı 2x veya 4x büyütme ve detaylandırma.' },
  { id: 'denoise', name: 'Gürültü Temizleme', description: 'Grain ve pikselasyon gibi gürültüleri temizleme.' },
  { id: 'lighting-fix', name: 'Işık Düzeltme', description: 'Aşırı karanlık veya aşırı parlak alanları dengeli ışığa çevirme.' },
  { id: 'detail-enhance', name: 'Detay Zenginleştirme', description: 'Doku, malzeme ve küçük detayları netleştirme.' },
  { id: 'color-grading', name: 'Renk Düzenleme', description: 'Renk sıcaklığı, kontrast ve doygunluğu profesyonel düzeye getirme.' },
];

export const ROOM_COLOR_PRESETS: RoomColorPreset[] = [
  { id: 'warm', name: 'Sıcak Tonlar', colors: { salon: '#F5E6D3', mutfak: '#FFF8E7', yatak: '#E8D5C4', banyo: '#F0EDE5', calisma: '#D4C5B5' } },
  { id: 'cool', name: 'Soğuk Tonlar', colors: { salon: '#E3F2FD', mutfak: '#F5F5F5', yatak: '#E8EAF6', banyo: '#E0F7FA', calisma: '#ECEFF1' } },
  { id: 'neutral', name: 'Nötr Tonlar', colors: { salon: '#EFEBE9', mutfak: '#FAFAFA', yatak: '#D7CCC8', banyo: '#F5F5F5', calisma: '#EEEEEE' } },
  { id: 'modern', name: 'Modern Kontrast', colors: { salon: '#212121', mutfak: '#FFFFFF', yatak: '#424242', banyo: '#9E9E9E', calisma: '#616161' } },
];

export const MOCK_RESULT_URLS = [
  'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=90',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=90',
  'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=1200&q=90',
  'https://images.unsplash.com/photo-1506158669146-619067006800?w=1200&q=90',
  'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=1200&q=90',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=90',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=90',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200&q=90',
];
