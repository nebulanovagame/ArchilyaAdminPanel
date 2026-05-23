export type UserStatus = 'active' | 'passive' | 'blocked';

export type BillingPeriod = 'monthly' | 'yearly' | 'custom';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: UserStatus;
  plan: string;
  credits: number;
  totalEarned: number;
  totalSpent: number;
  ownedProjectIds: string[];
  activeWorkspaceId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  lastLoginAt: Date | null;
}

export interface ProductFileRecord {
  name: string;
  url: string;
  size: number;
  path?: string | null;
  storageProvider?: string;
  objectKey?: string | null;
  contentType?: string;
  hash?: string;
  version?: string;
}

export type ProductCategory = 'vr_project' | 'demo_map';

export interface VrProductRecord {
  id: string;
  category: ProductCategory;
  title: string;
  mapName: string;
  vrMapName: string;
  webShareMapName: string;
  chunkId: number;
  assignedTo: string | null;
  files: ProductFileRecord[];
  createdAt: Date | null;
  isPublished: boolean;
  isArchived: boolean;
}

export interface PlanRecord {
  id: string;
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
  features: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreditPackageRecord {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  description: string;
  badge: string;
  isPopular: boolean;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type CreditTransactionType =
  | 'earn'
  | 'spend'
  | 'refund'
  | 'manual_add'
  | 'manual_deduct'
  | 'subscription'
  | 'package_purchase'
  | 'campaign';

export interface CreditTransactionRecord {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: CreditTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  source: string;
  sourceRefId: string | null;
  sourceRefType: string | null;
  performedBy: string | null;
  createdAt: Date | null;
}

export type OrderType = 'subscription' | 'credit_package' | 'vr_package' | 'enterprise_offer';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export interface OrderItemRecord {
  itemType: string;
  itemId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  type: OrderType;
  status: OrderStatus;
  items: OrderItemRecord[];
  totalAmount: number;
  currency: string;
  paymentProvider: 'iyzico' | 'manual' | 'none';
  paymentReference: string;
  paymentVerified: boolean;
  invoiceNo: string;
  notes: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending';

export interface SubscriptionRecord {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: Date | null;
  endDate: Date | null;
  renewalDate: Date | null;
  paymentProvider: 'iyzico' | 'manual' | 'none';
  paymentVerified: boolean;
  orderId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type ReleaseChannel = 'stable' | 'beta' | 'internal';

export interface LauncherReleasePartRecord {
  url: string;
  size: number;
}

export interface LauncherReleaseRecord {
  id: string;
  version: string;
  buildDate: string;
  downloadUrl: string;
  downloadParts: LauncherReleasePartRecord[];
  totalSize: number;
  zipHash: string;
  executableName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  patchNotes: string[];
  channel: ReleaseChannel;
  isActive: boolean;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type MachineStatus = 'online' | 'offline' | 'blocked';

export interface MachineRecord {
  id: string;
  machineId: string;
  hostname: string;
  userId: string | null;
  customerId: string | null;
  status: MachineStatus;
  appVersion: string;
  launcherVersion: string;
  lastSeenAt: Date | null;
  notes: string;
  tags: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type LauncherCommandType =
  | 'START_STREAM'
  | 'STOP_STREAM'
  | 'REFRESH_PROJECTS'
  | 'FORCE_UPDATE'
  | 'CLEAR_CACHE';

export type LauncherCommandStatus = 'pending' | 'processed' | 'failed' | 'cancelled';

export interface LauncherCommandRecord {
  id: string;
  targetMachineId: string;
  commandType: LauncherCommandType;
  payload: Record<string, unknown> | null;
  status: LauncherCommandStatus;
  createdBy: string;
  processedByMachineId: string;
  resultMessage: string;
  createdAt: Date | null;
  processedAt: Date | null;
}

export type LicenseType = 'vr_access' | 'launcher_access' | 'enterprise_license';

export type LicenseStatus = 'active' | 'expired' | 'revoked';

export interface LicenseRecord {
  id: string;
  userId: string | null;
  workspaceId: string | null;
  productId: string | null;
  machineId: string | null;
  type: LicenseType;
  status: LicenseStatus;
  validFrom: Date | null;
  validUntil: Date | null;
  maxMachines: number;
  assignedMachines: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type AuditEntityType =
  | 'user'
  | 'project'
  | 'product'
  | 'plan'
  | 'order'
  | 'license'
  | 'machine'
  | 'release'
  | 'credit'
  | 'package'
  | 'workspace'
  | 'system';

export interface AuditLogRecord {
  id: string;
  actorUid: string;
  actorRole: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date | null;
}

export interface DashboardMetrics {
  totalUsers: number;
  totalProducts: number;
  totalPlans: number;
  totalCreditPackages: number;
  totalCreditTransactions: number;
  totalAuditLogs: number;
  activeUsers: number;
  blockedUsers: number;
  archivedProducts: number;
  totalOrders: number;
  totalSubscriptions: number;
  totalLauncherReleases: number;
  totalMachines: number;
  totalLauncherCommands: number;
  totalLicenses: number;
}

export interface UploadQueueItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
}

export interface FlashMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}
