// ─── Admin API Types ───────────────────────────────────
// These types define the shape of data the AdminPanel works with.
// They are designed to match the expected backend Admin API response format.
// When the backend is ready, only the admin-client.ts needs updating.

export type AdminUser = {
  uid: string;
  email: string;
  role: "admin" | "superadmin";
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

export type DashboardStats = {
  totalUsers: number;
  activeWorkspaces: number;
  totalCreditUsage: number;
  activeSubscriptions: number;
  pendingRenderJobs: number;
  systemStatus: "healthy" | "degraded" | "down";
};

export type UserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  status: "active" | "disabled" | "suspended";
  createdAt: string;
  lastSignInAt: string | null;
  workspaceCount: number;
  totalCreditsUsed: number;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  ownerEmail: string;
  projectCount: number;
  memberCount: number;
  storageUsed: number;
  status: "active" | "archived" | "suspended";
  createdAt: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  workspaceId: string;
  ownerEmail: string;
  status: string;
  fileCount: number;
  totalSize: number;
  createdAt: string;
  updatedAt: string;
};

export type CreditRecord = {
  id: string;
  userEmail: string;
  amount: number;
  type: "grant" | "usage" | "refund" | "purchase";
  description: string;
  createdAt: string;
};

export type SubscriptionRecord = {
  id: string;
  userEmail: string;
  planName: string;
  status: "active" | "canceled" | "past_due" | "trialing";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  amount: number;
  currency: string;
};

export type RenderJobRecord = {
  id: string;
  type: "render" | "ai";
  status: string;
  userEmail: string;
  projectName: string;
  progress: number;
  createdAt: string;
  completedAt: string | null;
};

export type AuditLogEntry = {
  id: string;
  actorEmail: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export type LegacyProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  active: boolean;
  createdAt: string;
};

export type LegacyPlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  active: boolean;
  features: string[];
  createdAt: string;
};

export type LegacyOrder = {
  id: string;
  userEmail: string;
  productName: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export type LegacyLicense = {
  id: string;
  userEmail: string;
  licenseKey: string;
  productName: string;
  status: "active" | "expired" | "revoked";
  expiresAt: string | null;
  createdAt: string;
};

export type LegacyMachine = {
  id: string;
  name: string;
  ipAddress: string;
  status: "online" | "offline" | "maintenance";
  lastHeartbeat: string | null;
  createdAt: string;
};

export type LauncherRelease = {
  id: string;
  version: string;
  platform: "windows" | "mac" | "linux";
  url: string;
  size: number;
  published: boolean;
  createdAt: string;
};

// ─── Generic API Response ──────────────────────────────
export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  mock: boolean;
};
