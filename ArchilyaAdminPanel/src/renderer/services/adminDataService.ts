import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '../firebase';
import type {
  AdminUser,
  AuditEntityType,
  AuditLogRecord,
  BillingPeriod,
  CreditPackageRecord,
  CreditTransactionRecord,
  CreditTransactionType,
  DashboardMetrics,
  LauncherCommandRecord,
  LauncherCommandStatus,
  LauncherCommandType,
  LauncherReleasePartRecord,
  LauncherReleaseRecord,
  LicenseRecord,
  LicenseStatus,
  LicenseType,
  MachineRecord,
  MachineStatus,
  OrderItemRecord,
  OrderRecord,
  OrderStatus,
  OrderType,
  PlanRecord,
  ProductCategory,
  ProductFileRecord,
  ReleaseChannel,
  SubscriptionRecord,
  SubscriptionStatus,
  UserStatus,
  VrProductRecord,
} from '../types/admin';

const USERS_COLLECTION = 'users';
const PRODUCTS_COLLECTION = 'products';
const PLANS_COLLECTION = 'plans';
const CREDIT_PACKAGES_COLLECTION = 'creditPackages';
const CREDIT_TRANSACTIONS_COLLECTION = 'creditTransactions';
const AUDIT_LOGS_COLLECTION = 'auditLogs';
const ADMINS_COLLECTION = 'admins';
const ORDERS_COLLECTION = 'orders';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';
const LAUNCHER_RELEASES_COLLECTION = 'launcherReleases';
const MACHINES_COLLECTION = 'machines';
const LAUNCHER_COMMANDS_COLLECTION = 'launcherCommands';
const LICENSES_COLLECTION = 'licenses';

const R2_SIZE_THRESHOLD_BYTES = 50 * 1024 * 1024;
const R2_EXTENSIONS = new Set([
  'pak',
  'utoc',
  'ucas',
  'mp4',
  'mov',
  'avi',
  'mkv',
  'zip',
  'rar',
  '7z',
  'glb',
  'gltf',
  'fbx',
  'obj',
  'blend',
  'usdz',
]);

const R2_STRICT_EXTENSIONS = new Set(['pak', 'utoc', 'ucas']);
const R2_UPLOAD_RETRY_ATTEMPTS = 3;
const R2_UPLOAD_RETRY_BASE_DELAY_MS = 1500;
const R2_LARGE_FILE_BYTES = 300 * 1024 * 1024;

interface R2UploadMeta {
  success?: boolean;
  uploadUrl?: string;
  objectKey?: string;
  pseudoUrl?: string;
  contentType?: string;
}

interface R2DeleteResult {
  success?: boolean;
}

