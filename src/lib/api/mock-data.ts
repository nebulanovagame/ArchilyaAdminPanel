/**
 * Mock data layer for AdminPanel development.
 *
 * ⚠️ All data returned here is fake and clearly marked as "mock".
 * When the backend Admin API is ready, update admin-client.ts
 * to call real endpoints instead of using these fixtures.
 *
 * Mock data is used when NEXT_PUBLIC_ADMIN_API_BASE_URL is not set
 * or when the backend is unavailable.
 */

import type {
  AdminUser,
  DashboardStats,
  UserRecord,
  WorkspaceRecord,
  ProjectRecord,
  CreditRecord,
  SubscriptionRecord,
  RenderJobRecord,
  AuditLogEntry,
  LegacyProduct,
  LegacyPlan,
  LegacyOrder,
  LegacyLicense,
  LegacyMachine,
  LauncherRelease,
} from "./types";

export const MOCK_ADMIN_USER: AdminUser = {
  uid: "admin-mock-001",
  email: "admin@archilya.com",
  role: "superadmin",
  displayName: "Admin Kullanıcı",
  avatarUrl: null,
  createdAt: "2024-01-01T00:00:00Z",
  lastSignInAt: new Date().toISOString(),
};

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalUsers: 1247,
  activeWorkspaces: 89,
  totalCreditUsage: 456_000,
  activeSubscriptions: 234,
  pendingRenderJobs: 12,
  systemStatus: "healthy",
};

export const MOCK_USERS: UserRecord[] = Array.from({ length: 25 }, (_, i) => ({
  id: `user-${i + 1}`,
  email: `kullanici${i + 1}@ornek.com`,
  displayName: i === 0 ? null : `Kullanıcı ${i + 1}`,
  avatarUrl: null,
  role: i < 3 ? "admin" : "user",
  status: i === 5 ? "suspended" : i === 8 ? "disabled" : "active",
  createdAt: new Date(Date.now() - (i * 86400000)).toISOString(),
  lastSignInAt: i % 3 === 0 ? null : new Date(Date.now() - (i * 3600000)).toISOString(),
  workspaceCount: Math.floor(Math.random() * 5),
  totalCreditsUsed: Math.floor(Math.random() * 100000),
})) as UserRecord[];

export const MOCK_WORKSPACES: WorkspaceRecord[] = Array.from({ length: 15 }, (_, i) => ({
  id: `ws-${i + 1}`,
  name: `Çalışma Alanı ${i + 1}`,
  ownerEmail: `kullanici${i + 1}@ornek.com`,
  projectCount: Math.floor(Math.random() * 20),
  memberCount: Math.floor(Math.random() * 10) + 1,
  storageUsed: Math.floor(Math.random() * 5000),
  status: i === 7 ? "archived" : i === 12 ? "suspended" : "active",
  createdAt: new Date(Date.now() - (i * 86400000 * 2)).toISOString(),
})) as WorkspaceRecord[];

export const MOCK_PROJECTS: ProjectRecord[] = Array.from({ length: 30 }, (_, i) => ({
  id: `proj-${i + 1}`,
  name: `Proje ${i + 1}`,
  workspaceId: `ws-${(i % 15) + 1}`,
  ownerEmail: `kullanici${(i % 25) + 1}@ornek.com`,
  status: ["Aktif", "Tamamlandı", "Taslak", "İncelemede"][i % 4],
  fileCount: Math.floor(Math.random() * 50),
  totalSize: Math.floor(Math.random() * 10000),
  createdAt: new Date(Date.now() - (i * 86400000 * 3)).toISOString(),
  updatedAt: new Date(Date.now() - (i * 3600000)).toISOString(),
})) as ProjectRecord[];

export const MOCK_CREDITS: CreditRecord[] = Array.from({ length: 20 }, (_, i) => ({
  id: `cred-${i + 1}`,
  userEmail: `kullanici${(i % 25) + 1}@ornek.com`,
  amount: i % 3 === 0 ? 10000 : i % 3 === 1 ? -500 : 25000,
  type: i % 3 === 0 ? "grant" : i % 3 === 1 ? "usage" : "purchase",
  description: ["Hediye kredi", "AI işleme ücreti", "Kredi paketi satın alımı"][i % 3],
  createdAt: new Date(Date.now() - (i * 86400000)).toISOString(),
})) as CreditRecord[];

export const MOCK_SUBSCRIPTIONS: SubscriptionRecord[] = Array.from({ length: 15 }, (_, i) => ({
  id: `sub-${i + 1}`,
  userEmail: `kullanici${i + 1}@ornek.com`,
  planName: ["Starter", "Professional", "Enterprise"][i % 3],
  status: i === 3 ? "canceled" : i === 7 ? "past_due" : "active",
  currentPeriodStart: new Date(Date.now() - 86400000 * 30).toISOString(),
  currentPeriodEnd: new Date(Date.now() + 86400000 * (i % 30)).toISOString(),
  amount: [299, 799, 2499][i % 3],
  currency: "TRY",
})) as SubscriptionRecord[];

export const MOCK_RENDER_JOBS: RenderJobRecord[] = Array.from({ length: 20 }, (_, i) => ({
  id: `job-${i + 1}`,
  type: i % 4 === 0 ? "ai" : "render",
  status: i < 3 ? "processing" : i < 6 ? "queued" : i < 10 ? "completed" : "failed",
  userEmail: `kullanici${(i % 25) + 1}@ornek.com`,
  projectName: `Proje ${(i % 10) + 1}`,
  progress: i < 3 ? Math.floor(Math.random() * 80) + 10 : 100,
  createdAt: new Date(Date.now() - (i * 3600000)).toISOString(),
  completedAt: i >= 10 ? new Date(Date.now() - (i * 3600000) + 1800000).toISOString() : null,
})) as RenderJobRecord[];

