import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Key,
  LayoutDashboard,
  Loader2,
  Monitor,
  Package,
  Receipt,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
  Upload,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  addAuditLog,
  addCreditTransaction,
  adjustUserCredits,
  createProductDraftId,
  createProductAndAssign,
  deleteProductWithAssets,
  ensureAdminDocument,
  fetchAuditLogs,
  fetchCreditPackages,
  fetchCreditTransactions,
  fetchLauncherCommands,
  fetchLauncherReleases,
  fetchLicenses,
  fetchMachines,
  fetchOrders,
  fetchPlans,
  fetchProducts,
  fetchSubscriptions,
  fetchUsers,
  findUserByEmail,
  reassignProductOwner,
  seedBaseCommerceData,
  updateUserPlanAndStatus,
  uploadVrProjectFiles,
  upsertLauncherCommand,
  upsertLauncherRelease,
  upsertLicense,
  upsertMachine,
  upsertOrder,
  upsertCreditPackage,
  upsertPlan,
  upsertSubscription,
  type AuditLogInput,
} from '../services/adminDataService';
import type {
  AdminUser,
  AuditLogRecord,
  BillingPeriod,
  CreditPackageRecord,
  CreditTransactionRecord,
  CreditTransactionType,
  DashboardMetrics,
  FlashMessage,
  LauncherCommandRecord,
  LauncherCommandStatus,
  LauncherCommandType,
  LauncherReleaseRecord,
  LicenseRecord,
  LicenseStatus,
  LicenseType,
  MachineRecord,
  MachineStatus,
  PlanRecord,
  OrderRecord,
  OrderStatus,
  OrderType,
  ReleaseChannel,
  SubscriptionRecord,
  SubscriptionStatus,
  UploadQueueItem,
  UserStatus,
  VrProductRecord,
} from '../types/admin';

function cn(...inputs: Array<string | undefined | null | false>) {
  return twMerge(clsx(inputs));
}

function formatDate(value: Date | null): string {
  if (!value) {
    return '-';
  }

  return value.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNumber(value: number): string {
  return value.toLocaleString('tr-TR');
}

function formatCurrency(value: number, currency = 'TRY'): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getPlanBadgeClass(planCode: string): string {
  const normalized = planCode.trim().toLowerCase();

  if (normalized === 'free') {
    return 'bg-gray-500/15 text-gray-300 ring-gray-500/20';
  }

  if (normalized === 'solo') {
    return 'bg-sky-500/15 text-sky-300 ring-sky-500/20';
  }

  if (normalized === 'pro') {
    return 'bg-violet-500/15 text-violet-300 ring-violet-500/20';
  }

  if (normalized === 'studio') {
    return 'bg-amber-500/15 text-amber-300 ring-amber-500/20';
  }

  if (normalized.includes('premium')) {
    return 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/20';
  }

  return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20';
}

function renderPlanBadge(planCode: string) {
  const label = planCode.trim() || 'free';

  return (
    <span className={cn('inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1', getPlanBadgeClass(label))}>
      {label}
    </span>
  );
}

function parsePositiveNumber(rawValue: string): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Lutfen 0 dan buyuk bir sayi girin.');
  }
  return parsed;
}