interface R2UploadRequestPayload {
  projectId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

interface R2DeleteRequestPayload {
  projectId: string;
  objectKey: string;
}

interface FirebaseFunctionErrorLike {
  code?: string;
  message?: string;
}

interface FirebaseStorageErrorLike {
  code?: string;
  message?: string;
}

interface UploadFailureDetail {
  fileName: string;
  message: string;
}

const createR2UploadUrlAdminSecureCallable = httpsCallable<R2UploadRequestPayload, R2UploadMeta>(
  functions,
  'createR2UploadUrlAdminSecure',
);
const deleteR2ObjectAdminSecureCallable = httpsCallable<R2DeleteRequestPayload, R2DeleteResult>(
  functions,
  'deleteR2ObjectAdminSecure',
);

const createR2UploadUrlSecureCallable = httpsCallable<R2UploadRequestPayload, R2UploadMeta>(
  functions,
  'createR2UploadUrlSecure',
);
const deleteR2ObjectSecureCallable = httpsCallable<R2DeleteRequestPayload, R2DeleteResult>(
  functions,
  'deleteR2ObjectSecure',
);

type StorageRef = Parameters<typeof listAll>[0];
type DeleteObjectRef = Parameters<typeof deleteObject>[0];

interface TimestampLike {
  toDate: () => Date;
}

export interface UploadProgressPatch {
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  url?: string;
}

export interface CreateProductInput {
  id?: string;
  category?: ProductCategory;
  title: string;
  mapName: string;
  vrMapName?: string;
  webShareMapName?: string;
  chunkId: number;
  assignedTo?: string | null;
  files: ProductFileRecord[];
}

export interface CreditAdjustmentInput {
  userId: string;
  delta: number;
}

export interface CreditAdjustmentResult {
  balanceBefore: number;
  balanceAfter: number;
  totalEarned: number;
  totalSpent: number;
}

export interface PlanInput {
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
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface CreditPackageInput {
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

export interface SeedCommerceDataResult {
  plansCreated: number;
  creditPackagesCreated: number;
}

const DEFAULT_PLAN_SEEDS: PlanInput[] = [
  {
    id: 'free',
    code: 'free',
    name: 'Kesif',
    billingPeriod: 'monthly',
    price: 0,
    currency: 'TRY',
    monthlyCredits: 150,
    storageLimitGb: 5,
    projectLimit: 3,
    workspaceMemberLimit: 1,
    launcherAccess: false,
    vrAccess: false,
    aiAccess: true,
    features: ['Aylik 150 islem', 'Temel AI Studyo araclari', '5 GB bulut depolama', '3 proje limiti'],
    isActive: true,
    sortOrder: 10,
  },
  {
    id: 'solo',
    code: 'solo',
    name: 'Solo',
    billingPeriod: 'monthly',
    price: 699,
    currency: 'TRY',
    monthlyCredits: 1000,
    storageLimitGb: 30,
    projectLimit: 15,
    workspaceMemberLimit: 1,
    launcherAccess: false,
    vrAccess: false,
    aiAccess: true,
    features: ['Aylik 1.000 islem', '30 GB bulut depolama', '15 aktif proje', 'Filigransiz indirme'],
    isActive: true,
    sortOrder: 20,
  },
  {
    id: 'pro',
    code: 'pro',
    name: 'Pro',
    billingPeriod: 'monthly',
    price: 1499,
    currency: 'TRY',
    monthlyCredits: 2200,
    storageLimitGb: 100,
    projectLimit: 100,
    workspaceMemberLimit: 5,
    launcherAccess: true,
    vrAccess: true,
    aiAccess: true,
    features: ['Aylik 2.200 islem', '100 GB bulut depolama', '5 kisilik ekip destegi', 'Oncelikli destek'],
    isActive: true,
    sortOrder: 30,
  },
  {
    id: 'studio',
    code: 'studio',
    name: 'Studio',
    billingPeriod: 'monthly',
    price: 4999,
    currency: 'TRY',
    monthlyCredits: 7000,
    storageLimitGb: 750,
    projectLimit: 999999,
    workspaceMemberLimit: 20,
    launcherAccess: true,
    vrAccess: true,
    aiAccess: true,
    features: ['Aylik 7.000 islem havuzu', '750 GB paylasimli depolama', 'Sinirsiz proje', '20 kisilik workspace'],
    isActive: true,
    sortOrder: 40,
  },
];

const DEFAULT_CREDIT_PACKAGE_SEEDS: CreditPackageInput[] = [
  {
    id: 'boost_500',
    name: 'Boost 500',
    credits: 500,
    price: 450,
    currency: 'TRY',
    description: 'Ay ortasinda yetismeyen teslimler icin hizli kredi takviyesi.',
    badge: '500 Kredi',
    isPopular: false,
    isActive: true,
  },
  {
    id: 'boost_1500',
    name: 'Boost 1500',
    credits: 1500,
    price: 1150,
    currency: 'TRY',
    description: 'Teklif, ihale ve sunum yogunlugu olan ekipler icin dengeli ek kota.',
    badge: 'Populer',
    isPopular: true,
    isActive: true,
  },
  {
    id: 'boost_4000',
    name: 'Boost 4000',
    credits: 4000,
    price: 2700,
    currency: 'TRY',
    description: 'Buyuk teslim ve yarisma donemlerinde tek seferlik yuksek hacim.',
    badge: '4000 Kredi',
    isPopular: false,
    isActive: true,
  },
];

export interface CreditTransactionInput {
  userId: string;
  workspaceId?: string | null;
  type: CreditTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  source: string;
  sourceRefId?: string | null;
  sourceRefType?: string | null;
  performedBy?: string | null;
}

export interface AuditLogInput {
  actorUid: string;
  actorRole: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

interface UploadVrProjectFilesInput {
  projectId: string;
  projectTitle: string;
  files: File[];
  onProgress: (index: number, patch: UploadProgressPatch) => void;
}

export interface OrderItemInput {
  itemType: string;
  itemId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderInput {
  id?: string;
  userId: string;
  type: OrderType;
  status: OrderStatus;
  items: OrderItemInput[];
  totalAmount: number;
  currency: string;
  paymentProvider: 'iyzico' | 'manual' | 'none';
  paymentReference: string;
  paymentVerified: boolean;
  invoiceNo: string;
  notes: string;
}

export interface SubscriptionInput {
  id?: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: Date | null;
  endDate: Date | null;
  renewalDate: Date | null;
  paymentProvider: 'iyzico' | 'manual' | 'none';
  paymentVerified: boolean;
  orderId: string;
}

export interface LauncherReleasePartInput {
  url: string;
  size: number;
}

export interface LauncherReleaseInput {
  id?: string;
  version: string;
  buildDate: string;
  downloadUrl: string;
  downloadParts: LauncherReleasePartInput[];
  totalSize: number;
  zipHash: string;
  executableName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  patchNotes: string[];
  channel: ReleaseChannel;
  isActive: boolean;
  createdBy: string;
}

export interface MachineInput {
  id?: string;
  machineId: string;
  hostname: string;
  userId?: string | null;
  customerId?: string | null;
  status: MachineStatus;
  appVersion: string;
  launcherVersion: string;
  lastSeenAt: Date | null;
  notes: string;
  tags: string[];
}

export interface LauncherCommandInput {
  id?: string;
  targetMachineId: string;
  commandType: LauncherCommandType;
  payload?: Record<string, unknown> | null;
  status: LauncherCommandStatus;
  createdBy: string;
  processedByMachineId?: string;
  resultMessage?: string;
  processedAt?: Date | null;
}

export interface LicenseInput {
  id?: string;
  userId?: string | null;
  workspaceId?: string | null;
  productId?: string | null;
  machineId?: string | null;
  type: LicenseType;
  status: LicenseStatus;
  validFrom: Date | null;
  validUntil: Date | null;
  maxMachines: number;
  assignedMachines: string[];
}

interface UserIdentity {
  id: string;
  email: string;
  displayName: string;
}

function isTimestampLike(value: unknown): value is TimestampLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeTimestamp = value as { toDate?: unknown };
  return typeof maybeTimestamp.toDate === 'function';
}

function asDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (isTimestampLike(value)) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function mapProductFiles(value: unknown): ProductFileRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const url = asString(item.url);
      const objectKey = asString(item.objectKey).trim() || null;
      const path = asString(item.path).trim() || null;
      const provider = asString(item.storageProvider).trim().toLowerCase();
      const inferredProvider = provider || (objectKey || url.toLowerCase().startsWith('r2://') ? 'r2' : 'firebase');

      return {
        name: asString(item.name),
        url,
        size: asNumber(item.size, 0),
        path,
        storageProvider: inferredProvider,
        objectKey,
        contentType: asString(item.contentType),
        hash: asString(item.hash),
        version: asString(item.version),
      } satisfies ProductFileRecord;
    });
}

function mapPlanBillingPeriod(value: unknown): BillingPeriod {
  if (value === 'monthly' || value === 'yearly' || value === 'custom') {
    return value;
  }
  return 'monthly';
}

function mapProductCategory(value: unknown): ProductCategory {
  if (value === 'demo_map') {
    return 'demo_map';
  }

  return 'vr_project';
}

function mapUserStatus(value: unknown): UserStatus {
  if (value === 'active' || value === 'passive' || value === 'blocked') {
    return value;
  }
  return 'active';
}

function mapCreditTransactionType(value: unknown): CreditTransactionType {
  const allowed: CreditTransactionType[] = [
    'earn',
    'spend',
    'refund',
    'manual_add',
    'manual_deduct',
    'subscription',
    'package_purchase',
    'campaign',
  ];

  if (typeof value === 'string' && allowed.includes(value as CreditTransactionType)) {
    return value as CreditTransactionType;
  }

  return 'manual_add';
}

function mapOrderType(value: unknown): OrderType {
  const allowed: OrderType[] = ['subscription', 'credit_package', 'vr_package', 'enterprise_offer'];
  if (typeof value === 'string' && allowed.includes(value as OrderType)) {
    return value as OrderType;
  }
  return 'subscription';
}

function mapOrderStatus(value: unknown): OrderStatus {
  const allowed: OrderStatus[] = ['pending', 'paid', 'failed', 'cancelled', 'refunded'];
  if (typeof value === 'string' && allowed.includes(value as OrderStatus)) {
    return value as OrderStatus;
  }
  return 'pending';
}

function mapSubscriptionStatus(value: unknown): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = ['active', 'cancelled', 'expired', 'pending'];
  if (typeof value === 'string' && allowed.includes(value as SubscriptionStatus)) {
    return value as SubscriptionStatus;
  }
  return 'pending';
}

function mapReleaseChannel(value: unknown): ReleaseChannel {
  const allowed: ReleaseChannel[] = ['stable', 'beta', 'internal'];
  if (typeof value === 'string' && allowed.includes(value as ReleaseChannel)) {
    return value as ReleaseChannel;
  }
  return 'stable';
}

function mapMachineStatus(value: unknown): MachineStatus {
  const allowed: MachineStatus[] = ['online', 'offline', 'blocked'];
  if (typeof value === 'string' && allowed.includes(value as MachineStatus)) {
    return value as MachineStatus;
  }
  return 'offline';
}

function mapLauncherCommandType(value: unknown): LauncherCommandType {
  const allowed: LauncherCommandType[] = [
    'START_STREAM',
    'STOP_STREAM',
    'REFRESH_PROJECTS',
    'FORCE_UPDATE',
    'CLEAR_CACHE',
  ];
  if (typeof value === 'string' && allowed.includes(value as LauncherCommandType)) {
    return value as LauncherCommandType;
  }
  return 'REFRESH_PROJECTS';
}

function mapLauncherCommandStatus(value: unknown): LauncherCommandStatus {
  const allowed: LauncherCommandStatus[] = ['pending', 'processed', 'failed', 'cancelled'];
  if (typeof value === 'string' && allowed.includes(value as LauncherCommandStatus)) {
    return value as LauncherCommandStatus;
  }
  return 'pending';
}

