export type SubscriptionPlan = {
  id: string;
  name: string;
  title: string;
  description: string;
  price: number;
  priceAnnual?: number | null;
  credits: number;
  storage: string;
  projects: string;
  teamSize?: number;
  iconKey: string;
  color: string;
  popular?: boolean;
  features: string[];
  cta: string;
};

export type AddOnPackage = {
  id: string;
  label: string;
  credits: number;
  subscriberPrice: number;
  standardPrice: number;
  description: string;
  popular?: boolean;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Keşif",
    title: "Ücretsiz keşif alanı",
    description: "Platformu tanımak, örnek çıktıları görmek ve ilk iş akışını test etmek isteyen kullanıcılar için başlangıç katmanı.",
    price: 0,
    credits: 150,
    storage: "5 GB",
    projects: "3 proje",
    iconKey: "sparkles",
    color: "text-gray-400",
    features: [
      "Aylık 150 işlem",
      "Temel AI Stüdyo araçları",
      "5 GB bulut depolama",
      "3 proje limiti",
      "Topluluk seviyesi destek",
    ],
    cta: "Ücretsiz Başla",
  },
  {
    id: "solo",
    name: "Solo",
    title: "Freelancer köprü planı",
    description: "Tek başına çalışan mimar ve iç mimarlar için Keşif ile Pro arasındaki kopukluğu kapatan, düşük bariyerli profesyonel plan.",
    price: 699,
    priceAnnual: 549,
    credits: 1000,
    storage: "30 GB",
    projects: "15 proje",
    iconKey: "zap",
    color: "text-sky-300",
    features: [
      "Aylık 1.000 işlem",
      "30 GB bulut depolama",
      "15 aktif proje",
      "Filigransız indirme",
      "Standart kurulum rehberi ve onboarding videoları",
      "Ek paketlerde abone fiyatı",
    ],
    cta: "Solo’ya Geç",
  },
  {
    id: "pro",
    name: "Pro",
    title: "Küçük ekipli üretim planı",
    description: "Yoğun üretim yapan profesyoneller ve küçük ekipler için 5 kişilik iş birliği kapasitesi sunan ana üretim planı.",
    price: 1499,
    priceAnnual: 1199,
    credits: 2200,
    storage: "100 GB",
    projects: "100 proje",
    teamSize: 5,
    iconKey: "rocket",
    color: "text-primary",
    popular: true,
    features: [
      "Aylık 2.200 işlem",
      "100 GB bulut depolama",
      "100 proje kapasitesi",
      "5 kişilik ekip / workspace desteği",
      "VR ve üretim hizmetlerinde %20 abone indirimi",
      "Archilya Launcher kurulum desteği",
      "1 saat canlı AI & VR onboarding",
      "Öncelikli render kuyruğu",
      "Filigransız çıktı ve öncelikli destek",
    ],
    cta: "Pro’ya Geç",
  },
  {
    id: "studio",
    name: "Studio",
    title: "Stüdyo ve ekip operasyonu",
    description: "Birden fazla çalışan, ortak havuz ve müşteri sunum altyapısı yöneten tasarım ofisleri için ekip planı.",
    price: 4999,
    priceAnnual: 3999,
    credits: 7000,
    storage: "750 GB",
    projects: "Sınırsız proje",
    teamSize: 20,
    iconKey: "crown",
    color: "text-amber-400",
    features: [
      "Aylık 7.000 işlem havuzu",
      "750 GB paylaşımlı depolama",
      "Sınırsız proje ve 20 kişilik workspace",
      "Rol, davet ve ekip yönetimi",
      "Tam gün AI & VR kurulum ve ekip eğitimi",
      "Özel proje yöneticisi ve öncelikli destek",
      "White-label ve API modülleri için add-on hazır altyapı",
    ],
    cta: "Studio’ya Geç",
  },
];

export const ADD_ON_PACKAGES: AddOnPackage[] = [
  {
    id: "boost-500",
    label: "Akış Takviyesi",
    credits: 500,
    subscriberPrice: 350,
    standardPrice: 450,
    description: "Ay ortasında yetişmeyen teslimler için hızlı takviye.",
  },
  {
    id: "boost-1500",
    label: "Proje Hızı",
    credits: 1500,
    subscriberPrice: 900,
    standardPrice: 1150,
    popular: true,
    description: "Teklif, ihale ve sunum yoğunluğu olan ekipler için dengeli ek kota.",
  },
  {
    id: "boost-4000",
    label: "İhale Sprinti",
    credits: 4000,
    subscriberPrice: 2200,
    standardPrice: 2700,
    description: "Büyük teslim ve yarışma dönemlerinde tek seferlik yüksek hacim.",
  },
];

export const PRICING_EXPLANATION = {
  unitTitle: "1 işlem ne demek?",
  unitDescription:
    "1 işlem; tek bir AI görevi veya güçlü dönüşüm hakkıdır. Örneğin bir render iyileştirme, plan boyama, stil dönüşümü ya da sahne revizesi bir işlem tüketir.",
  annualNote: "Yıllık peşin ödemede yaklaşık %20 fiyat avantajı uygulanır.",
  addOnNote: "Ek işlem paketleri aylık planın yerine geçmez; yoğun dönemlerde kullanılan premium top-up katmanıdır.",
  studioNote: "Studio havuzu kişi başına bölünmez; ekip ortak kullanır. Böylece yüksek kullanan ekip arkadaşları projeyi bloklamaz.",
};
