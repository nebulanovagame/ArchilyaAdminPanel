/* ─── Types ─── */

export type ServiceGroup =
  | 'mimari-proje'
  | 'ic-mekan'
  | 'cephe'
  | 'peyzaj'
  | 'tadilat-renovasyon'
  | 'gorsellestirme'
  | 'vr'
  | 'proje-yonetimi'
  | 'idari-surec';

export interface ServiceGroupMeta {
  key: ServiceGroup;
  label: string;
  color: 'primary' | 'amber';
}

export const SERVICE_GROUPS: ServiceGroupMeta[] = [
  { key: 'mimari-proje', label: 'Mimari Proje Hizmetleri', color: 'primary' },
  { key: 'ic-mekan', label: 'İç Mekan Tasarımı', color: 'primary' },
  { key: 'cephe', label: 'Cephe Tasarımı', color: 'primary' },
  { key: 'peyzaj', label: 'Peyzaj ve Çevre Düzenleme', color: 'primary' },
  { key: 'tadilat-renovasyon', label: 'Tadilat ve Renovasyon', color: 'primary' },
  { key: 'gorsellestirme', label: 'Görselleştirme ve Dijital Sunum', color: 'amber' },
  { key: 'vr', label: 'VR Deneyimleri', color: 'amber' },
  { key: 'proje-yonetimi', label: 'Proje ve Uygulama Yönetimi', color: 'primary' },
  { key: 'idari-surec', label: 'Ruhsat ve İdari Süreç Danışmanlığı', color: 'primary' },
];

export interface Service {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  category: 'arch' | 'vr';
  group: ServiceGroup;
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
  const raw = basePrice * Math.pow(m2 / 100, 0.8);
  return Math.round(raw / 100) * 100;
}

export function unitSavingPct(m2: number): number {
  if (m2 <= 100) return 0;
  return Math.round((1 - Math.pow(m2 / 100, -0.2)) * 100);
}