function mapLicenseType(value: unknown): LicenseType {
  const allowed: LicenseType[] = ['vr_access', 'launcher_access', 'enterprise_license'];
  if (typeof value === 'string' && allowed.includes(value as LicenseType)) {
    return value as LicenseType;
  }
  return 'vr_access';
}

function mapLicenseStatus(value: unknown): LicenseStatus {
  const allowed: LicenseStatus[] = ['active', 'expired', 'revoked'];
  if (typeof value === 'string' && allowed.includes(value as LicenseStatus)) {
    return value as LicenseStatus;
  }
  return 'active';
}

function mapOrderItems(value: unknown): OrderItemRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const quantity = Math.max(1, asNumber(item.quantity, 1));
      const unitPrice = asNumber(item.unitPrice, 0);
      const totalPrice = asNumber(item.totalPrice, quantity * unitPrice);

      return {
        itemType: asString(item.itemType),
        itemId: asString(item.itemId),
        title: asString(item.title),
        quantity,
        unitPrice,
        totalPrice,
      } satisfies OrderItemRecord;
    });
}

function mapReleaseParts(value: unknown): LauncherReleasePartRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      url: asString(item.url),
      size: asNumber(item.size, 0),
    } satisfies LauncherReleasePartRecord));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? String(parts.pop() || '').toLowerCase() : '';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getElectronFilePath(file: File): string | null {
  const candidate = (file as File & { path?: unknown }).path;
  if (typeof candidate !== 'string') {
    return null;
  }

  const normalized = candidate.trim();
  return normalized || null;
}

function shouldRouteToR2(file: File): boolean {
  const extension = getFileExtension(file.name);
  const contentType = String(file.type || '').toLowerCase();
  const fileSize = Number(file.size || 0);
  return fileSize >= R2_SIZE_THRESHOLD_BYTES || R2_EXTENSIONS.has(extension) || /video|model|octet-stream/.test(contentType);
}

function isStrictR2File(file: File): boolean {
  return R2_STRICT_EXTENSIONS.has(getFileExtension(file.name));
}

function getFunctionErrorCode(error: unknown): string {
  const candidate = error as FirebaseFunctionErrorLike | null;
  return String(candidate?.code || '').toLowerCase();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  const candidate = error as { message?: unknown } | null;
  if (typeof candidate?.message === 'string') {
    return candidate.message;
  }

  return String(error || '');
}

function isCspBlockedError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('content security policy') ||
    message.includes('violates the following') ||
    message.includes('connect-src')
  );
}

function isCorsBlockedError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('cors') ||
    message.includes('preflight') ||
    message.includes('access-control-allow-origin') ||
    message.includes('networkerror') ||
    message.includes('err_failed')
  );
}

function mapR2UploadError(error: unknown, fileName: string): Error {
  const rawMessage = getErrorMessage(error).toLowerCase();

  if (rawMessage.includes('nosuchbucket') || rawMessage.includes('bucket does not exist')) {
    return new Error(
      `R2 bucket bulunamadi (${fileName}). Cloud Function tarafinda bucket/endpoint eslesmesi yanlis.`,
    );
  }

  if (isCorsBlockedError(error)) {
    return new Error(
      `R2 CORS hatasi (${fileName}). Bucket CORS ayarlarina http://localhost:5173 origini ve PUT icin preflight izinleri eklenmeli.`,
    );
  }

  if (isCspBlockedError(error)) {
    return new Error(
      `R2 Cloud Functions CSP engeli (${fileName}). connect-src ayarina https://*.cloudfunctions.net eklenmeli.`,
    );
  }

  const message = getErrorMessage(error).trim();
  if (message) {
    return new Error(`R2 yukleme basarisiz (${fileName}): ${message}`);
  }

  return new Error(`R2 yukleme basarisiz (${fileName}).`);
}

function mapStorageUploadError(error: unknown, fileName: string): Error {
  const candidate = error as FirebaseStorageErrorLike | null;
  const code = String(candidate?.code || '').toLowerCase();

  if (code.includes('storage/unauthorized') || code.includes('permission-denied')) {
    return new Error(
      `Firebase Storage yazma yetkisi bulunamadi (${fileName}). R2 Cloud Functions ve Storage kurallarini kontrol edin.`,
    );
  }

  return error instanceof Error ? error : new Error('Dosya yuklenemedi.');
}

function canFallbackToLegacyCallable(error: unknown): boolean {
  const code = getFunctionErrorCode(error);
  return code.includes('not-found') || code.includes('unimplemented');
}

async function requestR2UploadMeta(payload: R2UploadRequestPayload): Promise<R2UploadMeta> {
  try {
    const result = await createR2UploadUrlAdminSecureCallable(payload);
    const data = result?.data;
    if (data?.success && data.uploadUrl && data.objectKey) {
      return data;
    }
  } catch (error) {
    if (!canFallbackToLegacyCallable(error)) {
      if (isCspBlockedError(error)) {
        throw new Error(
          'Cloud Functions cagrisina CSP engeli var. connect-src icine https://*.cloudfunctions.net domainini ekleyin.',
        );
      }
      throw error;
    }
  }

  const legacyResult = await createR2UploadUrlSecureCallable(payload);
  const legacyData = legacyResult?.data;
  if (legacyData?.success && legacyData.uploadUrl && legacyData.objectKey) {
    return legacyData;
  }

  throw new Error('R2 upload URL olusturulamadi.');
}

async function deleteR2ObjectWithFallback(payload: R2DeleteRequestPayload): Promise<void> {
  try {
    await deleteR2ObjectAdminSecureCallable(payload);
    return;
  } catch (error) {
    if (!canFallbackToLegacyCallable(error)) {
      throw error;
    }
  }

  await deleteR2ObjectSecureCallable(payload);
}

function uploadToSignedUrl(
  uploadUrl: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  const electronUploadFilePath = getElectronFilePath(file);
  if (electronUploadFilePath && window.electronAPI?.uploadFileToSignedUrl) {
    return window.electronAPI
      .uploadFileToSignedUrl({
        uploadUrl,
        filePath: electronUploadFilePath,
        contentType: file.type || 'application/octet-stream',
      })
      .then(() => {
        onProgress(100);
      });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const progress = (event.loaded / event.total) * 100;
      onProgress(progress);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      if (xhr.status === 403) {
        reject(new Error('R2 upload reddedildi (403). Signed URL suresi dolmus veya bucket yetkisi yetersiz olabilir.'));
        return;
      }

      if (xhr.status === 0) {
        reject(new Error('R2 upload CORS/preflight hatasi (status 0).'));
        return;
      }

      reject(new Error(`R2 upload hatasi (${xhr.status}).`));
    };

    xhr.onerror = () => reject(new Error('R2 upload baglanti/CORS hatasi.'));
    xhr.onabort = () => reject(new Error('R2 upload iptal edildi.'));
    xhr.send(file);
  });
}