function toDateInputValue(value: Date | null): string {
  if (!value) {
    return '';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string): Date | null {
  const clean = value.trim();
  if (!clean) {
    return null;
  }

  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type AdminViewKey =
  | 'overview'
  | 'users'
  | 'credits'
  | 'plans'
  | 'vrProjects'
  | 'demoMaps'
  | 'audit'
  | 'orders'
  | 'subscriptions'
  | 'launcherReleases'
  | 'machines'
  | 'remoteCommands'
  | 'licenses'
  | 'settings';

interface AdminModule {
  key: AdminViewKey;
  label: string;
  description: string;
  phase: 1 | 2 | 3;
  implemented: boolean;
  icon: LucideIcon;
}

interface AdminPanelProps {
  user: User | null;
}

interface PlanFormState {
  id?: string;
  code: string;
  name: string;
  billingPeriod: BillingPeriod;
  price: number;
  currency: string;
  monthlyCredits: number;
  storageLimitGb: number;
  projectLimit: number;
  workspaceMemberLimit: number;
  launcherAccess: boolean;
  vrAccess: boolean;
  aiAccess: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface PackageFormState {
  id?: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  description: string;
  badge: string;
  isPopular: boolean;
  isActive: boolean;
}

interface OrderFormState {
  id?: string;
  userEmail: string;
  type: OrderType;
  status: OrderStatus;
  itemType: string;
  itemId: string;
  itemTitle: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  paymentProvider: 'iyzico' | 'manual' | 'none';
  paymentReference: string;
  paymentVerified: boolean;
  invoiceNo: string;
  notes: string;
}

interface SubscriptionFormState {
  id?: string;
  userEmail: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  renewalDate: string;
  paymentProvider: 'iyzico' | 'manual' | 'none';
  paymentVerified: boolean;
  orderId: string;
}

interface LauncherReleaseFormState {
  id?: string;
  version: string;
  buildDate: string;
  downloadUrl: string;
  totalSize: number;
  zipHash: string;
  executableName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  patchNotesText: string;
  channel: ReleaseChannel;
  isActive: boolean;
}

interface MachineFormState {
  id?: string;
  machineId: string;
  hostname: string;
  userEmail: string;
  customerId: string;
  status: MachineStatus;
  appVersion: string;
  launcherVersion: string;
  lastSeenAt: string;
  notes: string;
  tagsText: string;
}

interface RemoteCommandFormState {
  id?: string;
  targetMachineId: string;
  commandType: LauncherCommandType;
  payloadText: string;
  status: LauncherCommandStatus;
  processedByMachineId: string;
  resultMessage: string;
}

interface LicenseFormState {
  id?: string;
  userEmail: string;
  workspaceId: string;
  productId: string;
  machineId: string;
  type: LicenseType;
  status: LicenseStatus;
  validFrom: string;
  validUntil: string;
  maxMachines: number;
  assignedMachinesText: string;
}

const PHASE_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Faz 1 · Operasyon',
  2: 'Faz 2 · Ticari',
  3: 'Faz 3 · Device ve Release',
};

const MODULES: AdminModule[] = [
  {
    key: 'overview',
    label: 'Dashboard',
    description: 'Tum operasyonel ozeti tek ekranda izleyin.',
    phase: 1,
    implemented: true,
    icon: LayoutDashboard,
  },
  {
    key: 'users',
    label: 'Kullanici Yonetimi',
    description: 'Plan, durum, kredi ve proje yetkilerini yonetin.',
    phase: 1,
    implemented: true,
    icon: Users,
  },
  {
    key: 'credits',
    label: 'Kredi Islem Merkezi',
    description: 'Kredi yukleme, dusme ve hareket gecmisi takibi.',
    phase: 1,
    implemented: true,
    icon: Wallet,
  },
  {
    key: 'plans',
    label: 'Plan ve Paketler',
    description: 'Abonelik planlarini ve kredi paketlerini duzenleyin.',
    phase: 1,
    implemented: true,
    icon: Package,
  },
  {
    key: 'vrProjects',
    label: 'VR Proje Dagitimi',
    description: 'VR proje tanimi, dosya yukleme, atama ve dagitim.',
    phase: 1,
    implemented: true,
    icon: Upload,
  },
  {
    key: 'demoMaps',
    label: 'Demo Map Havuzu',
    description: 'Global demo map yukleme ve surum yonetimi.',
    phase: 1,
    implemented: true,
    icon: Upload,
  },
  {
    key: 'audit',
    label: 'Audit Log',
    description: 'Admin paneldeki kritik islemleri takip edin.',
    phase: 1,
    implemented: true,
    icon: ShieldCheck,
  },
  {
    key: 'orders',
    label: 'Siparisler',
    description: 'Odeme dogrulama ve siparis operasyonlari.',
    phase: 2,
    implemented: true,
    icon: Receipt,
  },
  {
    key: 'subscriptions',
    label: 'Abonelikler',
    description: 'Abonelik yasam dongusu ve yenileme yonetimi.',
    phase: 2,
    implemented: true,
    icon: Receipt,
  },
  {
    key: 'launcherReleases',
    label: 'Launcher Release',
    description: 'Manifest, patch note ve maintenance modu.',
    phase: 2,
    implemented: true,
    icon: Rocket,
  },
  {
    key: 'machines',
    label: 'Makine Yonetimi',
    description: 'MachineId, cihaz durumu ve baglanti takibi.',
    phase: 3,
    implemented: true,
    icon: Monitor,
  },
  {
    key: 'remoteCommands',
    label: 'Uzak Komutlar',
    description: 'Launcher komutlarini hedef cihaza gonderin.',
    phase: 3,
    implemented: true,
    icon: Terminal,
  },
  {
    key: 'licenses',
    label: 'Lisanslar',
    description: 'Lisans omru, erisim ve cihaz kotasi yonetimi.',
    phase: 3,
    implemented: true,
    icon: Key,
  },
  {
    key: 'settings',
    label: 'Sistem Ayarlari',
    description: 'Platform davranisi ve varsayilan degerler.',
    phase: 3,
    implemented: false,
    icon: Settings,
  },
];

const DEFAULT_METRICS: DashboardMetrics = {
  totalUsers: 0,
  totalProducts: 0,
  totalPlans: 0,
  totalCreditPackages: 0,
  totalCreditTransactions: 0,
  totalAuditLogs: 0,
  activeUsers: 0,
  blockedUsers: 0,
  archivedProducts: 0,
  totalOrders: 0,
  totalSubscriptions: 0,
  totalLauncherReleases: 0,
  totalMachines: 0,
  totalLauncherCommands: 0,
  totalLicenses: 0,
};

const DEFAULT_PLAN_FORM: PlanFormState = {
  code: 'free',
  name: '',
  billingPeriod: 'monthly',
  price: 0,
  currency: 'TRY',
  monthlyCredits: 0,
  storageLimitGb: 0,
  projectLimit: 0,
  workspaceMemberLimit: 0,
  launcherAccess: false,
  vrAccess: false,
  aiAccess: true,
  isActive: true,
  sortOrder: 0,
};

const DEFAULT_PACKAGE_FORM: PackageFormState = {
  name: '',
  credits: 1000,
  price: 0,
  currency: 'TRY',
  description: '',
  badge: '',
  isPopular: false,
  isActive: true,
};

const DEFAULT_ORDER_FORM: OrderFormState = {
  userEmail: '',
  type: 'subscription',
  status: 'pending',
  itemType: 'subscription',
  itemId: '',
  itemTitle: '',
  quantity: 1,
  unitPrice: 0,
  currency: 'TRY',
  paymentProvider: 'manual',
  paymentReference: '',
  paymentVerified: false,
  invoiceNo: '',
  notes: '',
};

const DEFAULT_SUBSCRIPTION_FORM: SubscriptionFormState = {
  userEmail: '',
  planId: 'pro',
  status: 'pending',
  startDate: '',
  endDate: '',
  renewalDate: '',
  paymentProvider: 'manual',
  paymentVerified: false,
  orderId: '',
};

const DEFAULT_RELEASE_FORM: LauncherReleaseFormState = {
  version: '',
  buildDate: '',
  downloadUrl: '',
  totalSize: 0,
  zipHash: '',
  executableName: 'Archilya.exe',
  maintenanceMode: false,
  maintenanceMessage: '',
  patchNotesText: '',
  channel: 'stable',
  isActive: true,
};

const DEFAULT_MACHINE_FORM: MachineFormState = {
  machineId: '',
  hostname: '',
  userEmail: '',
  customerId: '',
  status: 'offline',
  appVersion: '',
  launcherVersion: '',
  lastSeenAt: '',
  notes: '',
  tagsText: '',
};

const DEFAULT_REMOTE_COMMAND_FORM: RemoteCommandFormState = {
  targetMachineId: '',
  commandType: 'REFRESH_PROJECTS',
  payloadText: '',
  status: 'pending',
  processedByMachineId: '',
  resultMessage: '',
};

const DEFAULT_LICENSE_FORM: LicenseFormState = {
  userEmail: '',
  workspaceId: '',
  productId: '',
  machineId: '',
  type: 'vr_access',
  status: 'active',
  validFrom: '',
  validUntil: '',
  maxMachines: 1,
  assignedMachinesText: '',
};

const DEFAULT_PLAN_OPTIONS = ['free', 'solo', 'pro', 'studio', 'premium', 'archilya_premium_monthly', 'enterprise'];
const REQUIRED_BASE_PLAN_CODES = ['free', 'solo', 'pro', 'studio'];
const REQUIRED_BOOST_PACKAGE_IDS = ['boost_500', 'boost_1500', 'boost_4000'];

const ORDER_TYPE_OPTIONS: OrderType[] = ['subscription', 'credit_package', 'vr_package', 'enterprise_offer'];
const ORDER_STATUS_OPTIONS: OrderStatus[] = ['pending', 'paid', 'failed', 'cancelled', 'refunded'];
const SUBSCRIPTION_STATUS_OPTIONS: SubscriptionStatus[] = ['pending', 'active', 'cancelled', 'expired'];
const PAYMENT_PROVIDER_OPTIONS: Array<'iyzico' | 'manual' | 'none'> = ['manual', 'iyzico', 'none'];
const RELEASE_CHANNEL_OPTIONS: ReleaseChannel[] = ['stable', 'beta', 'internal'];
const MACHINE_STATUS_OPTIONS: MachineStatus[] = ['online', 'offline', 'blocked'];
const COMMAND_TYPE_OPTIONS: LauncherCommandType[] = [
  'START_STREAM',
  'STOP_STREAM',
  'REFRESH_PROJECTS',
  'FORCE_UPDATE',
  'CLEAR_CACHE',
];
const COMMAND_STATUS_OPTIONS: LauncherCommandStatus[] = ['pending', 'processed', 'failed', 'cancelled'];
const LICENSE_TYPE_OPTIONS: LicenseType[] = ['vr_access', 'launcher_access', 'enterprise_license'];
const LICENSE_STATUS_OPTIONS: LicenseStatus[] = ['active', 'expired', 'revoked'];

const CREDIT_TYPE_OPTIONS: Array<'all' | CreditTransactionType> = [
  'all',
  'earn',
  'spend',
  'refund',
  'manual_add',
  'manual_deduct',
  'subscription',
  'package_purchase',
  'campaign',
];

const PLANNED_MODULE_DETAILS: Record<
  Exclude<AdminViewKey, 'overview' | 'users' | 'credits' | 'plans' | 'vrProjects' | 'demoMaps' | 'audit'>,
  string[]
> = {
  orders: [
    'Odeme saglayici referansi ile siparis kaydi',
    'Onay/iptal/iade akislarinda otomatik kredi etkisi',
    'Finance rolune ozel aksiyonlar ve filtreler',
  ],
  subscriptions: [
    'Plan gecis gecmisi ve yenileme takibi',
    'Zamanlanmis yenileme ve hatirlatma paneli',
    'Abonelik durumuna gore otomatik yetki kurali',
  ],
  launcherReleases: [
    'Game manifest yayini ve version secimi',
    'Maintenance mode ac/kapa ve mesaj yonetimi',
    'Patch notes ve dagitim kanali (stable/beta) kontrolu',
  ],
  machines: [
    'MachineId envanteri ve son gorulme bilgisi',
    'Kullanici-cihaz iliskisi ve cihaz notlari',
    'Kritik cihazlar icin durum etiketleri',
  ],
  remoteCommands: [
    'START_STREAM ve STOP_STREAM komut panosu',
    'Bekleyen/islenen/hatali komut durum takibi',
    'Komut sonucunu cihazdan geri alma',
  ],
  licenses: [
    'Lisans olusturma, uzatma ve iptal',
    'Urun bazli lisans atama ve bitis tarihi takibi',
    'Cihaz kotasi ve lisans asimi alarmlari',
  ],
  settings: [
    'Sistem varsayilanlari ve feature flag yonetimi',
    'Odeme/entegrasyon saglik kontrol kartlari',
    'Admin panel role-based erisim matrisi',
  ],
};

const AdminPanel: React.FC<AdminPanelProps> = ({ user }) => {
  const [activeView, setActiveView] = useState<AdminViewKey>('overview');
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOperationBusy, setIsOperationBusy] = useState(false);
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [products, setProducts] = useState<VrProductRecord[]>([]);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [creditPackages, setCreditPackages] = useState<CreditPackageRecord[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransactionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [launcherReleases, setLauncherReleases] = useState<LauncherReleaseRecord[]>([]);
  const [machines, setMachines] = useState<MachineRecord[]>([]);
  const [launcherCommands, setLauncherCommands] = useState<LauncherCommandRecord[]>([]);
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [moduleLoadIssues, setModuleLoadIssues] = useState<string[]>([]);

  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [planDraft, setPlanDraft] = useState('free');
  const [statusDraft, setStatusDraft] = useState<UserStatus>('active');
  const [autoAddCredits, setAutoAddCredits] = useState(true);
  const [selectedUserAmount, setSelectedUserAmount] = useState('');
  const [selectedUserDirection, setSelectedUserDirection] = useState<'add' | 'deduct'>('add');
  const [selectedUserDescription, setSelectedUserDescription] = useState('Admin panel manuel kredi islemi');

  const [creditEmail, setCreditEmail] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDirection, setCreditDirection] = useState<'add' | 'deduct'>('add');
  const [creditDescription, setCreditDescription] = useState('Admin panel manuel kredi islemi');
  const [creditUserFilter, setCreditUserFilter] = useState('');
  const [creditTypeFilter, setCreditTypeFilter] = useState<'all' | CreditTransactionType>('all');

  const [planForm, setPlanForm] = useState<PlanFormState>(DEFAULT_PLAN_FORM);
  const [planFeatureText, setPlanFeatureText] = useState('');
  const [packageForm, setPackageForm] = useState<PackageFormState>(DEFAULT_PACKAGE_FORM);

  const [orderForm, setOrderForm] = useState<OrderFormState>(DEFAULT_ORDER_FORM);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');

  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionFormState>(DEFAULT_SUBSCRIPTION_FORM);
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<'all' | SubscriptionStatus>('all');

  const [releaseForm, setReleaseForm] = useState<LauncherReleaseFormState>(DEFAULT_RELEASE_FORM);

  const [machineForm, setMachineForm] = useState<MachineFormState>(DEFAULT_MACHINE_FORM);
  const [machineSearch, setMachineSearch] = useState('');
  const [machineStatusFilter, setMachineStatusFilter] = useState<'all' | MachineStatus>('all');

  const [remoteCommandForm, setRemoteCommandForm] = useState<RemoteCommandFormState>(DEFAULT_REMOTE_COMMAND_FORM);
  const [commandSearch, setCommandSearch] = useState('');
  const [commandStatusFilter, setCommandStatusFilter] = useState<'all' | LauncherCommandStatus>('all');

  const [licenseForm, setLicenseForm] = useState<LicenseFormState>(DEFAULT_LICENSE_FORM);
  const [licenseSearch, setLicenseSearch] = useState('');
  const [licenseStatusFilter, setLicenseStatusFilter] = useState<'all' | LicenseStatus>('all');

  const [projectTitle, setProjectTitle] = useState('');
  const [mapName, setMapName] = useState('');
  const [vrMapName, setVrMapName] = useState('');
  const [webShareMapName, setWebShareMapName] = useState('');
  const [chunkId, setChunkId] = useState<number>(0);
  const [customerEmail, setCustomerEmail] = useState('');
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const [demoProjectTitle, setDemoProjectTitle] = useState('');
  const [demoMapName, setDemoMapName] = useState('');
  const [demoVrMapName, setDemoVrMapName] = useState('');
  const [demoWebShareMapName, setDemoWebShareMapName] = useState('');
  const [demoChunkId, setDemoChunkId] = useState<number>(0);
  const [demoUploadQueue, setDemoUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isDemoDragging, setIsDemoDragging] = useState(false);
  const [demoUploadStatus, setDemoUploadStatus] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const demoUploadInputRef = useRef<HTMLInputElement | null>(null);

  const moduleByKey = useMemo(() => new Map(MODULES.map((module) => [module.key, module])), []);
  const activeModule = moduleByKey.get(activeView) || MODULES[0];

  const modulesByPhase = useMemo(() => {
    const groups: Record<1 | 2 | 3, AdminModule[]> = {
      1: [],
      2: [],
      3: [],
    };

    for (const module of MODULES) {
      groups[module.phase].push(module);
    }

    return groups;
  }, []);

  const userEmailMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const currentUser of users) {
      map.set(currentUser.id, currentUser.email);
    }
    return map;
  }, [users]);

  const vrProductsWithOwner = useMemo(
    () =>
      products
        .filter((product) => product.category !== 'demo_map')
        .map((product) => ({
          ...product,
          assignedEmail: product.assignedTo ? userEmailMap.get(product.assignedTo) || 'Bilinmiyor' : 'Atanmamis',
        })),
    [products, userEmailMap],
  );

  const demoProducts = useMemo(
    () => products.filter((product) => product.category === 'demo_map'),
    [products],
  );

  const filteredUsers = useMemo(() => {
    const queryValue = userSearch.trim().toLowerCase();
    if (!queryValue) {
      return users;
    }

    return users.filter((item) => {
      return (
        item.email.toLowerCase().includes(queryValue) ||
        item.displayName.toLowerCase().includes(queryValue) ||
        item.plan.toLowerCase().includes(queryValue)
      );
    });
  }, [users, userSearch]);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [users, selectedUserId],
  );

  const filteredTransactions = useMemo(() => {
    const userQuery = creditUserFilter.trim().toLowerCase();

    return creditTransactions.filter((transaction) => {
      if (creditTypeFilter !== 'all' && transaction.type !== creditTypeFilter) {
        return false;
      }

      if (!userQuery) {
        return true;
      }

      const email = (userEmailMap.get(transaction.userId) || '').toLowerCase();
      return email.includes(userQuery) || transaction.userId.toLowerCase().includes(userQuery);
    });
  }, [creditTransactions, creditTypeFilter, creditUserFilter, userEmailMap]);

  const filteredOrders = useMemo(() => {
    const queryText = orderSearch.trim().toLowerCase();

    return orders.filter((order) => {
      if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) {
        return false;
      }

      if (!queryText) {
        return true;
      }

      const email = (userEmailMap.get(order.userId) || '').toLowerCase();
      return (
        email.includes(queryText) ||
        order.type.toLowerCase().includes(queryText) ||
        order.paymentReference.toLowerCase().includes(queryText)
      );
    });
  }, [orderSearch, orderStatusFilter, orders, userEmailMap]);

  const filteredSubscriptions = useMemo(() => {
    const queryText = subscriptionSearch.trim().toLowerCase();

    return subscriptions.filter((subscription) => {
      if (subscriptionStatusFilter !== 'all' && subscription.status !== subscriptionStatusFilter) {
        return false;
      }

      if (!queryText) {
        return true;
      }

      const email = (userEmailMap.get(subscription.userId) || '').toLowerCase();
      return (
        email.includes(queryText) ||
        subscription.planId.toLowerCase().includes(queryText) ||
        subscription.orderId.toLowerCase().includes(queryText)
      );
    });
  }, [subscriptionSearch, subscriptionStatusFilter, subscriptions, userEmailMap]);

  const sortedLauncherReleases = useMemo(() => {
    return [...launcherReleases].sort((left, right) => {
      const leftTime = left.createdAt?.getTime() ?? 0;
      const rightTime = right.createdAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });
  }, [launcherReleases]);

  const filteredMachines = useMemo(() => {
    const queryText = machineSearch.trim().toLowerCase();

    return machines.filter((machine) => {
      if (machineStatusFilter !== 'all' && machine.status !== machineStatusFilter) {
        return false;
      }

      if (!queryText) {
        return true;
      }

      const ownerEmail = (machine.userId ? userEmailMap.get(machine.userId) : '') || '';
      return (
        machine.machineId.toLowerCase().includes(queryText) ||
        machine.hostname.toLowerCase().includes(queryText) ||
        ownerEmail.toLowerCase().includes(queryText)
      );
    });
  }, [machineSearch, machineStatusFilter, machines, userEmailMap]);

  const filteredCommands = useMemo(() => {
    const queryText = commandSearch.trim().toLowerCase();

    return launcherCommands.filter((command) => {
      if (commandStatusFilter !== 'all' && command.status !== commandStatusFilter) {
        return false;
      }

      if (!queryText) {
        return true;
      }

      return (
        command.targetMachineId.toLowerCase().includes(queryText) ||
        command.commandType.toLowerCase().includes(queryText) ||
        command.createdBy.toLowerCase().includes(queryText)
      );
    });
  }, [commandSearch, commandStatusFilter, launcherCommands]);

  const filteredLicenses = useMemo(() => {
    const queryText = licenseSearch.trim().toLowerCase();

    return licenses.filter((license) => {
      if (licenseStatusFilter !== 'all' && license.status !== licenseStatusFilter) {
        return false;
      }

      if (!queryText) {
        return true;
      }

      const ownerEmail = (license.userId ? userEmailMap.get(license.userId) : '') || '';
      return (
        ownerEmail.toLowerCase().includes(queryText) ||
        license.type.toLowerCase().includes(queryText) ||
        (license.machineId || '').toLowerCase().includes(queryText) ||
        (license.productId || '').toLowerCase().includes(queryText)
      );
    });
  }, [licenseSearch, licenseStatusFilter, licenses, userEmailMap]);

  const planOptions = useMemo(() => {
    const dynamicCodes = plans.map((item) => item.code).filter((item) => item.trim().length > 0);
    const merged = new Set([...DEFAULT_PLAN_OPTIONS, ...dynamicCodes]);
    return Array.from(merged);
  }, [plans]);

  const missingBasePlanCodes = useMemo(() => {
    const existingCodes = new Set(plans.map((item) => item.code.trim().toLowerCase()));
    return REQUIRED_BASE_PLAN_CODES.filter((code) => !existingCodes.has(code));
  }, [plans]);

  const missingBoostPackageIds = useMemo(() => {
    const existingIds = new Set(creditPackages.map((item) => item.id.trim().toLowerCase()));
    return REQUIRED_BOOST_PACKAGE_IDS.filter((id) => !existingIds.has(id));
  }, [creditPackages]);

  const hasUsersAccessIssue = moduleLoadIssues.includes('Kullanicilar');
  const hasCommerceAccessIssue = moduleLoadIssues.includes('Planlar') || moduleLoadIssues.includes('Kredi Paketleri');
  const isCommerceDataMissing =
    !hasCommerceAccessIssue && (missingBasePlanCodes.length > 0 || missingBoostPackageIds.length > 0);

  const notify = useCallback((type: FlashMessage['type'], text: string) => {
    setFlashMessage({ type, text });
  }, []);

  const loadPanelData = useCallback(async () => {
    if (!user) {
      setIsBootLoading(false);
      setIsRefreshing(false);
      setModuleLoadIssues([]);
      return;
    }

    setIsRefreshing(true);
    try {
      try {
        await ensureAdminDocument({
          uid: user.uid,
          email: user.email,
        });
      } catch {
        // Bootstrap admin dokumani olusturulamasa da veri yukleme denensin.
      }

      const settled = await Promise.allSettled([
        fetchUsers(),
        fetchProducts(),
        fetchPlans(),
        fetchCreditPackages(),
        fetchCreditTransactions(),
        fetchAuditLogs(),
        fetchOrders(),
        fetchSubscriptions(),
        fetchLauncherReleases(),
        fetchMachines(),
        fetchLauncherCommands(),
        fetchLicenses(),
      ]);

      const failedModules: string[] = [];
      const moduleNames = [
        'Kullanicilar',
        'VR Projeler',
        'Planlar',
        'Kredi Paketleri',
        'Kredi Hareketleri',
        'Audit Kayitlari',
        'Siparisler',
        'Abonelikler',
        'Launcher Release',
        'Makineler',
        'Uzak Komutlar',
        'Lisanslar',
      ];

      const resolveResult = <T,>(result: PromiseSettledResult<T>, fallback: T, moduleName: string): T => {
        if (result.status === 'fulfilled') {
          return result.value;
        }

        failedModules.push(moduleName);
        return fallback;
      };

      const nextUsers = resolveResult(settled[0], [] as AdminUser[], moduleNames[0]);
      const nextProducts = resolveResult(settled[1], [] as VrProductRecord[], moduleNames[1]);
      const nextPlans = resolveResult(settled[2], [] as PlanRecord[], moduleNames[2]);
      const nextPackages = resolveResult(settled[3], [] as CreditPackageRecord[], moduleNames[3]);
      const nextTransactions = resolveResult(settled[4], [] as CreditTransactionRecord[], moduleNames[4]);
      const nextAuditLogs = resolveResult(settled[5], [] as AuditLogRecord[], moduleNames[5]);
      const nextOrders = resolveResult(settled[6], [] as OrderRecord[], moduleNames[6]);
      const nextSubscriptions = resolveResult(settled[7], [] as SubscriptionRecord[], moduleNames[7]);
      const nextLauncherReleases = resolveResult(settled[8], [] as LauncherReleaseRecord[], moduleNames[8]);
      const nextMachines = resolveResult(settled[9], [] as MachineRecord[], moduleNames[9]);
      const nextLauncherCommands = resolveResult(settled[10], [] as LauncherCommandRecord[], moduleNames[10]);
      const nextLicenses = resolveResult(settled[11], [] as LicenseRecord[], moduleNames[11]);

      setModuleLoadIssues(failedModules);

      setUsers(nextUsers);
      setProducts(nextProducts);
      setPlans(nextPlans);
      setCreditPackages(nextPackages);
      setCreditTransactions(nextTransactions);
      setAuditLogs(nextAuditLogs);
      setOrders(nextOrders);
      setSubscriptions(nextSubscriptions);
      setLauncherReleases(nextLauncherReleases);
      setMachines(nextMachines);
      setLauncherCommands(nextLauncherCommands);
      setLicenses(nextLicenses);

      const activeUsers = nextUsers.filter((item) => item.status === 'active').length;
      const blockedUsers = nextUsers.filter((item) => item.status === 'blocked').length;
      const archivedProducts = nextProducts.filter((item) => item.isArchived).length;

      setMetrics({
        totalUsers: nextUsers.length,
        totalProducts: nextProducts.length,
        totalPlans: nextPlans.length,
        totalCreditPackages: nextPackages.length,
        totalCreditTransactions: nextTransactions.length,
        totalAuditLogs: nextAuditLogs.length,
        activeUsers,
        blockedUsers,
        archivedProducts,
        totalOrders: nextOrders.length,
        totalSubscriptions: nextSubscriptions.length,
        totalLauncherReleases: nextLauncherReleases.length,
        totalMachines: nextMachines.length,
        totalLauncherCommands: nextLauncherCommands.length,
        totalLicenses: nextLicenses.length,
      });

      setSelectedUserId((current) => {
        if (current && nextUsers.some((item) => item.id === current)) {
          return current;
        }

        return nextUsers[0]?.id || '';
      });

      if (failedModules.length > 0) {
        notify(
          'info',
          `Bazi moduller icin yetki veya erisim sorunu var: ${failedModules.join(', ')}. Yetkili koleksiyonlar yuklendi.`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Veriler yuklenirken bilinmeyen bir hata olustu.';
      setModuleLoadIssues(['Tum Moduller']);
      notify('error', message);
    } finally {
      setIsBootLoading(false);
      setIsRefreshing(false);
    }
  }, [notify, user]);

  useEffect(() => {
    if (!user) {
      setIsBootLoading(false);
      return;
    }

    setIsBootLoading(true);
    void loadPanelData();
  }, [loadPanelData, user]);

  useEffect(() => {
    if (!selectedUser) {
      return;
    }

    setPlanDraft(selectedUser.plan || 'free');
    setStatusDraft(selectedUser.status);
  }, [selectedUser]);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFlashMessage(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [flashMessage]);

  const writeAuditLog = useCallback(
    async (payload: Omit<AuditLogInput, 'actorUid' | 'actorRole'>) => {
      if (!user) {
        return;
      }

      await addAuditLog({
        ...payload,
        actorUid: user.uid,
        actorRole: 'admin',
      });
    },
    [user],
  );

  const onRefreshClick = useCallback(async () => {
    await loadPanelData();
    notify('info', 'Panel verileri guncellendi.');
  }, [loadPanelData, notify]);

  const onUpdateSelectedUser = useCallback(async () => {
    if (!selectedUser) {
      notify('error', 'Lutfen once bir kullanici secin.');
      return;
    }

    setIsOperationBusy(true);
    try {
      await updateUserPlanAndStatus({
        userId: selectedUser.id,
        plan: planDraft,
        status: statusDraft,
      });

      await writeAuditLog({
        action: 'user.update-profile',
        entityType: 'user',
        entityId: selectedUser.id,
        summary: `${selectedUser.email} kullanicisinin plan/durum bilgisi guncellendi.`,
        before: { plan: selectedUser.plan, status: selectedUser.status },
        after: { plan: planDraft, status: statusDraft },
      });

      const isPlanChanged = selectedUser.plan !== planDraft;
      if (autoAddCredits && isPlanChanged) {
        const selectedPlanData = plans.find((p) => p.code === planDraft);
        const planCredits = selectedPlanData ? selectedPlanData.monthlyCredits : 0;

        if (planCredits > 0) {
          const result = await adjustUserCredits({ userId: selectedUser.id, delta: planCredits });
          const transactionId = await addCreditTransaction({
            userId: selectedUser.id,
            type: 'manual_add',
            amount: planCredits,
            balanceBefore: result.balanceBefore,
            balanceAfter: result.balanceAfter,
            description: `Plan guncellemesi (${planDraft}) sebebiyle otomatik kredi yuklemesi`,
            source: 'admin',
            sourceRefType: 'plan_update',
            performedBy: user?.uid || null,
          });

          await writeAuditLog({
            action: 'credit.auto-adjust-for-plan',
            entityType: 'credit',
            entityId: transactionId,
            summary: `${selectedUser.email} kullanicisinin plani ${planDraft} olarak guncellendigi icin otomatik ${planCredits} kredi yuklendi.`,
            before: { credits: result.balanceBefore },
            after: { credits: result.balanceAfter, amount: planCredits },
          });

          notify('success', `Plan guncellendi ve ${planCredits} kredi otomatik yuklendi.`);
        } else {
          notify('success', 'Plan guncellendi (Kredi tanimi bulunamadi veya 0).');
        }
      } else {
        notify('success', 'Kullanici bilgileri guncellendi.');
      }

      await loadPanelData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kullanici bilgileri guncellenemedi.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [autoAddCredits, loadPanelData, notify, planDraft, plans, selectedUser, statusDraft, user?.uid, writeAuditLog]);

  const onAdjustSelectedUserCredits = useCallback(async () => {
    if (!selectedUser) {
      notify('error', 'Lutfen once bir kullanici secin.');
      return;
    }

    setIsOperationBusy(true);
    try {
      const amount = parsePositiveNumber(selectedUserAmount);
      const delta = selectedUserDirection === 'add' ? amount : -amount;
      const result = await adjustUserCredits({ userId: selectedUser.id, delta });
      const txType: CreditTransactionType = selectedUserDirection === 'add' ? 'manual_add' : 'manual_deduct';

      const transactionId = await addCreditTransaction({
        userId: selectedUser.id,
        type: txType,
        amount,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        description: selectedUserDescription.trim() || 'Admin panel manuel kredi islemi',
        source: 'admin',
        sourceRefType: 'manual',
        performedBy: user?.uid || null,
      });

      await writeAuditLog({
        action: 'credit.adjust-selected-user',
        entityType: 'credit',
        entityId: transactionId,
        summary: `${selectedUser.email} icin ${selectedUserDirection === 'add' ? 'kredi yukleme' : 'kredi dusme'} islemi yapildi.`,
        before: { credits: result.balanceBefore },
        after: { credits: result.balanceAfter, amount },
      });

      setSelectedUserAmount('');
      await loadPanelData();
      notify('success', 'Kredi islemi basariyla tamamlandi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kredi islemi basarisiz.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [
    loadPanelData,
    notify,
    selectedUser,
    selectedUserAmount,
    selectedUserDescription,
    selectedUserDirection,
    user?.uid,
    writeAuditLog,
  ]);

  const onAdjustCreditsByEmail = useCallback(async () => {
    setIsOperationBusy(true);
    try {
      const amount = parsePositiveNumber(creditAmount);
      const delta = creditDirection === 'add' ? amount : -amount;
      const matchedUser = await findUserByEmail(creditEmail);
      const result = await adjustUserCredits({ userId: matchedUser.id, delta });
      const txType: CreditTransactionType = creditDirection === 'add' ? 'manual_add' : 'manual_deduct';

      const transactionId = await addCreditTransaction({
        userId: matchedUser.id,
        type: txType,
        amount,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        description: creditDescription.trim() || 'Admin panel manuel kredi islemi',
        source: 'admin',
        sourceRefType: 'manual',
        performedBy: user?.uid || null,
      });

      await writeAuditLog({
        action: 'credit.adjust-by-email',
        entityType: 'credit',
        entityId: transactionId,
        summary: `${matchedUser.email} icin ${creditDirection === 'add' ? 'kredi yukleme' : 'kredi dusme'} islemi yapildi.`,
        before: { credits: result.balanceBefore },
        after: { credits: result.balanceAfter, amount },
      });

      setCreditAmount('');
      setCreditEmail('');
      await loadPanelData();
      notify('success', 'E-posta uzerinden kredi islemi basarili.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kredi islemi basarisiz.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [
    creditAmount,
    creditDescription,
    creditDirection,
    creditEmail,
    loadPanelData,
    notify,
    user?.uid,
    writeAuditLog,
  ]);

  const resetPlanForm = useCallback(() => {
    setPlanForm(DEFAULT_PLAN_FORM);
    setPlanFeatureText('');
  }, []);

  const resetPackageForm = useCallback(() => {
    setPackageForm(DEFAULT_PACKAGE_FORM);
  }, []);

  const onPlanEditClick = useCallback((plan: PlanRecord) => {
    setPlanForm({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      billingPeriod: plan.billingPeriod,
      price: plan.price,
      currency: plan.currency,
      monthlyCredits: plan.monthlyCredits,
      storageLimitGb: plan.storageLimitGb,
      projectLimit: plan.projectLimit,
      workspaceMemberLimit: plan.workspaceMemberLimit,
      launcherAccess: plan.launcherAccess,
      vrAccess: plan.vrAccess,
      aiAccess: plan.aiAccess,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    });
    setPlanFeatureText(plan.features.join(', '));
  }, []);

  const onSavePlan = useCallback(async () => {
    if (!planForm.name.trim() || !planForm.code.trim()) {
      notify('error', 'Plan adi ve plan kodu zorunludur.');
      return;
    }

    setIsOperationBusy(true);
    try {
      const features = planFeatureText
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const planId = await upsertPlan({
        id: planForm.id,
        code: planForm.code,
        name: planForm.name,
        billingPeriod: planForm.billingPeriod,
        price: planForm.price,
        currency: planForm.currency,
        monthlyCredits: planForm.monthlyCredits,
        storageLimitGb: planForm.storageLimitGb,
        projectLimit: planForm.projectLimit,
        workspaceMemberLimit: planForm.workspaceMemberLimit,
        launcherAccess: planForm.launcherAccess,
        vrAccess: planForm.vrAccess,
        aiAccess: planForm.aiAccess,
        features,
        isActive: planForm.isActive,
        sortOrder: planForm.sortOrder,
      });

      await writeAuditLog({
        action: planForm.id ? 'plan.update' : 'plan.create',
        entityType: 'plan',
        entityId: planId,
        summary: `${planForm.code} plan kaydi ${planForm.id ? 'guncellendi' : 'olusturuldu'}.`,
      });

      await loadPanelData();
      resetPlanForm();
      notify('success', 'Plan kaydi basariyla kaydedildi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Plan kaydedilemedi.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [loadPanelData, notify, planFeatureText, planForm, resetPlanForm, writeAuditLog]);

  const onPackageEditClick = useCallback((creditPackage: CreditPackageRecord) => {
    setPackageForm({
      id: creditPackage.id,
      name: creditPackage.name,
      credits: creditPackage.credits,
      price: creditPackage.price,
      currency: creditPackage.currency,
      description: creditPackage.description,
      badge: creditPackage.badge,
      isPopular: creditPackage.isPopular,
      isActive: creditPackage.isActive,
    });
  }, []);

  const onSavePackage = useCallback(async () => {
    if (!packageForm.name.trim()) {
      notify('error', 'Paket adi zorunludur.');
      return;
    }

    setIsOperationBusy(true);
    try {
      const packageId = await upsertCreditPackage({
        id: packageForm.id,
        name: packageForm.name,
        credits: packageForm.credits,
        price: packageForm.price,
        currency: packageForm.currency,
        description: packageForm.description,
        badge: packageForm.badge,
        isPopular: packageForm.isPopular,
        isActive: packageForm.isActive,
      });

      await writeAuditLog({
        action: packageForm.id ? 'credit-package.update' : 'credit-package.create',
        entityType: 'package',
        entityId: packageId,
        summary: `${packageForm.name} kredi paketi ${packageForm.id ? 'guncellendi' : 'olusturuldu'}.`,
      });

      await loadPanelData();
      resetPackageForm();
      notify('success', 'Kredi paketi kaydi basariyla kaydedildi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kredi paketi kaydedilemedi.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [loadPanelData, notify, packageForm, resetPackageForm, writeAuditLog]);

  const onSeedCommerceData = useCallback(async () => {
    setIsOperationBusy(true);
    try {
      const result = await seedBaseCommerceData();

      await writeAuditLog({
        action: 'commerce.seed-defaults',
        entityType: 'system',
        entityId: 'commerce-defaults',
        summary: `Temel plan/paket verisi seed edildi. Plan: ${result.plansCreated}, paket: ${result.creditPackagesCreated}.`,
        after: { ...result },
      });

      await loadPanelData();

      if (result.plansCreated === 0 && result.creditPackagesCreated === 0) {
        notify('info', 'Temel planlar ve Boost paketleri zaten mevcut.');
      } else {
        notify(
          'success',
          `${result.plansCreated} plan ve ${result.creditPackagesCreated} Boost paketi olusturuldu.`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Temel plan ve paket verisi olusturulamadi.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [loadPanelData, notify, writeAuditLog]);

  const resetOrderForm = useCallback(() => {
    setOrderForm(DEFAULT_ORDER_FORM);
  }, []);

  const onOrderEditClick = useCallback(
    (order: OrderRecord) => {
      const firstItem = order.items[0];
      setOrderForm({
        id: order.id,
        userEmail: userEmailMap.get(order.userId) || '',
        type: order.type,
        status: order.status,
        itemType: firstItem?.itemType || order.type,
        itemId: firstItem?.itemId || '',
        itemTitle: firstItem?.title || '',
        quantity: firstItem?.quantity || 1,
        unitPrice: firstItem?.unitPrice || order.totalAmount,
        currency: order.currency,
        paymentProvider: order.paymentProvider,
        paymentReference: order.paymentReference,
        paymentVerified: order.paymentVerified,
        invoiceNo: order.invoiceNo,
        notes: order.notes,
      });
    },
    [userEmailMap],
  );

  const onSaveOrder = useCallback(async () => {
    if (!orderForm.userEmail.trim() || !orderForm.itemTitle.trim()) {
      notify('error', 'Kullanici e-postasi ve urun basligi zorunludur.');
      return;
    }

    setIsOperationBusy(true);
    try {
      const targetUser = await findUserByEmail(orderForm.userEmail);
      const quantity = Math.max(1, Number(orderForm.quantity || 1));
      const unitPrice = Math.max(0, Number(orderForm.unitPrice || 0));
      const totalAmount = quantity * unitPrice;

      const orderId = await upsertOrder({
        id: orderForm.id,
        userId: targetUser.id,
        type: orderForm.type,
        status: orderForm.status,
        items: [
          {
            itemType: orderForm.itemType.trim() || orderForm.type,
            itemId: orderForm.itemId.trim() || `${orderForm.type}-manual`,
            title: orderForm.itemTitle.trim(),
            quantity,
            unitPrice,
            totalPrice: totalAmount,
          },
        ],
        totalAmount,
        currency: orderForm.currency.trim() || 'TRY',
        paymentProvider: orderForm.paymentProvider,
        paymentReference: orderForm.paymentReference,
        paymentVerified: orderForm.paymentVerified,
        invoiceNo: orderForm.invoiceNo,
        notes: orderForm.notes,
      });

      await writeAuditLog({
        action: orderForm.id ? 'order.update' : 'order.create',
        entityType: 'order',
        entityId: orderId,
        summary: `${targetUser.email} icin ${orderForm.type} siparisi ${orderForm.id ? 'guncellendi' : 'olusturuldu'}.`,
      });

      resetOrderForm();
      await loadPanelData();
      notify('success', 'Siparis kaydi basariyla kaydedildi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Siparis kaydi kaydedilemedi.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [loadPanelData, notify, orderForm, resetOrderForm, writeAuditLog]);

  const resetSubscriptionForm = useCallback(() => {
    setSubscriptionForm(DEFAULT_SUBSCRIPTION_FORM);
  }, []);

  const onSubscriptionEditClick = useCallback(
    (subscription: SubscriptionRecord) => {
      setSubscriptionForm({
        id: subscription.id,
        userEmail: userEmailMap.get(subscription.userId) || '',
        planId: subscription.planId,
        status: subscription.status,
        startDate: toDateInputValue(subscription.startDate),
        endDate: toDateInputValue(subscription.endDate),
        renewalDate: toDateInputValue(subscription.renewalDate),
        paymentProvider: subscription.paymentProvider,
        paymentVerified: subscription.paymentVerified,
        orderId: subscription.orderId,
      });
    },
    [userEmailMap],
  );

  const onSaveSubscription = useCallback(async () => {
    if (!subscriptionForm.userEmail.trim() || !subscriptionForm.planId.trim()) {
      notify('error', 'Kullanici e-postasi ve plan kodu zorunludur.');
      return;
    }

    setIsOperationBusy(true);
    try {
      const targetUser = await findUserByEmail(subscriptionForm.userEmail);
      const subscriptionId = await upsertSubscription({
        id: subscriptionForm.id,
        userId: targetUser.id,
        planId: subscriptionForm.planId.trim(),
        status: subscriptionForm.status,
        startDate: fromDateInputValue(subscriptionForm.startDate),
        endDate: fromDateInputValue(subscriptionForm.endDate),
        renewalDate: fromDateInputValue(subscriptionForm.renewalDate),
        paymentProvider: subscriptionForm.paymentProvider,
        paymentVerified: subscriptionForm.paymentVerified,
        orderId: subscriptionForm.orderId,
      });

      await writeAuditLog({
        action: subscriptionForm.id ? 'subscription.update' : 'subscription.create',
        entityType: 'system',
        entityId: subscriptionId,
        summary: `${targetUser.email} icin ${subscriptionForm.planId} abonelik kaydi ${subscriptionForm.id ? 'guncellendi' : 'olusturuldu'}.`,
      });

      resetSubscriptionForm();
      await loadPanelData();
      notify('success', 'Abonelik kaydi basariyla kaydedildi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Abonelik kaydi kaydedilemedi.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [loadPanelData, notify, resetSubscriptionForm, subscriptionForm, writeAuditLog]);

  const resetReleaseForm = useCallback(() => {
    setReleaseForm(DEFAULT_RELEASE_FORM);
  }, []);

  const onReleaseEditClick = useCallback((release: LauncherReleaseRecord) => {
    setReleaseForm({
      id: release.id,
      version: release.version,
      buildDate: release.buildDate,
      downloadUrl: release.downloadUrl,
      totalSize: release.totalSize,
      zipHash: release.zipHash,
      executableName: release.executableName,
      maintenanceMode: release.maintenanceMode,
      maintenanceMessage: release.maintenanceMessage,
      patchNotesText: release.patchNotes.join('\n'),
      channel: release.channel,
      isActive: release.isActive,
    });
  }, []);

  const onSaveRelease = useCallback(async () => {
    if (!releaseForm.version.trim() || !releaseForm.zipHash.trim() || !releaseForm.executableName.trim()) {
      notify('error', 'Version, zip hash ve executable adi zorunludur.');
      return;
    }

    setIsOperationBusy(true);
    try {
      const releaseId = await upsertLauncherRelease({
        id: releaseForm.id,
        version: releaseForm.version,
        buildDate: releaseForm.buildDate,
        downloadUrl: releaseForm.downloadUrl,
        downloadParts: [],
        totalSize: releaseForm.totalSize,
        zipHash: releaseForm.zipHash,
        executableName: releaseForm.executableName,
        maintenanceMode: releaseForm.maintenanceMode,
        maintenanceMessage: releaseForm.maintenanceMessage,
        patchNotes: releaseForm.patchNotesText
          .split('\n')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
        channel: releaseForm.channel,
        isActive: releaseForm.isActive,
        createdBy: user?.uid || 'system',
      });

      await writeAuditLog({
        action: releaseForm.id ? 'launcher-release.update' : 'launcher-release.create',
        entityType: 'release',
        entityId: releaseId,
        summary: `${releaseForm.version} (${releaseForm.channel}) release kaydi ${releaseForm.id ? 'guncellendi' : 'olusturuldu'}.`,
      });

      resetReleaseForm();
      await loadPanelData();
      notify('success', 'Launcher release kaydi basariyla kaydedildi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Release kaydi kaydedilemedi.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [loadPanelData, notify, releaseForm, resetReleaseForm, user?.uid, writeAuditLog]);

  const resetMachineForm = useCallback(() => {
    setMachineForm(DEFAULT_MACHINE_FORM);
  }, []);

  const onMachineEditClick = useCallback(
    (machine: MachineRecord) => {
      setMachineForm({
        id: machine.id,
        machineId: machine.machineId,
        hostname: machine.hostname,
        userEmail: machine.userId ? userEmailMap.get(machine.userId) || '' : '',
        customerId: machine.customerId || '',
        status: machine.status,
        appVersion: machine.appVersion,
        launcherVersion: machine.launcherVersion,
        lastSeenAt: toDateInputValue(machine.lastSeenAt),
        notes: machine.notes,
        tagsText: machine.tags.join(', '),
      });
    },
    [userEmailMap],
  );

  const onSaveMachine = useCallback(async () => {
    if (!machineForm.machineId.trim()) {
      notify('error', 'MachineId zorunludur.');
      return;
    }

    setIsOperationBusy(true);
    try {
      let userId: string | null = null;
      if (machineForm.userEmail.trim()) {
        const matched = await findUserByEmail(machineForm.userEmail);
        userId = matched.id;
      }

      const machineId = await upsertMachine({
        id: machineForm.id,
        machineId: machineForm.machineId,
        hostname: machineForm.hostname,
        userId,
        customerId: machineForm.customerId.trim() || null,
        status: machineForm.status,
        appVersion: machineForm.appVersion,
        launcherVersion: machineForm.launcherVersion,
        lastSeenAt: fromDateInputValue(machineForm.lastSeenAt),
        notes: machineForm.notes,
        tags: machineForm.tagsText
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      });

      await writeAuditLog({
        action: machineForm.id ? 'machine.update' : 'machine.create',
        entityType: 'machine',
        entityId: machineId,
        summary: `${machineForm.machineId} cihaz kaydi ${machineForm.id ? 'guncellendi' : 'olusturuldu'}.`,
      });

      resetMachineForm();
      await loadPanelData();
      notify('success', 'Makine kaydi basariyla kaydedildi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Makine kaydi kaydedilemedi.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [loadPanelData, machineForm, notify, resetMachineForm, writeAuditLog]);

  const resetRemoteCommandForm = useCallback(() => {
    setRemoteCommandForm(DEFAULT_REMOTE_COMMAND_FORM);
  }, []);

  const onRemoteCommandEditClick = useCallback((command: LauncherCommandRecord) => {
    setRemoteCommandForm({
      id: command.id,
      targetMachineId: command.targetMachineId,
      commandType: command.commandType,
      payloadText: command.payload ? JSON.stringify(command.payload, null, 2) : '',
      status: command.status,
      processedByMachineId: command.processedByMachineId,
      resultMessage: command.resultMessage,
    });
  }, []);

  const onSaveRemoteCommand = useCallback(async () => {
    if (!remoteCommandForm.targetMachineId.trim()) {
      notify('error', 'Hedef machineId zorunludur.');
      return;
    }

    setIsOperationBusy(true);
    try {
      let payload: Record<string, unknown> | null = null;
      if (remoteCommandForm.payloadText.trim()) {
        try {
          payload = JSON.parse(remoteCommandForm.payloadText) as Record<string, unknown>;
        } catch {
          throw new Error('Payload gecerli bir JSON olmalidir.');
        }
      }

      const commandId = await upsertLauncherCommand({
        id: remoteCommandForm.id,
        targetMachineId: remoteCommandForm.targetMachineId,
        commandType: remoteCommandForm.commandType,
        payload,
        status: remoteCommandForm.status,
        createdBy: user?.uid || 'system',
        processedByMachineId: remoteCommandForm.processedByMachineId,
        resultMessage: remoteCommandForm.resultMessage,
        processedAt: remoteCommandForm.status === 'pending' ? null : new Date(),
      });

      await writeAuditLog({
        action: remoteCommandForm.id ? 'launcher-command.update' : 'launcher-command.create',
        entityType: 'machine',
        entityId: commandId,
        summary: `${remoteCommandForm.targetMachineId} hedefi icin ${remoteCommandForm.commandType} komutu ${remoteCommandForm.id ? 'guncellendi' : 'olusturuldu'}.`,
      });

      resetRemoteCommandForm();
      await loadPanelData();
      notify('success', 'Uzak komut kaydi basariyla kaydedildi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Uzak komut kaydedilemedi.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [loadPanelData, notify, remoteCommandForm, resetRemoteCommandForm, user?.uid, writeAuditLog]);

  const resetLicenseForm = useCallback(() => {
    setLicenseForm(DEFAULT_LICENSE_FORM);
  }, []);

  const onLicenseEditClick = useCallback(
    (license: LicenseRecord) => {
      setLicenseForm({
        id: license.id,
        userEmail: license.userId ? userEmailMap.get(license.userId) || '' : '',
        workspaceId: license.workspaceId || '',
        productId: license.productId || '',
        machineId: license.machineId || '',
        type: license.type,
        status: license.status,
        validFrom: toDateInputValue(license.validFrom),
        validUntil: toDateInputValue(license.validUntil),
        maxMachines: license.maxMachines,
        assignedMachinesText: license.assignedMachines.join(', '),
      });
    },
    [userEmailMap],
  );

  const onSaveLicense = useCallback(async () => {
    if (!licenseForm.type || !licenseForm.status) {
      notify('error', 'Lisans tipi ve durumu zorunludur.');
      return;
    }

    setIsOperationBusy(true);
    try {
      let userId: string | null = null;
      if (licenseForm.userEmail.trim()) {
        const matched = await findUserByEmail(licenseForm.userEmail);
        userId = matched.id;
      }

      if (!userId && !licenseForm.machineId.trim() && !licenseForm.productId.trim()) {
        throw new Error('En az bir hedef girin: kullanici, machineId veya productId.');
      }

      const licenseId = await upsertLicense({
        id: licenseForm.id,
        userId,
        workspaceId: licenseForm.workspaceId.trim() || null,
        productId: licenseForm.productId.trim() || null,
        machineId: licenseForm.machineId.trim() || null,
        type: licenseForm.type,
        status: licenseForm.status,
        validFrom: fromDateInputValue(licenseForm.validFrom),
        validUntil: fromDateInputValue(licenseForm.validUntil),
        maxMachines: Math.max(1, Number(licenseForm.maxMachines || 1)),
        assignedMachines: licenseForm.assignedMachinesText
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      });

      await writeAuditLog({
        action: licenseForm.id ? 'license.update' : 'license.create',
        entityType: 'license',
        entityId: licenseId,
        summary: `${licenseForm.type} lisans kaydi ${licenseForm.id ? 'guncellendi' : 'olusturuldu'}.`,
      });

      resetLicenseForm();
      await loadPanelData();
      notify('success', 'Lisans kaydi basariyla kaydedildi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lisans kaydi kaydedilemedi.';
      notify('error', message);
    } finally {
      setIsOperationBusy(false);
    }
  }, [licenseForm, loadPanelData, notify, resetLicenseForm, writeAuditLog]);

  const appendFilesToQueue = useCallback((fileList: File[]) => {
    if (!fileList.length) {
      return;
    }

    const mapped = fileList.map((currentFile) => ({
      file: currentFile,
      progress: 0,
      status: 'pending' as const,
    }));

    setUploadQueue((previous) => [...previous, ...mapped]);
  }, []);

  const onUploadInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFiles = Array.from(event.target.files || []);
      appendFilesToQueue(nextFiles);
      event.target.value = '';
    },
    [appendFilesToQueue],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);

      const nextFiles = Array.from(event.dataTransfer.files || []);
      appendFilesToQueue(nextFiles);
    },
    [appendFilesToQueue],
  );

  const removeQueuedFile = useCallback((index: number) => {
    setUploadQueue((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const resetUploadForm = useCallback(() => {
    setProjectTitle('');
    setMapName('');
    setVrMapName('');
    setWebShareMapName('');
    setChunkId(0);
    setCustomerEmail('');
    setUploadQueue([]);
    setUploadStatus(null);
  }, []);

  const onCreateProject = useCallback(async () => {
    if (!projectTitle.trim() || !mapName.trim() || !customerEmail.trim() || uploadQueue.length === 0) {
      notify('error', 'Proje adi, map adi, musteri e-postasi ve dosyalar zorunludur.');
      return;
    }

    setIsOperationBusy(true);
    setUploadStatus('Kullanici dogrulaniyor...');

    try {
      const targetUser = await findUserByEmail(customerEmail);
      const draftProductId = createProductDraftId();

      setUploadStatus('Dosyalar yukleniyor...');
      const uploadedFiles = await uploadVrProjectFiles({
        projectId: draftProductId,
        projectTitle,
        files: uploadQueue.map((item) => item.file),
        onProgress: (index, patch) => {
          setUploadQueue((previous) =>
            previous.map((item, currentIndex) => {
              if (currentIndex !== index) {
                return item;
              }

              return {
                ...item,
                progress: patch.progress,
                status: patch.status,
                url: patch.url,
              };
            }),
          );
        },
      });

      setUploadStatus('Firestore kaydi olusturuluyor...');
      const productId = await createProductAndAssign({
        id: draftProductId,
        title: projectTitle,
        mapName,
        vrMapName,
        webShareMapName,
        chunkId,
        assignedTo: targetUser.id,
        files: uploadedFiles,
      });

      await writeAuditLog({
        action: 'product.create-and-assign',
        entityType: 'product',
        entityId: productId,
        summary: `${projectTitle} projesi yuklendi ve ${targetUser.email} kullanicisina atandi.`,
      });

      setUploadStatus('Kayit dogrulaniyor ve liste yenileniyor...');
      await loadPanelData();
      resetUploadForm();
      setUploadStatus('Yukleme tamamlandi ve VR proje listesi guncellendi.');
      notify('success', 'VR proje yukleme ve atama islemi tamamlandi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Proje yuklenirken bir hata olustu.';
      notify('error', message);
      setUploadStatus(`Hata: ${message}`);
    } finally {
      setIsOperationBusy(false);
    }
  }, [
    chunkId,
    customerEmail,
    loadPanelData,
    mapName,
    notify,
    projectTitle,
    resetUploadForm,
    uploadQueue,
    vrMapName,
    webShareMapName,
    writeAuditLog,
  ]);

  const appendDemoFilesToQueue = useCallback((fileList: File[]) => {
    if (!fileList.length) {
      return;
    }

    const mapped = fileList.map((currentFile) => ({
      file: currentFile,
      progress: 0,
      status: 'pending' as const,
    }));

    setDemoUploadQueue((previous) => [...previous, ...mapped]);
  }, []);

  const onDemoUploadInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFiles = Array.from(event.target.files || []);
      appendDemoFilesToQueue(nextFiles);
      event.target.value = '';
    },
    [appendDemoFilesToQueue],
  );

  const onDemoDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDemoDragging(true);
  }, []);

  const onDemoDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDemoDragging(false);
  }, []);

  const onDemoDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDemoDragging(false);

      const nextFiles = Array.from(event.dataTransfer.files || []);
      appendDemoFilesToQueue(nextFiles);
    },
    [appendDemoFilesToQueue],
  );

  const removeDemoQueuedFile = useCallback((index: number) => {
    setDemoUploadQueue((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const resetDemoUploadForm = useCallback(() => {
    setDemoProjectTitle('');
    setDemoMapName('');
    setDemoVrMapName('');
    setDemoWebShareMapName('');
    setDemoChunkId(0);
    setDemoUploadQueue([]);
    setDemoUploadStatus(null);
  }, []);

  const onCreateDemoMap = useCallback(async () => {
    if (!demoProjectTitle.trim() || !demoMapName.trim() || demoUploadQueue.length === 0) {
      notify('error', 'Demo basligi, map adi ve dosyalar zorunludur.');
      return;
    }

    setIsOperationBusy(true);
    setDemoUploadStatus('Dosyalar yukleniyor...');

    try {
      const draftProductId = createProductDraftId();
      const uploadedFiles = await uploadVrProjectFiles({
        projectId: draftProductId,
        projectTitle: demoProjectTitle,
        files: demoUploadQueue.map((item) => item.file),
        onProgress: (index, patch) => {
          setDemoUploadQueue((previous) =>
            previous.map((item, currentIndex) => {
              if (currentIndex !== index) {
                return item;
              }

              return {
                ...item,
                progress: patch.progress,
                status: patch.status,
                url: patch.url,
              };
            }),
          );
        },
      });

      setDemoUploadStatus('Firestore kaydi olusturuluyor...');
      const productId = await createProductAndAssign({
        id: draftProductId,
        category: 'demo_map',
        title: demoProjectTitle,
        mapName: demoMapName,
        vrMapName: demoVrMapName,
        webShareMapName: demoWebShareMapName,
        chunkId: demoChunkId,
        assignedTo: null,
        files: uploadedFiles,
      });

      await writeAuditLog({
        action: 'product.create-demo-map',
        entityType: 'product',
        entityId: productId,
        summary: `${demoProjectTitle} demo map kaydi yuklendi.`,
      });

      setDemoUploadStatus('Kayit dogrulaniyor ve liste yenileniyor...');
      await loadPanelData();
      resetDemoUploadForm();
      setDemoUploadStatus('Yukleme tamamlandi ve demo map listesi guncellendi.');
      notify('success', 'Demo map basariyla yuklendi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Demo map yuklenirken bir hata olustu.';
      notify('error', message);
      setDemoUploadStatus(`Hata: ${message}`);
    } finally {
      setIsOperationBusy(false);
    }
  }, [
    demoChunkId,
    demoMapName,
    demoProjectTitle,
    demoUploadQueue,
    demoVrMapName,
    demoWebShareMapName,
    loadPanelData,
    notify,
    resetDemoUploadForm,
    writeAuditLog,
  ]);

  const onDeleteProduct = useCallback(
    async (product: VrProductRecord) => {
      const confirmed = window.confirm(
        `'${product.title}' projesini silmek istediginize emin misiniz? Bu islem geri alinamaz.`,
      );

      if (!confirmed) {
        return;
      }

      setIsOperationBusy(true);
      try {
        await deleteProductWithAssets({
          productId: product.id,
          projectTitle: product.title,
          assignedTo: product.assignedTo,
          files: product.files,
        });

        await writeAuditLog({
          action: 'product.delete',
          entityType: 'product',
          entityId: product.id,
          summary: `${product.title} projesi silindi.`,
        });

        await loadPanelData();
        notify('success', 'Proje basariyla silindi.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Proje silinemedi.';
        notify('error', message);
      } finally {
        setIsOperationBusy(false);
      }
    },
    [loadPanelData, notify, writeAuditLog],
  );

  const onReassignProduct = useCallback(
    async (product: VrProductRecord) => {
      const currentEmail = product.assignedTo ? userEmailMap.get(product.assignedTo) || '' : '';
      const nextEmail = window.prompt('Yeni kullanici e-postasi', currentEmail);

      if (!nextEmail || !nextEmail.trim()) {
        return;
      }

      setIsOperationBusy(true);
      try {
        const targetUser = await findUserByEmail(nextEmail);
        await reassignProductOwner(product.id, product.assignedTo, targetUser.id);

        await writeAuditLog({
          action: 'product.reassign',
          entityType: 'product',
          entityId: product.id,
          summary: `${product.title} projesinin sahibi ${targetUser.email} olarak degistirildi.`,
          before: { assignedTo: product.assignedTo },
          after: { assignedTo: targetUser.id },
        });

        await loadPanelData();
        notify('success', 'Proje sahibi basariyla degistirildi.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Proje yeniden atanamadi.';
        notify('error', message);
      } finally {
        setIsOperationBusy(false);
      }
    },
    [loadPanelData, notify, userEmailMap, writeAuditLog],
  );

  const metricCards = [
    { label: 'Toplam Kullanici', value: formatNumber(metrics.totalUsers), note: `${metrics.activeUsers} aktif` },
    {
      label: 'Toplam Proje Kaydi',
      value: formatNumber(metrics.totalProducts),
      note: `${metrics.archivedProducts} arsivlenmis`,
    },
    { label: 'Plan Sayisi', value: formatNumber(metrics.totalPlans), note: 'Abonelik katalogu' },
    { label: 'Kredi Paketleri', value: formatNumber(metrics.totalCreditPackages), note: 'Ek alim paketleri' },
    {
      label: 'Kredi Hareketleri',
      value: formatNumber(metrics.totalCreditTransactions),
      note: 'Tum zamanlar',
    },
    { label: 'Siparis Kayitlari', value: formatNumber(metrics.totalOrders), note: 'Odeme operasyonu' },
    { label: 'Abonelik Kayitlari', value: formatNumber(metrics.totalSubscriptions), note: 'Plan yasam dongusu' },
    {
      label: 'Launcher Release',
      value: formatNumber(metrics.totalLauncherReleases),
      note: 'Manifest versiyonlari',
    },
    { label: 'Makine Kayitlari', value: formatNumber(metrics.totalMachines), note: 'Launcher cihaz envanteri' },
    {
      label: 'Uzak Komut Kayitlari',
      value: formatNumber(metrics.totalLauncherCommands),
      note: 'Komut gecmisi',
    },
    { label: 'Lisans Kayitlari', value: formatNumber(metrics.totalLicenses), note: 'Erisim ve aktivasyon' },
    { label: 'Audit Kayitlari', value: formatNumber(metrics.totalAuditLogs), note: 'Yonetsel islem izi' },
  ];

  const renderOverview = () => {
    const recentTransactions = creditTransactions.slice(0, 6);
    const recentAudit = auditLogs.slice(0, 6);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {metricCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
              <p className="mt-1 text-xs text-gray-400">{card.note}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Faz Durumu</h3>
            <div className="mt-4 space-y-3">
              {(Object.keys(modulesByPhase) as Array<'1' | '2' | '3'>).map((phaseKey) => {
                const phase = Number(phaseKey) as 1 | 2 | 3;
                const modules = modulesByPhase[phase];
                const completedCount = modules.filter((module) => module.implemented).length;

                return (
                  <div key={phase} className="rounded-lg border border-gray-700 bg-gray-800/60 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">{PHASE_LABELS[phase]}</p>
                      <span className="text-xs text-gray-400">
                        {completedCount}/{modules.length}
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-gray-700">
                      <div
                        className="h-2 rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${modules.length === 0 ? 0 : (completedCount / modules.length) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Son Kredi Hareketleri</h3>
            <div className="mt-4 space-y-3">
              {recentTransactions.length === 0 ? (
                <p className="text-sm text-gray-500">Kayit bulunamadi.</p>
              ) : (
                recentTransactions.map((row) => (
                  <div key={row.id} className="rounded-lg border border-gray-700 bg-gray-800/60 p-3">
                    <p className="text-sm text-white">{userEmailMap.get(row.userId) || row.userId}</p>
                    <p className="text-xs text-gray-400">
                      {row.type} · {formatNumber(row.amount)} kredi · {formatDate(row.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Son Audit Olaylari</h3>
          <div className="mt-4 space-y-3">
            {recentAudit.length === 0 ? (
              <p className="text-sm text-gray-500">Henüz audit kaydi yok.</p>
            ) : (
              recentAudit.map((row) => (
                <div key={row.id} className="rounded-lg border border-gray-700 bg-gray-800/60 p-3">
                  <p className="text-sm text-white">{row.summary}</p>
                  <p className="text-xs text-gray-400">
                    {row.action} · {row.entityType} · {formatDate(row.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    return (
      <div className="grid grid-cols-1 2xl:grid-cols-[1.35fr_1fr] gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          {hasUsersAccessIssue && (
            <div className="mb-4 rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-xs text-amber-200">
              `users` koleksiyonuna erisim yok. `admins/&lt;uid&gt;` dokumani olusturup Firestore rules deploy edin.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Kullanici Listesi</h3>
            <div className="relative w-full max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-9 py-2 text-sm text-white outline-none focus:border-emerald-500"
                placeholder="E-posta veya plan ara"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Kullanici</th>
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Kredi</th>
                  <th className="px-3 py-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers.map((item) => {
                  const isSelected = item.id === selectedUserId;
                  return (
                    <tr
                      key={item.id}
                      className={cn('cursor-pointer hover:bg-gray-800/70', isSelected && 'bg-emerald-700/20')}
                      onClick={() => setSelectedUserId(item.id)}
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium text-white">{item.displayName || '-'}</p>
                        <p className="text-xs text-gray-400">{item.email}</p>
                      </td>
                      <td className="px-3 py-3">{renderPlanBadge(item.plan)}</td>
                      <td className="px-3 py-3 text-gray-300">{formatNumber(item.credits)}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                            item.status === 'active' && 'bg-emerald-500/15 text-emerald-300',
                            item.status === 'passive' && 'bg-amber-500/15 text-amber-300',
                            item.status === 'blocked' && 'bg-red-500/15 text-red-300',
                          )}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-5 text-center text-gray-500">
                      {hasUsersAccessIssue
                        ? 'Kullanici koleksiyonu okunamiyor. admins/<uid> kaydi ve Firestore kurallari kontrol edin.'
                        : 'Kullanici kaydi bulunamadi.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Kullanici Detay / Islem</h3>

          {!selectedUser ? (
            <p className="text-sm text-gray-500">Detay goruntulemek icin listeden bir kullanici secin.</p>
          ) : (
            <>
              <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4 space-y-2">
                <p className="text-white font-semibold">{selectedUser.displayName || '-'}</p>
                <p className="text-sm text-gray-400">{selectedUser.email}</p>
                <p className="text-xs text-gray-500">UID: {selectedUser.id}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-300">
                  <div className="flex items-center gap-2">Plan: {renderPlanBadge(selectedUser.plan)}</div>
                  <p>Kredi: {formatNumber(selectedUser.credits)}</p>
                  <p>Toplam Kazanim: {formatNumber(selectedUser.totalEarned)}</p>
                  <p>Toplam Harcama: {formatNumber(selectedUser.totalSpent)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-[0.16em] text-gray-400">Plan ve Durum Guncelle</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={planDraft}
                    onChange={(event) => setPlanDraft(event.target.value)}
                    className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    {planOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value as UserStatus)}
                    className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    <option value="active">active</option>
                    <option value="passive">passive</option>
                    <option value="blocked">blocked</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-1 mb-2">
                  <input
                    type="checkbox"
                    id="autoAddCredits"
                    checked={autoAddCredits}
                    onChange={(event) => setAutoAddCredits(event.target.checked)}
                    className="rounded border-gray-700 bg-gray-900 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4"
                  />
                  <label htmlFor="autoAddCredits" className="text-xs text-gray-300 cursor-pointer select-none">
                    Plan kredisini otomatik yukle
                  </label>
                </div>

                <button
                  disabled={isOperationBusy}
                  onClick={onUpdateSelectedUser}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-700"
                >
                  {isOperationBusy ? 'Guncelleniyor...' : 'Plan ve Durumu Kaydet'}
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-[0.16em] text-gray-400">Secili Kullaniciya Kredi Islem</h4>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={selectedUserAmount}
                    onChange={(event) => setSelectedUserAmount(event.target.value)}
                    className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    placeholder="Miktar"
                    type="number"
                    min={1}
                  />
                  <select
                    value={selectedUserDirection}
                    onChange={(event) => setSelectedUserDirection(event.target.value as 'add' | 'deduct')}
                    className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    <option value="add">Kredi Yukle</option>
                    <option value="deduct">Kredi Dus</option>
                  </select>
                </div>
                <textarea
                  value={selectedUserDescription}
                  onChange={(event) => setSelectedUserDescription(event.target.value)}
                  className="min-h-[72px] w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  placeholder="Aciklama"
                />
                <button
                  disabled={isOperationBusy}
                  onClick={onAdjustSelectedUserCredits}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700"
                >
                  {isOperationBusy ? 'Isleniyor...' : 'Kredi Islem Uygula'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderCredits = () => {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300 mb-4">E-posta ile Manuel Kredi Islem</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <input
              value={creditEmail}
              onChange={(event) => setCreditEmail(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="kullanici@ornek.com"
              type="email"
            />
            <input
              value={creditAmount}
              onChange={(event) => setCreditAmount(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Miktar"
              type="number"
              min={1}
            />
            <select
              value={creditDirection}
              onChange={(event) => setCreditDirection(event.target.value as 'add' | 'deduct')}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="add">Kredi Yukle</option>
              <option value="deduct">Kredi Dus</option>
            </select>
            <input
              value={creditDescription}
              onChange={(event) => setCreditDescription(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Aciklama"
            />
            <button
              onClick={onAdjustCreditsByEmail}
              disabled={isOperationBusy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {isOperationBusy ? 'Isleniyor...' : 'Islem Uygula'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Kredi Hareket Gecmisi</h3>
            <div className="flex-1" />
            <input
              value={creditUserFilter}
              onChange={(event) => setCreditUserFilter(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Kullanici e-posta filtre"
            />
            <select
              value={creditTypeFilter}
              onChange={(event) => setCreditTypeFilter(event.target.value as 'all' | CreditTransactionType)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {CREDIT_TYPE_OPTIONS.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Tarih</th>
                  <th className="px-3 py-3">Kullanici</th>
                  <th className="px-3 py-3">Tip</th>
                  <th className="px-3 py-3">Miktar</th>
                  <th className="px-3 py-3">Bakiye</th>
                  <th className="px-3 py-3">Aciklama</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredTransactions.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-3 py-3 text-gray-300">{userEmailMap.get(row.userId) || row.userId}</td>
                    <td className="px-3 py-3 text-gray-300">{row.type}</td>
                    <td className="px-3 py-3 text-gray-300">{formatNumber(row.amount)}</td>
                    <td className="px-3 py-3 text-gray-300">
                      {formatNumber(row.balanceBefore)} → {formatNumber(row.balanceAfter)}
                    </td>
                    <td className="px-3 py-3 text-gray-400">{row.description}</td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-5 text-center text-gray-500">
                      Eslesen kredi hareketi bulunamadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderPlans = () => {
    return (
      <div className="space-y-6">
        {(isCommerceDataMissing || hasCommerceAccessIssue) && (
          <div
            className={cn(
              'rounded-xl border p-5',
              hasCommerceAccessIssue ? 'border-amber-500/30 bg-amber-500/10' : 'border-sky-500/30 bg-sky-500/10',
            )}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Temel plan ve Boost paket kurulumu</h3>
                <p className="mt-1 text-sm text-gray-300">
                  {hasCommerceAccessIssue
                    ? 'Planlar veya Kredi Paketleri koleksiyonu okunamiyor. Firestore rules tarafinda admin okuma/yazma yetkisini kontrol edin.'
                    : `Eksik temel veriler var. Planlar: ${missingBasePlanCodes.join(', ') || 'tamam'}; Boost paketleri: ${missingBoostPackageIds.join(', ') || 'tamam'}. Tek tusla eksikleri olusturabilirsiniz.`}
                </p>
              </div>
              <button
                onClick={onSeedCommerceData}
                disabled={isOperationBusy || hasCommerceAccessIssue}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-700"
              >
                {isOperationBusy ? 'Olusturuluyor...' : 'Temel Planlari Olustur'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Planlar</h3>
            <button
              onClick={resetPlanForm}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              Yeni Plan
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Kod</th>
                  <th className="px-3 py-3">Ad</th>
                  <th className="px-3 py-3">Fiyat</th>
                  <th className="px-3 py-3">Aktif</th>
                  <th className="px-3 py-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-800/60">
                    <td className="px-3 py-3 text-gray-300">{plan.code}</td>
                    <td className="px-3 py-3 text-white">{plan.name}</td>
                    <td className="px-3 py-3 text-gray-300">{formatCurrency(plan.price, plan.currency)}</td>
                    <td className="px-3 py-3 text-gray-300">{plan.isActive ? 'Evet' : 'Hayir'}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onPlanEditClick(plan)}
                        className="rounded-lg bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
                      >
                        Duzenle
                      </button>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-5 text-center text-gray-500">
                      Henuz plan kaydi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={planForm.code}
              onChange={(event) => setPlanForm((previous) => ({ ...previous, code: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Plan kodu"
            />
            <input
              value={planForm.name}
              onChange={(event) => setPlanForm((previous) => ({ ...previous, name: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Plan adi"
            />
            <select
              value={planForm.billingPeriod}
              onChange={(event) =>
                setPlanForm((previous) => ({ ...previous, billingPeriod: event.target.value as BillingPeriod }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
              <option value="custom">custom</option>
            </select>
            <input
              value={planForm.currency}
              onChange={(event) => setPlanForm((previous) => ({ ...previous, currency: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="TRY"
            />
            <input
              value={planForm.price}
              onChange={(event) => setPlanForm((previous) => ({ ...previous, price: Number(event.target.value || 0) }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={0}
              placeholder="Fiyat"
            />
            <input
              value={planForm.monthlyCredits}
              onChange={(event) =>
                setPlanForm((previous) => ({ ...previous, monthlyCredits: Number(event.target.value || 0) }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={0}
              placeholder="Aylik kredi"
            />
            <input
              value={planForm.storageLimitGb}
              onChange={(event) =>
                setPlanForm((previous) => ({ ...previous, storageLimitGb: Number(event.target.value || 0) }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={0}
              placeholder="Storage (GB)"
            />
            <input
              value={planForm.projectLimit}
              onChange={(event) =>
                setPlanForm((previous) => ({ ...previous, projectLimit: Number(event.target.value || 0) }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={0}
              placeholder="Proje limiti"
            />
            <input
              value={planForm.workspaceMemberLimit}
              onChange={(event) =>
                setPlanForm((previous) => ({ ...previous, workspaceMemberLimit: Number(event.target.value || 0) }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={0}
              placeholder="Ekip limiti"
            />
            <input
              value={planForm.sortOrder}
              onChange={(event) =>
                setPlanForm((previous) => ({ ...previous, sortOrder: Number(event.target.value || 0) }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={0}
              placeholder="Siralama"
            />
          </div>

          <textarea
            value={planFeatureText}
            onChange={(event) => setPlanFeatureText(event.target.value)}
            className="min-h-[64px] w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            placeholder="Ozellikler (virgulle ayirin)"
          />

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={planForm.launcherAccess}
                onChange={(event) =>
                  setPlanForm((previous) => ({ ...previous, launcherAccess: event.target.checked }))
                }
              />
              Launcher Access
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={planForm.vrAccess}
                onChange={(event) => setPlanForm((previous) => ({ ...previous, vrAccess: event.target.checked }))}
              />
              VR Access
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={planForm.aiAccess}
                onChange={(event) => setPlanForm((previous) => ({ ...previous, aiAccess: event.target.checked }))}
              />
              AI Access
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={planForm.isActive}
                onChange={(event) => setPlanForm((previous) => ({ ...previous, isActive: event.target.checked }))}
              />
              Aktif
            </label>
          </div>

          <button
            onClick={onSavePlan}
            disabled={isOperationBusy}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            {isOperationBusy ? 'Kaydediliyor...' : planForm.id ? 'Plani Guncelle' : 'Plan Olustur'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Kredi Paketleri</h3>
            <button
              onClick={resetPackageForm}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              Yeni Paket
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Paket</th>
                  <th className="px-3 py-3">Kredi</th>
                  <th className="px-3 py-3">Fiyat</th>
                  <th className="px-3 py-3">Aktif</th>
                  <th className="px-3 py-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {creditPackages.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/60">
                    <td className="px-3 py-3 text-white">{item.name}</td>
                    <td className="px-3 py-3 text-gray-300">{formatNumber(item.credits)}</td>
                    <td className="px-3 py-3 text-gray-300">{formatCurrency(item.price, item.currency)}</td>
                    <td className="px-3 py-3 text-gray-300">{item.isActive ? 'Evet' : 'Hayir'}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onPackageEditClick(item)}
                        className="rounded-lg bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
                      >
                        Duzenle
                      </button>
                    </td>
                  </tr>
                ))}
                {creditPackages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-5 text-center text-gray-500">
                      Henuz kredi paketi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={packageForm.name}
              onChange={(event) => setPackageForm((previous) => ({ ...previous, name: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Paket adi"
            />
            <input
              value={packageForm.currency}
              onChange={(event) => setPackageForm((previous) => ({ ...previous, currency: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="TRY"
            />
            <input
              value={packageForm.credits}
              onChange={(event) => setPackageForm((previous) => ({ ...previous, credits: Number(event.target.value || 0) }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={0}
              placeholder="Kredi"
            />
            <input
              value={packageForm.price}
              onChange={(event) => setPackageForm((previous) => ({ ...previous, price: Number(event.target.value || 0) }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={0}
              placeholder="Fiyat"
            />
          </div>

          <input
            value={packageForm.badge}
            onChange={(event) => setPackageForm((previous) => ({ ...previous, badge: event.target.value }))}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            placeholder="Badge"
          />

          <textarea
            value={packageForm.description}
            onChange={(event) => setPackageForm((previous) => ({ ...previous, description: event.target.value }))}
            className="min-h-[64px] w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            placeholder="Paket aciklamasi"
          />

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={packageForm.isPopular}
                onChange={(event) => setPackageForm((previous) => ({ ...previous, isPopular: event.target.checked }))}
              />
              Populer
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={packageForm.isActive}
                onChange={(event) => setPackageForm((previous) => ({ ...previous, isActive: event.target.checked }))}
              />
              Aktif
            </label>
          </div>

          <button
            onClick={onSavePackage}
            disabled={isOperationBusy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            {isOperationBusy ? 'Kaydediliyor...' : packageForm.id ? 'Paketi Guncelle' : 'Paket Olustur'}
          </button>
        </div>
        </div>
      </div>
    );
  };

  const renderVrProjects = () => {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300 mb-4">Yeni VR Proje Yukleme</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Proje basligi"
            />
            <input
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Musteri e-postasi"
              type="email"
            />
            <input
              value={mapName}
              onChange={(event) => setMapName(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="mapName"
            />
            <input
              value={vrMapName}
              onChange={(event) => setVrMapName(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="vrMapName (opsiyonel)"
            />
            <input
              value={webShareMapName}
              onChange={(event) => setWebShareMapName(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="webShareMapName (opsiyonel)"
            />
            <input
              value={chunkId}
              onChange={(event) => setChunkId(Number(event.target.value || 0))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="chunkId"
              type="number"
              min={0}
            />
          </div>

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => uploadInputRef.current?.click()}
            className={cn(
              'rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-gray-700 bg-gray-950/70 hover:border-gray-500 hover:bg-gray-900',
            )}
          >
            <Upload className="mx-auto h-10 w-10 text-gray-500" />
            <p className="mt-3 text-sm text-gray-300">.pak / .utoc / .ucas dosyalarini surukleyin veya tiklayin</p>
            <p className="mt-1 text-xs text-gray-500">Toplu secim desteklenir</p>
            <input ref={uploadInputRef} onChange={onUploadInputChange} type="file" multiple className="hidden" />
          </div>

          {uploadQueue.length > 0 && (
            <div className="mt-4 space-y-2 max-h-56 overflow-auto pr-1">
              {uploadQueue.map((item, index) => (
                <div key={`${item.file.name}-${index}`} className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{item.file.name}</p>
                      <p className="text-xs text-gray-500">{(item.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{Math.round(item.progress)}%</span>
                      <button
                        type="button"
                        onClick={() => removeQueuedFile(index)}
                        disabled={item.status === 'uploading'}
                        className="rounded p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-800">
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        item.status === 'error' ? 'bg-red-500' : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-gray-700 pt-4">
            <p className="text-sm text-gray-400">{uploadStatus || 'Yukleme baslatilmadi.'}</p>
            <button
              onClick={onCreateProject}
              disabled={isOperationBusy || uploadQueue.length === 0}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {isOperationBusy ? 'Yukleniyor...' : 'Proje Yukle ve Ata'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300 mb-4">Mevcut VR Projeler</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Proje</th>
                  <th className="px-3 py-3">Map</th>
                  <th className="px-3 py-3">Dosya</th>
                  <th className="px-3 py-3">Musteri</th>
                  <th className="px-3 py-3">Olusturma</th>
                  <th className="px-3 py-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {vrProductsWithOwner.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-3">
                      <p className="text-white font-medium">{row.title}</p>
                      <p className="text-xs text-gray-500">ID: {row.id}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-300">{row.mapName}</td>
                    <td className="px-3 py-3 text-gray-300">{formatNumber(row.files.length)}</td>
                    <td className="px-3 py-3 text-emerald-300">{row.assignedEmail}</td>
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onReassignProduct(row)}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Yeniden Ata
                        </button>
                        <button
                          onClick={() => onDeleteProduct(row)}
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {vrProductsWithOwner.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-5 text-center text-gray-500">
                      Henuz VR proje kaydi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderDemoMaps = () => {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300 mb-4">Demo Map Yukleme</h3>
          <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
            Demo mapler global havuza yuklenir. Kullaniciya atama gerektirmez. Yukleme basarisizsa kayit olusmaz ve listede
            gorunmez.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input
              value={demoProjectTitle}
              onChange={(event) => setDemoProjectTitle(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Demo basligi"
            />
            <input
              value={demoMapName}
              onChange={(event) => setDemoMapName(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="mapName"
            />
            <input
              value={demoVrMapName}
              onChange={(event) => setDemoVrMapName(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="vrMapName (opsiyonel)"
            />
            <input
              value={demoWebShareMapName}
              onChange={(event) => setDemoWebShareMapName(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="webShareMapName (opsiyonel)"
            />
            <input
              value={demoChunkId}
              onChange={(event) => setDemoChunkId(Number(event.target.value || 0))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="chunkId"
              type="number"
              min={0}
            />
          </div>

          <div
            onDragOver={onDemoDragOver}
            onDragLeave={onDemoDragLeave}
            onDrop={onDemoDrop}
            onClick={() => demoUploadInputRef.current?.click()}
            className={cn(
              'rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
              isDemoDragging
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-gray-700 bg-gray-950/70 hover:border-gray-500 hover:bg-gray-900',
            )}
          >
            <Upload className="mx-auto h-10 w-10 text-gray-500" />
            <p className="mt-3 text-sm text-gray-300">.pak / .utoc / .ucas dosyalarini surukleyin veya tiklayin</p>
            <p className="mt-1 text-xs text-gray-500">Toplu secim desteklenir</p>
            <input ref={demoUploadInputRef} onChange={onDemoUploadInputChange} type="file" multiple className="hidden" />
          </div>

          {demoUploadQueue.length > 0 && (
            <div className="mt-4 space-y-2 max-h-56 overflow-auto pr-1">
              {demoUploadQueue.map((item, index) => (
                <div key={`${item.file.name}-${index}`} className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{item.file.name}</p>
                      <p className="text-xs text-gray-500">{(item.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{Math.round(item.progress)}%</span>
                      <button
                        type="button"
                        onClick={() => removeDemoQueuedFile(index)}
                        disabled={item.status === 'uploading'}
                        className="rounded p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-800">
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        item.status === 'error' ? 'bg-red-500' : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-gray-700 pt-4">
            <p className="text-sm text-gray-400">{demoUploadStatus || 'Yukleme baslatilmadi.'}</p>
            <button
              onClick={onCreateDemoMap}
              disabled={isOperationBusy || demoUploadQueue.length === 0}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {isOperationBusy ? 'Yukleniyor...' : 'Demo Map Yukle'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300 mb-4">Mevcut Demo Map Kayitlari</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Demo</th>
                  <th className="px-3 py-3">Map</th>
                  <th className="px-3 py-3">Dosya</th>
                  <th className="px-3 py-3">Olusturma</th>
                  <th className="px-3 py-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {demoProducts.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-3">
                      <p className="text-white font-medium">{row.title}</p>
                      <p className="text-xs text-gray-500">ID: {row.id}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-300">{row.mapName}</td>
                    <td className="px-3 py-3 text-gray-300">{formatNumber(row.files.length)}</td>
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onDeleteProduct(row)}
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
                {demoProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-5 text-center text-gray-500">
                      Henuz demo map kaydi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAudit = () => {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300 mb-4">Admin Audit Kayitlari</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="admin-table w-full text-left text-sm">
            <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
              <tr>
                <th className="px-3 py-3">Tarih</th>
                <th className="px-3 py-3">Aksiyon</th>
                <th className="px-3 py-3">Entity</th>
                <th className="px-3 py-3">Ozet</th>
                <th className="px-3 py-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {auditLogs.map((row) => (
                <tr key={row.id} className="hover:bg-gray-800/50">
                  <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                  <td className="px-3 py-3 text-gray-300">{row.action}</td>
                  <td className="px-3 py-3 text-gray-300">
                    {row.entityType} · {row.entityId}
                  </td>
                  <td className="px-3 py-3 text-white">{row.summary}</td>
                  <td className="px-3 py-3 text-gray-400">{row.actorUid || '-'}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-gray-500">
                    Henuz audit log kaydi yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderOrders = () => {
    return (
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Siparis Formu</h3>
            <button
              onClick={resetOrderForm}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              Yeni Siparis
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={orderForm.userEmail}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, userEmail: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Kullanici e-postasi"
              type="email"
            />

            <select
              value={orderForm.type}
              onChange={(event) =>
                setOrderForm((prev) => ({ ...prev, type: event.target.value as OrderType, itemType: event.target.value }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {ORDER_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={orderForm.status}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, status: event.target.value as OrderStatus }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <input
              value={orderForm.itemTitle}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, itemTitle: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Urun basligi"
            />

            <input
              value={orderForm.itemId}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, itemId: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Urun ID"
            />

            <input
              value={orderForm.currency}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, currency: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="TRY"
            />

            <input
              value={orderForm.quantity}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, quantity: Number(event.target.value || 0) }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={1}
              placeholder="Adet"
            />

            <input
              value={orderForm.unitPrice}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, unitPrice: Number(event.target.value || 0) }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={0}
              placeholder="Birim fiyat"
            />

            <select
              value={orderForm.paymentProvider}
              onChange={(event) =>
                setOrderForm((prev) => ({ ...prev, paymentProvider: event.target.value as 'iyzico' | 'manual' | 'none' }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {PAYMENT_PROVIDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <input
              value={orderForm.paymentReference}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, paymentReference: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Odeme referansi"
            />

            <input
              value={orderForm.invoiceNo}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, invoiceNo: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Fatura no (opsiyonel)"
            />

            <textarea
              value={orderForm.notes}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, notes: event.target.value }))}
              className="col-span-2 min-h-[76px] rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Siparis notu"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm">
            <p className="text-gray-300">Toplam Tutar</p>
            <p className="text-white font-semibold">{formatCurrency(Math.max(1, orderForm.quantity) * Math.max(0, orderForm.unitPrice), orderForm.currency || 'TRY')}</p>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={orderForm.paymentVerified}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, paymentVerified: event.target.checked }))}
            />
            Odeme dogrulandi
          </label>

          <button
            onClick={onSaveOrder}
            disabled={isOperationBusy}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            {isOperationBusy ? 'Kaydediliyor...' : orderForm.id ? 'Siparisi Guncelle' : 'Siparis Olustur'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Siparis Listesi</h3>
            <div className="flex-1" />
            <input
              value={orderSearch}
              onChange={(event) => setOrderSearch(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="E-posta / tip / referans ara"
            />
            <select
              value={orderStatusFilter}
              onChange={(event) => setOrderStatusFilter(event.target.value as 'all' | OrderStatus)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="all">all</option>
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Tarih</th>
                  <th className="px-3 py-3">Kullanici</th>
                  <th className="px-3 py-3">Tip</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3">Tutar</th>
                  <th className="px-3 py-3">Odeme</th>
                  <th className="px-3 py-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredOrders.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-3 py-3 text-gray-300">{userEmailMap.get(row.userId) || row.userId}</td>
                    <td className="px-3 py-3 text-gray-300">{row.type}</td>
                    <td className="px-3 py-3 text-gray-300">{row.status}</td>
                    <td className="px-3 py-3 text-white">{formatCurrency(row.totalAmount, row.currency)}</td>
                    <td className="px-3 py-3 text-gray-300">{row.paymentVerified ? 'verified' : row.paymentProvider}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onOrderEditClick(row)}
                        className="rounded-lg bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
                      >
                        Duzenle
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-5 text-center text-gray-500">
                      Eslesen siparis bulunamadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderSubscriptions = () => {
    return (
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Abonelik Formu</h3>
            <button
              onClick={resetSubscriptionForm}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              Yeni Abonelik
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={subscriptionForm.userEmail}
              onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, userEmail: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Kullanici e-postasi"
              type="email"
            />

            <input
              value={subscriptionForm.planId}
              onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, planId: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Plan kodu"
            />

            <select
              value={subscriptionForm.status}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({ ...prev, status: event.target.value as SubscriptionStatus }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <input
              value={subscriptionForm.startDate}
              onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, startDate: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="date"
            />

            <input
              value={subscriptionForm.endDate}
              onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, endDate: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="date"
            />

            <input
              value={subscriptionForm.renewalDate}
              onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, renewalDate: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="date"
            />

            <select
              value={subscriptionForm.paymentProvider}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({
                  ...prev,
                  paymentProvider: event.target.value as 'iyzico' | 'manual' | 'none',
                }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {PAYMENT_PROVIDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <input
              value={subscriptionForm.orderId}
              onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, orderId: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Bagli orderId (opsiyonel)"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={subscriptionForm.paymentVerified}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({ ...prev, paymentVerified: event.target.checked }))
              }
            />
            Odeme dogrulandi
          </label>

          <button
            onClick={onSaveSubscription}
            disabled={isOperationBusy}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            {isOperationBusy ? 'Kaydediliyor...' : subscriptionForm.id ? 'Aboneligi Guncelle' : 'Abonelik Olustur'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Abonelik Listesi</h3>
            <div className="flex-1" />
            <input
              value={subscriptionSearch}
              onChange={(event) => setSubscriptionSearch(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="E-posta / plan ara"
            />
            <select
              value={subscriptionStatusFilter}
              onChange={(event) => setSubscriptionStatusFilter(event.target.value as 'all' | SubscriptionStatus)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="all">all</option>
              {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Kullanici</th>
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3">Yenileme</th>
                  <th className="px-3 py-3">Odeme</th>
                  <th className="px-3 py-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredSubscriptions.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-3 text-gray-300">{userEmailMap.get(row.userId) || row.userId}</td>
                    <td className="px-3 py-3 text-white">{row.planId}</td>
                    <td className="px-3 py-3 text-gray-300">{row.status}</td>
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDate(row.renewalDate)}</td>
                    <td className="px-3 py-3 text-gray-300">{row.paymentVerified ? 'verified' : row.paymentProvider}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onSubscriptionEditClick(row)}
                        className="rounded-lg bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
                      >
                        Duzenle
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSubscriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-5 text-center text-gray-500">
                      Eslesen abonelik kaydi bulunamadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderLauncherReleases = () => {
    return (
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Release Formu</h3>
            <button
              onClick={resetReleaseForm}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              Yeni Release
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={releaseForm.version}
              onChange={(event) => setReleaseForm((prev) => ({ ...prev, version: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Version"
            />
            <input
              value={releaseForm.buildDate}
              onChange={(event) => setReleaseForm((prev) => ({ ...prev, buildDate: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Build date"
            />
            <input
              value={releaseForm.executableName}
              onChange={(event) => setReleaseForm((prev) => ({ ...prev, executableName: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Executable"
            />
            <select
              value={releaseForm.channel}
              onChange={(event) => setReleaseForm((prev) => ({ ...prev, channel: event.target.value as ReleaseChannel }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {RELEASE_CHANNEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              value={releaseForm.zipHash}
              onChange={(event) => setReleaseForm((prev) => ({ ...prev, zipHash: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Zip hash"
            />
            <input
              value={releaseForm.downloadUrl}
              onChange={(event) => setReleaseForm((prev) => ({ ...prev, downloadUrl: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Download URL"
            />
            <input
              value={releaseForm.totalSize}
              onChange={(event) => setReleaseForm((prev) => ({ ...prev, totalSize: Number(event.target.value || 0) }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Toplam boyut"
              type="number"
              min={0}
            />
            <label className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={releaseForm.isActive}
                onChange={(event) => setReleaseForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Aktif release
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={releaseForm.maintenanceMode}
              onChange={(event) => setReleaseForm((prev) => ({ ...prev, maintenanceMode: event.target.checked }))}
            />
            Maintenance mode
          </label>

          <input
            value={releaseForm.maintenanceMessage}
            onChange={(event) => setReleaseForm((prev) => ({ ...prev, maintenanceMessage: event.target.value }))}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            placeholder="Maintenance message"
          />

          <textarea
            value={releaseForm.patchNotesText}
            onChange={(event) => setReleaseForm((prev) => ({ ...prev, patchNotesText: event.target.value }))}
            className="min-h-[90px] w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            placeholder="Patch notes (her satir ayri)"
          />

          <button
            onClick={onSaveRelease}
            disabled={isOperationBusy}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            {isOperationBusy ? 'Kaydediliyor...' : releaseForm.id ? 'Release Guncelle' : 'Release Olustur'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300 mb-4">Release Listesi</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Version</th>
                  <th className="px-3 py-3">Kanal</th>
                  <th className="px-3 py-3">Aktif</th>
                  <th className="px-3 py-3">Maintenance</th>
                  <th className="px-3 py-3">Tarih</th>
                  <th className="px-3 py-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sortedLauncherReleases.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-3 text-white">{row.version}</td>
                    <td className="px-3 py-3 text-gray-300">{row.channel}</td>
                    <td className="px-3 py-3 text-gray-300">{row.isActive ? 'Evet' : 'Hayir'}</td>
                    <td className="px-3 py-3 text-gray-300">{row.maintenanceMode ? 'Acik' : 'Kapali'}</td>
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onReleaseEditClick(row)}
                        className="rounded-lg bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
                      >
                        Duzenle
                      </button>
                    </td>
                  </tr>
                ))}
                {sortedLauncherReleases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-5 text-center text-gray-500">
                      Henuz launcher release kaydi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderMachines = () => {
    return (
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Makine Formu</h3>
            <button
              onClick={resetMachineForm}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              Yeni Makine
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={machineForm.machineId}
              onChange={(event) => setMachineForm((prev) => ({ ...prev, machineId: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="machineId"
            />
            <input
              value={machineForm.hostname}
              onChange={(event) => setMachineForm((prev) => ({ ...prev, hostname: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="hostname"
            />
            <input
              value={machineForm.userEmail}
              onChange={(event) => setMachineForm((prev) => ({ ...prev, userEmail: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Kullanici e-postasi (opsiyonel)"
              type="email"
            />
            <input
              value={machineForm.customerId}
              onChange={(event) => setMachineForm((prev) => ({ ...prev, customerId: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="customerId"
            />
            <select
              value={machineForm.status}
              onChange={(event) => setMachineForm((prev) => ({ ...prev, status: event.target.value as MachineStatus }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {MACHINE_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              value={machineForm.appVersion}
              onChange={(event) => setMachineForm((prev) => ({ ...prev, appVersion: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="appVersion"
            />
            <input
              value={machineForm.launcherVersion}
              onChange={(event) => setMachineForm((prev) => ({ ...prev, launcherVersion: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="launcherVersion"
            />
            <input
              value={machineForm.lastSeenAt}
              onChange={(event) => setMachineForm((prev) => ({ ...prev, lastSeenAt: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="date"
            />
            <input
              value={machineForm.tagsText}
              onChange={(event) => setMachineForm((prev) => ({ ...prev, tagsText: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Tagler (virgulle)"
            />
            <textarea
              value={machineForm.notes}
              onChange={(event) => setMachineForm((prev) => ({ ...prev, notes: event.target.value }))}
              className="col-span-2 min-h-[72px] rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Notlar"
            />
          </div>

          <button
            onClick={onSaveMachine}
            disabled={isOperationBusy}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            {isOperationBusy ? 'Kaydediliyor...' : machineForm.id ? 'Makineyi Guncelle' : 'Makine Olustur'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Makine Listesi</h3>
            <div className="flex-1" />
            <input
              value={machineSearch}
              onChange={(event) => setMachineSearch(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="machineId / hostname / email"
            />
            <select
              value={machineStatusFilter}
              onChange={(event) => setMachineStatusFilter(event.target.value as 'all' | MachineStatus)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="all">all</option>
              {MACHINE_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Machine</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3">Kullanici</th>
                  <th className="px-3 py-3">Launcher</th>
                  <th className="px-3 py-3">Son Gorulme</th>
                  <th className="px-3 py-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredMachines.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-3">
                      <p className="text-white">{row.machineId}</p>
                      <p className="text-xs text-gray-500">{row.hostname || '-'}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-300">{row.status}</td>
                    <td className="px-3 py-3 text-gray-300">{row.userId ? userEmailMap.get(row.userId) || row.userId : '-'}</td>
                    <td className="px-3 py-3 text-gray-300">{row.launcherVersion || '-'}</td>
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDate(row.lastSeenAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onMachineEditClick(row)}
                        className="rounded-lg bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
                      >
                        Duzenle
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredMachines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-5 text-center text-gray-500">
                      Eslesen makine kaydi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderRemoteCommands = () => {
    return (
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Uzak Komut Formu</h3>
            <button
              onClick={resetRemoteCommandForm}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              Yeni Komut
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={remoteCommandForm.targetMachineId}
              onChange={(event) => setRemoteCommandForm((prev) => ({ ...prev, targetMachineId: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="targetMachineId"
            />
            <select
              value={remoteCommandForm.commandType}
              onChange={(event) =>
                setRemoteCommandForm((prev) => ({ ...prev, commandType: event.target.value as LauncherCommandType }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {COMMAND_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={remoteCommandForm.status}
              onChange={(event) =>
                setRemoteCommandForm((prev) => ({ ...prev, status: event.target.value as LauncherCommandStatus }))
              }
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {COMMAND_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              value={remoteCommandForm.processedByMachineId}
              onChange={(event) =>
                setRemoteCommandForm((prev) => ({ ...prev, processedByMachineId: event.target.value }))
              }
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="processedByMachineId (opsiyonel)"
            />
            <textarea
              value={remoteCommandForm.payloadText}
              onChange={(event) => setRemoteCommandForm((prev) => ({ ...prev, payloadText: event.target.value }))}
              className="col-span-2 min-h-[90px] rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 font-mono"
              placeholder="JSON payload (opsiyonel)"
            />
            <textarea
              value={remoteCommandForm.resultMessage}
              onChange={(event) => setRemoteCommandForm((prev) => ({ ...prev, resultMessage: event.target.value }))}
              className="col-span-2 min-h-[70px] rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Sonuc mesaji (opsiyonel)"
            />
          </div>

          <button
            onClick={onSaveRemoteCommand}
            disabled={isOperationBusy}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            {isOperationBusy ? 'Kaydediliyor...' : remoteCommandForm.id ? 'Komutu Guncelle' : 'Komut Olustur'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Komut Listesi</h3>
            <div className="flex-1" />
            <input
              value={commandSearch}
              onChange={(event) => setCommandSearch(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="machineId / komut / actor"
            />
            <select
              value={commandStatusFilter}
              onChange={(event) => setCommandStatusFilter(event.target.value as 'all' | LauncherCommandStatus)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="all">all</option>
              {COMMAND_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Tarih</th>
                  <th className="px-3 py-3">Hedef</th>
                  <th className="px-3 py-3">Komut</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3">Actor</th>
                  <th className="px-3 py-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredCommands.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-3 py-3 text-gray-300">{row.targetMachineId}</td>
                    <td className="px-3 py-3 text-gray-300">{row.commandType}</td>
                    <td className="px-3 py-3 text-gray-300">{row.status}</td>
                    <td className="px-3 py-3 text-gray-300">{row.createdBy || '-'}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onRemoteCommandEditClick(row)}
                        className="rounded-lg bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
                      >
                        Duzenle
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCommands.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-5 text-center text-gray-500">
                      Eslesen komut kaydi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderLicenses = () => {
    return (
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Lisans Formu</h3>
            <button
              onClick={resetLicenseForm}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              Yeni Lisans
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={licenseForm.userEmail}
              onChange={(event) => setLicenseForm((prev) => ({ ...prev, userEmail: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Kullanici e-postasi (opsiyonel)"
              type="email"
            />
            <input
              value={licenseForm.workspaceId}
              onChange={(event) => setLicenseForm((prev) => ({ ...prev, workspaceId: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="workspaceId"
            />
            <input
              value={licenseForm.productId}
              onChange={(event) => setLicenseForm((prev) => ({ ...prev, productId: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="productId"
            />
            <input
              value={licenseForm.machineId}
              onChange={(event) => setLicenseForm((prev) => ({ ...prev, machineId: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="machineId"
            />
            <select
              value={licenseForm.type}
              onChange={(event) => setLicenseForm((prev) => ({ ...prev, type: event.target.value as LicenseType }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {LICENSE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={licenseForm.status}
              onChange={(event) => setLicenseForm((prev) => ({ ...prev, status: event.target.value as LicenseStatus }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              {LICENSE_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              value={licenseForm.validFrom}
              onChange={(event) => setLicenseForm((prev) => ({ ...prev, validFrom: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="date"
            />
            <input
              value={licenseForm.validUntil}
              onChange={(event) => setLicenseForm((prev) => ({ ...prev, validUntil: event.target.value }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="date"
            />
            <input
              value={licenseForm.maxMachines}
              onChange={(event) => setLicenseForm((prev) => ({ ...prev, maxMachines: Number(event.target.value || 1) }))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              type="number"
              min={1}
              placeholder="maxMachines"
            />
            <input
              value={licenseForm.assignedMachinesText}
              onChange={(event) => setLicenseForm((prev) => ({ ...prev, assignedMachinesText: event.target.value }))}
              className="col-span-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Atanmis cihazlar (virgulle)"
            />
          </div>

          <button
            onClick={onSaveLicense}
            disabled={isOperationBusy}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            {isOperationBusy ? 'Kaydediliyor...' : licenseForm.id ? 'Lisansi Guncelle' : 'Lisans Olustur'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Lisans Listesi</h3>
            <div className="flex-1" />
            <input
              value={licenseSearch}
              onChange={(event) => setLicenseSearch(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="email / type / product / machine"
            />
            <select
              value={licenseStatusFilter}
              onChange={(event) => setLicenseStatusFilter(event.target.value as 'all' | LicenseStatus)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="all">all</option>
              {LICENSE_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="admin-table w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="px-3 py-3">Sahip</th>
                  <th className="px-3 py-3">Tip</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3">Machine</th>
                  <th className="px-3 py-3">Gecerlilik</th>
                  <th className="px-3 py-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredLicenses.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-3 text-gray-300">{row.userId ? userEmailMap.get(row.userId) || row.userId : '-'}</td>
                    <td className="px-3 py-3 text-gray-300">{row.type}</td>
                    <td className="px-3 py-3 text-gray-300">{row.status}</td>
                    <td className="px-3 py-3 text-gray-300">{row.machineId || '-'}</td>
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">
                      {formatDate(row.validFrom)} · {formatDate(row.validUntil)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onLicenseEditClick(row)}
                        className="rounded-lg bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
                      >
                        Duzenle
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredLicenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-5 text-center text-gray-500">
                      Eslesen lisans kaydi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderPlannedView = () => {
    const checklist =
      activeView in PLANNED_MODULE_DETAILS
        ? PLANNED_MODULE_DETAILS[activeView as keyof typeof PLANNED_MODULE_DETAILS]
        : [];

    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-300" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">
            {activeModule.label} · Planli Modul
          </h3>
        </div>

        <p className="mt-3 text-sm text-gray-400">{activeModule.description}</p>

        <div className="mt-5 space-y-3">
          {checklist.map((item) => (
            <div key={item} className="rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 text-sm text-gray-300">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-xs text-emerald-200">
          Bu modul icin koleksiyon semasi ve ekran alanlari planlandi. Sonraki adimda bu modulu kodlayip aktif edecegim.
        </div>
      </div>
    );
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'overview':
        return renderOverview();
      case 'users':
        return renderUsers();
      case 'credits':
        return renderCredits();
      case 'plans':
        return renderPlans();
      case 'vrProjects':
        return renderVrProjects();
      case 'demoMaps':
        return renderDemoMaps();
      case 'audit':
        return renderAudit();
      case 'orders':
        return renderOrders();
      case 'subscriptions':
        return renderSubscriptions();
      case 'launcherReleases':
        return renderLauncherReleases();
      case 'machines':
        return renderMachines();
      case 'remoteCommands':
        return renderRemoteCommands();
      case 'licenses':
        return renderLicenses();
      default:
        return renderPlannedView();
    }
  };

  if (isBootLoading) {
    return (
      <div className="h-[70vh] flex items-center justify-center text-gray-300 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Panel verileri yukleniyor...
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto pb-10">
      <div className="grid grid-cols-1 xl:grid-cols-[290px_1fr] gap-6">
        <aside className="rounded-xl border border-gray-700 bg-gray-900/70 p-4 h-fit xl:sticky xl:top-4">
          <div className="mb-4 rounded-lg bg-gradient-to-r from-emerald-600/20 to-cyan-500/20 border border-emerald-600/30 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Uygulama Yol Haritasi</p>
            <p className="text-sm text-gray-200 mt-1">Fazlar sirasi ile planlandi ve Faz 1 dogrudan uygulandi.</p>
          </div>

          <div className="space-y-4">
            {(Object.keys(modulesByPhase) as Array<'1' | '2' | '3'>).map((phaseKey) => {
              const phase = Number(phaseKey) as 1 | 2 | 3;
              const modules = modulesByPhase[phase];

              return (
                <div key={phase}>
                  <p className="px-2 text-[11px] uppercase tracking-[0.18em] text-gray-500">{PHASE_LABELS[phase]}</p>
                  <div className="mt-2 space-y-1">
                    {modules.map((module) => {
                      const ModuleIcon = module.icon;
                      const isActive = activeView === module.key;

                      return (
                        <button
                          key={module.key}
                          onClick={() => setActiveView(module.key)}
                          className={cn(
                            'w-full rounded-lg px-3 py-2 text-left transition-colors border flex items-center gap-2',
                            isActive
                              ? 'border-emerald-500/60 bg-emerald-500/15 text-white'
                              : 'border-transparent hover:border-gray-700 hover:bg-gray-800/70 text-gray-300',
                          )}
                        >
                          <ModuleIcon className="h-4 w-4" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{module.label}</p>
                            <p className="text-[11px] text-gray-500 truncate">{module.implemented ? 'Aktif' : 'Planli'}</p>
                          </div>
                          {module.implemented ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-300" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Aktif Modul</p>
              <h2 className="text-xl font-semibold text-white mt-1">{activeModule.label}</h2>
              <p className="text-sm text-gray-400 mt-1">{activeModule.description}</p>
            </div>
            <button
              onClick={onRefreshClick}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Yenile
            </button>
          </div>

          {flashMessage && (
            <div
              className={cn(
                'rounded-lg border px-4 py-3 text-sm',
                flashMessage.type === 'success' && 'border-emerald-600/40 bg-emerald-600/10 text-emerald-200',
                flashMessage.type === 'error' && 'border-red-600/40 bg-red-600/10 text-red-200',
                flashMessage.type === 'info' && 'border-blue-600/40 bg-blue-600/10 text-blue-200',
              )}
            >
              {flashMessage.text}
            </div>
          )}

          {renderActiveView()}
        </section>
      </div>
    </div>
  );
};

export default AdminPanel;
