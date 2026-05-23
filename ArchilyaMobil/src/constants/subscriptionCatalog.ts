export type PlanId = 'free' | 'solo' | 'pro' | 'studio';

export type SubscriptionPlan = {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  credits: number;
  storage: string;
  projects: string;
  teamSize?: number;
  features: string[];
  popular?: boolean;
};

export type CreditPackage = {
  id: 'boost_500' | 'boost_1500' | 'boost_4000';
  credits: number;
  standardPrice: number;
  subscriberPrice: number;
  label: string;
  popular?: boolean;
  standardProductId: string;
  subscriberProductId: string;
};

export const PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Keşif',
    monthlyPrice: 0,
    annualPrice: 0,
    credits: 150,
    storage: '5 GB',
    projects: '3 proje',
    features: [
      'Aylık 150 işlem',
      'Temel AI Stüdyo araçları',
      '5 GB bulut depolama',
      '3 proje limiti',
      'Topluluk seviyesi destek',
    ],
  },
  {
    id: 'solo',
    name: 'Solo',
    monthlyPrice: 699,
    annualPrice: 6588,
    credits: 1000,
    storage: '30 GB',
    projects: '15 proje',
    features: [
      'Aylık 1.000 işlem',
      '30 GB bulut depolama',
      '15 aktif proje',
      'Filigransız indirme',
      'Standart kurulum rehberi ve onboarding videoları',
      'Ek paketlerde abone fiyatı',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 1499,
    annualPrice: 14388,
    credits: 2200,
    storage: '100 GB',
    projects: '100 proje',
    teamSize: 5,
    popular: true,
    features: [
      'Aylık 2.200 işlem',
      '100 GB bulut depolama',
      '100 proje kapasitesi',
      '5 kişilik ekip / workspace desteği',
      'VR ve üretim hizmetlerinde %20 abone indirimi',
      'Archilya Launcher kurulum desteği',
      '1 saat canlı AI & VR onboarding',
      'Öncelikli render kuyruğu',
      'Filigransız çıktı ve öncelikli destek',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    monthlyPrice: 4999,
    annualPrice: 47988,
    credits: 7000,
    storage: '750 GB',
    projects: 'Sınırsız',
    teamSize: 20,
    features: [
      'Aylık 7.000 işlem havuzu',
      '750 GB paylaşımlı depolama',
      'Sınırsız proje ve 20 kişilik workspace',
      'Rol, davet ve ekip yönetimi',
      'Tam gün AI & VR kurulum ve ekip eğitimi',
      'Özel proje yöneticisi ve öncelikli destek',
      'White-label ve API modülleri için add-on hazır altyapı',
    ],
  },
];

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'boost_500',
    credits: 500,
    standardPrice: 450,
    subscriberPrice: 350,
    label: '500 Kredi',
    standardProductId: 'boost_500_std',
    subscriberProductId: 'boost_500_sub',
  },
  {
    id: 'boost_1500',
    credits: 1500,
    standardPrice: 1150,
    subscriberPrice: 900,
    label: '1500 Kredi',
    popular: true,
    standardProductId: 'boost_1500_std',
    subscriberProductId: 'boost_1500_sub',
  },
  {
    id: 'boost_4000',
    credits: 4000,
    standardPrice: 2700,
    subscriberPrice: 2200,
    label: '4000 Kredi',
    standardProductId: 'boost_4000_std',
    subscriberProductId: 'boost_4000_sub',
  },
];

export const SUBSCRIPTION_PRODUCT_IDS = [
  'solo_monthly',
  'solo_annual',
  'pro_monthly',
  'pro_annual',
  'studio_monthly',
  'studio_annual',
];

export const CREDIT_PRODUCT_IDS = CREDIT_PACKAGES.flatMap((pkg) => [
  pkg.standardProductId,
  pkg.subscriberProductId,
]);

export function getPlanById(id: string | null | undefined): SubscriptionPlan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

export function getCreditPackageByProductId(id: string | null | undefined): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((pkg) => pkg.standardProductId === id || pkg.subscriberProductId === id);
}