function uploadFileToFirebaseStorage(
  projectTitle: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<ProductFileRecord> {
  const storagePath = `projects/${projectTitle}/${file.name}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot: { bytesTransferred: number; totalBytes: number }) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      },
      (error: unknown) => reject(mapStorageUploadError(error, file.name)),
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            name: file.name,
            url,
            size: file.size,
            path: storagePath,
            storageProvider: 'firebase',
            objectKey: null,
            contentType: file.type || 'application/octet-stream',
          });
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

function getProductFileObjectKey(file: ProductFileRecord): string | null {
  const objectKey = asString(file.objectKey).trim();
  if (objectKey) {
    return objectKey;
  }

  const url = asString(file.url).trim();
  if (url.toLowerCase().startsWith('r2://')) {
    const candidate = url.slice(5).trim();
    return candidate || null;
  }

  return null;
}

function getProductFileStorageProvider(file: ProductFileRecord): string {
  const provider = asString(file.storageProvider).trim().toLowerCase();
  if (provider) {
    return provider;
  }

  return getProductFileObjectKey(file) ? 'r2' : 'firebase';
}

function getFirebaseStoragePath(file: ProductFileRecord): string | null {
  const path = asString(file.path).trim();
  return path || null;
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const snapshot = await getDocs(collection(db, USERS_COLLECTION));
  const users = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      email: asString(data.email),
      displayName: asString(data.displayName, asString(data.email, 'Adsiz Kullanici')),
      role: asString(data.role, 'customer'),
      status: mapUserStatus(data.status),
      plan: asString(data.plan, 'free'),
      credits: asNumber(data.credits, 0),
      totalEarned: asNumber(data.totalEarned, 0),
      totalSpent: asNumber(data.totalSpent, 0),
      ownedProjectIds: asStringArray(data.owned_project_ids),
      activeWorkspaceId: asString(data.activeWorkspaceId) || null,
      createdAt: asDate(data.createdAt),
      updatedAt: asDate(data.updatedAt),
      lastLoginAt: asDate(data.lastLoginAt),
    } satisfies AdminUser;
  });

  users.sort((left, right) => left.email.localeCompare(right.email, 'tr'));
  return users;
}

export async function fetchProducts(): Promise<VrProductRecord[]> {
  const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
  const products = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    const mapName = asString(data.mapName || data.map_name);
    return {
      id: docSnap.id,
      category: mapProductCategory(data.category),
      title: asString(data.title, 'Adsiz Proje'),
      mapName,
      vrMapName: asString(data.vrMapName || data.vr_map_name, mapName),
      webShareMapName: asString(data.webShareMapName || data.web_share_map_name, mapName),
      chunkId: asNumber(data.chunkId, 0),
      assignedTo: asString(data.assignedTo) || null,
      files: mapProductFiles(data.files),
      createdAt: asDate(data.createdAt),
      isPublished: asBoolean(data.isPublished, true),
      isArchived: asBoolean(data.isArchived, false),
    } satisfies VrProductRecord;
  });

  products.sort((left, right) => {
    const rightTime = right.createdAt?.getTime() ?? 0;
    const leftTime = left.createdAt?.getTime() ?? 0;
    return rightTime - leftTime;
  });

  return products;
}

export async function fetchPlans(): Promise<PlanRecord[]> {
  const snapshot = await getDocs(collection(db, PLANS_COLLECTION));
  const plans = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      code: asString(data.code, docSnap.id),
      name: asString(data.name, docSnap.id),
      billingPeriod: mapPlanBillingPeriod(data.billingPeriod),
      price: asNumber(data.price, 0),
      currency: asString(data.currency, 'TRY'),
      monthlyCredits: asNumber(data.monthlyCredits, 0),
      storageLimitGb: asNumber(data.storageLimitGb, 0),
      projectLimit: asNumber(data.projectLimit, 0),
      workspaceMemberLimit: asNumber(data.workspaceMemberLimit, 0),
      launcherAccess: asBoolean(data.launcherAccess, false),
      vrAccess: asBoolean(data.vrAccess, false),
      aiAccess: asBoolean(data.aiAccess, true),
      features: asStringArray(data.features),
      isActive: asBoolean(data.isActive, true),
      sortOrder: asNumber(data.sortOrder, 0),
      createdAt: asDate(data.createdAt),
      updatedAt: asDate(data.updatedAt),
    } satisfies PlanRecord;
  });

  plans.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'tr'));
  return plans;
}

export async function fetchCreditPackages(): Promise<CreditPackageRecord[]> {
  const snapshot = await getDocs(collection(db, CREDIT_PACKAGES_COLLECTION));
  const packages = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: asString(data.name, 'Adsiz Paket'),
      credits: asNumber(data.credits, 0),
      price: asNumber(data.price, 0),
      currency: asString(data.currency, 'TRY'),
      description: asString(data.description),
      badge: asString(data.badge),
      isPopular: asBoolean(data.isPopular, false),
      isActive: asBoolean(data.isActive, true),
      createdAt: asDate(data.createdAt),
      updatedAt: asDate(data.updatedAt),
    } satisfies CreditPackageRecord;
  });

  packages.sort((left, right) => right.credits - left.credits);
  return packages;
}

export async function fetchCreditTransactions(maxItems = 80): Promise<CreditTransactionRecord[]> {
  const txQuery = query(
    collection(db, CREDIT_TRANSACTIONS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(maxItems),
  );

  const snapshot = await getDocs(txQuery);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: asString(data.userId),
      workspaceId: asString(data.workspaceId) || null,
      type: mapCreditTransactionType(data.type),
      amount: asNumber(data.amount, 0),
      balanceBefore: asNumber(data.balanceBefore, 0),
      balanceAfter: asNumber(data.balanceAfter, 0),
      description: asString(data.description),
      source: asString(data.source, 'admin'),
      sourceRefId: asString(data.sourceRefId) || null,
      sourceRefType: asString(data.sourceRefType) || null,
      performedBy: asString(data.performedBy) || null,
      createdAt: asDate(data.createdAt),
    } satisfies CreditTransactionRecord;
  });
}

export async function fetchAuditLogs(maxItems = 80): Promise<AuditLogRecord[]> {
  const auditQuery = query(collection(db, AUDIT_LOGS_COLLECTION), orderBy('createdAt', 'desc'), limit(maxItems));
  const snapshot = await getDocs(auditQuery);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    const before = data.before;
    const after = data.after;

    return {
      id: docSnap.id,
      actorUid: asString(data.actorUid),
      actorRole: asString(data.actorRole, 'admin'),
      action: asString(data.action),
      entityType: asString(data.entityType, 'system') as AuditEntityType,
      entityId: asString(data.entityId),
      summary: asString(data.summary),
      before: before && typeof before === 'object' ? (before as Record<string, unknown>) : null,
      after: after && typeof after === 'object' ? (after as Record<string, unknown>) : null,
      createdAt: asDate(data.createdAt),
    } satisfies AuditLogRecord;
  });
}

export async function fetchOrders(maxItems = 80): Promise<OrderRecord[]> {
  const ordersQuery = query(collection(db, ORDERS_COLLECTION), orderBy('createdAt', 'desc'), limit(maxItems));
  const snapshot = await getDocs(ordersQuery);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: asString(data.userId),
      type: mapOrderType(data.type),
      status: mapOrderStatus(data.status),
      items: mapOrderItems(data.items),
      totalAmount: asNumber(data.totalAmount, 0),
      currency: asString(data.currency, 'TRY'),
      paymentProvider: asString(data.paymentProvider, 'manual') as 'iyzico' | 'manual' | 'none',
      paymentReference: asString(data.paymentReference),
      paymentVerified: asBoolean(data.paymentVerified, false),
      invoiceNo: asString(data.invoiceNo),
      notes: asString(data.notes),
      createdAt: asDate(data.createdAt),
      updatedAt: asDate(data.updatedAt),
    } satisfies OrderRecord;
  });
}

export async function fetchSubscriptions(maxItems = 80): Promise<SubscriptionRecord[]> {
  const subscriptionsQuery = query(
    collection(db, SUBSCRIPTIONS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(maxItems),
  );
  const snapshot = await getDocs(subscriptionsQuery);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: asString(data.userId),
      planId: asString(data.planId),
      status: mapSubscriptionStatus(data.status),
      startDate: asDate(data.startDate),
      endDate: asDate(data.endDate),
      renewalDate: asDate(data.renewalDate),
      paymentProvider: asString(data.paymentProvider, 'none') as 'iyzico' | 'manual' | 'none',
      paymentVerified: asBoolean(data.paymentVerified, false),
      orderId: asString(data.orderId),
      createdAt: asDate(data.createdAt),
      updatedAt: asDate(data.updatedAt),
    } satisfies SubscriptionRecord;
  });
}

export async function fetchLauncherReleases(maxItems = 80): Promise<LauncherReleaseRecord[]> {
  const releasesQuery = query(
    collection(db, LAUNCHER_RELEASES_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(maxItems),
  );
  const snapshot = await getDocs(releasesQuery);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      version: asString(data.version),
      buildDate: asString(data.buildDate),
      downloadUrl: asString(data.downloadUrl),
      downloadParts: mapReleaseParts(data.downloadParts),
      totalSize: asNumber(data.totalSize, 0),
      zipHash: asString(data.zipHash),
      executableName: asString(data.executableName),
      maintenanceMode: asBoolean(data.maintenanceMode, false),
      maintenanceMessage: asString(data.maintenanceMessage),
      patchNotes: asStringArray(data.patchNotes),
      channel: mapReleaseChannel(data.channel),
      isActive: asBoolean(data.isActive, false),
      createdBy: asString(data.createdBy),
      createdAt: asDate(data.createdAt),
      updatedAt: asDate(data.updatedAt),
    } satisfies LauncherReleaseRecord;
  });
}

export async function fetchMachines(maxItems = 120): Promise<MachineRecord[]> {
  const machinesQuery = query(collection(db, MACHINES_COLLECTION), orderBy('updatedAt', 'desc'), limit(maxItems));
  const snapshot = await getDocs(machinesQuery);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      machineId: asString(data.machineId, docSnap.id),
      hostname: asString(data.hostname),
      userId: asString(data.userId) || null,
      customerId: asString(data.customerId) || null,
      status: mapMachineStatus(data.status),
      appVersion: asString(data.appVersion),
      launcherVersion: asString(data.launcherVersion),
      lastSeenAt: asDate(data.lastSeenAt),
      notes: asString(data.notes),
      tags: asStringArray(data.tags),
      createdAt: asDate(data.createdAt),
      updatedAt: asDate(data.updatedAt),
    } satisfies MachineRecord;
  });
}

export async function fetchLauncherCommands(maxItems = 120): Promise<LauncherCommandRecord[]> {
  const commandsQuery = query(
    collection(db, LAUNCHER_COMMANDS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(maxItems),
  );
  const snapshot = await getDocs(commandsQuery);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      targetMachineId: asString(data.targetMachineId),
      commandType: mapLauncherCommandType(data.commandType),
      payload: asRecord(data.payload),
      status: mapLauncherCommandStatus(data.status),
      createdBy: asString(data.createdBy),
      processedByMachineId: asString(data.processedByMachineId),
      resultMessage: asString(data.resultMessage),
      createdAt: asDate(data.createdAt),
      processedAt: asDate(data.processedAt),
    } satisfies LauncherCommandRecord;
  });
}

export async function fetchLicenses(maxItems = 120): Promise<LicenseRecord[]> {
  const licensesQuery = query(collection(db, LICENSES_COLLECTION), orderBy('createdAt', 'desc'), limit(maxItems));
  const snapshot = await getDocs(licensesQuery);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: asString(data.userId) || null,
      workspaceId: asString(data.workspaceId) || null,
      productId: asString(data.productId) || null,
      machineId: asString(data.machineId) || null,
      type: mapLicenseType(data.type),
      status: mapLicenseStatus(data.status),
      validFrom: asDate(data.validFrom),
      validUntil: asDate(data.validUntil),
      maxMachines: asNumber(data.maxMachines, 1),
      assignedMachines: asStringArray(data.assignedMachines),
      createdAt: asDate(data.createdAt),
      updatedAt: asDate(data.updatedAt),
    } satisfies LicenseRecord;
  });
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    usersCount,
    productsCount,
    plansCount,
    packagesCount,
    txCount,
    auditCount,
    activeUsersCount,
    blockedUsersCount,
    archivedProductsCount,
    ordersCount,
    subscriptionsCount,
    launcherReleasesCount,
    machinesCount,
    launcherCommandsCount,
    licensesCount,
  ] = await Promise.all([
    getCountFromServer(collection(db, USERS_COLLECTION)),
    getCountFromServer(collection(db, PRODUCTS_COLLECTION)),
    getCountFromServer(collection(db, PLANS_COLLECTION)),
    getCountFromServer(collection(db, CREDIT_PACKAGES_COLLECTION)),
    getCountFromServer(collection(db, CREDIT_TRANSACTIONS_COLLECTION)),
    getCountFromServer(collection(db, AUDIT_LOGS_COLLECTION)),
    getCountFromServer(query(collection(db, USERS_COLLECTION), where('status', '==', 'active'))),
    getCountFromServer(query(collection(db, USERS_COLLECTION), where('status', '==', 'blocked'))),
    getCountFromServer(query(collection(db, PRODUCTS_COLLECTION), where('isArchived', '==', true))),
    getCountFromServer(collection(db, ORDERS_COLLECTION)),
    getCountFromServer(collection(db, SUBSCRIPTIONS_COLLECTION)),
    getCountFromServer(collection(db, LAUNCHER_RELEASES_COLLECTION)),
    getCountFromServer(collection(db, MACHINES_COLLECTION)),
    getCountFromServer(collection(db, LAUNCHER_COMMANDS_COLLECTION)),
    getCountFromServer(collection(db, LICENSES_COLLECTION)),
  ]);

  return {
    totalUsers: usersCount.data().count,
    totalProducts: productsCount.data().count,
    totalPlans: plansCount.data().count,
    totalCreditPackages: packagesCount.data().count,
    totalCreditTransactions: txCount.data().count,
    totalAuditLogs: auditCount.data().count,
    activeUsers: activeUsersCount.data().count,
    blockedUsers: blockedUsersCount.data().count,
    archivedProducts: archivedProductsCount.data().count,
    totalOrders: ordersCount.data().count,
    totalSubscriptions: subscriptionsCount.data().count,
    totalLauncherReleases: launcherReleasesCount.data().count,
    totalMachines: machinesCount.data().count,
    totalLauncherCommands: launcherCommandsCount.data().count,
    totalLicenses: licensesCount.data().count,
  };
}

export async function findUserByEmail(email: string): Promise<UserIdentity> {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) {
    throw new Error('E-posta alani bos birakilamaz.');
  }

  const usersQuery = query(collection(db, USERS_COLLECTION), where('email', '==', cleanEmail), limit(1));
  const userSnapshot = await getDocs(usersQuery);

  if (userSnapshot.empty) {
    throw new Error(`'${cleanEmail}' e-postasi ile kayitli kullanici bulunamadi.`);
  }

  const userDoc = userSnapshot.docs[0];
  const userData = userDoc.data();
  return {
    id: userDoc.id,
    email: asString(userData.email, cleanEmail),
    displayName: asString(userData.displayName, cleanEmail),
  };
}

export async function ensureAdminDocument(input: { uid: string; email: string | null }): Promise<boolean> {
  const uid = input.uid.trim();
  if (!uid) {
    return false;
  }

  const adminRef = doc(db, ADMINS_COLLECTION, uid);
  const adminSnap = await getDoc(adminRef);
  if (adminSnap.exists()) {
    return true;
  }

  await setDoc(adminRef, {
    email: normalizeEmail(input.email || ''),
    role: 'super_admin',
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}

export async function uploadVrProjectFiles(input: UploadVrProjectFilesInput): Promise<ProductFileRecord[]> {
  const cleanProjectId = input.projectId.trim();
  const cleanProjectTitle = input.projectTitle.trim();
  if (!cleanProjectId) {
    throw new Error('Proje kimligi bos olamaz.');
  }
  if (!cleanProjectTitle) {
    throw new Error('Proje basligi bos olamaz.');
  }

  const uploadResults: Array<ProductFileRecord | null> = new Array(input.files.length).fill(null);
  const failures: UploadFailureDetail[] = [];

  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index];
    input.onProgress(index, { progress: 0, status: 'uploading' });

    let r2Failure: Error | null = null;
    let isUploadedToR2 = false;

    try {
      if (shouldRouteToR2(file)) {
        const maxR2Attempts = file.size >= R2_LARGE_FILE_BYTES || isStrictR2File(file) ? R2_UPLOAD_RETRY_ATTEMPTS : 2;

        for (let attempt = 1; attempt <= maxR2Attempts; attempt += 1) {
          try {
            const uploadMeta = await requestR2UploadMeta({
              projectId: cleanProjectId,
              fileName: file.name,
              fileSize: file.size,
              contentType: file.type || 'application/octet-stream',
            });

            if (!uploadMeta.uploadUrl || !uploadMeta.objectKey) {
              throw new Error('R2 upload URL olusturulamadi.');
            }

            await uploadToSignedUrl(uploadMeta.uploadUrl, file, (progress) => {
              input.onProgress(index, { progress, status: 'uploading' });
            });

            const objectKey = uploadMeta.objectKey;
            const url = uploadMeta.pseudoUrl || `r2://${objectKey}`;

            uploadResults[index] = {
              name: file.name,
              url,
              size: file.size,
              path: null,
              storageProvider: 'r2',
              objectKey,
              contentType: file.type || uploadMeta.contentType || 'application/octet-stream',
            };

            input.onProgress(index, { progress: 100, status: 'completed', url });
            isUploadedToR2 = true;
            break;
          } catch (error) {
            r2Failure = mapR2UploadError(error, file.name);

            if (attempt >= maxR2Attempts) {
              break;
            }

            console.warn(
              `[R2] ${file.name} yukleme denemesi (${attempt}/${maxR2Attempts}) basarisiz. Tekrar denenecek.`,
              r2Failure,
            );
            input.onProgress(index, { progress: 0, status: 'uploading' });
            await wait(R2_UPLOAD_RETRY_BASE_DELAY_MS * attempt);
          }
        }

        if (isUploadedToR2) {
          continue;
        }

        if (isStrictR2File(file)) {
          throw r2Failure || new Error(`R2 yukleme basarisiz (${file.name}).`);
        }

        if (r2Failure) {
          console.warn('R2 yukleme basarisiz, Firebase Storage fallback kullaniliyor.', r2Failure);
        }
        input.onProgress(index, { progress: 0, status: 'uploading' });
      }

      const firebaseUploadResult = await uploadFileToFirebaseStorage(cleanProjectTitle, file, (progress) => {
        input.onProgress(index, { progress, status: 'uploading' });
      });

      uploadResults[index] = firebaseUploadResult;
      input.onProgress(index, {
        progress: 100,
        status: 'completed',
        url: firebaseUploadResult.url,
      });
    } catch (error) {
      const mappedError =
        r2Failure && !isStrictR2File(file)
          ? new Error(`${r2Failure.message} Firebase Storage fallback da basarisiz: ${getErrorMessage(error)}`)
          : error instanceof Error
            ? error
            : new Error('Dosya yukleme basarisiz.');

      input.onProgress(index, { progress: 0, status: 'error' });
      failures.push({
        fileName: file.name,
        message: getErrorMessage(mappedError) || 'Bilinmeyen hata.',
      });
      break;
    }
  }

  if (failures.length > 0) {
    const firstFailure = failures[0];
    if (failures.length === 1) {
      throw new Error(`${firstFailure.fileName}: ${firstFailure.message}`);
    }

    throw new Error(
      `${failures.length} dosya yuklenemedi. Ilk hata: ${firstFailure.fileName}: ${firstFailure.message}`,
    );
  }

  return uploadResults.filter((item): item is ProductFileRecord => item !== null);
}

