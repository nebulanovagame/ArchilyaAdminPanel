/* ─── Types ─── */

export interface Service {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  category: 'arch' | 'vr';
  defaultM2: number;
  guarantee?: boolean;
  badge?: string | null;
  features: string[];
}

export interface PriceResult {
  total: number;
  member: number;
  unit: number;
  saving: number;
}

export interface Totals {
  standard: number;
  subscriber: number;
  saving: number;
  extraDiscount: number;
  hasCustom: boolean;
  count: number;
}

/* ─── Helpers ─── */

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('tr-TR');
}

export function calcPrice(basePrice: number, m2: number): number {
  return Math.round(basePrice * Math.pow(m2 / 100, 0.8));
}

export function unitSavingPct(m2: number): number {
  if (m2 <= 100) return 0;
  return Math.round((1 - Math.pow(m2 / 100, -0.2)) * 100);
}

export function calcServicePrice(basePrice: number, m2: number): PriceResult | null {
  if (m2 >= 5000) return null;
  const total = calcPrice(basePrice, m2);
  const member = Math.round(total * 0.8);
  const unit = Math.round(total / m2);
  return { total, member, unit, saving: total - member };
}

export function calcTotals(services: Service[], m2Map: Record<string, number>): Totals {
  let standard = 0;
  let subscriber = 0;
  let hasCustom = false;
  services.forEach((s) => {
    const m2 = m2Map[s.id] ?? s.defaultM2;
    if (m2 >= 5000) { hasCustom = true; return; }
    const p = calcServicePrice(s.basePrice, m2);
    if (p) {
      standard += p.total;
      subscriber += p.member;
    }
  });
  return {
    standard,
    subscriber,
    saving: standard - subscriber,
    extraDiscount: 0,
    hasCustom,
    count: services.length,
  };
}

export function getServiceM2(service: Service, m2Map: Record<string, number>): number {
  return m2Map[service.id] ?? service.defaultM2;
}

/* ─── Service Data ─── */

export const ARCH_SERVICES: Service[] = [
  {
    id: 'konsept',
    name: 'Konsept Tasarım',
    description: 'Mimari ofis ile birlikte yürütülen, yoğun revizyonlu fikir geliştirme süreci.',
    basePrice: 18000,
    category: 'arch',
    defaultM2: 200,
    guarantee: true,
    features: ['Kütle ve Yerleşim Planı', 'Ortak Tasarım Süreci', '10 Revizyon Hakkı', 'Konsept Diyagramlar'],
  },
  {
    id: 'ic-mekan',
    name: 'İç Mekan Tasarımı',
    description: 'Yaşam alanlarını işlevsel, estetik ve markaya uygun biçimde kurgulayan mekan çözümleri.',
    basePrice: 18000,
    category: 'arch',
    defaultM2: 40,
    features: ['Tefriş ve Yerleşim Planı', 'Renk & Doku Analizi', 'Sabit Mobilya Konsepti', 'Aydınlatma Şeması'],
  },
  {
    id: 'peyzaj',
    name: 'Peyzaj ve Çevre Düzenleme',
    description: 'Projenin dış mekan, yeşil alan ve çevre tasarımını bütüncül bir bakışla planlayan hizmet.',
    basePrice: 8000,
    category: 'arch',
    defaultM2: 120,
    features: ['Sert / Yumuşak Zemin Planı', 'Bitkilendirme Şeması', 'Çevre Aydınlatma Konsepti', 'Açık Alan Kullanım Analizi'],
  },
  {
    id: 'modelleme',
    name: 'Profesyonel Modelleme',
    description: 'Eskiz veya 2D projenin kaynak dosyasıyla birlikte teslim edilen yüksek kaliteli 3D modeli.',
    basePrice: 14000,
    category: 'arch',
    defaultM2: 100,
    features: ['Yüksek Detaylı (LOD) Model', 'Tüm CAD / BIM Formatları', 'Poligon veya Parametrik Altyapı', 'Kaynak Dosya Teslimi'],
  },
  {
    id: 'gorseklestirme',
    name: 'Görselleştirme (İç + Dış Paket)',
    description: 'İç ve dış mekanı aynı m² üzerinden tek pakette fiyatlandıran tam kapsamlı görselleştirme. Ayrı ayrı almaktan %30 daha avantajlıdır.',
    basePrice: 15000,
    category: 'arch',
    defaultM2: 100,
    features: ['İç Mekan + Dış Cephe + Peyzaj', 'Tek m² Girişi ile Kolay Teklif', 'Ayrı Almaya Göre ~%30 İndirim', '2 Ücretsiz Revizyon + ₺1.500/ek'],
  },
  {
    id: 'ic-gorseklestirme',
    name: 'İç Mekan Görselleştirme',
    description: 'Mobilyalı, detaylı aydınlatma ve materyal çalışmasıyla üretilen iç mekan render seti. İç ve dış mekan m²\'leri farklı projelerde ayrı fiyatlandırma için kullanın.',
    basePrice: 12000,
    category: 'arch',
    defaultM2: 100,
    features: ['Mobilyalı ve Detaylı Render', 'Oda Bazlı Işıklandırma', 'Malzeme ve Doku Çalışması', '2 Ücretsiz Revizyon + ₺1.500/ek'],
  },
  {
    id: 'dis-gorseklestirme',
    name: 'Dış Mekan Görselleştirme',
    description: 'Cephe, çatı, bahçe, havuz ve vaziyet planını kapsayan dış mekan render seti. İç mekana göre daha düşük detay yoğunluğu nedeniyle ayrı fiyatlandırılır.',
    basePrice: 9000,
    category: 'arch',
    defaultM2: 100,
    features: ['Dış Cephe + Çatı Render', 'Peyzaj ve Vaziyet Planı', 'Doğal Gün Işığı Aydınlatma', '2 Ücretsiz Revizyon + ₺1.500/ek'],
  },
  {
    id: 'ruhsat',
    name: 'Ruhsat ve Uygulama',
    description: 'Belediye ve şantiye standartlarında hazırlanan fason 2D teknik çizim desteği.',
    basePrice: 10000,
    category: 'arch',
    defaultM2: 100,
    features: ['Belediye Standartlarında Çizim', 'Kat Planları ve Kesitler', 'Mevzuat ve Yönetmelik Uyumu', 'Sınırsız 2D Revizyon'],
  },
];