export function calcServicePrice(basePrice: number, m2: number): PriceResult | null {
  if (m2 >= 5000) return null;
  const total = calcPrice(basePrice, m2);
  const member = Math.round((total * 0.8) / 100) * 100;
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

export const ALL_SERVICES: Service[] = [
  // ── A. MİMARİ PROJE HİZMETLERİ ──
  {
    id: 'fizibilite',
    name: 'Fizibilite ve İmar Araştırması',
    description: 'Arsa analizi, imar durumu tespiti, yapılabilirlik ve ön bütçe çalışması.',
    basePrice: 8000,
    category: 'arch',
    group: 'mimari-proje',
    defaultM2: 100,
    features: ['İmar durumu belgesi analizi', 'Yapılaşma hakkı hesaplaması', 'Ön fizibilite raporu', 'Bütçe tahmini'],
  },
  {
    id: 'konsept',
    name: 'Konsept Tasarım',
    description: 'Archilya AI + mimar işbirliğiyle yürütülen, yoğun revizyonlu fikir geliştirme süreci.',
    basePrice: 18000,
    category: 'arch',
    group: 'mimari-proje',
    defaultM2: 200,
    guarantee: true,
    features: ['Kütle ve Yerleşim Planı', 'AI Destekli Konsept Diyagramlar', '3D Kütle Modeli', '10 Revizyon Hakkı'],
  },
  {
    id: 'avan-proje',
    name: 'Avan Proje',
    description: 'Tasarım kararlarının netleştiği, yerleşim ve planlama çözümlerinin sunulduğu ön proje aşaması.',
    basePrice: 12000,
    category: 'arch',
    group: 'mimari-proje',
    defaultM2: 200,
    features: ['Kat planları ve kesitler (1/200)', 'Cephe görünüşleri', 'Alan hesap cetveli', 'Disiplin koordinasyon başlangıcı'],
  },
  {
    id: 'kesin-proje',
    name: 'Kesin Proje',
    description: 'Tüm disiplinlerle koordineli, uygulamaya esas teşkil eden kesinleşmiş tasarım seti.',
    basePrice: 20000,
    category: 'arch',
    group: 'mimari-proje',
    defaultM2: 200,
    features: ['Kesin kat planları (1/100)', 'Tüm kesit ve görünüşler', 'Mahal listesi', 'Statik/mekanik/elektrik koordinasyonu'],
  },
  {
    id: 'ruhsat-projesi',
    name: 'Ruhsat Projesi',
    description: 'İdari onaya sunulmak üzere hazırlanan, belediye standartlarına uygun proje seti.',
    basePrice: 8000,
    category: 'arch',
    group: 'mimari-proje',
    defaultM2: 100,
    features: ['Belediye onay formatında çizimler', 'Kat planları ve kesitler', 'Vaziyet planı', 'Mevzuat uyum raporu'],
  },
  {
    id: 'uygulama-projesi',
    name: 'Mimari Uygulama Projesi',
    description: 'Şantiyede imalata yönelik, sistem ve montaj detaylarını içeren kapsamlı uygulama seti.',
    basePrice: 15000,
    category: 'arch',
    group: 'mimari-proje',
    defaultM2: 100,
    features: ['Uygulama plan ve detayları', 'Sistem ve birleşim detayları', 'Kapı-pencere doğrama çizelgeleri', 'Islak hacim ve merdiven detayları'],
  },
  {
    id: 'ruhsat',
    name: 'Ruhsat ve Uygulama (Birleşik Paket)',
    description: 'Ruhsat projesi + uygulama projesini tek pakette birleştiren avantajlı seçenek.',
    basePrice: 10000,
    category: 'arch',
    group: 'mimari-proje',
    defaultM2: 100,
    features: ['Belediye Standartlarında Çizim', 'Kat Planları ve Kesitler', 'Mevzuat ve Yönetmelik Uyumu', 'Sınırsız 2D Revizyon'],
  },

  // ── B. İÇ MEKAN TASARIMI ──
  {
    id: 'ic-mekan',
    name: 'İç Mekan Konsept Tasarımı',
    description: 'Konut, ofis ve ticari alanlar için işlevsel, estetik ve markaya uygun mekan çözümleri.',
    basePrice: 18000,
    category: 'arch',
    group: 'ic-mekan',
    defaultM2: 40,
    features: ['Tefriş ve Yerleşim Planı', 'Renk & Doku Analizi', 'Sabit Mobilya Konsepti', 'Aydınlatma Şeması'],
  },
  {
    id: 'ic-mekan-uygulama',
    name: 'İç Mekan Uygulama Projesi',
    description: 'İç mekan konseptinin uygulamaya dönüştüğü, tavan-aydınlatma-kaplama detaylarını içeren proje seti.',
    basePrice: 12000,
    category: 'arch',
    group: 'ic-mekan',
    defaultM2: 40,
    features: ['Tavan ve aydınlatma planları', 'Duvar-zemin-tavan kaplama planları', 'Sabit mobilya ve marangozluk detayları', 'Uygulama kesit ve görünüşleri'],
  },
  {
    id: 'ffe',
    name: 'FF&E Seçimi ve Malzeme Danışmanlığı',
    description: 'Mobilya, donatı ve malzeme seçimi, satın alma listesi ve numune yönetimi.',
    basePrice: 8000,
    category: 'arch',
    group: 'ic-mekan',
    defaultM2: 40,
    features: ['Mobilya ve donatı seçimi', 'Satın alma listesi', 'Numune ve mock-up yönetimi', 'Malzeme onay süreci'],
  },
  {
    id: 'ozel-mobilya',
    name: 'Özel Mobilya Tasarımı',
    description: 'Projeye özel, kişiye özel mobilya tasarımı ve imalat detayları.',
    basePrice: 8000,
    category: 'arch',
    group: 'ic-mekan',
    defaultM2: 40,
    features: ['Özel mobilya konsepti', 'İmalat detay çizimleri', 'Malzeme ve kaplama seçimi', 'Üretim takibi'],
  },

  // ── C. CEPHE TASARIMI ──
  {
    id: 'cephe',
    name: 'Cephe Tasarım ve Uygulama Paketi',
    description: 'Konseptten uygulamaya, malzeme seçiminden montaj detaylarına kadar tüm cephe hizmetleri.',
    basePrice: 15000,
    category: 'arch',
    group: 'cephe',
    defaultM2: 100,
    features: ['Cephe konsepti ve malzeme seçimi', '3D cephe modellemesi', 'Cephe uygulama ve montaj detayları', 'Isı yalıtım ve su sızdırmazlık koordinasyonu'],
  },

  // ── D. PEYZAJ ──
  {
    id: 'peyzaj',
    name: 'Peyzaj ve Çevre Düzenleme',
    description: 'Projenin dış mekan, yeşil alan ve çevre tasarımını bütüncül bir bakışla planlayan hizmet.',
    basePrice: 8000,
    category: 'arch',
    group: 'peyzaj',
    defaultM2: 120,
    features: ['Sert / Yumuşak Zemin Planı', 'Bitkilendirme Şeması', 'Çevre Aydınlatma Konsepti', 'Açık Alan Kullanım Analizi'],
  },

  // ── E. TADİLAT & RENOVASYON ──
  {
    id: 'tadilat',
    name: 'Tadilat ve Renovasyon Projesi',
    description: 'Mevcut yapıların ölçümü, yenileme tasarımı ve tadilat ruhsat sürecini kapsayan hizmet.',
    basePrice: 10000,
    category: 'arch',
    group: 'tadilat-renovasyon',
    defaultM2: 100,
    features: ['Mevcut durum ölçümü ve rölöve', 'Plan revizyonu ve yenileme tasarımı', 'Tadilat ruhsat projesi', 'Uygulama detayları'],
  },

  // ── F. GÖRSELLEŞTİRME VE DİJİTAL SUNUM ──
  {
    id: 'modelleme',
    name: 'Profesyonel 3D Modelleme',
    description: 'Eskiz veya 2D projenin, kaynak dosyasıyla birlikte teslim edilen yüksek kaliteli 3D modeli.',
    basePrice: 14000,
    category: 'arch',
    group: 'gorsellestirme',
    defaultM2: 100,
    features: ['Yüksek Detaylı (LOD 200-400) Model', 'Tüm CAD/BIM Formatları', 'Poligon veya Parametrik Altyapı', 'Kaynak Dosya Teslimi'],
  },
  {
    id: 'ic-gorseklestirme',
    name: 'İç Mekan Görselleştirme',
    description: 'Villa ve özel konutlar için mobilyalı, detaylı aydınlatma ve materyal çalışmasıyla üretilen iç mekan render seti.',
    basePrice: 12000,
    category: 'arch',
    group: 'gorsellestirme',
    defaultM2: 100,
    features: ['Mobilyalı ve Detaylı Render', 'Oda Bazlı Işıklandırma', 'Malzeme ve Doku Çalışması', '2 Ücretsiz Revizyon + ₺1.500/ek'],
  },
  {
    id: 'dis-gorseklestirme',
    name: 'Dış Mekan Görselleştirme',
    description: 'Villa konsepti için cephe, çatı, bahçe, havuz ve vaziyet planını kapsayan dış mekan render seti.',
    basePrice: 9000,
    category: 'arch',
    group: 'gorsellestirme',
    defaultM2: 100,
    features: ['Dış Cephe + Çatı Render', 'Peyzaj ve Vaziyet Planı', 'Doğal Gün Işığı Aydınlatma', '2 Ücretsiz Revizyon + ₺1.500/ek'],
  },
  {
    id: 'toplu-konut-render',
    name: 'Toplu Konut Render Paketi',
    description: 'Daire tipi projeler için iç mekan + dış cephe render setini tek pakette sunan avantajlı çözüm. m² alanına proje genel alanını (daireler+ortak alan+arsa) giriniz.',
    basePrice: 15000,
    category: 'arch',
    group: 'gorsellestirme',
    defaultM2: 500,
    features: ['Daire iç mekan render', 'Bina dış cephe render', 'Vaziyet ve peyzaj render', '2 Ücretsiz Revizyon + ₺1.500/ek'],
  },
  {
    id: 'animasyon',
    name: '3D Animasyon ve Walkthrough',
    description: 'Projenizin gezilebilir 3D animasyonu, görselleştirme ve sunum videoları.',
    basePrice: 15000,
    category: 'arch',
    group: 'gorsellestirme',
    defaultM2: 100,
    features: ['3D gezinti videosu', 'Proje sunum animasyonu', 'Seslendirme ve müzik seçeneği', 'Full HD / 4K çıktı'],
  },
  {
    id: 'sanal-staging',
    name: 'Sanal Staging',
    description: 'Boş mekanların dijital mobilya ve dekorasyonla görselleştirilerek pazarlanabilir hale getirilmesi.',
    basePrice: 5000,
    category: 'arch',
    group: 'gorsellestirme',
    defaultM2: 100,
    features: ['Boş mekan mobilyalama', 'Dekorasyon konsepti', 'Hızlı teslim (2-3 gün)', 'Emlak ilanlarına hazır format'],
  },
  {
    id: '360-tur',
    name: '360° Sanal Tur',
    description: 'Mekanın her açıdan gezilebildiği, web üzerinden paylaşılabilir 360° sanal tur.',
    basePrice: 4000,
    category: 'arch',
    group: 'gorsellestirme',
    defaultM2: 100,
    features: ['360° oda bazlı çekim', 'Web üzerinden paylaşım', 'Mobil uyumlu görüntüleme', 'VR gözlük desteği'],
  },

  // ── H. PROJE YÖNETİMİ ──
  {
    id: 'metraj-kesif',
    name: 'Metraj, Keşif ve Yaklaşık Maliyet',
    description: 'İş kalemleri bazında miktar tespiti, fiyatlandırma ve yaklaşık bütçe çalışması.',
    basePrice: 8000,
    category: 'arch',
    group: 'proje-yonetimi',
    defaultM2: 100,
    features: ['İş kalemi bazında metraj', 'Birim fiyat analizi', 'Yaklaşık maliyet cetveli', 'Alternatif malzeme karşılaştırması'],
  },
  {
    id: 'ihale-dosyasi',
    name: 'İhale Dosyası, Şartname ve Teklif Karşılaştırma',
    description: 'Yüklenici seçimine yönelik ihale belgeleri, teknik şartname ve teklif değerlendirme.',
    basePrice: 10000,
    category: 'arch',
    group: 'proje-yonetimi',
    defaultM2: 100,
    features: ['Teknik şartname hazırlığı', 'Teklif dosyası', 'Yüklenici ön yeterlilik değerlendirmesi', 'Teklif karşılaştırma raporu'],
  },
  {
    id: 'santiye',
    name: 'Mimari Uygulama ve Şantiye Danışmanlığı',
    description: 'Periyodik saha ziyaretleri, projeye uygunluk kontrolü ve malzeme onay süreci.',
    basePrice: 12000,
    category: 'arch',
    group: 'proje-yonetimi',
    defaultM2: 100,
    features: ['Periyodik saha ziyareti', 'Projeye uygunluk kontrolü', 'Malzeme ve numune onayı', 'Revizyonların projeye işlenmesi'],
  },

  // ── I. RUHSAT VE İDARİ SÜREÇ ──
  {
    id: 'ruhsat-takip',
    name: 'Yapı Ruhsatı Başvuru ve Takibi',
    description: 'Belediye süreçlerinin yönetimi, evrak takibi ve ruhsat çıkarma hizmeti.',
    basePrice: 5000,
    category: 'arch',
    group: 'idari-surec',
    defaultM2: 100,
    features: ['Evrak hazırlığı ve kontrolü', 'Belediye başvuru süreci', 'Eksik evrak takibi', 'Ruhsat teslim alımı'],
  },
  {
    id: 'iskan-takip',
    name: 'Yapı Kullanma İzin Belgesi Başvuru ve Takibi',
    description: 'İskan sürecinin yönetimi, gerekli belgelerin hazırlanması ve takibi.',
    basePrice: 3000,
    category: 'arch',
    group: 'idari-surec',
    defaultM2: 100,
    features: ['İskan evrak hazırlığı', 'Belediye başvurusu', 'Ekspertiz koordinasyonu', 'İzin belgesi teslim alımı'],
  },
];

/* ─── VR SERVİSLERİ (mevcut, aynen) ─── */

export const VR_SERVICES: Service[] = [
  {
    id: 'vr-transfer-raw',
    name: 'Materyalsiz VR Aktarma',
    description: 'Hazır 3D modeli materyal atamadan VR ortama aktaran hızlı sunum paketi.',
    basePrice: 6000,
    category: 'vr',
    group: 'vr',
    defaultM2: 100,
    features: ['Hazır modelin VR\'a optimize aktarımı', 'Lo-fi / piksel art stil seçeneği', 'Teleport + serbest yürüme', 'Meta Quest & PC uyumlu teslim', '1 revizyon hakkı'],
  },
  {
    id: 'vr-transfer-4k',
    name: 'Materyalli 4K VR Aktarma',
    description: 'Hazır modeli Archilya materyal kütüphanesiyle kaplayıp 4K kalitede sunuma dönüştüren paket.',
    basePrice: 12000,
    category: 'vr',
    group: 'vr',
    defaultM2: 100,
    badge: 'En çok tercih edilen',
    features: ['Archilya materyal kütüphanesinden tam kaplama', '4K çözünürlük ve gerçek zamanlı gün ışığı', 'Piksel art / fotorealistik stil seçimi', 'Gezinebilir VR deneyimi', '2 revizyon hakkı'],
  },
  {
    id: 'vr-transfer-interactive',
    name: 'Full Etkileşimli 4K VR Aktarma',
    description: 'Hazır modele oda varyantları, anlık malzeme değişimi ve bütçe katmanı ekleyen premium interaktif paket.',
    basePrice: 45000,
    category: 'vr',
    group: 'vr',
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
    group: 'vr',
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
    group: 'vr',
    defaultM2: 100,
    features: ['2D plandan sıfırdan 3D modelleme', 'Archilya materyal kütüphanesiyle tam kaplama', 'Piksel art / fotorealistik stil seçimi', 'Gerçek zamanlı gün ışığı ve gölge', '2 revizyon hakkı'],
  },
  {
    id: 'vr-model-interactive',
    name: 'Full Etkileşimli VR Modelleme',
    description: 'Sıfırdan modelleme, materyal kaplama ve tam etkileşimi tek pakette birleştiren en kapsamlı çözüm.',
    basePrice: 65000,
    category: 'vr',
    group: 'vr',
    defaultM2: 100,
    badge: 'Prestij paketi',
    features: ['2D\'den sıfırdan yüksek detaylı modelleme', 'Archilya materyal kütüphanesiyle tam kaplama', 'Oda varyantları + kombinasyon matrisi', 'Anlık bütçe / maliyet tablosu', 'White-label arayüz', '3 revizyon + öncelikli destek'],
  },
];

/* ─── Grouped accessors ─── */

export function getServicesByGroup(group: ServiceGroup): Service[] {
  return ALL_SERVICES.filter((s) => s.group === group);
}

export const ARCH_SERVICES = ALL_SERVICES.filter((s) => s.category === 'arch');
export const NON_VR_GROUPS: ServiceGroup[] = SERVICE_GROUPS
  .filter((g) => g.key !== 'vr')
  .map((g) => g.key);

/* ─── Constants ─── */

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