export function createProductDraftId(): string {
  return doc(collection(db, PRODUCTS_COLLECTION)).id;
}

export async function createProductAndAssign(input: CreateProductInput): Promise<string> {
  const payload = {
    category: input.category || 'vr_project',
    title: input.title.trim(),
    mapName: input.mapName.trim(),
    vrMapName: (input.vrMapName || input.mapName).trim(),
    webShareMapName: (input.webShareMapName || input.mapName).trim(),
    chunkId: Number(input.chunkId || 0),
    files: input.files,
    assignedTo: input.assignedTo || null,
    isPublished: true,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const requestedId = input.id?.trim();
  let productId = requestedId || '';
  if (requestedId) {
    await setDoc(doc(db, PRODUCTS_COLLECTION, requestedId), payload);
  } else {
    const productDocRef = await addDoc(collection(db, PRODUCTS_COLLECTION), payload);
    productId = productDocRef.id;
  }

  if (payload.assignedTo) {
    const userRef = doc(db, USERS_COLLECTION, payload.assignedTo);
    await updateDoc(userRef, {
      owned_project_ids: arrayUnion(productId),
      updatedAt: serverTimestamp(),
    });
  }

  return productId;
}

export async function reassignProductOwner(
  productId: string,
  currentUserId: string | null,
  nextUserId: string,
): Promise<void> {
  if (currentUserId === nextUserId) {
    return;
  }

  const newOwnerRef = doc(db, USERS_COLLECTION, nextUserId);
  const newOwnerSnap = await getDoc(newOwnerRef);
  if (!newOwnerSnap.exists()) {
    throw new Error('Yeni kullanici bulunamadi.');
  }

  const batch = writeBatch(db);
  const productRef = doc(db, PRODUCTS_COLLECTION, productId);

  batch.update(productRef, {
    assignedTo: nextUserId,
    updatedAt: serverTimestamp(),
  });

  if (currentUserId) {
    const oldOwnerRef = doc(db, USERS_COLLECTION, currentUserId);
    const oldOwnerSnap = await getDoc(oldOwnerRef);
    if (oldOwnerSnap.exists()) {
      batch.update(oldOwnerRef, {
        owned_project_ids: arrayRemove(productId),
        updatedAt: serverTimestamp(),
      });
    }
  }

  batch.update(newOwnerRef, {
    owned_project_ids: arrayUnion(productId),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

async function removeStorageTree(baseRef: StorageRef): Promise<void> {
  const listResult = await listAll(baseRef);

  await Promise.all([
    ...listResult.items.map((itemRef: DeleteObjectRef) => deleteObject(itemRef)),
    ...listResult.prefixes.map((prefixRef: StorageRef) => removeStorageTree(prefixRef)),
  ]);
}

async function removeProductFiles(productId: string, files: ProductFileRecord[]): Promise<boolean> {
  if (!files.length) {
    return false;
  }

  let hasUnknownFirebasePath = false;

  await Promise.allSettled(
    files.map(async (file) => {
      const provider = getProductFileStorageProvider(file);
      if (provider === 'r2') {
        const objectKey = getProductFileObjectKey(file);
        if (!objectKey) {
          return;
        }

        await deleteR2ObjectWithFallback({
          projectId: productId,
          objectKey,
        });
        return;
      }

      const storagePath = getFirebaseStoragePath(file);
      if (!storagePath) {
        hasUnknownFirebasePath = true;
        return;
      }

      await deleteObject(ref(storage, storagePath));
    }),
  );

  return hasUnknownFirebasePath;
}

export async function deleteProductWithAssets(input: {
  productId: string;
  projectTitle: string;
  assignedTo?: string | null;
  files?: ProductFileRecord[];
}): Promise<void> {
  if (input.assignedTo) {
    const userRef = doc(db, USERS_COLLECTION, input.assignedTo);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        owned_project_ids: arrayRemove(input.productId),
        updatedAt: serverTimestamp(),
      });
    }
  }

  await deleteDoc(doc(db, PRODUCTS_COLLECTION, input.productId));

  const hasUnknownFirebasePath = await removeProductFiles(input.productId, input.files || []);

  const cleanTitle = input.projectTitle.trim();
  if (!cleanTitle || (!hasUnknownFirebasePath && (input.files || []).length > 0)) {
    return;
  }

  try {
    const rootRef = ref(storage, `projects/${cleanTitle}`);
    await removeStorageTree(rootRef);
  } catch {
    // Storage klasoru yoksa veya silinemiyorsa urun silme yine de devam etsin.
  }
}

export async function updateUserPlanAndStatus(input: {
  userId: string;
  plan?: string;
  status?: UserStatus;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof input.plan === 'string' && input.plan.trim()) {
    payload.plan = input.plan.trim();
  }

  if (input.status) {
    payload.status = input.status;
  }

  await updateDoc(doc(db, USERS_COLLECTION, input.userId), payload);
}

export async function adjustUserCredits(input: CreditAdjustmentInput): Promise<CreditAdjustmentResult> {
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    throw new Error('Delta degeri 0 olamaz.');
  }

  return runTransaction(db, async (transaction) => {
    const userRef = doc(db, USERS_COLLECTION, input.userId);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists()) {
      throw new Error('Kullanici bulunamadi.');
    }

    const data = userSnap.data();
    const currentCredits = asNumber(data.credits, 0);
    const currentEarned = asNumber(data.totalEarned, 0);
    const currentSpent = asNumber(data.totalSpent, 0);
    const nextCredits = currentCredits + input.delta;

    if (nextCredits < 0) {
      throw new Error(`Yetersiz bakiye. Mevcut: ${currentCredits}`);
    }

    const nextEarned = input.delta > 0 ? currentEarned + input.delta : currentEarned;
    const nextSpent = input.delta < 0 ? currentSpent + Math.abs(input.delta) : currentSpent;

    transaction.update(userRef, {
      credits: nextCredits,
      totalEarned: nextEarned,
      totalSpent: nextSpent,
      updatedAt: serverTimestamp(),
    });

    return {
      balanceBefore: currentCredits,
      balanceAfter: nextCredits,
      totalEarned: nextEarned,
      totalSpent: nextSpent,
    };
  });
}