export const VR_SERVICES: Service[] = [
  {
    id: 'vr-transfer-raw',
    name: 'Materyalsiz VR Aktarma',
    description: 'Hazır 3D modeli materyal atamadan VR ortama aktaran hızlı sunum paketi.',
    basePrice: 6000,
    category: 'vr',
    defaultM2: 100,
    features: ['Hazır modelin VR\'a optimize aktarımı', 'Lo-fi / piksel art stil seçeneği', 'Teleport + serbest yürüme', 'Meta Quest & PC uyumlu teslim', '1 revizyon hakkı'],
  },
  {
    id: 'vr-transfer-4k',
    name: 'Materyalli 4K VR Aktarma',
    description: 'Hazır modeli Archilya materyal kütüphanesiyle kaplayıp 4K kalitede sunuma dönüştüren paket.',
    basePrice: 12000,
    category: 'vr',
    defaultM2: 100,
    features: ['Archilya materyal kütüphanesinden tam kaplama', '4K çözünürlük ve gerçek zamanlı gün ışığı', 'Piksel art / fotorealistik stil seçimi', 'Gezinebilir VR deneyimi', '2 revizyon hakkı'],
  },
  {
    id: 'vr-transfer-interactive',
    name: 'Full Etkileşimli 4K VR Aktarma',
    description: 'Hazır modele oda varyantları, anlık malzeme değişimi ve bütçe katmanı ekleyen premium interaktif paket.',
    basePrice: 45000,
    category: 'vr',
    defaultM2: 100,
    badge: 'Premium paket',
    features: ['Oda bazlı materyal / zemin / duvar varyantları', 'Anlık bütçe / maliyet güncelleme tablosu', 'Kapı, pencere ve ışık etkileşimleri', 'Gece / gündüz döngüsü', 'Öncelikli destek + 3 revizyon'],
  },
  {
    id: 'vr-model-raw',
    name: 'Materyalsiz VR Modelleme',
    description: '2D CAD veya PDF\'ten AI destekli sıfırdan geometri üretip hızlı sunum ortamına çeviren paket.',
    basePrice: 8000,
    category: 'vr',
    defaultM2: 100,
    badge: 'En çok istenen',
    features: ['2D plandan AI destekli sıfırdan modelleme', 'Materyalsiz / ham sunum ortamı', 'Standart 3–5 iş günü teslim', 'Teleport navigasyonlu VR dosyası', '2 revizyon hakkı'],
  },
  {
    id: 'vr-model-material',
    name: 'Materyalli VR Modelleme',
    description: '2D plandan sıfırdan modelleme + materyal kütüphanesiyle tam kaplama yapan sunum paketi.',
    basePrice: 18000,
    category: 'vr',
    defaultM2: 100,
    features: ['2D plandan sıfırdan 3D modelleme', 'Archilya materyal kütüphanesiyle tam kaplama', 'Piksel art / fotorealistik stil seçimi', 'Gerçek zamanlı gün ışığı ve gölge', '2 revizyon hakkı'],
  },
  {
    id: 'vr-model-interactive',
    name: 'Full Etkileşimli VR Modelleme',
    description: 'Sıfırdan modelleme, materyal kaplama ve tam etkileşimi tek pakette birleştiren en kapsamlı çözüm.',
    basePrice: 65000,
    category: 'vr',
    defaultM2: 100,
    badge: 'Prestij paketi',
    features: ['2D\'den sıfırdan yüksek detaylı modelleme', 'Archilya materyal kütüphanesiyle tam kaplama', 'Oda varyantları + kombinasyon matrisi', 'Anlık bütçe / maliyet tablosu', 'White-label arayüz', '3 revizyon + öncelikli destek'],
  },
];

export const ALL_SERVICES: Service[] = [...ARCH_SERVICES, ...VR_SERVICES];

export const M2_PRESETS = [50, 100, 500, 1000, 2500];
export const M2_MIN = 50;
export const M2_MAX = 5000;
export const M2_STEP = 10;

/* ─── Renk paleti (dağılım çubuğu için) ─── */

export const DISTRIBUTION_COLORS = [
  'bg-primary',
  'bg-sky-300',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-violet-400',
  'bg-rose-400',
  'bg-cyan-400',
  'bg-orange-400',
];