export const MOCK_AUDIT_LOGS: AuditLogEntry[] = Array.from({ length: 40 }, (_, i) => ({
  id: `log-${i + 1}`,
  actorEmail: "admin@archilya.com",
  action: ["user.login", "user.create", "workspace.delete", "credits.grant", "settings.update"][i % 5],
  resource: ["user", "workspace", "project", "subscription", "system"][i % 5],
  resourceId: `res-${i + 1}`,
  details: i % 2 === 0 ? null : `Detaylı işlem bilgisi #${i + 1}`,
  ipAddress: `192.168.1.${(i % 254) + 1}`,
  createdAt: new Date(Date.now() - (i * 3600000)).toISOString(),
})) as AuditLogEntry[];

export const MOCK_LEGACY_PRODUCTS: LegacyProduct[] = Array.from({ length: 10 }, (_, i) => ({
  id: `prod-${i + 1}`,
  name: `Ürün ${i + 1}`,
  description: `${i + 1}. ürün açıklaması`,
  price: [99, 199, 499, 999, 1499][i % 5],
  currency: "TRY",
  active: i !== 8,
  createdAt: new Date(Date.now() - (i * 86400000 * 7)).toISOString(),
})) as LegacyProduct[];

export const MOCK_LEGACY_PLANS: LegacyPlan[] = [
  {
    id: "plan-1",
    name: "Başlangıç",
    description: "Temel özellikler",
    price: 299,
    currency: "TRY",
    interval: "month",
    active: true,
    features: ["5 proje", "1 GB depolama", "Temel AI desteği"],
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "plan-2",
    name: "Profesyonel",
    description: "İleri düzey özellikler",
    price: 799,
    currency: "TRY",
    interval: "month",
    active: true,
    features: ["Sınırsız proje", "10 GB depolama", "Öncelikli AI", "Takım çalışması"],
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "plan-3",
    name: "Kurumsal",
    description: "Tam kapsamlı çözüm",
    price: 2499,
    currency: "TRY",
    interval: "month",
    active: true,
    features: ["Sınırsız her şey", "Özel depolama", "API erişimi", "7/24 destek", "SLA"],
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "plan-4",
    name: "Eski Yıllık",
    description: "Eski plan - artık satışta değil",
    price: 5999,
    currency: "TRY",
    interval: "year",
    active: false,
    features: ["Sınırsız proje", "5 GB depolama"],
    createdAt: "2023-06-01T00:00:00Z",
  },
];

export const MOCK_LEGACY_ORDERS: LegacyOrder[] = Array.from({ length: 20 }, (_, i) => ({
  id: `ord-${i + 1}`,
  userEmail: `kullanici${(i % 25) + 1}@ornek.com`,
  productName: `Ürün ${(i % 10) + 1}`,
  amount: [99, 199, 499, 999][i % 4],
  currency: "TRY",
  status: i === 2 ? "refunded" : i === 5 ? "failed" : "completed",
  createdAt: new Date(Date.now() - (i * 86400000 * 2)).toISOString(),
})) as LegacyOrder[];

export const MOCK_LEGACY_LICENSES: LegacyLicense[] = Array.from({ length: 15 }, (_, i) => ({
  id: `lic-${i + 1}`,
  userEmail: `kullanici${i + 1}@ornek.com`,
  licenseKey: `ARCHLYA-${String(i + 1).padStart(4, "0")}-${Array.from({ length: 4 }, () => Math.random().toString(36).substring(2, 6).toUpperCase()).join("-")}`,
  productName: `Ürün ${(i % 10) + 1}`,
  status: i === 3 ? "expired" : i === 7 ? "revoked" : "active",
  expiresAt: i % 2 === 0 ? new Date(Date.now() + 86400000 * 365).toISOString() : null,
  createdAt: new Date(Date.now() - (i * 86400000 * 30)).toISOString(),
})) as LegacyLicense[];

export const MOCK_LEGACY_MACHINES: LegacyMachine[] = Array.from({ length: 8 }, (_, i) => ({
  id: `mac-${i + 1}`,
  name: `Render Makinesi ${i + 1}`,
  ipAddress: `10.0.0.${i + 1}`,
  status: i === 2 ? "offline" : i === 5 ? "maintenance" : "online",
  lastHeartbeat: i === 2 ? null : new Date(Date.now() - (i * 60000)).toISOString(),
  createdAt: new Date(Date.now() - (i * 86400000 * 30)).toISOString(),
})) as LegacyMachine[];

export const MOCK_LAUNCHER_RELEASES: LauncherRelease[] = [
  { id: "rel-1", version: "2.5.0", platform: "windows", url: "#", size: 256_000_000, published: true, createdAt: "2024-12-01T00:00:00Z" },
  { id: "rel-2", version: "2.5.0", platform: "mac", url: "#", size: 264_000_000, published: true, createdAt: "2024-12-01T00:00:00Z" },
  { id: "rel-3", version: "2.4.0", platform: "windows", url: "#", size: 250_000_000, published: true, createdAt: "2024-11-15T00:00:00Z" },
  { id: "rel-4", version: "2.4.0", platform: "linux", url: "#", size: 258_000_000, published: false, createdAt: "2024-11-14T00:00:00Z" },
  { id: "rel-5", version: "2.3.0", platform: "windows", url: "#", size: 245_000_000, published: true, createdAt: "2024-10-20T00:00:00Z" },
];

export function delay(ms: number = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