export async function addCreditTransaction(input: CreditTransactionInput): Promise<string> {
  const refDoc = await addDoc(collection(db, CREDIT_TRANSACTIONS_COLLECTION), {
    userId: input.userId,
    workspaceId: input.workspaceId || null,
    type: input.type,
    amount: input.amount,
    balanceBefore: input.balanceBefore,
    balanceAfter: input.balanceAfter,
    description: input.description.trim(),
    source: input.source,
    sourceRefId: input.sourceRefId || null,
    sourceRefType: input.sourceRefType || null,
    performedBy: input.performedBy || null,
    createdAt: serverTimestamp(),
  });

  return refDoc.id;
}

export async function addAuditLog(input: AuditLogInput): Promise<string> {
  const refDoc = await addDoc(collection(db, AUDIT_LOGS_COLLECTION), {
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    before: input.before || null,
    after: input.after || null,
    createdAt: serverTimestamp(),
  });

  return refDoc.id;
}

export async function upsertOrder(input: OrderInput): Promise<string> {
  const normalizedItems = input.items.map((item) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Number(item.unitPrice || 0);
    const totalPrice = Number(item.totalPrice || quantity * unitPrice);
    return {
      itemType: item.itemType.trim(),
      itemId: item.itemId.trim(),
      title: item.title.trim(),
      quantity,
      unitPrice,
      totalPrice,
    };
  });

  const payload = {
    userId: input.userId,
    type: input.type,
    status: input.status,
    items: normalizedItems,
    totalAmount: Number(input.totalAmount),
    currency: input.currency.trim() || 'TRY',
    paymentProvider: input.paymentProvider,
    paymentReference: input.paymentReference.trim(),
    paymentVerified: input.paymentVerified,
    invoiceNo: input.invoiceNo.trim(),
    notes: input.notes.trim(),
    updatedAt: serverTimestamp(),
  };

  if (input.id) {
    await updateDoc(doc(db, ORDERS_COLLECTION, input.id), payload);
    return input.id;
  }

  const refDoc = await addDoc(collection(db, ORDERS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return refDoc.id;
}

export async function upsertSubscription(input: SubscriptionInput): Promise<string> {
  const payload = {
    userId: input.userId,
    planId: input.planId.trim(),
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    renewalDate: input.renewalDate,
    paymentProvider: input.paymentProvider,
    paymentVerified: input.paymentVerified,
    orderId: input.orderId.trim(),
    updatedAt: serverTimestamp(),
  };

  if (input.id) {
    await updateDoc(doc(db, SUBSCRIPTIONS_COLLECTION, input.id), payload);
    return input.id;
  }

  const refDoc = await addDoc(collection(db, SUBSCRIPTIONS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return refDoc.id;
}

export async function upsertLauncherRelease(input: LauncherReleaseInput): Promise<string> {
  const payload = {
    version: input.version.trim(),
    buildDate: input.buildDate.trim(),
    downloadUrl: input.downloadUrl.trim(),
    downloadParts: input.downloadParts.map((part) => ({
      url: part.url.trim(),
      size: Number(part.size || 0),
    })),
    totalSize: Number(input.totalSize || 0),
    zipHash: input.zipHash.trim(),
    executableName: input.executableName.trim(),
    maintenanceMode: input.maintenanceMode,
    maintenanceMessage: input.maintenanceMessage.trim(),
    patchNotes: input.patchNotes.map((note) => note.trim()).filter((note) => note.length > 0),
    channel: input.channel,
    isActive: input.isActive,
    createdBy: input.createdBy.trim(),
    updatedAt: serverTimestamp(),
  };

  let releaseId = input.id;

  if (releaseId) {
    await updateDoc(doc(db, LAUNCHER_RELEASES_COLLECTION, releaseId), payload);
  } else {
    const refDoc = await addDoc(collection(db, LAUNCHER_RELEASES_COLLECTION), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    releaseId = refDoc.id;
  }

  if (payload.isActive) {
    const activeReleasesQuery = query(
      collection(db, LAUNCHER_RELEASES_COLLECTION),
      where('channel', '==', payload.channel),
      where('isActive', '==', true),
    );
    const activeSnapshot = await getDocs(activeReleasesQuery);
    const batch = writeBatch(db);

    activeSnapshot.docs.forEach((docSnap) => {
      if (docSnap.id === releaseId) {
        return;
      }

      batch.update(doc(db, LAUNCHER_RELEASES_COLLECTION, docSnap.id), {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }

  return releaseId;
}

export async function upsertMachine(input: MachineInput): Promise<string> {
  const payload = {
    machineId: input.machineId.trim(),
    hostname: input.hostname.trim(),
    userId: input.userId || null,
    customerId: input.customerId || null,
    status: input.status,
    appVersion: input.appVersion.trim(),
    launcherVersion: input.launcherVersion.trim(),
    lastSeenAt: input.lastSeenAt,
    notes: input.notes.trim(),
    tags: input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0),
    updatedAt: serverTimestamp(),
  };

  if (input.id) {
    await updateDoc(doc(db, MACHINES_COLLECTION, input.id), payload);
    return input.id;
  }

  const refDoc = await addDoc(collection(db, MACHINES_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return refDoc.id;
}

export async function upsertLauncherCommand(input: LauncherCommandInput): Promise<string> {
  const payload = {
    targetMachineId: input.targetMachineId.trim(),
    commandType: input.commandType,
    payload: input.payload || null,
    status: input.status,
    createdBy: input.createdBy.trim(),
    processedByMachineId: input.processedByMachineId?.trim() || '',
    resultMessage: input.resultMessage?.trim() || '',
    processedAt: input.processedAt || null,
    updatedAt: serverTimestamp(),
  };

  if (input.id) {
    await updateDoc(doc(db, LAUNCHER_COMMANDS_COLLECTION, input.id), payload);
    return input.id;
  }

  const refDoc = await addDoc(collection(db, LAUNCHER_COMMANDS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return refDoc.id;
}

export async function upsertLicense(input: LicenseInput): Promise<string> {
  const payload = {
    userId: input.userId || null,
    workspaceId: input.workspaceId || null,
    productId: input.productId || null,
    machineId: input.machineId || null,
    type: input.type,
    status: input.status,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    maxMachines: Math.max(1, Number(input.maxMachines || 1)),
    assignedMachines: input.assignedMachines.map((item) => item.trim()).filter((item) => item.length > 0),
    updatedAt: serverTimestamp(),
  };

  if (input.id) {
    await updateDoc(doc(db, LICENSES_COLLECTION, input.id), payload);
    return input.id;
  }

  const refDoc = await addDoc(collection(db, LICENSES_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return refDoc.id;
}

export async function upsertPlan(input: PlanInput): Promise<string> {
  const payload = {
    code: input.code.trim(),
    name: input.name.trim(),
    billingPeriod: input.billingPeriod,
    price: Number(input.price),
    currency: input.currency.trim() || 'TRY',
    monthlyCredits: Number(input.monthlyCredits),
    storageLimitGb: Number(input.storageLimitGb),
    projectLimit: Number(input.projectLimit),
    workspaceMemberLimit: Number(input.workspaceMemberLimit),
    launcherAccess: input.launcherAccess,
    vrAccess: input.vrAccess,
    aiAccess: input.aiAccess,
    features: input.features,
    isActive: input.isActive,
    sortOrder: Number(input.sortOrder),
    updatedAt: serverTimestamp(),
  };

  if (input.id) {
    await updateDoc(doc(db, PLANS_COLLECTION, input.id), payload);
    return input.id;
  }

  const refDoc = await addDoc(collection(db, PLANS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return refDoc.id;
}

export async function seedBaseCommerceData(): Promise<SeedCommerceDataResult> {
  const batch = writeBatch(db);
  let plansCreated = 0;
  let creditPackagesCreated = 0;

  for (const plan of DEFAULT_PLAN_SEEDS) {
    const planId = plan.id || plan.code;
    const planRef = doc(db, PLANS_COLLECTION, planId);
    const snapshot = await getDoc(planRef);

    if (!snapshot.exists()) {
      batch.set(planRef, {
        code: plan.code.trim(),
        name: plan.name.trim(),
        billingPeriod: plan.billingPeriod,
        price: Number(plan.price),
        currency: plan.currency.trim() || 'TRY',
        monthlyCredits: Number(plan.monthlyCredits),
        storageLimitGb: Number(plan.storageLimitGb),
        projectLimit: Number(plan.projectLimit),
        workspaceMemberLimit: Number(plan.workspaceMemberLimit),
        launcherAccess: plan.launcherAccess,
        vrAccess: plan.vrAccess,
        aiAccess: plan.aiAccess,
        features: plan.features,
        isActive: plan.isActive,
        sortOrder: Number(plan.sortOrder),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      plansCreated += 1;
    }
  }

  for (const creditPackage of DEFAULT_CREDIT_PACKAGE_SEEDS) {
    const packageId = creditPackage.id || creditPackage.name.toLowerCase().replace(/\s+/g, '_');
    const packageRef = doc(db, CREDIT_PACKAGES_COLLECTION, packageId);
    const snapshot = await getDoc(packageRef);

    if (!snapshot.exists()) {
      batch.set(packageRef, {
        name: creditPackage.name.trim(),
        credits: Number(creditPackage.credits),
        price: Number(creditPackage.price),
        currency: creditPackage.currency.trim() || 'TRY',
        description: creditPackage.description.trim(),
        badge: creditPackage.badge.trim(),
        isPopular: creditPackage.isPopular,
        isActive: creditPackage.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      creditPackagesCreated += 1;
    }
  }

  if (plansCreated > 0 || creditPackagesCreated > 0) {
    await batch.commit();
  }

  return { plansCreated, creditPackagesCreated };
}

export async function upsertCreditPackage(input: CreditPackageInput): Promise<string> {
  const payload = {
    name: input.name.trim(),
    credits: Number(input.credits),
    price: Number(input.price),
    currency: input.currency.trim() || 'TRY',
    description: input.description.trim(),
    badge: input.badge.trim(),
    isPopular: input.isPopular,
    isActive: input.isActive,
    updatedAt: serverTimestamp(),
  };

  if (input.id) {
    await updateDoc(doc(db, CREDIT_PACKAGES_COLLECTION, input.id), payload);
    return input.id;
  }

  const refDoc = await addDoc(collection(db, CREDIT_PACKAGES_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return refDoc.id;
}
